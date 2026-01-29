import { updateServiceStat, persistLog } from "./logger.ts";

export type CircuitStatus = "CLOSED" | "OPEN" | "HALF-OPEN";

interface CircuitState {
    status: CircuitStatus;
    failures: number;
    lastFailure: number;
    nextRetry: number;
}

const THRESHOLD = 15; // Failures before tripping
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
            const msg = `Circuit HALF-OPEN for ${service}`;
            console.log(`[GUARDIAN] ${msg}`);
            state.status = "HALF-OPEN";

            persistLog({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                service: "guardian",
                source: "info",
                message: msg
            });

            return true; // Allow one trial request
        }
        return false;
    }

    if (state.status === "HALF-OPEN") {
        return true;
    }

    return true;
}

export function recordSuccess(service: string) {
    const state = getCircuitState(service);
    if (state.status === "HALF-OPEN") {
        const msg = `Circuit CLOSED for ${service} (Recovered)`;
        console.log(`[GUARDIAN] ${msg}`);
        state.status = "CLOSED";
        state.failures = 0;
        updateServiceStat(service, "circuit_recovered");

        persistLog({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            service: "guardian",
            source: "info",
            message: msg
        });
    } else if (state.status === "CLOSED") {
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
        const msg = `Circuit TRIPPED for ${service} (${state.failures} failures)`;
        console.log(`[GUARDIAN] ${msg}`);
        updateServiceStat(service, "circuit_tripped");

        persistLog({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            service: "guardian",
            source: "stderr",
            message: msg
        });
    } else if (state.status === "HALF-OPEN") {
        state.status = "OPEN";
        state.nextRetry = Date.now() + TIMEOUT;
        const msg = `Circuit TRIPPED again for ${service}`;
        console.log(`[GUARDIAN] ${msg}`);

        persistLog({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            service: "guardian",
            source: "stderr",
            message: msg
        });
    }
}

export function getCircuitsSnapshot() {
    const snapshot: Record<string, CircuitState> = {};
    for (const [key, val] of circuits.entries()) {
        snapshot[key] = { ...val };
    }
    return snapshot;
}
