import { kv } from "../../src/api/kv.ts";

async function listUsers() {
    const iter = kv.list({ prefix: ["users"] });
    for await (const entry of iter) {
        console.log(JSON.stringify(entry.value, null, 2));
    }
}

listUsers();
