import { Middleware, GuardianContext, NextFunction } from "./core.ts";
import { isBanned } from "../security.ts";
import { checkBot, checkHoneypot } from "../botDetection.ts";
import { checkWaf, logWafEvent } from "../waf.ts";
import { CONFIG } from "../config.ts";

export class BlockListMiddleware implements Middleware {
    name = "BlockList";

    async execute(ctx: GuardianContext, next: NextFunction) {
        if (await isBanned(ctx.ip)) {
            ctx.blocked = true;
            ctx.blockReason = "IP Banned";
            ctx.response = new Response("Access Denied", { status: 403 });
            return;
        }
        await next();
    }
}

export class BotDefenseMiddleware implements Middleware {
    name = "BotDefense";

    async execute(ctx: GuardianContext, next: NextFunction) {
        // 1. Check UA
        const botResult = await checkBot(ctx.userAgent);
        if (botResult.blocked) {
            ctx.blocked = true;
            ctx.blockReason = botResult.reason;
            ctx.response = new Response("Access Denied (Bot)", { status: 403 });
            return;
        }

        // 2. Check Honeypot
        if (await checkHoneypot(ctx.url.pathname, ctx.ip)) {
            ctx.blocked = true;
            ctx.blockReason = "Honeypot Triggered";
            ctx.response = new Response("Access Denied", { status: 403 });
            return;
        }

        await next();
    }
}

export class WafMiddleware implements Middleware {
    name = "WAF";

    async execute(ctx: GuardianContext, next: NextFunction) {
        const result = await checkWaf(ctx.url, ctx.req.method, ctx.req.headers);
        if (result.blocked) {
            await logWafEvent(result, ctx.ip, ctx.url.pathname);
            ctx.blocked = true;
            ctx.blockReason = `WAF: ${result.reason}`;
            ctx.response = new Response(`Guardian WAF: Blocked (${result.reason})`, { status: 403 });
            return;
        }
        await next();
    }
}

// Token Bucket Implementation
interface Bucket {
    tokens: number;
    lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export class TokenBucketRateLimitMiddleware implements Middleware {
    name = "RateLimit";
    lastCleanup = 0;

    async execute(ctx: GuardianContext, next: NextFunction) {
        if (!CONFIG.rateLimit.enabled) {
            await next();
            return;
        }

        const now = Date.now();

        // Cleanup periodically (every 60s)
        if (now - this.lastCleanup > 60000) {
            this.cleanup(now);
            this.lastCleanup = now;
        }

        let bucket = buckets.get(ctx.ip);

        if (!bucket) {
            bucket = {
                tokens: CONFIG.rateLimit.maxTokens,
                lastRefill: now
            };
            buckets.set(ctx.ip, bucket);
        }

        // Refill
        const elapsed = now - bucket.lastRefill;
        // tokensPerInterval / interval = tokens per ms
        const refillRate = CONFIG.rateLimit.tokensPerInterval / CONFIG.rateLimit.interval;
        const tokensToAdd = elapsed * refillRate;

        bucket.tokens = Math.min(CONFIG.rateLimit.maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;

        // Consume
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            await next();
        } else {
            ctx.blocked = true;
            ctx.blockReason = "Rate Limit Exceeded";
            ctx.response = new Response("Too Many Requests", {
                status: 429,
                headers: { "Retry-After": "10" }
            });
        }
    }

    private cleanup(now: number) {
        for (const [ip, bucket] of buckets.entries()) {
            // Remove buckets that haven't been touched in 1 hour
            if (now - bucket.lastRefill > 3600000) {
                buckets.delete(ip);
            }
        }
    }
}
