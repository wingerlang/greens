const kv = await Deno.openKv("./greens.db");

const targetDate = "2026-03-10";
console.log(`Analyzing feed_events for ${targetDate}...`);

const iter = kv.list({ prefix: ["feed_events"] });
for await (const entry of iter) {
    const keyStr = JSON.stringify(entry.key);
    if (keyStr.includes(targetDate)) {
        console.log(`Key: ${keyStr}`);
        console.log(`  Value: ${JSON.stringify(entry.value)}`);
    }
}

await kv.close();
