const kv = await Deno.openKv("./guardian.db");
const keys = new Set();
for await (const entry of kv.list({ prefix: [] })) {
    keys.add(JSON.stringify(entry.key[0]));
}
console.log("Unique top-level keys in guardian.db:", Array.from(keys));
await kv.close();
export {};
