import { saveRequestMetric } from "./logger.ts";
import { checkRateLimit, isBanned } from "./security.ts";

const BACKEND_URL = "http://127.0.0.1:8001";
const FRONTEND_URL = "http://127.0.0.1:3001";

export async function handleProxyRequest(req: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
    const start = performance.now();
    const url = new URL(req.url);
    const ip = info.remoteAddr.hostname;

    // 1. Security Check
    if (await isBanned(ip)) {
        return new Response("Access Denied", { status: 403 });
    }

    if (!checkRateLimit(ip)) {
        return new Response("Too Many Requests", { status: 429 });
    }

    // 2. Routing
    const isApi = url.pathname.startsWith("/api");
    const targetBase = isApi ? BACKEND_URL : FRONTEND_URL;
    const targetUrl = new URL(targetBase + url.pathname + url.search);

    // 3. Proxying
    try {
        if (req.headers.get("upgrade") === "websocket") {
             return new Response("WebSocket proxying not fully implemented in Guardian yet.", { status: 501 });
        }

        const headers = new Headers(req.headers);
        headers.set("X-Forwarded-For", ip);
        headers.set("X-Guardian-ID", crypto.randomUUID());

        // Retry logic for connection errors (Backend startup)
        let response: Response | null = null;
        let lastError = null;
        let attempt = 0;

        for (let i = 0; i < 3; i++) {
            attempt = i;
            try {
                // We clone the request for retries if it's not a GET,
                // but actually fetch consumes body.
                // If we have a body, we can only retry if we buffer it.
                // For now, simpler: Only retry if body is null or we accept risk.
                // Safest: Retry only on connection error immediately.

                response = await fetch(targetUrl, {
                    method: req.method,
                    headers: headers,
                    body: req.body, // Stream is consumed here!
                    redirect: "manual"
                });
                break;
            } catch (e) {
                lastError = e;
                const msg = String(e);
                // Only retry if connection refused (service restarting)
                if (msg.includes("Connection refused") || msg.includes("reset")) {
                    await new Promise(r => setTimeout(r, 500));
                    // Check if body is used? If body was stream, it's gone.
                    // If req.method is GET, we can retry.
                    if (req.method !== "GET" && req.method !== "HEAD") {
                        break; // Cannot safe retry
                    }
                    continue;
                }
                break;
            }
        }

        if (!response) {
            throw lastError || new Error("Failed to connect");
        }

        const duration = performance.now() - start;

        // 4. Logging
        saveRequestMetric({
            timestamp: Date.now(),
            path: url.pathname,
            method: req.method,
            status: response.status,
            duration,
            ip,
            retries: attempt
        });

        // 5. Response
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });

    } catch (e) {
        console.error(`[GUARDIAN] Proxy Error: ${e}`);
        saveRequestMetric({
            timestamp: Date.now(),
            path: url.pathname,
            method: req.method,
            status: 502,
            duration: performance.now() - start,
            ip
        });
        return new Response("Guardian Service Unavailable", { status: 502 });
    }
}
