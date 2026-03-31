
const kv = await Deno.openKv("./greens.db");

const targetDate = "2026-02-23";
const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";

console.log(`--- EXERCISE ENTRIES (LOKALA) ---`);
const iter1 = kv.list({ prefix: ["exercise_entries", userId, targetDate] });
for (let entry = await iter1.next(); !entry.done; entry = await iter1.next()) {
    console.log(`Key: ${JSON.stringify(entry.value.key)}`);
    console.log(`  Value: ${JSON.stringify(entry.value.value)}`);
}

console.log(`\n--- UNIVERSAL ACTIVITIES (SERVER) ---`);
const iter2 = kv.list({ prefix: ["activities", userId, targetDate] });
for (let entry = await iter2.next(); !entry.done; entry = await iter2.next()) {
    console.log(`Key: ${JSON.stringify(entry.value.key)}`);
    console.log(`  Value: ${JSON.stringify(entry.value.value)}`);
}

console.log(`\n--- STRENGTH WORKOUTS ---`);
const iter3 = kv.list({ prefix: ["strength_workouts", userId, targetDate] });
for (let entry = await iter3.next(); !entry.done; entry = await iter3.next()) {
    console.log(`Key: ${JSON.stringify(entry.value.key)}`);
    console.log(`  Value: ${JSON.stringify(entry.value.value)}`);
}

await kv.close();
