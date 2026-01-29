
const kv = await Deno.openKv("./guardian.db");

console.log("--- GUARDIAN KV SCAN ---");

// 1. Check Request Stats
console.log("\n[STATS]");
const statsIter = kv.list({ prefix: ["guardian", "stats"] });
let statsCount = 0;
for await (const entry of statsIter) {
    statsCount++;
    if (statsCount <= 20) {
        console.log(`${entry.key.join("/")}: ${entry.value instanceof Deno.KvU64 ? entry.value.value : JSON.stringify(entry.value)}`);
    }
}
console.log(`Total Stats Entries: ${statsCount}`);

// 2. Check Requests
console.log("\n[REQUESTS]");
const reqIter = kv.list({ prefix: ["guardian", "requests"] }, { limit: 5 });
for await (const entry of reqIter) {
    console.log(`${entry.key.join("/")}: ${JSON.stringify(entry.value)}`);
}

// 3. Check Logs
console.log("\n[LOGS]");
const logIter = kv.list({ prefix: ["guardian", "logs"] }, { limit: 5 });
for await (const entry of logIter) {
    console.log(`${entry.key.join("/")}: ${JSON.stringify(entry.value)}`);
}

// 4. Check Circuits
console.log("\n[CIRCUITS]");
// Note: Circuits are currently in-memory in circuitBreaker.ts, 
// they aren't persisted to KV yet (based on manual inspection of the code).
// But let's check if anything exists under "guardian/circuits" just in case or for future.
const circIter = kv.list({ prefix: ["guardian", "circuits"] });
for await (const entry of circIter) {
    console.log(`${entry.key.join("/")}: ${JSON.stringify(entry.value)}`);
}

kv.close();
