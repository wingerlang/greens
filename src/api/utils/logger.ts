import { kv } from "../kv.ts";

export interface LogEntry {
    id: string;
    timestamp: string;
    level: 'error' | 'warn' | 'info';
    message: string;
    stack?: string;
    context?: any;
    userId?: string;
    path?: string;
}

export interface MetricEntry {
    name: string;
    value: number;
    timestamp: string;
    tags?: Record<string, string>;
}

export async function logError(error: Error | string, context?: any, userId?: string, path?: string) {
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const entry: LogEntry = {
        id,
        timestamp,
        level: 'error',
        message,
        stack,
        context,
        userId,
        path
    };

    // Store in KV with expiration (e.g., 7 days)
    // Key: ['logs', 'error', timestamp, id]
    await kv.set(['logs', 'error', timestamp, id], entry, { expireIn: 7 * 24 * 60 * 60 * 1000 });

    // Also log to console for immediate visibility
    console.error(`[Logger] ${message}`, context || '');
}

export async function getErrorLogs(limit = 100): Promise<LogEntry[]> {
    const iter = kv.list({ prefix: ['logs', 'error'] }, { limit, reverse: true });
    const logs: LogEntry[] = [];
    for await (const entry of iter) {
        logs.push(entry.value as LogEntry);
    }
    return logs;
}

export async function logMetric(name: string, value: number, tags?: Record<string, string>) {
    const timestamp = new Date().toISOString();
    // Aggregation keys could be added here (e.g. per minute)
    // For now, just raw stream with short expiration (24h)
    await kv.set(['metrics', name, timestamp], { value, tags }, { expireIn: 24 * 60 * 60 * 1000 });
}

export async function getMetrics(name: string, limit = 100): Promise<{timestamp: string, value: number, tags?: any}[]> {
    const iter = kv.list({ prefix: ['metrics', name] }, { limit, reverse: true });
    const metrics: {timestamp: string, value: number, tags?: any}[] = [];
    for await (const entry of iter) {
        // extract timestamp from key
        const timestamp = entry.key[2] as string;
        const val = entry.value as any;
        metrics.push({ timestamp, value: val.value, tags: val.tags });
    }
    return metrics;
}
