const kv = await Deno.openKv("./greens.db");
console.log("Checking most recently updated user profiles...");
const profiles = [];
for await (const entry of kv.list({ prefix: ["user_profiles"] })) {
    profiles.push({ userId: entry.key[1], updatedAt: entry.value.updatedAt });
}
profiles.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
console.log(profiles.slice(0, 5));
await kv.close();
