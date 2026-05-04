const kv = await Deno.openKv("./greens.db");

const prefixes = new Set();
console.log("Listing all prefixes in KV store...");

for await (const entry of kv.list({ prefix: [] })) {
    prefixes.add(JSON.stringify(entry.key[0]));
}

console.log("Found prefixes:", Array.from(prefixes));

await kv.close();
