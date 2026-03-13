const kv = await Deno.openKv("./greens.db");

const targetDate = "2025-09-10";
const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";

console.log(`Analyzing exercise_entries for ${userId} on ${targetDate}...`);

const iter = kv.list({ prefix: ["exercise_entries", userId, targetDate] });
for await (const entry of iter) {
    console.log(`Key: ${JSON.stringify(entry.key)}`);
    console.log(`  Value: ${JSON.stringify(entry.value)}`);
}

await kv.close();
