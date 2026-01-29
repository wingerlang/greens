import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";

/**
 * Body Size Limit Middleware
 * Rejects requests with bodies larger than configured maximum
 */
export class BodySizeLimitMiddleware implements Middleware {
    name = "BodySizeLimit";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        const limits = (CONFIG as any).limits || {};
        const maxBodySize = limits.maxBodySize || 10 * 1024 * 1024; // Default 10MB

        // Check Content-Length header
        const contentLength = ctx.req.headers.get("content-length");

        if (contentLength) {
            const size = parseInt(contentLength, 10);

            if (!isNaN(size) && size > maxBodySize) {
                ctx.log("info", `Blocked oversized request: ${size} bytes (max: ${maxBodySize})`);

                ctx.response = new Response(
                    JSON.stringify({
                        error: "Payload Too Large",
                        message: `Request body exceeds maximum size of ${formatBytes(maxBodySize)}`,
                        maxSize: maxBodySize,
                        receivedSize: size
                    }),
                    {
                        status: 413,
                        headers: { "Content-Type": "application/json" }
                    }
                );
                return;
            }
        }

        await next();
    }
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
