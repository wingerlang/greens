import { Middleware, GuardianContext, NextFunction } from "./core.ts";
import { CONFIG } from "../config.ts";

const MAINTENANCE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Maintenance - Guardian</title>
    <style>
        body { background: #0f172a; color: #f8fafc; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; }
        h1 { color: #3b82f6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>System Maintenance</h1>
        <p>This service is currently stopped or restarting.</p>
        <p>Please try again in a moment.</p>
        <div style="margin-top:20px; font-size:0.8rem; color:#94a3b8">Guardian ${CONFIG.version}</div>
    </div>
</body>
</html>
`;

export class ProxyMiddleware implements Middleware {
    name = "Proxy";

    async execute(ctx: GuardianContext, next: NextFunction) {
        if (ctx.response) return; // Already handled (e.g. Cache Hit)

        // Construct Target URL
        const targetUrl = new URL(`http://127.0.0.1:${ctx.targetPort}${ctx.url.pathname}${ctx.url.search}`);

        if (ctx.req.headers.get("upgrade") === "websocket") {
             ctx.response = new Response("WebSocket proxying not fully implemented in Guardian yet.", { status: 501 });
             return;
        }

        const headers = new Headers(ctx.req.headers);
        headers.set("X-Forwarded-For", ctx.ip);
        headers.set("X-Guardian-ID", ctx.requestId);

        let response: Response | null = null;
        let attempt = 0;

        for (let i = 0; i < 3; i++) {
            attempt = i;
            try {
                // We use a timeout for the fetch itself if possible, but standard fetch doesn't support it easily without AbortController
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeouts.proxyRequest);

                response = await fetch(targetUrl, {
                    method: ctx.req.method,
                    headers: headers,
                    body: ctx.req.body, // Note: Body might be consumed if we are not careful?
                    // ctx.req is the original Request.
                    // Middleware like Cache might clone it.
                    // The standard Request body is a stream. If consumed by Cache, we need to handle that.
                    // My CacheMiddleware clones it. So original stream should be intact?
                    // "If you read the body of a request... you cannot read it again".
                    // clone() allows reading the clone.
                    redirect: "manual",
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                break;
            } catch (e) {
                // Retry logic
                const msg = String(e);
                if (msg.includes("Connection refused") || msg.includes("reset") || msg.includes("aborted")) {
                    await new Promise(r => setTimeout(r, 500));
                    if (ctx.req.method !== "GET" && ctx.req.method !== "HEAD") break; // Don't retry POST safely without knowing idempotency
                    continue;
                }
                break;
            }
        }

        if (!response) {
             ctx.response = new Response(MAINTENANCE_HTML, {
                 status: 503,
                 headers: { "content-type": "text/html" }
             });
        } else {
            ctx.response = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
            });
        }

        // We don't call next() because this is the terminal middleware
    }
}
