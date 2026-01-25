import { Middleware, GuardianContext, NextFunction } from "./core.ts";
import { CONFIG } from "../config.ts";

interface CacheEntry {
    body: ArrayBuffer;
    headers: [string, string][];
    status: number;
    expires: number;
}

const cache = new Map<string, CacheEntry>();

export class SmartCacheMiddleware implements Middleware {
    name = "SmartCache";

    async execute(ctx: GuardianContext, next: NextFunction) {
        if (!CONFIG.cache.enabled || ctx.req.method !== "GET") {
            await next();
            return;
        }

        // Check if path matches cacheable paths
        const isCacheable = CONFIG.cache.paths.some(p => ctx.url.pathname.startsWith(p));
        if (!isCacheable) {
            await next();
            return;
        }

        const key = `${ctx.req.method}:${ctx.url.pathname}:${ctx.url.search}`;
        const now = Date.now();
        const entry = cache.get(key);

        if (entry && entry.expires > now) {
            // Cache Hit
            ctx.cacheHit = true;
            ctx.response = new Response(entry.body, {
                status: entry.status,
                headers: new Headers(entry.headers)
            });
            ctx.response.headers.set("X-Guardian-Cache", "HIT");
            return;
        }

        // Cache Miss - Proceed
        await next();

        // After response, check if we should cache it
        if (ctx.response && ctx.response.status === 200) {
            try {
                // We need to clone to read body without consuming the response meant for user
                const resClone = ctx.response.clone();
                const buffer = await resClone.arrayBuffer();

                cache.set(key, {
                    body: buffer,
                    headers: Array.from(resClone.headers.entries()),
                    status: resClone.status,
                    expires: now + CONFIG.cache.ttl
                });
            } catch (e) {
                console.error("Failed to cache response", e);
            }
        }
    }
}
