import { kv } from "../kv.ts";

export interface AuditEntry {
    timestamp: string;
    actorId: string;
    action: string;
    targetId?: string;
    metadata?: Record<string, any>;
    ip?: string;
}

/**
 * Logs a sensitive action to the audit log in KV.
 * Keys: ["audit", timestamp_iso]
 */
export async function logAudit(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
    const timestamp = new Date().toISOString();
    const fullEntry: AuditEntry = { ...entry, timestamp };

    // We use a timestamp-based key for chronological listing
    await kv.set(["audit", timestamp], fullEntry);

    // Also log to console for visibility in logs
    console.log(`[AUDIT] ${entry.actorId} performed ${entry.action} on ${entry.targetId || 'system'}`);
}

/**
 * Retrieves audit logs, optionally filtered or limited.
 */
export async function getAuditLogs(limit = 100): Promise<AuditEntry[]> {
    const iter = kv.list<AuditEntry>({ prefix: ["audit"] }, { limit, reverse: true });
    const logs: AuditEntry[] = [];
    for await (const entry of iter) {
        logs.push(entry.value);
    }
    return logs;
}
