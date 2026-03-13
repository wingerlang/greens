const kv = await Deno.openKv("./greens.db");

const counts = {};
const duplicates = [];

console.log("Scanning all activities for duplicates...");

const iter = kv.list({ prefix: ["activities"] });
for await (const entry of iter) {
    const act = entry.value;
    const date = act.date ? act.date.split('T')[0] : 'unknown';

    if (!counts[date]) counts[date] = [];
    counts[date].push({
        id: act.id,
        title: act.title,
        source: act.performance?.source?.source,
        createdAt: act.createdAt,
        distance: act.distance
    });
}

const entries = Object.entries(counts);
entries.sort((a, b) => b[1].length - a[1].length);

console.log("Top 5 most active dates:");
entries.slice(0, 5).forEach(([date, list]) => {
    console.log(`${date}: ${list.length} activities`);
    if (list.length > 2) {
        list.forEach(a => console.log(`  - ${a.title} (${a.source}), ID: ${a.id}, Created: ${a.createdAt}`));
    }
});

await kv.close();
