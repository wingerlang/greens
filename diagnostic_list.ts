const kv = await Deno.openKv("./greens.db");

const dateIso = "2026-03-10";
const activities = [];

console.log("Listing activities for", dateIso);

const iter = kv.list({ prefix: ["activities"] });
for await (const entry of iter) {
    const act = entry.value;
    if (act.date && act.date.startsWith(dateIso)) {
        activities.push({
            id: act.id,
            title: act.title,
            source: act.performance?.source?.source || 'unknown',
            externalId: act.performance?.source?.externalId,
            createdAt: act.createdAt,
            updatedAt: act.updatedAt,
            distance: act.distance,
            duration: act.durationMinutes,
            userId: act.userId
        });
    }
}

activities.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

console.log(JSON.stringify(activities, null, 2));
await kv.close();
