const kv = await Deno.openKv("./greens.db");
const tester4Id = "3a7e119f-86a6-456f-b5e0-034d07847aa6";
console.log(`Listing activities for tester4 (${tester4Id})`);

const results = [];
for await (const entry of kv.list({ prefix: ["activities", tester4Id] })) {
    results.push(entry.value);
}
console.log(`Found ${results.length} activities.`);
if (results.length > 0) {
    console.log("Latest activity:", results.sort((a,b) => b.date.localeCompare(a.date))[0]);
}

await kv.close();
export {};
