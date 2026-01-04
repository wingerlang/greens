
import { getUser, saveUser } from "../src/api/db/user.ts";

async function cleanup() {
    console.log("🧹 Cleaning up user bio...");
    const user = await getUser("wingerlang");
    if (user) {
        if (user.bio && user.bio.includes("Updated via Verification Script")) {
            user.bio = "Just a regular user.";
            await saveUser(user);
            console.log("✅ Bio reset for wingerlang.");
        } else {
            console.log("ℹ️ Bio was already clean or different.");
        }
    } else {
        console.error("❌ User wingerlang not found.");
    }

    // Check admin identity vs wingerlang
    const admin = await getUser("admin");
    if (admin && user) {
        console.log(`\n🆔 ID Check:`);
        console.log(`   Admin ID:      ${admin.id}`);
        console.log(`   Wingerlang ID: ${user.id}`);
        if (admin.id === user.id) {
            console.error("❌ CRITICAL: Admin and Wingerlang share the same ID!");
        } else {
            console.log("✅ IDs are distinct.");
        }
    }
}

cleanup();
