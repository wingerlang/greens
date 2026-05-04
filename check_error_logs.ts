const kv = await Deno.openKv("./greens.db");
console.log("Checking recent error logs...");
const iter = kv.list({ prefix: ["logs", "error"] }, { limit: 20, reverse: true });
for await (const entry of iter) {
    console.log(JSON.stringify(entry.value, null, 2));
}
await kv.close();
