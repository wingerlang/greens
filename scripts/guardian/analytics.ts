import { getKv } from "./logger.ts";
import { SessionStats } from "./types.ts";

export async function getTopEndpoints(limit = 10) {
    const kv = getKv();
    if (!kv) return [];

    const date = new Date().toISOString().split('T')[0];
    const iter = kv.list<Deno.KvU64>({ prefix: ["guardian", "stats", date, "endpoint"] });
    const stats = [];

    for await (const res of iter) {
        stats.push({
            path: String(res.key[4]),
            count: Number(res.value.value)
        });
    }

    return stats.sort((a, b) => b.count - a.count).slice(0, limit);
}

export async function getTopEndpointsHistory(days = 7, limit = 10) {
    const kv = getKv();
    if (!kv) return [];

    const endpointMap = new Map<string, number>();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < days; i++) {
        const date = new Date(now - i * oneDay).toISOString().split('T')[0];
        const iter = kv.list<Deno.KvU64>({ prefix: ["guardian", "stats", date, "endpoint"] });
        for await (const res of iter) {
            const path = String(res.key[4]);
            const count = Number(res.value.value);
            endpointMap.set(path, (endpointMap.get(path) || 0) + count);
        }
    }

    return Array.from(endpointMap.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

export async function getTopIps(limit = 10) {
    const kv = getKv();
    if (!kv) return [];

    const date = new Date().toISOString().split('T')[0];
    const iter = kv.list<Deno.KvU64>({ prefix: ["guardian", "stats", date, "ip"] });
    const stats = [];

    for await (const res of iter) {
        stats.push({
            ip: String(res.key[4]),
            count: Number(res.value.value)
        });
    }

    return stats.sort((a, b) => b.count - a.count).slice(0, limit);
}

export async function getTrafficStats() {
    const kv = getKv();
    if (!kv) return { total: 0 };

    const date = new Date().toISOString().split('T')[0];
    const res = await kv.get<Deno.KvU64>(["guardian", "stats", date, "total_requests"]);
    return {
        total: res.value ? Number(res.value.value) : 0
    };
}

export async function getServiceStats() {
    const kv = getKv();
    if (!kv) return [];
    const date = new Date().toISOString().split('T')[0];
    const iter = kv.list<Deno.KvU64>({ prefix: ["guardian", "stats", date, "service"] });
    const stats = [];
    for await (const res of iter) {
        stats.push({ name: String(res.key[4]), count: Number(res.value.value) });
    }
    return stats;
}

export async function getServiceDailyStats(serviceName: string, days = 7) {
    const kv = getKv();
    if (!kv) return [];

    const stats = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now - i * oneDay).toISOString().split('T')[0];
        // Key: ["guardian", "stats", date, "service", serviceName]
        try {
            const res = await kv.get<Deno.KvU64>(["guardian", "stats", date, "service", serviceName]);
            stats.push({
                date,
                count: res.value ? Number(res.value.value) : 0
            });
        } catch(e) {
             stats.push({ date, count: 0 });
        }
    }

    return stats;
}

export async function getTypeStats() {
    const kv = getKv();
    if (!kv) return [];
    const date = new Date().toISOString().split('T')[0];
    const iter = kv.list<Deno.KvU64>({ prefix: ["guardian", "stats", date, "type"] });
    const stats = [];
    for await (const res of iter) {
        stats.push({ type: String(res.key[4]), count: Number(res.value.value) });
    }
    return stats;
}

export async function getSessions(limit = 50) {
    const kv = getKv();
    if (!kv) return [];
    const date = new Date().toISOString().split('T')[0];
    // List sessions for today
    const iter = kv.list<SessionStats>({ prefix: ["guardian", "sessions", date] }, { limit });
    const sessions = [];
    for await (const res of iter) {
        sessions.push(res.value);
    }
    // Sort by last seen desc
    return sessions.sort((a, b) => b.lastSeen - a.lastSeen);
}

export async function getCountryStats() {
    const kv = getKv();
    if (!kv) return [];
    const date = new Date().toISOString().split('T')[0];
    const iter = kv.list<Deno.KvU64>({ prefix: ["guardian", "stats", date, "country"] });
    const stats = [];
    for await (const res of iter) {
        stats.push({ code: String(res.key[4]), count: Number(res.value.value) });
    }
    return stats.sort((a, b) => b.count - a.count);
}
