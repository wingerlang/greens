const kv = await Deno.openKv("./greens.db");

const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";
const targetDate = "2026-03-10";

console.log(`Scanning EVERYTHING for User ${userId} on ${targetDate}...`);

const scanPrefix = async (prefix) => {
    const results = [];
    const iter = kv.list({ prefix });
    for await (const entry of iter) {
        const val = entry.value;
        const date = val.date || (val.performance?.date) || (val.plan?.date);
        if (date && date.startsWith(targetDate)) {
            results.push({ key: entry.key, value: val });
        }
    }
    return results;
};

const prefixes = ["activities", "exercise_entries", "strength_workouts", "planned_activities"];
for (const p of prefixes) {
    const found = await scanPrefix([p]);
    console.log(`Prefix [${p}]: Found ${found.length} entries.`);
    found.forEach(f => {
        console.log(`  Key: ${JSON.stringify(f.key)}`);
        console.log(`  Title: ${f.value.title || f.value.name || f.value.plan?.title}`);
        console.log(`  CreatedAt: ${f.value.createdAt}`);
        console.log(`  Distance: ${f.value.distance || f.value.distanceKm || f.value.performance?.distanceKm}`);
    });
}

await kv.close();
