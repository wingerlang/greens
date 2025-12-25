import { kv } from "../src/api/kv.ts"; // This now uses ./greens.db

async function checkData() {
    console.log("Checking KV Store...");

    // 1. List all activities
    const iter = kv.list({ prefix: ["activities"] });
    let count = 0;
    for await (const entry of iter) {
        count++;
        if (count <= 5) {
            console.log("Activity:", entry.key, "Val:", entry.value);
        }
    }
    console.log(`Total Activities in KV: ${count}`);

    // 2. Check User Profile
    const userIter = kv.list({ prefix: ["users"] });
    for await (const entry of userIter) {
        const u = entry.value as any;
        console.log("User:", u.username, "ID:", u.id);
    }

    console.log("--- Activity IDs ---");
    const actIter = kv.list({ prefix: ["activities"] });
    let actCount = 0;
    for await (const entry of actIter) {
        if (actCount < 3) console.log("Act Key:", entry.key);
        actCount++;
    }
}

checkData();
