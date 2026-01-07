import { kv } from "../src/api/kv.ts";
import { TextLineStream } from "jsr:@std/streams/text-line-stream";

async function restoreBackup(filePath: string) {
    console.log(`Restoring backup from ${filePath}...`);

    const file = await Deno.open(filePath);

    // Create a stream that decodes bytes to text and splits by newline
    const lines = file.readable
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new TextLineStream());

    let atomic = kv.atomic();
    let ops = 0;
    let count = 0;

    for await (const line of lines) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.key && entry.value !== undefined) {
                atomic.set(entry.key, entry.value);
                ops++;
                count++;

                if (ops >= 100) {
                    await atomic.commit();
                    atomic = kv.atomic();
                    ops = 0;
                    console.log(`Restored ${count} entries...`);
                }
            }
        } catch (e) {
            console.error("Failed to parse line:", line.substring(0, 50) + "...", e);
        }
    }

    if (ops > 0) {
        await atomic.commit();
    }

    console.log(`Restore complete! Total entries: ${count}`);
}

if (import.meta.main) {
    const backupFile = Deno.args[0];
    if (!backupFile) {
        console.error("Please provide the backup file path.");
        Deno.exit(1);
    }
    await restoreBackup(backupFile);
}
