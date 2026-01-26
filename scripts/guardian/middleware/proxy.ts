import { Middleware, GuardianContext, Next } from "./types.ts";

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

        // Inject GeoIP if available
        const geo = ctx.state.get("geo");
        if (geo && geo.countryCode) {
            headers.set("X-Guardian-Country", geo.countryCode);
        }

        let response: Response | null = null;
        let lastError = null;

        const isIdempotent = ["GET", "HEAD", "OPTIONS", "TRACE"].includes(ctx.req.method);
        const maxRetries = 2;

        for (let i = 0; i <= maxRetries; i++) {
            try {
                // Note: ctx.req.body is a ReadableStream.
                // If we pass it to fetch, it gets locked.
                // If the fetch fails (network error), the stream might still be locked/disturbed.
                // Thus, we can only safely retry requests that typically don't have bodies (Idempotent).

                response = await fetch(targetUrl, {
                    method: ctx.req.method,
                    headers: headers,
                    body: ctx.req.body,
                    redirect: "manual",
                });
                break; // Success
            } catch (e) {
                lastError = e;
                const msg = String(e);
                const isNetError = msg.includes("Connection refused") || msg.includes("reset") || msg.includes("refused");

                if (!isNetError) {
                    break;
                }

                if (i < maxRetries && isIdempotent) {
                    // Retry with backoff
                    await new Promise(r => setTimeout(r, 200 * (i + 1)));
                    continue;
                }

                // If not idempotent, we cannot retry safely
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
