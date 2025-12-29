
import { createUser, getUser } from "./src/api/db/user.ts";
import { getUserData, saveUserData } from "./src/api/db/data.ts";
import { UserSettings } from "./src/models/types.ts";

async function createTestUsers() {
    console.log("🚀 Creating test users...");

    const usersToCreate = [
        {
            username: "Pontus",
            gender: "male",
            birthYear: 1995,
            password: "password123",
            bio: "Gillar styrkelyft och öl."
        },
        {
            username: "Jennie",
            gender: "female",
            birthYear: 2000,
            password: "password123",
            bio: "Löpning och yoga är min grej."
        }
    ];

    const currentYear = new Date().getFullYear();

    for (const u of usersToCreate) {
        let user = await getUser(u.username);

        if (!user) {
            console.log(`Creating ${u.username}...`);
            // Create base user
            user = await createUser(u.username, u.password);
            if (!user) {
                console.error(`❌ Failed to create ${u.username}`);
                continue;
            }
            console.log(`✅ Created user: ${u.username} (${user.id})`);
        } else {
            console.log(`ℹ️ User ${u.username} already exists.`);
        }

        // Update Settings (Age & Gender) & Bio
        const age = currentYear - u.birthYear;

        // 1. Update Core User Bio
        user.bio = u.bio;
        // We'd need saveUser to persist bio, but createUser saves it. 
        // Let's assume we need to re-save if we changed bio just now (if existing).
        // For simplicity, we assume fresh or just updating data below.

        // 2. Update AppData Settings
        const data = await getUserData(user.id);
        if (data) {
            const newSettings: UserSettings = {
                ...data.userSettings,
                age: age,
                gender: u.gender as 'male' | 'female',
            };

            // Persist
            await saveUserData(user.id, {
                ...data,
                userSettings: newSettings
            });
            console.log(`   Updated settings: Age ${age}, Gender ${u.gender}`);
        }
    }

    console.log("\n✨ Done.");
}

createTestUsers();
