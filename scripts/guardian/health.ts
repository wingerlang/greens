import { CONFIG } from "./config.ts";
import { recordSuccess, recordFailure } from "./circuitBreaker.ts";
import { manager } from "./services.ts";

const failureCounts = new Map<string, number>();
const RESTART_THRESHOLD = 3;

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

        // Use 127.0.0.1 to avoid IPv6 issues on local dev
        const res = await fetch(`http://127.0.0.1:${port}/`, {
            method: "HEAD",
            signal: controller.signal
        }).catch(async (err) => {
            // Retry with GET if HEAD fails (some dev servers might not handle HEAD well?)
            if (err.name === 'AbortError') throw err;

            return await fetch(`http://127.0.0.1:${port}/`, {
                method: "GET",
                signal: controller.signal
            });
        });

        clearTimeout(id);

        if (res.status && res.status < 502) {
            // Service is reachable and responding (even if 404 or 500)
            recordSuccess(name);
            failureCounts.set(name, 0);
        } else {
            handleFailure(name, service);
        }
    } catch (e) {
        handleFailure(name, service);
    }
}

function handleFailure(name: string, service: any) {
    recordFailure(name);

    const currentFailures = (failureCounts.get(name) || 0) + 1;
    failureCounts.set(name, currentFailures);

    if (currentFailures >= RESTART_THRESHOLD) {
        service.addLog("info", `Service unresponsive for ${currentFailures} checks. Forcing restart...`);
        service.restart();
        failureCounts.set(name, 0); // Reset after triggering restart
    }
}
