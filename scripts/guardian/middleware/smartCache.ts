import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";

interface CacheEntry {
    body: ArrayBuffer;
    headers: Headers;
    expiry: number;
}

const cache = new Map<string, CacheEntry>();
let currentCacheSize = 0;

export class SmartCacheMiddleware implements Middleware {
    name = "SmartCache";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!CONFIG.features.smartCache || ctx.req.method !== "GET") {
            await next();
            return;
        }

        const url = ctx.url.pathname;
        const isCacheable = CONFIG.smartCache.paths.some(p => url.includes(p));

        if (!isCacheable) {
            await next();
            return;
        }

        // Check Cache
        const entry = cache.get(url);
        if (entry) {
            if (Date.now() < entry.expiry) {
                // HIT
                ctx.response = new Response(entry.body, {
                    status: 200,
                    headers: entry.headers
                });
                ctx.response.headers.set("X-Guardian-Cache", "HIT");
                return;
            } else {
                cache.delete(url);
                currentCacheSize -= entry.body.byteLength;
            }
        }

        // MISS
        await next();

        // Cache on response
        if (ctx.response && ctx.response.status === 200) {
            // We clone and process asynchronously to avoid blocking the response
            const headers = new Headers(ctx.response.headers);
            try {
                const resClone = ctx.response.clone();
                resClone.arrayBuffer().then(arrayBuffer => {
                    if (currentCacheSize + arrayBuffer.byteLength > CONFIG.smartCache.maxSize) return;
                    cache.set(url, {
                        body: arrayBuffer,
                        headers: headers,
                        expiry: Date.now() + CONFIG.smartCache.ttl
                    });
                    currentCacheSize += arrayBuffer.byteLength;
                }).catch(e => console.error("[SmartCache] Failed to cache:", e));
            } catch (e) {
                 // Clone might fail if body is already used (shouldn't happen here normally)
                 console.error("[SmartCache] Clone failed:", e);
            }
        }
    }
}
