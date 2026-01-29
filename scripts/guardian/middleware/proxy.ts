import { Middleware, GuardianContext, Next } from "./types.ts";

export class ProxyMiddleware implements Middleware {
    name = "Proxy";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        // If response already set (e.g. by cache), skip
        if (ctx.response) return;

        const targetUrl = new URL(`http://127.0.0.1:${ctx.targetPort}${ctx.url.pathname}${ctx.url.search}`);

        if (ctx.req.headers.get("upgrade") === "websocket") {
            const protocol = ctx.req.headers.get("Sec-WebSocket-Protocol") || undefined;
            const { socket: clientSocket, response } = Deno.upgradeWebSocket(ctx.req, { protocol });

            // Connect to target
            const wsTargetUrl = targetUrl.toString().replace("http", "ws");

            try {
                // We don't have 'headers' defined yet for the WS case, and standard WebSocket doesn't take custom headers in browser-style Deno implementation
                // but we can pass protocol.
                const serverSocket = new WebSocket(wsTargetUrl, ctx.req.headers.get("Sec-WebSocket-Protocol") || undefined);

                clientSocket.onmessage = (e: any) => {
                    if (serverSocket.readyState === WebSocket.OPEN) {
                        serverSocket.send(e.data);
                    }
                };
                serverSocket.onmessage = (e: any) => {
                    if (clientSocket.readyState === WebSocket.OPEN) {
                        clientSocket.send(e.data);
                    }
                };

                clientSocket.onclose = () => {
                    if (serverSocket.readyState === WebSocket.OPEN) serverSocket.close();
                };
                serverSocket.onclose = () => {
                    if (clientSocket.readyState === WebSocket.OPEN) clientSocket.close();
                };

                serverSocket.onerror = (e: any) => {
                    const msg = `Target WS Error (${wsTargetUrl}): ${e.message || 'Connection refused/Unexpected EOF'}`;
                    ctx.log("stderr", msg);
                };
                clientSocket.onerror = (e: any) => {
                    ctx.log("stderr", `Client WS Error: ${e.message || 'Unexpected EOF'}`);
                };

                ctx.response = response;
            } catch (err: any) {
                const msg = `WS Connection Failed to ${wsTargetUrl}: ${err.message || err}`;
                ctx.log("stderr", msg);
                clientSocket.close(1011, "Internal Proxy Error");
                ctx.response = response;
            }
            return;
        }

        const headers = new Headers(ctx.req.headers);
        headers.set("X-Forwarded-For", ctx.ip);
        headers.set("X-Forwarded-Host", ctx.url.host);
        headers.set("X-Forwarded-Proto", ctx.url.protocol.replace(':', ''));
        headers.set("X-Guardian-ID", ctx.requestId);

        // Crucial: Set Host to the target host if we want the backend to see its own address,
        // OR set it to the original host if we want the backend to generate correct absolute URLs.
        // For Deno/Vite, we usually want the ORIGINAL host so redirects work.
        headers.set("Host", ctx.url.host);

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
                const isNetError = msg.includes("Connection refused") || msg.includes("reset") || msg.includes("refused") || msg.includes("Unexpected EOF");

                if (!isNetError) {
                    ctx.log("stderr", `Proxy Fetch Error: ${msg}`);
                    break;
                }

                if (i < maxRetries && isIdempotent) {
                    ctx.log("info", `Retrying connection to ${ctx.serviceName} (Attempt ${i + 1})...`);
                    // Retry with backoff
                    await new Promise(r => setTimeout(r, 200 * (i + 1)));
                    continue;
                }

                // If not idempotent, we cannot retry safely
                break;
            }
        }

        if (!response) {
            ctx.log("stderr", `Connection failed to ${targetUrl}: ${(lastError as any)?.message || lastError}`);
            ctx.response = new Response("Guardian Service Unavailable", { status: 502 });
            return;
        }

        // Return the response
        let finalHeaders = new Headers(response.headers);

        // Rewrite Location header for redirects
        const location = finalHeaders.get("Location");
        if (location) {
            const isInternal = location.includes(":3001") || location.includes(":8001") ||
                location.includes(":3000") || location.includes(":8000");

            if (isInternal) {
                try {
                    const locUrl = new URL(location);
                    // If it's one of our internal ports, rewrite to gateway ports
                    if (locUrl.port === "3001") locUrl.port = "3000";
                    if (locUrl.port === "8001") locUrl.port = "8000";

                    // Use the domain from ctx.url (localhost or real domain) but keep the new port
                    locUrl.hostname = ctx.url.hostname;
                    finalHeaders.set("Location", locUrl.toString());
                } catch (e) {
                    const rewritten = location
                        .replace(/127\.0\.0\.1:3001|localhost:3001/g, ctx.url.host)
                        .replace(/127\.0\.0\.1:8001|localhost:8001/g, ctx.url.host)
                        .replace(/127\.0\.0\.1:3000|localhost:3000/g, ctx.url.host);
                    finalHeaders.set("Location", rewritten);
                }
            }
        }

        ctx.response = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: finalHeaders
        });
    }
}
