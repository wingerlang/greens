import { saveRequestMetric, determineResourceType, generateSessionId } from "./logger.ts";
import { checkRateLimit, isBanned } from "./security.ts";
import { manager } from "./services.ts";

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
        <div style="margin-top:20px; font-size:0.8rem; color:#94a3b8">Guardian 2.5</div>
    </div>
</body>
</html>
`;

export async function handleProxyRequest(
    req: Request,
    info: Deno.ServeHandlerInfo,
    targetPort: number,
    serviceName: string
): Promise<Response> {
    const start = performance.now();
    const url = new URL(req.url);
    const ip = info.remoteAddr.hostname;
    const userAgent = req.headers.get("user-agent") || "unknown";

    // 1. Security Check
    if (await isBanned(ip)) {
        return new Response("Access Denied", { status: 403 });
    }

    if (!checkRateLimit(ip)) {
        return new Response("Too Many Requests", { status: 429 });
    }

    // 2. Service Status Check
    const service = manager.get(serviceName);
    if (service && service.stats.status === "stopped") {
         return new Response(MAINTENANCE_HTML, {
             status: 503,
             headers: { "content-type": "text/html" }
         });
    }

    const targetUrl = new URL(`http://127.0.0.1:${targetPort}${url.pathname}${url.search}`);
    const sessionId = await generateSessionId(ip, userAgent);
    const resourceType = determineResourceType(url.pathname);

    // 3. Proxying
    try {
        if (req.headers.get("upgrade") === "websocket") {
             return new Response("WebSocket proxying not fully implemented in Guardian yet.", { status: 501 });
        }

        const headers = new Headers(req.headers);
        headers.set("X-Forwarded-For", ip);
        headers.set("X-Guardian-ID", crypto.randomUUID());

        // Retry logic for connection errors
        let response: Response | null = null;
        let lastError = null;
        let attempt = 0;

        for (let i = 0; i < 3; i++) {
            attempt = i;
            try {
                response = await fetch(targetUrl, {
                    method: req.method,
                    headers: headers,
                    body: req.body,
                    redirect: "manual"
                });
                break;
            } catch (e) {
                lastError = e;
                const msg = String(e);
                if (msg.includes("Connection refused") || msg.includes("reset")) {
                    await new Promise(r => setTimeout(r, 500));
                    if (req.method !== "GET" && req.method !== "HEAD") break;
                    continue;
                }
                break;
            }
        }

        if (!response) {
            // Service might be crashing or starting up
             return new Response(MAINTENANCE_HTML, {
                 status: 503,
                 headers: { "content-type": "text/html" }
             });
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
            retries: attempt,
            targetService: serviceName,
            resourceType,
            sessionId,
            userAgent
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
            ip,
            targetService: serviceName,
            resourceType,
            sessionId,
            userAgent
        });
        return new Response("Guardian Service Unavailable", { status: 502 });
    }
}
