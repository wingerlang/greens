import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";

/**
 * CORS Middleware
 * Handles preflight OPTIONS requests and adds CORS headers to responses.
 */
export class CorsMiddleware implements Middleware {
    name = "CORS";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        const corsConfig = (CONFIG as any).cors || {};

        // Skip if CORS is disabled
        if (!corsConfig.enabled) {
            await next();
            return;
        }

        const origin = ctx.req.headers.get("origin");
        const allowedOrigins = corsConfig.allowedOrigins || ["*"];
        const allowedMethods = corsConfig.allowedMethods || ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
        const allowedHeaders = corsConfig.allowedHeaders || ["Content-Type", "Authorization", "X-Request-ID"];
        const allowCredentials = corsConfig.allowCredentials ?? true;
        const maxAge = corsConfig.maxAge || 86400; // 24 hours

        // Check if origin is allowed
        const isAllowed = allowedOrigins.includes("*") ||
            (origin && allowedOrigins.includes(origin));

        // Handle preflight OPTIONS request
        if (ctx.req.method === "OPTIONS") {
            const headers = new Headers();

            if (isAllowed && origin) {
                headers.set("Access-Control-Allow-Origin", origin);
            } else if (allowedOrigins.includes("*")) {
                headers.set("Access-Control-Allow-Origin", "*");
            }

            headers.set("Access-Control-Allow-Methods", allowedMethods.join(", "));
            headers.set("Access-Control-Allow-Headers", allowedHeaders.join(", "));
            headers.set("Access-Control-Max-Age", String(maxAge));

            if (allowCredentials && origin) {
                headers.set("Access-Control-Allow-Credentials", "true");
            }

            ctx.response = new Response(null, {
                status: 204,
                headers
            });
            return;
        }

        // Continue with the request
        await next();

        // Add CORS headers to response
        if (ctx.response && origin) {
            const newHeaders = new Headers(ctx.response.headers);

            if (isAllowed) {
                newHeaders.set("Access-Control-Allow-Origin", origin);
                if (allowCredentials) {
                    newHeaders.set("Access-Control-Allow-Credentials", "true");
                }
            }

            // Expose certain headers to client
            const exposeHeaders = corsConfig.exposeHeaders || ["X-Request-ID", "X-Guardian-ID"];
            if (exposeHeaders.length > 0) {
                newHeaders.set("Access-Control-Expose-Headers", exposeHeaders.join(", "));
            }

            ctx.response = new Response(ctx.response.body, {
                status: ctx.response.status,
                statusText: ctx.response.statusText,
                headers: newHeaders
            });
        }
    }
}
