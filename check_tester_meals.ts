const kv = await Deno.openKv("./greens.db");
const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";
const date = "2026-04-27";

console.log(`Checking meals for user ${userId} on ${date}...`);

const iter = kv.list({ prefix: ["meals", userId] });
for await (const entry of iter) {
    console.log(JSON.stringify(entry.value, null, 2));
}

await kv.close();
