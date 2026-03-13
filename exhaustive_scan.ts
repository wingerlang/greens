const kv = await Deno.openKv("./greens.db");

console.log("Listing all users...");
for await (const entry of kv.list({ prefix: ["users"] })) {
    const user = entry.value;
    console.log(`User: ${user.username}, ID: ${user.id}`);
}

const allDates = {};

console.log("\nScanning all [exercise_entries]...");
for await (const entry of kv.list({ prefix: ["exercise_entries"] })) {
    const val = entry.value;
    const userId = entry.key[1];
    const date = entry.key[2];

    if (!allDates[date]) allDates[date] = [];
    allDates[date].push({ userId, id: val.id, title: val.title || val.notes });
}

const entries = Object.entries(allDates);
entries.sort((a, b) => b[1].length - a[1].length);

console.log("\nTop 10 dates by entry count in [exercise_entries]:");
entries.slice(0, 10).forEach(([date, list]) => {
    console.log(`${date}: ${list.length} entries`);
    if (list.length > 2) {
        list.forEach(e => console.log(`  - User ${e.userId.substring(0, 8)}: ${e.title}`));
    }
});

await kv.close();
