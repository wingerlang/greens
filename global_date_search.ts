const kv = await Deno.openKv("./greens.db");

const targetDate = "2026-03-10";
console.log(`Global Search for "${targetDate}"...`);

const matches = [];
for await (const entry of kv.list({ prefix: [] })) {
    const keyStr = JSON.stringify(entry.key);
    const valStr = JSON.stringify(entry.value);

    if (keyStr.includes(targetDate) || valStr.includes(targetDate)) {
        matches.push({ key: entry.key, value: entry.value });
    }
}

console.log(`Found ${matches.length} matches.`);
matches.forEach(m => {
    console.log(`Key: ${JSON.stringify(m.key)}`);
    // Print a bit of the value
    const v = m.value;
    console.log(`  Type: ${v.type || v.activityType || '?'}, Id: ${v.id}, Date: ${v.date}`);
});

await kv.close();
