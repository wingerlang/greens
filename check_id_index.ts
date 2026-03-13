const kv = await Deno.openKv("./greens.db");

const targetId = "50667861-2de5-4198-99a2-05879345a8b1";
console.log(`Checking idx_activities_by_id for: ${targetId}`);

const res = await kv.get(["idx_activities_by_id", targetId]);
if (res.value) {
    console.log(`Found Index! Data: ${JSON.stringify(res.value)}`);
    // res.value is [userId, date]
    const [userId, date] = res.value as [string, string];
    const actRes = await kv.get(["activities", userId, date, targetId]);
    if (actRes.value) {
        console.log(`Found Activity! Data: ${JSON.stringify(actRes.value)}`);
    } else {
        console.log(`Activity missing at ["activities", ${userId}, ${date}, ${targetId}]`);
    }
} else {
    console.log(`ID not found in idx_activities_by_id.`);
}

await kv.close();
