import { getKv } from "./logger.ts";

const RATE_LIMIT_WINDOW = 10000; // 10s
const RATE_LIMIT_MAX = 200; // 200 requests per 10s

interface RateState {
    count: number;
    start: number;
}

const rateLimitMap = new Map<string, RateState>();
export const bannedIps = new Set<string>();

// Hydrate banned IPs from KV on startup
export async function loadBannedIps() {
    const kv = getKv();
    if (!kv) return;
    try {
        const iter = kv.list({ prefix: ["guardian", "banned"] });
        for await (const res of iter) {
            bannedIps.add(String(res.key[2]));
        }
    } catch (e) { /* ignore */ }
}

export async function isBanned(ip: string): Promise<boolean> {
    return bannedIps.has(ip);
}

export async function banIp(ip: string, reason: string) {
    bannedIps.add(ip);
    const kv = getKv();
    if (kv) {
        await kv.set(["guardian", "banned", ip], { reason, timestamp: Date.now() });
    }
    console.log(`[GUARDIAN] BANNED IP: ${ip} (${reason})`);
}

export async function unbanIp(ip: string) {
    bannedIps.delete(ip);
    const kv = getKv();
    if (kv) {
        await kv.delete(["guardian", "banned", ip]);
    }
}

export function checkRateLimit(ip: string): boolean {
    let state = rateLimitMap.get(ip);
    const now = Date.now();

    if (!state || now - state.start > RATE_LIMIT_WINDOW) {
        state = { count: 0, start: now };
        rateLimitMap.set(ip, state);
    }

    state.count++;
    if (state.count > RATE_LIMIT_MAX) {
        // Auto-ban if extreme?
        // For now just return false (blocked)
        if (state.count > RATE_LIMIT_MAX * 10) {
            banIp(ip, "Extreme Rate Limiting");
        }
        return false;
    }
    return true;
}
