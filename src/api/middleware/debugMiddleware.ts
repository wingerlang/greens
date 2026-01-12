import { debugStorage, DebugContext } from "../utils/debugContext.ts";
import { kv } from "../kv.ts";

// Deno KV has a 65KB limit per value, we use 60KB to leave room for overhead
const MAX_KV_SIZE = 60 * 1024;

function estimateSize(data: unknown): number {
    try {
        return new TextEncoder().encode(JSON.stringify(data)).length;
    } catch {
        return Infinity;
    }
}

function truncateForKV(debugData: Record<string, unknown>): Record<string, unknown> {
    let size = estimateSize(debugData);

    if (size <= MAX_KV_SIZE) {
        return debugData;
    }

    const result = { ...debugData };

    // First, truncate responseBody if it's large
    if (result.responseBody && typeof result.responseBody === 'string' && result.responseBody.length > 1000) {
        const originalLen = result.responseBody.length;
        result.responseBody = `[Truncated, original: ${originalLen} bytes] ${result.responseBody.slice(0, 500)}...`;
        size = estimateSize(result);
    } else if (result.responseBody && typeof result.responseBody === 'object') {
        result.responseBody = '[Object too large for KV storage]';
        size = estimateSize(result);
    }

    // Then, truncate logs if still too large
    if (size > MAX_KV_SIZE && Array.isArray(result.logs) && result.logs.length > 0) {
        const logsLen = result.logs.length;
        const truncatedLogs = (result.logs as unknown[]).slice(0, 10);
        truncatedLogs.push({ message: `[Truncated ${logsLen - 10} additional logs]`, timestamp: Date.now() });
        result.logs = truncatedLogs;
        size = estimateSize(result);
    }

    // Finally, truncate payload if still too large
    if (size > MAX_KV_SIZE && result.payload) {
        if (typeof result.payload === 'string' && result.payload.length > 500) {
            result.payload = `[Truncated payload, original: ${result.payload.length} bytes]`;
        } else if (typeof result.payload === 'object') {
            result.payload = '[Payload too large for KV storage]';
        }
    }

    return result;
}

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
                const truncatedData = truncateForKV(debugData);
                await kv.set(['system', 'debug', requestId], truncatedData, { expireIn: 10 * 60 * 1000 });
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

            const truncatedData = truncateForKV(debugData);
            await kv.set(['system', 'debug', requestId], truncatedData, { expireIn: 10 * 60 * 1000 });
            throw error;
        }
    });
}
