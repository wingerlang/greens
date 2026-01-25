/// <reference lib="deno.ns" />
import { updateServiceStat } from "./logger.ts";

export type CircuitStatus = "CLOSED" | "OPEN" | "HALF-OPEN";

interface CircuitState {
    status: CircuitStatus;
    failures: number;
    lastFailure: number;
    nextRetry: number;
}

const THRESHOLD = 5; // Failures before tripping
const TIMEOUT = 30000; // 30s before Half-Open

const circuits = new Map<string, CircuitState>();

export function getCircuitState(service: string): CircuitState {
    let state = circuits.get(service);
    if (!state) {
        state = { status: "CLOSED", failures: 0, lastFailure: 0, nextRetry: 0 };
        circuits.set(service, state);
    }
    return state;
}

export function checkCircuit(service: string): boolean {
    const state = getCircuitState(service);
    const now = Date.now();

    if (state.status === "CLOSED") return true;

    if (state.status === "OPEN") {
        if (now > state.nextRetry) {
            console.log(`[GUARDIAN] Circuit HALF-OPEN for ${service}`);
            state.status = "HALF-OPEN";
            return true; // Allow one trial request
        }
        return false;
    }

    if (state.status === "HALF-OPEN") {
        // We only allow 1 request at a time in half-open generally,
        // but for simplicity, we allow traffic. If it fails, it goes back to OPEN immediately.
        return true;
    }

    return true;
}

export function recordSuccess(service: string) {
    const state = getCircuitState(service);
    if (state.status === "HALF-OPEN") {
        console.log(`[GUARDIAN] Circuit CLOSED for ${service} (Recovered)`);
        state.status = "CLOSED";
        state.failures = 0;
        updateServiceStat(service, "circuit_recovered");
    } else if (state.status === "CLOSED") {
        // Decay failures over time?
        // For now, just reset if we have some failures but didn't trip
        if (state.failures > 0) state.failures = 0;
    }
}

export function recordFailure(service: string) {
    const state = getCircuitState(service);
    state.failures++;
    state.lastFailure = Date.now();

    if (state.status === "CLOSED" && state.failures >= THRESHOLD) {
        state.status = "OPEN";
        state.nextRetry = Date.now() + TIMEOUT;
        console.log(`[GUARDIAN] Circuit TRIPPED for ${service} (${state.failures} failures)`);
        updateServiceStat(service, "circuit_tripped");
    } else if (state.status === "HALF-OPEN") {
        state.status = "OPEN";
        state.nextRetry = Date.now() + TIMEOUT; // Back to timeout
        console.log(`[GUARDIAN] Circuit TRIPPED again for ${service}`);
    }
}

export function getCircuitsSnapshot() {
    const snapshot: Record<string, CircuitState> = {};
    for (const [key, val] of circuits.entries()) {
        snapshot[key] = { ...val };
    }
    return snapshot;
}
