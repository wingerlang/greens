import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { LogEntry, MetricEntry, RequestMetric } from "./types.ts";

const LOG_DIR = "logs";
const MAX_LOGS = 2000;
let kv: Deno.Kv | null = null;
let currentSessionId = crypto.randomUUID();

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
    // Store individual request for deep analysis (24h retention for raw requests to save space?)
    // Or 7 days? User wants "ALLT". Let's go with 7 days but be mindful of space.
    // KV is efficient.
    try {
        await kv.set(
            ["guardian", "requests", metric.timestamp, crypto.randomUUID()],
            metric,
            { expireIn: 7 * 24 * 60 * 60 * 1000 }
        );

        // Update aggregations (Daily stats)
        const date = new Date(metric.timestamp).toISOString().split('T')[0];

        // Total Requests
        await kv.atomic()
            .mutate({
                type: "sum",
                key: ["guardian", "stats", date, "total_requests"],
                value: new Deno.KvU64(1n)
            })
            .commit();

        // IP Tracking (for unique visitors / DDoS check)
        // We just log the IP hit count for the day
         await kv.atomic()
            .mutate({
                type: "sum",
                key: ["guardian", "stats", date, "ip", metric.ip],
                value: new Deno.KvU64(1n)
            })
            // Endpoint Discovery (Aggregate Hit Count)
            .mutate({
                type: "sum",
                key: ["guardian", "stats", date, "endpoint", metric.path],
                value: new Deno.KvU64(1n)
            })
            .commit();

    } catch (e) { /* ignore */ }
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
