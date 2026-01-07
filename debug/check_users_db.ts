
import { getAllUsers } from "../src/api/db/user.ts";

async function checkUsers() {
    console.log("Checking DB Users directly...");
    const users = await getAllUsers();
    console.log(`Found ${users.length} users in DB:`);
    users.forEach(u => console.log(` - ${u.username} (${u.id})`));
}

checkUsers();
