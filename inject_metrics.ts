const kv = await Deno.openKv("./guardian.db");

// Simulate some requests to "frontend" and "backend"
// keyed by timestamp: ["guardian", "requests", timestamp, uuid]

const now = Date.now();
const services = ["frontend", "backend"];

console.log("Injecting test request metrics for last 5-15 mins...");

for (let i = 0; i < 50; i++) {
    const service = services[i % 2];
    const ts = now - Math.floor(Math.random() * 20 * 60 * 1000); // 0-20 mins ago

    await kv.set(["guardian", "requests", ts, crypto.randomUUID()], {
        timestamp: ts,
        path: "/api/test",
        method: "GET",
        status: 200,
        duration: 10,
        ip: "12.34.56.78",
        targetService: service,
        resourceType: "api",
        sessionId: "test-session"
    }, { expireIn: 7 * 24 * 60 * 60 * 1000 });
}

kv.close();
console.log("Done.");
