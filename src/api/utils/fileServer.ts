
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { lookup } from "mime-types";

interface ServeDirOptions {
    fsRoot?: string;
    urlRoot?: string;
}

export async function serveDir(req: Request, options: ServeDirOptions = {}): Promise<Response> {
    // Check if we are in Deno
    if (typeof Deno !== "undefined" && typeof (Deno as any).serve === "function" && !(globalThis as any).IS_NODE_COMPAT_MODE) {
        // Dynamic import for Deno to avoid static analysis errors in Node
        try {
            const mod = await import("https://deno.land/std@0.208.0/http/file_server.ts");
            return mod.serveDir(req, options);
        } catch (e) {
            console.error("Failed to load Deno file_server:", e);
            return new Response("Internal Server Error", { status: 500 });
        }
    }

    // Node.js Implementation
    const url = new URL(req.url);
    const fsRoot = options.fsRoot || ".";
    const urlRoot = options.urlRoot || "";

    // Remove urlRoot prefix
    let pathname = url.pathname;
    if (urlRoot && pathname.startsWith(`/${urlRoot}`)) {
        pathname = pathname.slice(urlRoot.length + 1); // +1 for the slash
    }

    // Sanitize path (prevent directory traversal)
    const normalizedPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(fsRoot, normalizedPath);

    // Security check: ensure filePath is inside fsRoot
    const absoluteFsRoot = path.resolve(fsRoot);
    const absoluteFilePath = path.resolve(filePath);

    if (!absoluteFilePath.startsWith(absoluteFsRoot)) {
        return new Response("Forbidden", { status: 403 });
    }

    try {
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
             // For now, don't list directories, return 404 or index.html if exists
             return new Response("Not Found", { status: 404 });
        }

        const file = await fs.readFile(filePath);
        const contentType = lookup(filePath) || "application/octet-stream";

        // Cast Buffer to Uint8Array which is compatible with BodyInit in most envs
        const body = new Uint8Array(file);

        return new Response(body, {
            headers: {
                "Content-Type": contentType,
                "Content-Length": stats.size.toString(),
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (e: any) {
        if (e.code === 'ENOENT') {
            return new Response("Not Found", { status: 404 });
        }
        console.error("File serve error:", e);
        return new Response("Internal Server Error", { status: 500 });
    }
}
