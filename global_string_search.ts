const kv = await Deno.openKv("./greens.db");

const targetStr = "50667861";
console.log(`Global Search for string: ${targetStr}`);

for await (const entry of kv.list({ prefix: [] })) {
    const keyStr = JSON.stringify(entry.key);
    const valStr = JSON.stringify(entry.value, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );

    if (keyStr.includes(targetStr) || valStr.includes(targetStr)) {
        console.log(`Found:`);
        console.log(`  Key: ${keyStr}`);
        console.log(`  Value Type: ${entry.value?.type || '?'}, Date: ${entry.value?.date}`);
    }
}

await kv.close();
