const kv = await Deno.openKv("./greens.db");
console.log("Listing first 10 activities in greens.db");

let count = 0;
for await (const entry of kv.list({ prefix: ["activities"] })) {
    console.log(`Key: ${JSON.stringify(entry.key)}`);
    const val = entry.value as any;
    console.log(`UserId: ${val.userId}, Date: ${val.date}, Source: ${val.performance?.source?.source}`);
    count++;
    if (count >= 10) break;
}

await kv.close();
export {};
