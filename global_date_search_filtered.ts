const kv = await Deno.openKv("./greens.db");

const targetDate = "2026-03-10";
console.log(`Global Search (Filtered) for "${targetDate}"...`);

const matches = [];
for await (const entry of kv.list({ prefix: [] })) {
    const prefix = entry.key[0];
    if (prefix === "metrics" || prefix === "audit" || prefix === "analytics_event" || prefix === "analytics_page_view") continue;

    const keyStr = JSON.stringify(entry.key);
    const valStr = JSON.stringify(entry.value, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );

    if (keyStr.includes(targetDate) || valStr.includes(targetDate)) {
        matches.push({ key: entry.key, value: entry.value });
    }
}

console.log(`Found ${matches.length} matches.`);
matches.forEach(m => {
    console.log(`Key: ${JSON.stringify(m.key)}`);
    const v = m.value;
    console.log(`  Id: ${v.id}, Date: ${v.date || v.performance?.date || v.startDate || 'No Date'}`);
});

await kv.close();
