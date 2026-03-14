const kv = await Deno.openKv("./greens.db");
const userIds = new Set();
for await (const entry of kv.list({ prefix: ["activities"] })) {
    if (entry.key.length >= 2) {
        userIds.add(entry.key[1]);
    }
}
console.log("Found activities for userIds:", Array.from(userIds));

// Also check exercise_entries
const entryUserIds = new Set();
for await (const entry of kv.list({ prefix: ["exercise_entries"] })) {
    if (entry.key.length >= 2) {
        entryUserIds.add(entry.key[1]);
    }
}
console.log("Found exercise_entries for userIds:", Array.from(entryUserIds));

await kv.close();
export {};
