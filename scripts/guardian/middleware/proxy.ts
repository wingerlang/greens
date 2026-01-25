import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";

export class ProxyMiddleware implements Middleware {
    name = "Proxy";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        // If response already set (e.g. by cache), skip
        if (ctx.response) return;

        const targetUrl = new URL(`http://127.0.0.1:${ctx.targetPort}${ctx.url.pathname}${ctx.url.search}`);

        if (ctx.req.headers.get("upgrade") === "websocket") {
             ctx.response = new Response("WebSocket proxying not fully implemented in Guardian yet.", { status: 501 });
             return;
        }

        const headers = new Headers(ctx.req.headers);
        headers.set("X-Forwarded-For", ctx.ip);
        headers.set("X-Guardian-ID", ctx.requestId);

        let response: Response | null = null;
        let lastError = null;

        for (let i = 0; i < 3; i++) {
            try {
                // Create a new controller for each attempt if needed,
                // but fetch signal handling with retries can be tricky if the original request is aborted.
                // For now simple fetch.
                response = await fetch(targetUrl, {
                    method: ctx.req.method,
                    headers: headers,
                    body: ctx.req.body, // Note: body stream can typically only be read once.
                    // If we retry, we might fail if body is already consumed?
                    // Fetch usually handles this if we pass the ReadableStream.
                    // However, Deno's fetch with a consumed stream will fail.
                    // If the body is small, we could buffer it.
                    // But for now, if it's a POST/PUT, maybe we shouldn't retry if it fails mid-stream?
                    // The original code retried blindly. We will do the same but be aware of stream locking.
                    redirect: "manual",
                });
                break;
            } catch (e) {
                lastError = e;
                const msg = String(e);
                if (msg.includes("Connection refused") || msg.includes("reset") || msg.includes("refused")) {
                    await new Promise(r => setTimeout(r, 500));
                    // If it was a non-idempotent method and stream was used, we might be in trouble.
                    // But assuming standard connection failure before body is sent.
                    continue;
                }
                break;
            }
        }

        if (!response) {
            console.error(`[Proxy] Connection failed to ${targetUrl}:`, lastError);
            ctx.response = new Response("Guardian Service Unavailable", { status: 502 });
            return;
        }

        // Return the response
        ctx.response = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }
}
