const kv = await Deno.openKv("./greens.db");

const targetDate = "2025-09-10";
const results = [];

console.log(`Analyzing exercise_entries for ${targetDate}...`);

const iter = kv.list({ prefix: ["exercise_entries"] });
for await (const entry of iter) {
    const val = entry.value;
    if (entry.key[2] === targetDate) {
        results.push({
            id: val.id,
            title: val.title,
            createdAt: val.createdAt,
            updatedAt: val.updatedAt,
            source: val.source,
            externalId: val.externalId
        });
    }
}

console.log(JSON.stringify(results, null, 2));
await kv.close();
