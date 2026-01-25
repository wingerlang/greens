import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";
import { banIp } from "../security.ts";

interface Bucket {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export class TokenBucketRateLimitMiddleware implements Middleware {
    name = "RateLimit";

    handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!CONFIG.features.rateLimit) {
            return next();
        }

        const ip = ctx.ip;
        const now = Date.now();
        const config = CONFIG.rateLimit.tokenBucket;

        let bucket = buckets.get(ip);
        if (!bucket) {
            bucket = {
                tokens: config.capacity,
                lastRefill: now
            };
            buckets.set(ip, bucket);
        }

        // Refill
        const elapsedSeconds = (now - bucket.lastRefill) / 1000;
        const newTokens = elapsedSeconds * config.fillRate;

        if (newTokens > 0) {
            bucket.tokens = Math.min(config.capacity, bucket.tokens + newTokens);
            bucket.lastRefill = now;
        }

        // Consume
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return next();
        } else {
            // Check if we should ban (if they are hammering way too hard?)
            // For now just 429.
            ctx.response = new Response("Too Many Requests", {
                status: 429,
                headers: { "Retry-After": "1" }
            });
            return Promise.resolve();
        }
    }
}
