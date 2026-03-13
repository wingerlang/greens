const kv = await Deno.openKv("./greens.db");

const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";

console.log(`Listing ALL activities for User ${userId}...`);

const iter = kv.list({ prefix: ["activities", userId] });
let count = 0;
for await (const entry of iter) {
    count++;
    const val = entry.value;
    const date = entry.key[2];
    const id = entry.key[3];
    console.log(`  DateKey: ${date}, ID: ${id}, Title: ${val.title || val.plan?.title}, CreatedAt: ${val.createdAt}`);
}

console.log(`Total activities found: ${count}`);
await kv.close();
