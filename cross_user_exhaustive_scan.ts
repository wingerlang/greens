const kv = await Deno.openKv("./greens.db");

const targetDate = "2026-03-10";
console.log(`Searching ALL [exercise_entries] for ${targetDate}...`);

let totalFound = 0;
for await (const entry of kv.list({ prefix: ["exercise_entries"] })) {
    const val = entry.value;
    const userId = entry.key[1];
    const date = entry.key[2];

    if (date === targetDate) {
        totalFound++;
        console.log(`  User: ${userId}, ID: ${val.id}, Title: ${val.title}, Source: ${val.source}`);
    }
}

console.log(`Total Found: ${totalFound}`);

console.log(`\nSearching ALL [activities] for ${targetDate}...`);
let actsFound = 0;
for await (const entry of kv.list({ prefix: ["activities"] })) {
    const val = entry.value;
    const userId = entry.key[1];
    const date = entry.key[2];

    if (date === targetDate) {
        actsFound++;
        console.log(`  User: ${userId}, ID: ${val.id}, Title: ${val.title || val.plan?.title}, Source: ${val.source}`);
    }
}
console.log(`Total Found: ${actsFound}`);

await kv.close();
