import { debugStorage, DebugContext } from "../utils/debugContext.ts";
import { kv } from "../kv.ts";

export async function debugMiddleware(req: Request, next: (req: Request) => Promise<Response>): Promise<Response> {
    // Only run if DEBUG_MODE is set or implicitly in dev (we rely on env var)
    const isDebugMode = Deno.env.get("DEBUG_MODE") === "true";

    if (!isDebugMode) {
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
            const response = await next(req);

            // Post-request processing
            const duration = performance.now() - startTime;
            const endMemory = Deno.memoryUsage();

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
