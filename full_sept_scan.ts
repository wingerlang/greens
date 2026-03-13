const kv = await Deno.openKv("./greens.db");

const targetDate = "2025-09-10";
const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";

console.log(`FULL SCAN for ${userId} on ${targetDate}...`);

console.log(`\n--- exercise_entries ---`);
let eeCount = 0;
for await (const entry of kv.list({ prefix: ["exercise_entries", userId, targetDate] })) {
    eeCount++;
    console.log(`Key: ${JSON.stringify(entry.key)}`);
    const v = entry.value;
    console.log(`  Title: ${v.title}, Notes: ${v.notes}, Dist: ${v.distance}, Dur: ${v.durationMinutes}, CreatedAt: ${v.createdAt}, Id: ${v.id}, Source: ${v.source}`);
}
console.log(`Total exercise_entries: ${eeCount}`);

console.log(`\n--- activities ---`);
let aCount = 0;
for await (const entry of kv.list({ prefix: ["activities", userId, targetDate] })) {
    aCount++;
    console.log(`Key: ${JSON.stringify(entry.key)}`);
    const v = entry.value;
    console.log(`  Title: ${v.title || v.plan?.title}, Dist: ${v.distance || v.performance?.distanceKm}, Dur: ${v.durationMinutes || v.performance?.durationMinutes}, CreatedAt: ${v.createdAt}, Id: ${v.id}, Source: ${v.source}`);
}
console.log(`Total activities: ${aCount}`);

await kv.close();
