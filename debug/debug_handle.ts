
import { kv } from "../src/api/kv.ts";

async function debug() {
    console.log("🔍 Debugging Handle Lookup...");

    const handleToFind = "wingerlang";

    // 1. Check Index
    const indexKey = ["users_by_handle", handleToFind];
    const indexEntry = await kv.get(indexKey);
    console.log(`\n🔑 Index ["users_by_handle", "${handleToFind}"]:`, indexEntry.value || "MISSING");

    // 2. Check Username Index (fallback)
    const usernameKey = ["users_by_username", handleToFind];
    const usernameEntry = await kv.get(usernameKey);
    console.log(`🔑 Index ["users_by_username", "${handleToFind}"]:`, usernameEntry.value || "MISSING");

    // 3. List all users and check their handles
    console.log("\n👥 Scanning all users for handle match...");
    const iter = kv.list({ prefix: ["users"] });
    let found = false;
    for await (const entry of iter) {
        const user = entry.value as any;
        if (user.handle === handleToFind || user.username === handleToFind) {
            console.log(`✅ Found User [${user.id}]:`);
            console.log(`   - Username: ${user.username}`);
            console.log(`   - Handle:   ${user.handle}`);
            console.log(`   - ID:       ${user.id}`);
            found = true;

            // Fix if missing
            if (!indexEntry.value) {
                console.log("🛠️  Index is missing. Attempting to repair...");
                await kv.set(indexKey, user.id);
                console.log("✅ Repair complete. Try refreshing.");
            }
        }
    }

    if (!found) {
        console.log("❌ User 'wingerlang' not found in main 'users' list.");
    }
}

debug();
