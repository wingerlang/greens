import { createWorker as createWorkerCjs } from "tesseract.js";

export async function createWorker() {
    if (globalThis.Deno && !(globalThis as any).IS_NODE_COMPAT_MODE) {
        try {
            const mod = await import("npm:tesseract.js");
            return mod.createWorker();
        } catch (e) {
            console.error("Failed to load Deno tesseract.js:", e);
            throw e;
        }
    }

    // Node.js
    return createWorkerCjs();
}
