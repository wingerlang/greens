import { debugStorage, DebugContext } from "../utils/debugContext.ts";
import { kv } from "../kv.ts";

export async function debugMiddleware(req: Request, next: (req: Request) => Promise<Response>): Promise<Response> {
    // Only run if DEBUG_MODE is set or implicitly in dev (we rely on env var)
    const isDebugMode = Deno.env.get("DEBUG_MODE") === "true";

    if (!isDebugMode) {
        return await next(req);
    }

    // Exclude debug endpoints from logging to prevent recursion
    if (req.url.includes('/api/debug')) {
        return await next(req);
    }

    const requestId = crypto.randomUUID();
    const startTime = performance.now();
    const startMemory = Deno.memoryUsage();

    const context: DebugContext = {
        requestId,
        startTime,
        logs: [],
        startMemory
    };

    return await debugStorage.run(context, async () => {
        try {
            let payload: any = undefined;
            let requestToPass = req;

            if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
                try {
                    const buffer = await req.arrayBuffer();
                    requestToPass = new Request(req.url, {
                        method: req.method,
                        headers: req.headers,
                        body: buffer
                    });

                    const text = new TextDecoder().decode(buffer);
                    if (text && text.length < 100000) {
                        try {
                            payload = JSON.parse(text);
                        } catch {
                            payload = text;
                        }
                    } else if (text) {
                        payload = `[Payload too large: ${text.length} bytes]`;
                    }
                } catch (e) {
                    payload = `[Failed to read payload: ${e instanceof Error ? e.message : String(e)}]`;
                }
            }

            const response = await next(requestToPass);

            // Post-request processing
            const duration = performance.now() - startTime;
            const endMemory = Deno.memoryUsage();

            // Capture Response Body
            let responseBody: any = undefined;
            try {
                const resClone = response.clone();
                const resText = await resClone.text();
                if (resText && resText.length < 100000) {
                    try {
                        responseBody = JSON.parse(resText);
                    } catch {
                        responseBody = resText;
                    }
                } else if (resText) {
                    responseBody = `[Response too large: ${resText.length} bytes]`;
                }
            } catch (e) {
                responseBody = `[Failed to read response: ${e instanceof Error ? e.message : String(e)}]`;
            }

            const debugData = {
                id: requestId,
                url: req.url,
                method: req.method,
                status: response.status,
                startTime: new Date().toISOString(),
                duration,
                memory: {
                    rss: endMemory.rss - startMemory.rss,
                    heapTotal: endMemory.heapTotal - startMemory.heapTotal,
                    heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                    external: endMemory.external - startMemory.external,
                },
                logs: context.logs,
                payload, // Add payload
                responseBody // Add response body
            };

            // Store debug data in KV (expire in 10 minutes)
            try {
                await kv.set(['system', 'debug', requestId], debugData, { expireIn: 10 * 60 * 1000 });
            } catch (e) {
                console.error("Failed to save debug data", e);
            }

            // Clone response to add headers
            const newHeaders = new Headers(response.headers);
            newHeaders.set("X-Debug-Id", requestId);
            newHeaders.set("X-Debug-Mode", "true");

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders,
            });

        } catch (error) {
            // Capture error details too
            const duration = performance.now() - startTime;
            const endMemory = Deno.memoryUsage();

            const debugData = {
                id: requestId,
                url: req.url,
                method: req.method,
                status: 500,
                error: String(error),
                startTime: new Date().toISOString(),
                duration,
                memory: {
                    rss: endMemory.rss - startMemory.rss,
                    heapTotal: endMemory.heapTotal - startMemory.heapTotal,
                    heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                    external: endMemory.external - startMemory.external,
                },
                logs: context.logs
            };

            await kv.set(['system', 'debug', requestId], debugData, { expireIn: 10 * 60 * 1000 });
            throw error;
        }
    });
}
