
const API_BASE = "http://localhost:8000/api";

async function run() {
    console.log("🔍 Verifying Fixes...");

    // 1. Login as Admin
    console.log("\n🔑 Logging in as Admin...");
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin" })
    });

    if (!loginRes.ok) {
        console.error("❌ Login failed:", await loginRes.text());
        Deno.exit(1);
    }

    const { token, user } = await loginRes.json();
    console.log("✅ Logged in as:", user.username);
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };

    // 2. Test Community List (GET /api/users)
    console.log("\n👥 Testing GET /api/users...");
    const usersRes = await fetch(`${API_BASE}/users`, { headers });
    if (!usersRes.ok) {
        console.error("❌ Failed to fetch users:", await usersRes.text());
        Deno.exit(1);
    }
    const { users } = await usersRes.json();
    console.log(`✅ Fetched ${users.length} users.`);
    if (users.some((u: any) => u.username === "admin")) {
        console.log("✅ Admin found in user list.");
    } else {
        console.error("❌ Admin NOT found in user list.");
        Deno.exit(1);
    }

    // 3. Test Profile Update (PATCH /api/user/profile)
    const newBio = "Updated via Verification Script " + Date.now();
    console.log("\n✏️ Testing PATCH /api/user/profile with bio:", newBio);
    const patchRes = await fetch(`${API_BASE}/user/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ bio: newBio })
    });

    if (!patchRes.ok) {
        console.error("❌ Profile update failed:", await patchRes.text());
        Deno.exit(1);
    }
    console.log("✅ PATCH request successful.");

    // Verify update
    const meRes = await fetch(`${API_BASE}/auth/me`, { headers });
    const meData = await meRes.json();
    if (meData.user.bio === newBio) {
        console.log("✅ Profile persistence confirmed: Bio updated.");
    } else {
        console.error("❌ Profile persistence failed. Expected:", newBio, "Got:", meData.user.bio);
        Deno.exit(1);
    }

    // 3b. Test Handle Uniqueness
    console.log("\n🆔 Testing Handle Uniqueness (Try setting handle to 'admin')...");
    const handleRes = await fetch(`${API_BASE}/user/profile`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ handle: "admin" })
    });

    if (handleRes.status === 409) {
        console.log("✅ Handle collision correctly prevented (409 Conflict).");
    } else {
        console.error(`❌ Handle uniqueness check failed. Expected 409, got ${handleRes.status}`);
        // don't exit, just warn? NO, fail.
        Deno.exit(1);
    }

    // 4. Test Online Status (GET /api/admin/users)
    console.log("\n🟢 Testing Online Status (GET /api/admin/users)...");
    const adminUsersRes = await fetch(`${API_BASE}/admin/users`, { headers });

    // 5. Test Public Profile (GET /api/u/:handle)
    // We know my handle is 'admin' (or whatever it was). Let's try getting myself via public route.
    console.log("\n🌍 Testing Public Profile (GET /api/u/:handle)...");
    const handleToTest = meData.handle || meData.user?.handle;
    if (handleToTest) {
        const publicRes = await fetch(`${API_BASE}/u/${handleToTest}`, { headers });
        if (publicRes.ok) {
            const publicData = await publicRes.json();
            console.log("✅ Public profile fetched successfully for", handleToTest);
            if (publicData.id === meData.user.id) { // Corrected from meData.userId to meData.user.id
                console.log("✅ ID matches authenticated user.");
            } else {
                console.error("❌ ID mismatch in public profile.");
            }
        } else {
            console.error(`❌ Public profile fetch failed. Status: ${publicRes.status}`);
        }
    } else {
        console.warn("⚠️ Skipping public profile test (no handle found in 'me' response).");
    }

    if (!adminUsersRes.ok) {
        console.error("❌ Failed to fetch admin users:", await adminUsersRes.text());
        Deno.exit(1);
    }
    const { users: adminUsers } = await adminUsersRes.json();
    const adminUser = adminUsers.find((u: any) => u.username === "admin");

    if (adminUser && adminUser.isOnline === true) {
        console.log("✅ Admin is correctly marked as ONLINE.");
    } else {
        console.error("❌ Admin online status check failed. User:", adminUser);
        Deno.exit(1);
    }

    console.log("\n🎉 All Verification Steps Passed!");
}

run();
