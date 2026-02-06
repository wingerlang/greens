/// <reference lib="deno.ns" />
import { parseArgs } from "jsr:@std/cli/parse-args";
import { serveDir } from "jsr:@std/http/file-server";
import { existsSync } from "jsr:@std/fs/exists";

const args = parseArgs(Deno.args);
const PORT = Number(args.port) || 3001;
const DIST_DIR = "dist";

console.log(`[FRONTEND] Starting PROD server on port ${PORT}...`);

if (!existsSync(DIST_DIR)) {
    console.error(`[FRONTEND] FATAL: Directory '${DIST_DIR}' not found. Please run 'deno task build' first.`);
    Deno.exit(1);
}

console.log(`[FRONTEND] Serving static files from ./${DIST_DIR}`);

Deno.serve({
    port: PORT,
    handler: async (req: Request) => {
        const start = performance.now();
        const url = new URL(req.url);

        // Serve file
        let response = await serveDir(req, {
            fsRoot: DIST_DIR,
            quiet: true,
        });

        // SPA Fallback logic
        // If 404, and request is NOT for an asset (no extension), serve index.html
        if (response.status === 404) {
            const ext = url.pathname.split(".").pop();
            const hasExt = ext && ext !== url.pathname && !url.pathname.endsWith("/");

            // Only fallback if it looks like a route (not an asset)
            if (!hasExt) {
                try {
                    const index = await Deno.readFile(`${DIST_DIR}/index.html`);
                    response = new Response(index, {
                        headers: { "content-type": "text/html" }
                    });
                } catch (e) {
                    console.error(`[FRONTEND] Failed to serve index.html fallback: ${e}`);
                }
            }
        }

        const duration = performance.now() - start;
        const size = Number(response.headers.get("content-length")) || 0;

        // Custom Access Log format
        console.log(`[REQ] ${req.method} ${url.pathname} ${response.status} ${duration.toFixed(2)}ms ${size}b`);

        return response;
    },
    onListen: () => {
        console.log(`[FRONTEND] Listening on http://localhost:${PORT}`);
    }
});
