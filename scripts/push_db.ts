/// <reference lib="deno.unstable" />
/// <reference lib="deno.ns" />
import { parseArgs } from "jsr:@std/cli/parse-args";

const args = parseArgs(Deno.args);
const HOST = args.host || "http://localhost:9999";
const SECRET = args.secret || "change-me";
const MODE = args.mode || "merge";

if (!args.host) {
    console.log("Usage: deno run -A --unstable-kv scripts/push_db.ts --host <url> --secret <key> [--mode <merge|overwrite>]");
    console.log("Defaults: --host http://localhost:9999 --secret change-me --mode merge");
    // Deno.exit(1);
    // Don't exit, try defaults
}

console.log(`[SYNC] Connecting to local DB (./guardian.db)...`);
const kv = await Deno.openKv("./guardian.db");

console.log(`[SYNC] Pushing to ${HOST} (Mode: ${MODE})...`);

const stream = new ReadableStream({
    async start(controller) {
        const iter = kv.list({ prefix: [] });
        const encoder = new TextEncoder();
        let count = 0;

        for await (const res of iter) {
            const line = JSON.stringify({ key: res.key, value: res.value }) + "\n";
            controller.enqueue(encoder.encode(line));
            count++;
            if (count % 1000 === 0) {
                Deno.stdout.write(new TextEncoder().encode(`\r[SYNC] Streamed ${count} entries...`));
            }
        }
        console.log(`\n[SYNC] Finished streaming ${count} entries.`);
        controller.close();
    }
});

try {
    const res = await fetch(`${HOST}/api/db/sync?mode=${MODE}`, {
        method: "POST",
        headers: {
            "x-admin-secret": SECRET,
            "content-type": "application/x-ndjson"
        },
        body: stream,
    });

    if (res.ok) {
        const result = await res.json();
        console.log("[SYNC] Success:", result);
    } else {
        const text = await res.text();
        console.error("[SYNC] Server Error:", res.status, text);
    }

} catch (e) {
    console.error("[SYNC] Connection Failed:", e);
}

kv.close();
