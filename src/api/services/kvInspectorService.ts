import { kv } from "../kv.ts";
import { getAllUsers } from "../db/user.ts";
import { safeStringify } from "../utils/jsonUtils.ts";

export interface UserStorageUsage {
    userId: string;
    username: string;
    keyCount: number;
    totalSize: number;
    prefixes: Record<string, number>; // prefix -> size
}

export interface OrphanedData {
    prefix: string;
    key: string; // JSON string of the key
    size: number;
    inferredUserId: string;
}

export class KvInspectorService {

    /**
     * Analyzes storage usage per user and identifies orphaned data.
     * Assumes user ID is at index 1 for most user-scoped keys (e.g., ['activities', userId, ...])
     * or index 0 for some (like ['users', userId]).
     */
    async getUserStorageUsage(): Promise<{ users: UserStorageUsage[], orphans: OrphanedData[] }> {
        const users = await getAllUsers();
        const userMap = new Map(users.map(u => [u.id, u]));
        const usageMap = new Map<string, UserStorageUsage>();

        // Initialize usage map
        for (const user of users) {
            usageMap.set(user.id, {
                userId: user.id,
                username: user.username,
                keyCount: 0,
                totalSize: 0,
                prefixes: {}
            });
        }

        const orphans: OrphanedData[] = [];

        for await (const entry of kv.list({ prefix: [] })) {
            const key = entry.key;
            const rootPrefix = String(key[0]);

            // Skip system keys
            if (rootPrefix === 'system' || rootPrefix === 'idx_activities_source' || rootPrefix.startsWith('stats')) continue;

            let userId: string | null = null;

            // Determine User ID based on known patterns
            if (['activities', 'goals', 'meal_entries', 'weight_entries', 'strength_sessions', 'prs', 'user_profiles', 'user_data'].includes(rootPrefix)) {
                if (key.length > 1) userId = String(key[1]);
            } else if (rootPrefix === 'users') {
                if (key.length > 1) userId = String(key[1]);
            }

            const valueSize = safeStringify(entry.value).length;
            const keySize = safeStringify(entry.key).length;
            const entrySize = valueSize + keySize;

            if (userId) {
                if (userMap.has(userId)) {
                    const usage = usageMap.get(userId)!;
                    usage.keyCount++;
                    usage.totalSize += entrySize;
                    usage.prefixes[rootPrefix] = (usage.prefixes[rootPrefix] || 0) + entrySize;
                } else {
                    // Orphaned data
                    orphans.push({
                        prefix: rootPrefix,
                        key: safeStringify(key),
                        size: entrySize,
                        inferredUserId: userId
                    });
                }
            }
        }

        return {
            users: Array.from(usageMap.values()).sort((a, b) => b.totalSize - a.totalSize),
            orphans
        };
    }

    /**
     * Lists keys under a specific prefix.
     * Acts like a directory listing.
     */
    async listKeys(prefix: unknown[]): Promise<{ subPrefixes: string[], keys: { key: unknown[], size: number }[] }> {
        const iter = kv.list({ prefix });
        const subPrefixes = new Set<string>();
        const keys: { key: unknown[], size: number }[] = [];

        for await (const entry of iter) {
            const remainingKey = entry.key.slice(prefix.length);

            if (remainingKey.length === 0) {
                // Exact match (shouldn't happen with prefix list, but safe to ignore)
                continue;
            }

            if (remainingKey.length === 1) {
                // Leaf node (File)
                const valueSize = safeStringify(entry.value).length;
                keys.push({ key: entry.key, size: valueSize });
            } else {
                // Folder
                subPrefixes.add(String(remainingKey[0]));
            }
        }

        return {
            subPrefixes: Array.from(subPrefixes).sort(),
            keys: keys.sort((a, b) => String(a.key).localeCompare(String(b.key)))
        };
    }

    /**
     * Gets the value for a specific key
     */
    async getKeyValue(key: unknown[]): Promise<unknown> {
        const res = await kv.get(key);
        return res.value;
    }
}

export const kvInspector = new KvInspectorService();
