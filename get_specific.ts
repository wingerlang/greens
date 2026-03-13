const kv = await Deno.openKv("./greens.db");
const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";
const date = "2025-09-10";

console.log("Activity 50667861...");
const res = await kv.get(["activities", userId, date, "50667861-2de5-4198-99a2-05879345a8b1"]);
console.log(JSON.stringify(res.value, null, 2));

console.log("\nAll activities on 2025-09-10:");
for await (const entry of kv.list({ prefix: ["activities", userId, date] })) {
    const v = entry.value;
    console.log(`- ID: ${v.id}, Source: ${v.source || v.performance?.source?.source}, Created: ${v.createdAt}`);
}

console.log("\nAll exercise_entries on 2025-09-10:");
for await (const entry of kv.list({ prefix: ["exercise_entries", userId, date] })) {
    const v = entry.value;
    console.log(`- ID: ${v.id}, Source: ${v.source}, Title: ${v.title}, Created: ${v.createdAt}`);
}

await kv.close();
