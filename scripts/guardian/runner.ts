
// Guardian Runner Script
// This script wraps the main Guardian process to allow for self-restarts.

const COMMAND = ["deno", "run", "-A", "--unstable-kv", "scripts/guardian/main.ts"];
const RESTART_EXIT_CODE = 42;

async function run() {
    console.log("[RUNNER] Starting Guardian...");

    while (true) {
        const p = new Deno.Command(COMMAND[0], {
            args: COMMAND.slice(1),
            stdout: "inherit",
            stderr: "inherit",
            stdin: "inherit"
        }).spawn();

        const status = await p.status;

        if (status.code === RESTART_EXIT_CODE) {
            console.log("[RUNNER] Restart requested. Rebooting in 1s...");
            await new Promise(r => setTimeout(r, 1000));
            continue;
        }

        console.log(`[RUNNER] Guardian exited with code ${status.code}.`);
        Deno.exit(status.code);
    }
}

if (import.meta.main) {
    run();
}
