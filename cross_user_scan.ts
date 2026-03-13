const kv = await Deno.openKv("./greens.db");

const targetDate = "2026-03-10";

console.log(`Searching for ALL entries on ${targetDate} across ALL users...`);

const prefixes = ["activities", "exercise_entries", "strength_workouts"];
for (const p of prefixes) {
    console.log(`\nPrefix: ${p}`);
    const iter = kv.list({ prefix: [p] });
    for await (const entry of iter) {
        const userId = entry.key[1];
        const dateKey = entry.key[2];
        const val = entry.value;

        // Match by key date (YYYY-MM-DD) or value date
        const matchKey = typeof dateKey === 'string' && dateKey.startsWith(targetDate);
        const valDate = val.date || val.performance?.date;
        const matchVal = typeof valDate === 'string' && valDate.startsWith(targetDate);

        if (matchKey || matchVal) {
            console.log(`  User: ${userId}, ID: ${val.id}, Title: ${val.title || val.name || val.plan?.title || 'No Title'}, CreatedAt: ${val.createdAt}`);
        }
    }
}

await kv.close();
