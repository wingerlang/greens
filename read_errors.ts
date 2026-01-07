import { kv } from "./src/api/kv.ts";

const iter = kv.list({ prefix: ["logs", "error"] });
const errors = [];
for await (const entry of iter) {
    errors.push(entry.value);
}

console.log(JSON.stringify(errors, null, 2));
await kv.close();
