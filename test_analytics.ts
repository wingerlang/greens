import { kv } from './src/api/kv.ts';

console.log("--- Page Views ---");
let viewCount = 0;
for await (const entry of kv.list({ prefix: ["analytics_page_view"] })) {
    if (viewCount < 5) console.log(entry.key, entry.value);
    viewCount++;
}
console.log(`Total views: ${viewCount}\n`);

console.log("--- Events ---");
let eventCount = 0;
for await (const entry of kv.list({ prefix: ["analytics_event"] })) {
    if (eventCount < 5) console.log(entry.key, entry.value);
    eventCount++;
}
console.log(`Total events: ${eventCount}\n`);

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);
const cutoffStr = cutoff.toISOString();

const navigations: string[] = [];
for await (const entry of kv.list({ prefix: ["analytics_event"] })) {
    const e = entry.value as any;
    if (e.timestamp >= cutoffStr && e.type === 'omnibox_nav') {
        navigations.push(e.metadata?.path);
    }
}
console.log("Omnibox Navs last 30d:", navigations.length);
console.log("Sample Navs:", navigations.slice(0, 5));
