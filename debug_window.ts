const kv = await Deno.openKv("./guardian.db");

const now = Date.now();
const window10m = 10 * 60 * 1000;
const start10m = now - window10m;

console.log("Current time:", now, new Date(now).toISOString());
console.log("Window start (10m):", start10m, new Date(start10m).toISOString());

// 1. Check all requests in last 10 mins without prefix constraint if possible
console.log("\n--- Scanning for requests in last 10 mins ---");
const iter = kv.list({
    start: ["guardian", "requests", start10m],
    end: ["guardian", "requests", now + 1000]
});

let count = 0;
const services = new Set();
for await (const res of iter) {
    count++;
    services.add(res.value.targetService);
    if (count <= 5) {
        console.log(`Match ${count}:`, JSON.stringify(res.key), "Service:", res.value.targetService);
    }
}

console.log("\nTotal requests found in last 10 mins:", count);
console.log("Services seen in window:", Array.from(services));

// 2. Check a few absolute latest requests to see what their timestamps are
console.log("\n--- Latest 5 requests in KV ---");
const latestIter = kv.list({ prefix: ["guardian", "requests"] }, { limit: 5, reverse: true });
for await (const res of latestIter) {
    console.log(JSON.stringify(res.key), "Timestamp in record:", res.value.timestamp, "Service:", res.value.targetService);
}

kv.close();
