import { CONFIG } from "./config.ts";

export interface ServiceHealth {
    status: "healthy" | "unhealthy" | "unknown";
    lastCheck: number;
    consecutiveFailures: number;
    latency: number;
}

const healthState = new Map<string, ServiceHealth>();

export function getServiceHealth(service: string): ServiceHealth {
    return healthState.get(service) || { status: "unknown", lastCheck: 0, consecutiveFailures: 0, latency: 0 };
}

async function checkService(name: string, port: number) {
    const start = performance.now();
    let success = false;

    try {
        // We try to fetch root or a lightweight endpoint.
        // Assuming services respond to / or have a /health.
        // For generic usage, just connecting to root is fine.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.health.timeout);

        await fetch(`http://127.0.0.1:${port}/`, {
            method: "HEAD",
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        success = true;
    } catch (e) {
        success = false;
    }

    const latency = performance.now() - start;
    const state = getServiceHealth(name);

    state.lastCheck = Date.now();
    state.latency = latency;

    if (success) {
        state.status = "healthy";
        state.consecutiveFailures = 0;
    } else {
        state.consecutiveFailures++;
        if (state.consecutiveFailures >= CONFIG.health.failureThreshold) {
            state.status = "unhealthy";
        }
    }

    healthState.set(name, state);
    if (!success && state.consecutiveFailures === 1) {
        // First failure log
        // console.warn(`[GUARDIAN] Health Check failed for ${name}`);
    } else if (success && state.consecutiveFailures > 0) {
        console.log(`[GUARDIAN] ${name} recovered!`);
    }
}

export function startHealthChecks() {
    console.log("[GUARDIAN] Starting Active Health Checks...");

    // Check Frontend
    setInterval(() => checkService("frontend", CONFIG.ports.internalFrontend), CONFIG.health.interval);

    // Check Backend
    setInterval(() => checkService("backend", CONFIG.ports.internalBackend), CONFIG.health.interval);
}
