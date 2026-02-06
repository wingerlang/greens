import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG as GLOBAL_CONFIG } from "../config.ts";
import { banIp } from "../security.ts";

interface Bucket {
    tokens: number;
    lastRefill: number;
}

export class TokenBucketRateLimitMiddleware implements Middleware {
    name = "RateLimit";
    private buckets = new Map<string, Bucket>();
    private config: any;

    constructor(config?: any) {
        this.config = config || GLOBAL_CONFIG;
    }

    handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!this.config.features.rateLimit) {
            return next();
        }

        const ip = ctx.ip;
        const now = Date.now();
        const config = this.config.rateLimit.tokenBucket;

        let bucket = this.buckets.get(ip);
        if (!bucket) {
            bucket = {
                tokens: config.capacity,
                lastRefill: now
            };
            this.buckets.set(ip, bucket);
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
