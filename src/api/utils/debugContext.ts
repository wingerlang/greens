import { AsyncLocalStorage } from "node:async_hooks";

export interface DebugLog {
    type: 'kv' | 'log';
    operation: string;
    key?: string;
    duration: number;
    timestamp: number;
    details?: any;
    error?: string;
}

export interface DebugContext {
    requestId: string;
    startTime: number;
    logs: DebugLog[];
    startMemory: Deno.MemoryUsage;
}

export const debugStorage = new AsyncLocalStorage<DebugContext>();

export function getDebugContext(): DebugContext | undefined {
    return debugStorage.getStore();
}

export function addDebugLog(log: DebugLog) {
    const store = getDebugContext();
    if (store) {
        store.logs.push(log);
    }
}
