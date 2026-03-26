/// <reference lib="deno.ns" />
const kv = await Deno.openKv("./greens.db");

const id = "8ed8fe99-4276-4a0a-8b71-2426e91601f5";
const idxRes = await kv.get(["idx_activities_by_id", id]);

console.log("Index Resolution:", idxRes.value);

if (idxRes.value) {
    const actRes = await kv.get(idxRes.value as any);
    console.log("Activity:", JSON.stringify(actRes.value, null, 2));
} else {
    console.log("Activity not found in index.");
}

await kv.close();
