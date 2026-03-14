const kv = await Deno.openKv("./greens.db");
for await (const entry of kv.list({ prefix: ["users"] })) {
    const val = entry.value as any;
    if (val.username === "tester4" || val.displayName === "tester4" || JSON.stringify(val).includes("tester4")) {
        console.log("Found user:", { key: entry.key, value: entry.value });
    }
}
await kv.close();
export {};
