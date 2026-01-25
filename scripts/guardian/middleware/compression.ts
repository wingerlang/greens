import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";

export class CompressionMiddleware implements Middleware {
    name = "Compression";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        await next();

        if (!CONFIG.features.compression || !ctx.response || !ctx.response.body) return;

        // Check if already compressed
        if (ctx.response.headers.has("Content-Encoding")) return;

        // Check accept-encoding
        const accept = ctx.req.headers.get("accept-encoding") || "";
        const type = ctx.response.headers.get("content-type") || "";

        // Compress only text/json/xml/wasm
        if (!type.match(/^text\/|application\/json|application\/xml|application\/javascript|application\/wasm/)) return;

        let encoding = "";
        let stream: TransformStream<any, any> | null = null;

        if (accept.includes("gzip")) {
            encoding = "gzip";
            stream = new CompressionStream("gzip");
        } else if (accept.includes("deflate")) {
            encoding = "deflate";
            stream = new CompressionStream("deflate");
        }

        if (stream) {
            ctx.response = new Response(ctx.response.body.pipeThrough(stream), {
                status: ctx.response.status,
                statusText: ctx.response.statusText,
                headers: ctx.response.headers
            });
            ctx.response.headers.set("Content-Encoding", encoding);
            ctx.response.headers.delete("Content-Length");
            ctx.response.headers.set("Vary", "Accept-Encoding");
        }
    }
}
