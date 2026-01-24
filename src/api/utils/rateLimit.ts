import { kv } from "../kv.ts";

/**
 * Checks if a given identifier (e.g., IP address) has exceeded the rate limit.
 * Implements a sliding window algorithm using Deno KV atomic transactions.
 *
 * @param identifier Unique identifier for the client (IP address)
 * @param limit Max number of requests allowed within the window
 * @param windowMs Time window in milliseconds
 * @returns true if allowed, false if limit exceeded
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const key = ["rate_limit", identifier];
  const now = Date.now();
  const windowStart = now - windowMs;

  // Retry loop for CAS (Compare-And-Swap)
  for (let i = 0; i < 3; i++) {
    const res = await kv.get<number[]>(key);
    let timestamps = res.value || [];

    // Filter out timestamps outside the window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= limit) {
      return false;
    }

    // Add current timestamp
    const newTimestamps = [...timestamps, now];

    // Atomic commit to ensure consistency
    const commitRes = await kv.atomic()
      .check(res) // Ensure value hasn't changed since we read it
      .set(key, newTimestamps, { expireIn: windowMs * 2 })
      .commit();

    if (commitRes.ok) {
      return true;
    }
    // If not ok, loop and try again
  }

  // Default to blocking if we fail to commit multiple times (fail-closed)
  return false;
}
