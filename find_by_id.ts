const kv = await Deno.openKv("./greens.db");

const targetId = "50667861-2de5-4198-99a2-05879345a8b1";
console.log(`Global Search for Activity ID: ${targetId}`);

const prefixes = ["activities", "exercise_entries", "strength_workouts", "planned_activities", "idx_activities_by_id"];

for (const p of prefixes) {
    for await (const entry of kv.list({ prefix: [p] })) {
        if (JSON.stringify(entry.key).includes(targetId) || (entry.value && (entry.value.id === targetId || entry.value.externalId === targetId))) {
            console.log(`Found in [${p}]:`);
            console.log(`  Key: ${JSON.stringify(entry.key)}`);
            console.log(`  Value: ${JSON.stringify(entry.value)}`);
        }
    }
}

await kv.close();
