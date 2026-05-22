/**
 * In-memory rate limiter using sliding window algorithm.
 * Much faster than KV-based rate limiting and avoids database lock issues under high load.
 * 
 * Note: This resets on server restart and doesn't work across multiple instances.
 * For production multi-instance deployments, use Redis or a dedicated rate limiting service.
 */

// In-memory storage: Map<identifier, timestamps[]>
const rateLimitStore = new Map<string, number[]>();

const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const maxAge = 120_000; // Clean entries older than 2 minutes

    for (const [key, timestamps] of rateLimitStore.entries()) {
        const filtered = timestamps.filter(t => t > now - maxAge);
        if (filtered.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, filtered);
        }
    }
}, 60_000);

if (globalThis.Deno && typeof (globalThis.Deno as any).unrefTimer === "function") {
    (globalThis.Deno as any).unrefTimer(cleanupInterval);
}

/**
 * Checks if a given identifier (e.g., IP address) has exceeded the rate limit.
 * Uses in-memory sliding window algorithm - no database, no locks.
 *
 * @param identifier Unique identifier for the client (IP address)
 * @param limit Max number of requests allowed within the window
 * @param windowMs Time window in milliseconds
 * @returns true if allowed, false if limit exceeded
 */
export async function checkRateLimit(identifier: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps for this identifier
    let timestamps = rateLimitStore.get(identifier) || [];

    // Filter out timestamps outside the window
    timestamps = timestamps.filter(t => t > windowStart);

    // Check if limit is exceeded
    if (timestamps.length >= limit) {
        rateLimitStore.set(identifier, timestamps);
        return false;
    }

    // Add current timestamp and store
    timestamps.push(now);
    rateLimitStore.set(identifier, timestamps);

    return true;
}

/**
 * Clear rate limit for a specific identifier (useful for testing/admin)
 */
export function clearRateLimit(identifier: string): void {
    rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit stats for an identifier
 */
export function getRateLimitStats(identifier: string, windowMs: number): { count: number, remaining: number, limit: number } {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = rateLimitStore.get(identifier) || [];
    const recentCount = timestamps.filter(t => t > windowStart).length;

    return {
        count: recentCount,
        remaining: Math.max(0, 10 - recentCount), // Assuming default limit of 10
        limit: 10
    };
}
