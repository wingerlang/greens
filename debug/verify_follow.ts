
import { kv } from "../src/api/kv.ts";
import { getUserById } from "../src/api/db/user.ts";
import { SocialRepository } from "../src/api/repositories/socialRepository.ts";

async function verify() {
    console.log("🧪 Verifying Follow Logic...");

    const followerId = "test-follower";
    const targetId = "test-target";

    // Setup: Reset counts
    await kv.delete(['stats', targetId, 'followersCount']);
    await kv.delete(['stats', followerId, 'followingCount']);

    // Create mock users if needed (getUserById fails if user doesn't exist in 'users' kv)
    const mockUser = { id: targetId, username: 'target', handle: 'target' } as any;
    await kv.set(['users', targetId], mockUser);

    console.log("\n1. Initial State Check");
    let target = await getUserById(targetId);
    console.log(`   Followers: ${target?.followersCount} (Expected: 0)`);

    console.log("\n2. Executing Follow...");
    await SocialRepository.followUser(followerId, targetId);

    target = await getUserById(targetId);
    console.log(`   Followers: ${target?.followersCount} (Expected: 1)`);
    if (target?.followersCount !== 1) console.error("❌ Follow count failed!");

    console.log("\n3. Executing Unfollow...");
    await SocialRepository.unfollowUser(followerId, targetId);

    target = await getUserById(targetId);
    console.log(`   Followers: ${target?.followersCount} (Expected: 0)`);
    if (target?.followersCount !== 0) console.error("❌ Unfollow count failed!");

    console.log("\n✅ Verification Complete.");
}

verify();
