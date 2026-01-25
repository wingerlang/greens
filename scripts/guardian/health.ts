import { CONFIG } from "./config.ts";
import { recordSuccess, recordFailure } from "./circuitBreaker.ts";
import { manager } from "./services.ts";

export function startHealthMonitor() {
    console.log("[GUARDIAN] Starting Active Health Monitor...");

    setInterval(async () => {
        // Check Frontend
        await checkService("frontend", CONFIG.ports.internalFrontend);
        // Check Backend
        await checkService("backend", CONFIG.ports.internalBackend);
    }, 10000); // 10s interval
}

async function checkService(name: string, port: number) {
    const service = manager.get(name);
    // If service is manually stopped or not registered, don't ping
    if (!service || service.stats.status === "stopped" || service.stats.status === "stopping") {
        return;
    }

    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 2000);

        // Use HEAD to minimize load
        const res = await fetch(`http://localhost:${port}/`, {
            method: "HEAD",
            signal: controller.signal
        }).catch(async () => {
             // Retry with GET if HEAD fails (some dev servers might not handle HEAD well?)
             // But for standard servers HEAD should be fine.
             // If fetch throws, it's network error.
             throw new Error("Network error");
        });

        clearTimeout(id);

        if (res.status && res.status < 502) {
            // Service is reachable and responding (even if 404 or 500)
            recordSuccess(name);
        } else {
             // 502, 503, 504 are gateway/proxy errors (if we were proxying)
             // But here we are hitting direct.
             // If the service returns 503, it declares itself down.
             recordFailure(name);
        }
    } catch (e) {
        // Connection refused, timeout
        recordFailure(name);
    }
}
