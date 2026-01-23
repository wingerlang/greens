console.log("Deno.openKv:", typeof Deno.openKv);
try {
    const kv = await Deno.openKv();
    console.log("Successfully opened default KV");
    await kv.close();
} catch (e) {
    console.error("Failed to open default KV:", e.message);
}
