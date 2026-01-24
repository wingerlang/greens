import { kv } from "../kv.ts";
import { safeStringify } from "../utils/jsonUtils.ts";

export interface SystemStats {
  totalKeys: number;
  totalSize: number; // Estimated bytes
  byPrefix: Record<string, { count: number; size: number }>;
  timestamp: string;
}

export interface StatsSnapshot {
  date: string; // YYYY-MM-DD
  timestamp: string;
  stats: SystemStats;
}

export class StatsRepository {
  /**
   * Scans the entire KV store to calculate statistics.
   * This is an expensive operation and should be used sparingly.
   */
  async getSystemStats(): Promise<SystemStats> {
    let totalKeys = 0;
    let totalSize = 0;
    const byPrefix: Record<string, { count: number; size: number }> = {};

    for await (const entry of kv.list({ prefix: [] })) {
      totalKeys++;

      // Estimate size: key size + serialized value size
      const valueSize = safeStringify(entry.value).length;
      const keySize = safeStringify(entry.key).length;
      const entrySize = valueSize + keySize;

      totalSize += entrySize;

      const rootPrefix = String(entry.key[0]);
      if (!byPrefix[rootPrefix]) {
        byPrefix[rootPrefix] = { count: 0, size: 0 };
      }
      byPrefix[rootPrefix].count++;
      byPrefix[rootPrefix].size += entrySize;
    }

    return {
      totalKeys,
      totalSize,
      byPrefix,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Records a daily snapshot if one doesn't exist for today.
   * Returns true if a new snapshot was created.
   */
  async recordDailySnapshot(): Promise<boolean> {
    const today = new Date().toISOString().split("T")[0];
    const key = ["system", "stats_history", today];

    const existing = await kv.get(key);
    if (existing.value) return false;

    const stats = await this.getSystemStats();
    const snapshot: StatsSnapshot = {
      date: today,
      timestamp: stats.timestamp,
      stats,
    };

    await kv.set(key, snapshot);
    return true;
  }

  /**
   * Retrieves historical stats snapshots.
   * Limit defaults to 30 days.
   */
  async getStatsHistory(limit = 30): Promise<StatsSnapshot[]> {
    const iter = kv.list<StatsSnapshot>(
      { prefix: ["system", "stats_history"] },
      {
        reverse: true,
        limit,
      },
    );

    const history: StatsSnapshot[] = [];
    for await (const entry of iter) {
      history.push(entry.value);
    }

    return history.reverse(); // Return in chronological order
  }
}

export const statsRepo = new StatsRepository();
