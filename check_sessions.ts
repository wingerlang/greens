const kv = await Deno.openKv("./greens.db");
console.log("Checking active sessions...");
const iter = kv.list({ prefix: ["sessions"] });
for await (const entry of iter) {
    console.log(JSON.stringify(entry.value, null, 2));
}
await kv.close();
