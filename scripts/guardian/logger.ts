/// <reference lib="deno.unstable" />
/// <reference lib="deno.ns" />
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { LogEntry, MetricEntry, RequestMetric, SessionStats } from "./types.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const LOG_DIR = "logs";
const MAX_LOGS = 2000;
let kv: Deno.Kv | null = null;
let currentSessionId = crypto.randomUUID();

const logClients = new Set<ReadableStreamDefaultController>();

export function registerLogClient(controller: ReadableStreamDefaultController) {
    logClients.add(controller);
}

export function removeLogClient(controller: ReadableStreamDefaultController) {
    logClients.delete(controller);
}

function broadcastLog(data: any) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    const encoded = new TextEncoder().encode(msg);
    for (const client of logClients) {
        try {
            client.enqueue(encoded);
        } catch (e) {
            logClients.delete(client);
        }
    }
}

export async function initLogger() {
    try {
        await Deno.mkdir(LOG_DIR, { recursive: true });
        kv = await Deno.openKv("./greens.db");
    } catch (e) {
        console.error("Failed to init logger:", e);
    }
}

export function getKv() {
    return kv;
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

export async function persistLog(entry: LogEntry) {
    if (!kv) return;

    // 1. KV Persistence (7 days retention)
    try {
        await kv.set(
            ["guardian", "logs", currentSessionId, entry.service, entry.timestamp, entry.id],
            entry,
            { expireIn: 7 * 24 * 60 * 60 * 1000 }
        );
    } catch (e) {
        // Silent fail
    }

    // 2. File Persistence
    try {
        const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : "";
        const line = `[${entry.timestamp}] [${entry.service.toUpperCase()}:${entry.source.toUpperCase()}] ${entry.message}${meta}\n`;
        const fileName = `${getTodayStr()}_${entry.service}.log`;
        const filePath = join(LOG_DIR, fileName);
        await Deno.writeTextFile(filePath, line, { append: true });
    } catch (e) {
        // Silent fail
    }

    // 3. Broadcast
    broadcastLog({ type: 'log', ...entry });
}

export async function saveMetric(serviceName: string, cpu: number, memory: number) {
    if (!kv) return;
    const now = Date.now();
    try {
        const metric: MetricEntry = { timestamp: now, cpu, memory };
        // 90 days retention for metrics
        await kv.set(
            ["guardian", "metrics", serviceName, now],
            metric,
            { expireIn: 90 * 24 * 60 * 60 * 1000 }
        );
    } catch (e) { /* ignore */ }
}

export async function saveRequestMetric(metric: RequestMetric) {
    if (!kv) return;
    // Store individual request for deep analysis (7 days retention)
    try {
        await kv.set(
            ["guardian", "requests", metric.timestamp, crypto.randomUUID()],
            metric,
            { expireIn: 7 * 24 * 60 * 60 * 1000 }
        );

        // Update aggregations (Daily stats)
        const date = new Date(metric.timestamp).toISOString().split('T')[0];
        const atomic = kv.atomic();

        // 1. Total Requests
        atomic.mutate({
            type: "sum",
            key: ["guardian", "stats", date, "total_requests"],
            value: new Deno.KvU64(1n)
        });

        // 2. IP Tracking
        atomic.mutate({
            type: "sum",
            key: ["guardian", "stats", date, "ip", metric.ip],
            value: new Deno.KvU64(1n)
        });

        // 3. Endpoint Discovery
        atomic.mutate({
            type: "sum",
            key: ["guardian", "stats", date, "endpoint", metric.path],
            value: new Deno.KvU64(1n)
        });

        // 4. Service Breakdown
        atomic.mutate({
            type: "sum",
            key: ["guardian", "stats", date, "service", metric.targetService],
            value: new Deno.KvU64(1n)
        });

        // 5. Resource Type Breakdown
        atomic.mutate({
            type: "sum",
            key: ["guardian", "stats", date, "type", metric.resourceType],
            value: new Deno.KvU64(1n)
        });

        // 6. Session Management
        await updateSession(metric, date);

        await atomic.commit();

        // Broadcast Request Log
        broadcastLog({ type: 'request', ...metric });

    } catch (e) { /* ignore */ }
}

async function updateSession(metric: RequestMetric, date: string) {
    if (!kv) return;
    // Session Key: ["guardian", "sessions", date, sessionId]
    const key = ["guardian", "sessions", date, metric.sessionId];

    // We need to fetch existing session to update it, or create new.
    // Optimistic locking via check() could be used, but for high throughput logging
    // we might just accept last-write-wins for metadata, or use atomic for counters.
    // Since we need to append paths, we have to read-modify-write.

    try {
        const res = await kv.get<SessionStats>(key);
        let session: SessionStats;

        if (res.value) {
            session = res.value;
            session.lastSeen = metric.timestamp;
            session.requestCount++;
            // Keep last 10 paths
            session.paths.push(metric.path);
            if (session.paths.length > 10) session.paths.shift();
        } else {
            session = {
                id: metric.sessionId,
                ip: metric.ip,
                userAgent: metric.userAgent || "unknown",
                firstSeen: metric.timestamp,
                lastSeen: metric.timestamp,
                requestCount: 1,
                paths: [metric.path]
            };
        }

        await kv.set(key, session, { expireIn: 24 * 60 * 60 * 1000 }); // 24h retention for session objects
    } catch (e) {
        // ignore
    }
}


export async function updateServiceStat(serviceName: string, type: string, count: number = 1) {
    if (!kv) return;
    const date = getTodayStr();
    try {
        await kv.atomic()
            .mutate({
                type: "sum",
                key: ["guardian", "stats", date, serviceName, type],
                value: new Deno.KvU64(BigInt(count))
            })
            .commit();
    } catch (e) { /* ignore */ }
}

export function determineResourceType(path: string, mimeType?: string): string {
    if (path.startsWith("/api")) return "api";
    const ext = path.split('.').pop()?.toLowerCase();

    if (!ext || path === "/" || !path.includes('.')) return "document";

    switch (ext) {
        case "js":
        case "mjs":
        case "ts":
        case "map":
            return "script";
        case "css":
        case "less":
        case "scss":
            return "style";
        case "png":
        case "jpg":
        case "jpeg":
        case "gif":
        case "svg":
        case "webp":
        case "ico":
            return "image";
        case "json":
        case "xml":
            return "api";
        case "woff":
        case "woff2":
        case "ttf":
            return "font";
        default:
            return "other";
    }
}

export async function generateSessionId(ip: string, userAgent: string): Promise<string> {
    const data = new TextEncoder().encode(ip + userAgent + getTodayStr());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return encodeHex(hashBuffer).slice(0, 12);
}
