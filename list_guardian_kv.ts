const kv = await Deno.openKv("./guardian.db");
for await (const entry of kv.list({ prefix: [] })) {
    console.log(entry.key, JSON.stringify(entry.value).length > 100 ? "Long value" : entry.value);
}
await kv.close();
export {};
