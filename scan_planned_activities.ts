const kv = await Deno.openKv("./greens.db");

const targetDate = "2026-03-10";
console.log(`Searching planned_activities for ${targetDate}...`);

const iter = kv.list({ prefix: ["planned_activities"] });
let count = 0;
for await (const entry of iter) {
    const val = entry.value;
    if (val.date?.startsWith(targetDate)) {
        count++;
        console.log(`Key: ${JSON.stringify(entry.key)}`);
        console.log(`  Title: ${val.title}, Status: ${val.status}, ExternalId: ${val.externalId}`);
    }
}

console.log(`Found ${count} planned activities for ${targetDate}.`);
await kv.close();
