import { join, dirname } from "https://deno.land/std@0.208.0/path/mod.ts";

const dbPath = "./guardian.db";
const kv = await Deno.openKv(dbPath);
const date = new Date().toISOString().split('T')[0];

console.log(`Checking sessions for ${date}...`);
const iter = kv.list({ prefix: ["guardian", "sessions", date] });
let count = 0;
for await (const res of iter) {
    count++;
    console.log(`- [${count}] Key: ${JSON.stringify(res.key)}`);
    // console.log(`  Value: ${JSON.stringify(res.value)}`);
}

console.log(`Total sessions in KV for today: ${count}`);

const now = Date.now();
const window1m = now - 60 * 1000;
let activeCount = 0;
const iter2 = kv.list({ prefix: ["guardian", "sessions", date] });
for await (const res of iter2) {
    if (res.value.lastSeen >= window1m) activeCount++;
}
console.log(`Sessions active in last 1m: ${activeCount}`);
