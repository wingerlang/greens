// Debug tracing for live request flow inspection

interface DebugEntry {
    id: string;
    timestamp: number;
    phase: "RECEIVED" | "MIDDLEWARE" | "PROXY_START" | "PROXY_SUCCESS" | "PROXY_FAIL" | "RESPONSE";
    service: string;
    method: string;
    path: string;
    status?: number;
    duration?: number;
    error?: string;
    details?: string;
    ip?: string;
}

const MAX_ENTRIES = 200;
const debugLog: DebugEntry[] = [];

export function recordDebug(entry: Omit<DebugEntry, "id" | "timestamp">): void {
    const fullEntry: DebugEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        ...entry
    };

    debugLog.unshift(fullEntry);

    // Trim to max size
    if (debugLog.length > MAX_ENTRIES) {
        debugLog.length = MAX_ENTRIES;
    }
}

export function getDebugLog(): DebugEntry[] {
    return debugLog;
}

export function clearDebugLog(): void {
    debugLog.length = 0;
}

// Helper to create a request tracker
export function createRequestTracker(requestId: string, service: string, method: string, path: string, ip: string) {
    const startTime = Date.now();

    recordDebug({
        phase: "RECEIVED",
        service,
        method,
        path,
        ip,
        details: `Request ${requestId} received`
    });

    return {
        middleware(name: string, details?: string) {
            recordDebug({
                phase: "MIDDLEWARE",
                service,
                method,
                path,
                duration: Date.now() - startTime,
                details: `[${name}] ${details || ''}`
            });
        },
        proxyStart(targetPort: number) {
            recordDebug({
                phase: "PROXY_START",
                service,
                method,
                path,
                duration: Date.now() - startTime,
                details: `Proxying to port ${targetPort}`
            });
        },
        proxySuccess(status: number) {
            recordDebug({
                phase: "PROXY_SUCCESS",
                service,
                method,
                path,
                status,
                duration: Date.now() - startTime,
                details: `Proxy completed with status ${status}`
            });
        },
        proxyFail(error: string) {
            recordDebug({
                phase: "PROXY_FAIL",
                service,
                method,
                path,
                duration: Date.now() - startTime,
                error,
                details: `Proxy failed: ${error}`
            });
        },
        response(status: number) {
            recordDebug({
                phase: "RESPONSE",
                service,
                method,
                path,
                status,
                duration: Date.now() - startTime,
                details: `Response sent with status ${status}`
            });
        }
    };
}
