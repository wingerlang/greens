const kv = await Deno.openKv("./greens.db");

const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";
const targetDate = "2026-03-10";

console.log(`Analyzing activities for User ${userId} on ${targetDate}...`);

// 1. Primary activities
const activities = [];
for await (const entry of kv.list({ prefix: ["activities", userId, targetDate] })) {
    activities.push({ key: entry.key, value: entry.value });
}

// 2. Strength sessions
const strength = [];
for await (const entry of kv.list({ prefix: ["strength_workouts", userId] })) {
    const act = entry.value;
    if (act.date && act.date.startsWith(targetDate)) {
        strength.push({ key: entry.key, value: entry.value });
    }
}

console.log(`Found ${activities.length} primary activities in prefixed storage.`);
activities.forEach(a => {
    console.log(`Activity ID: ${a.value.id}, Title: ${a.value.title || a.value.plan?.title}, Source: ${a.value.performance?.source?.source}, CreatedAt: ${a.value.createdAt}`);
});

console.log(`Found ${strength.length} strength workouts for this date.`);
strength.forEach(s => {
    console.log(`Workout ID: ${s.value.id}, Name: ${s.value.name}, CreatedAt: ${s.value.createdAt}`);
});

// 3. Check for any "invisible" duplicates (id index pointing to different keys)
console.log("Checking ID index for March 10th activity IDs...");
for (const a of activities) {
    const idRes = await kv.get(["idx_activities_by_id", a.value.id]);
    console.log(`Index for ${a.value.id} points to: ${JSON.stringify(idRes.value)}`);
}

await kv.close();
