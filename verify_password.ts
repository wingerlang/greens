import { getUser } from "./src/api/db/user.ts";
import { hashPassword } from "./src/api/utils/crypto.ts";

const username = "wingerlang";
const password = "admin";

const user = await getUser(username);
if (!user) {
    console.log(`User ${username} not found`);
} else {
    const hash = await hashPassword(password, user.salt);
    console.log(`Stored hash: ${user.passHash}`);
    console.log(`Calculated hash: ${hash}`);
    console.log(`Match: ${hash === user.passHash}`);
}
