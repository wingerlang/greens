import { kv } from './src/api/kv.ts';

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);
const cutoffStr = cutoff.toISOString();

const stats = {
    types: {} as Record<string, number>,
    total: 0
};

for await (const entry of kv.list({ prefix: ["analytics_event"] })) {
    const e = entry.value as any;
    if (e.timestamp >= cutoffStr) {
        stats.types[e.type] = (stats.types[e.type] || 0) + 1;
        stats.total++;
        if (e.type === 'omnibox_nav') {
            console.log("Omnibox Nav:", e.metadata?.path, "From:", e.path);
        }
    }
}

console.log("\nSummary of last 30d events:");
console.log(stats);
