const kv = await Deno.openKv("./greens.db");

const targetId = "559d539e-82cf-40b1-859d-f9942f68daee";
console.log(`Global Search for Activity ID: ${targetId}`);

const prefixes = ["activities", "exercise_entries", "strength_workouts", "planned_activities", "idx_activities_by_id"];

const results: any[] = [];
for (const p of prefixes) {
    for await (const entry of kv.list({ prefix: [p] })) {
        if (JSON.stringify(entry.key).includes(targetId) || (entry.value && ((entry.value as any).id === targetId || (entry.value as any).externalId === targetId))) {
            results.push({ key: entry.key, value: entry.value });
        }
    }
}
await Deno.writeTextFile("./search_result.json", JSON.stringify(results, null, 2));
console.log(`Search complete. Results written to search_result.json. Found ${results.length} matches.`);

await kv.close();
