import { getKv } from "./logger.ts";
import { LogEntry, MetricEntry, RequestMetric, SessionStats } from "./types.ts";

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

    if (stats.length === 0) {
        // console.log(`[ANALYTICS] No top endpoints found for ${date}`);
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
    if (!res.value) {
        // console.log(`[ANALYTICS] No total_requests found for ${date}`);
    }
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
        try {
            // If serviceName is 'guardian', we show TOTAL requests for the whole system
            const key = serviceName === "guardian"
                ? ["guardian", "stats", date, "total_requests"]
                : ["guardian", "stats", date, "service", serviceName];

            const res = await kv.get<Deno.KvU64>(key);
            stats.push({
                date,
                count: res.value ? Number(res.value.value) : 0
            });
        } catch (e) {
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

export async function getRequestCountInWindow(serviceName: string, windowMs: number) {
    const kv = getKv();
    if (!kv) return 0;

    const now = Date.now();
    const startTs = now - windowMs;

    // Use prefix to bound search, and manually filter/stop
    // Start from current time and go backwards
    const iter = kv.list<RequestMetric>({ prefix: ["guardian", "requests"] }, {
        reverse: true
    });

    let count = 0;
    try {
        for await (const res of iter) {
            const metric = res.value;
            // Since we are in reverse, we stop when we pass the startTs
            if (metric.timestamp < startTs) break;

            // Skip future-dated entries just in case
            if (metric.timestamp <= now) {
                if (serviceName === "guardian" || metric.targetService === serviceName) {
                    count++;
                }
            }
        }
    } catch (e) {
        console.error(`[ANALYTICS] Error counting requests for ${serviceName}:`, e);
    }

    return count;
}

export async function getSizeStats() {
    const kv = getKv();
    if (!kv) return { byType: [], total: 0 };
    const date = new Date().toISOString().split('T')[0];

    // By Type
    const iter = kv.list<Deno.KvU64>({ prefix: ["guardian", "stats", date, "size_by_type"] });
    const byType = [];
    for await (const res of iter) {
        byType.push({ type: String(res.key[4]), size: Number(res.value.value) });
    }

    // Total
    const totalRes = await kv.get<Deno.KvU64>(["guardian", "stats", date, "total_size"]);
    const total = totalRes.value ? Number(totalRes.value.value) : 0;

    return { byType, total };
}
