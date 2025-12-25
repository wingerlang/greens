import { createUser, getUser } from "../src/api/db/user.ts";
import { kv } from "../src/api/kv.ts";

async function seed() {
    console.log("Seeding Database...");

    // Check if user exists
    const existing = await getUser("wingerlang");
    if (existing) {
        console.log("User 'wingerlang' already exists.");
        await kv.close();
        return;
    }

    console.log("Creating user 'wingerlang' with password 'admin'...");
    // Email is just a placeholder
    const user = await createUser("wingerlang", "admin", "admin@greens.se");

    if (user) {
        console.log("User created successfully!");
        // Promote to admin manually since createUser defaults to 'user'
        user.role = 'admin';
        await kv.set(['users', user.id], user);
        console.log("Promoted 'wingerlang' to admin role.");
    } else {
        console.error("Failed to create user.");
    }

    /* 
       Also create 'admin' user just in case
    */
    const existingAdmin = await getUser("admin");
    if (!existingAdmin) {
        console.log("Creating fallback user 'admin' with password 'admin'...");
        const adminUser = await createUser("admin", "admin", "admin@greens.se");
        if (adminUser) {
            adminUser.role = 'admin';
            await kv.set(['users', adminUser.id], adminUser);
        }
    }

    // Close KV connection to allow graceful exit
    // Note: 'kv' imported from api/kv.ts is a singleton promise exposed as 'kv'
    // But api/kv.ts exports `closeKv` function too if I recall?
    // Let's check api/kv.ts again. Yes: export async function closeKv() { await kv.close(); }
    // But here I imported 'kv' object.

    // Actually, to close it properly I should import closeKv.
    // Or just let the script terminate (Deno usually hangs if KV is open).
    // I will let it hang or force exit. Deno.exit(0).
    Deno.exit(0);
}

seed();
