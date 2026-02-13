
import { router } from "./api/router.ts";
import { handleWebSocket } from "./api/websocket.ts";
import { serveDir } from "./api/utils/fileServer.ts";
// Seeder might fail if data file is missing, but app should start
import { ensureSeeded } from "./api/utils/seeder.ts";

console.log("🚀 Starting Greens on Deno Deploy...");

// Attempt to seed database (non-blocking for startup if it fails)
try {
    await ensureSeeded();
} catch (e) {
    console.error("Warning: Database seeding failed:", e);
}

Deno.serve(async (req: Request, info: Deno.ServeHandlerInfo) => {
    const url = new URL(req.url);

    // WebSocket
    if (req.headers.get("upgrade") === "websocket") {
        return handleWebSocket(req);
    }

    // API Routes
    if (url.pathname.startsWith("/api/")) {
        return await router(req, info.remoteAddr);
    }

    // Serve Static Assets from 'dist'
    // This requires the frontend to be built before deployment
    let response = await serveDir(req, {
        fsRoot: "dist",
        quiet: true,
    });

    // SPA Fallback logic (Serve index.html for unknown routes)
    if (response.status === 404) {
        const ext = url.pathname.split(".").pop();
        const hasExt = ext && ext !== url.pathname && !url.pathname.endsWith("/");

        // Only fallback if it looks like a route (not an asset)
        if (!hasExt) {
            try {
                // Serve index.html
                const indexReq = new Request(new URL("/index.html", req.url));
                const indexResponse = await serveDir(indexReq, {
                    fsRoot: "dist",
                    quiet: true
                });

                // If index.html exists, return it with 200 OK (soft 404 for SPA)
                // But typically SPA router handles the 404 UI.
                if (indexResponse.status === 200) {
                    return indexResponse;
                }
            } catch (e) {
                console.error(`Failed to serve index.html fallback: ${e}`);
            }
        }
    }

    return response;
});
