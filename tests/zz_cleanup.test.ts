import { closeKv } from "../src/api/kv.ts";

Deno.test({
    name: "Final Cleanup - Close Deno KV Connection",
    sanitizeOps: false,
    sanitizeResources: false
}, async () => {
    console.log("Closing Deno KV Connection at the end of the test suite...");
    await closeKv();
});
