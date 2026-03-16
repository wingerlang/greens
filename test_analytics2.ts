import { kv } from './src/api/kv.ts';

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);
const cutoffStr = cutoff.toISOString();

console.log("--- Analytics Events in KV ---");
let count = 0;
for await (const entry of kv.list({ prefix: ["analytics_event"] })) {
    const e = entry.value as any;
    if (e.timestamp >= cutoffStr) {
        console.log(`Type: ${e.type}, Path: ${e.path}, Label: ${e.label}, Metadata: ${JSON.stringify(e.metadata)}`);
        count++;
    }
}
console.log(`\nFound ${count} events in last 30 days.`);
