import * as fs from "node:fs/promises";
import * as http from "node:http";
import * as path from "node:path";
import * as os from "node:os";
import * as child_process from "node:child_process";
import { openKv } from "@deno/kv";

// Ensure globalThis.Deno exists
if (!globalThis.Deno) {
    (globalThis as any).Deno = {};
}

const Deno = (globalThis as any).Deno;

// Env Polyfill
Deno.env = {
    get: (key: string) => process.env[key],
    set: (key: string, value: string) => { process.env[key] = value; },
    toObject: () => ({ ...process.env }),
};

// Database Polyfill
// Use a unique symbol or property to avoid recursive calls if @deno/kv tries to use Deno.openKv
Deno.openKv = async (path?: string) => {
    // We must call the library's openKv, but make sure it doesn't call us back.
    // The @deno/kv library checks if `Deno.openKv` exists and uses it if available!
    // This causes infinite recursion.
    // We need to hide Deno.openKv from @deno/kv OR use the implementation directly.

    // Workaround: Temporarily hide Deno.openKv while calling the library?
    // Or simpler: Don't set Deno.openKv on the global object if @deno/kv is smart enough?
    // But our application code calls Deno.openKv.

    // Solution: When we polyfill Deno, we are mocking the runtime.
    // But @deno/kv is a "ponyfill" that tries to use native if available.
    // If we mock native, it uses our mock, which calls it, which uses our mock...

    // We can try to bind the original implementation if possible, or
    // modify the global Deno object during the call.

    const originalOpenKv = Deno.openKv;
    delete (globalThis as any).Deno.openKv; // Hide it
    try {
        return await openKv(path);
    } finally {
        (globalThis as any).Deno.openKv = originalOpenKv; // Restore it
    }
};

// File System Polyfill
Deno.readTextFile = async (path: string) => {
    return await fs.readFile(path, "utf-8");
};

Deno.writeTextFile = async (path: string, content: string) => {
    return await fs.writeFile(path, content, "utf-8");
};

Deno.readFile = async (path: string) => {
    const buffer = await fs.readFile(path);
    return new Uint8Array(buffer);
};

Deno.writeFile = async (path: string, data: Uint8Array) => {
    return await fs.writeFile(path, data);
};

Deno.mkdir = async (path: string, options?: { recursive?: boolean }) => {
    await fs.mkdir(path, options);
};

Deno.remove = async (path: string, options?: { recursive?: boolean }) => {
    await fs.rm(path, { recursive: options?.recursive, force: true });
};

Deno.rename = async (oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath);
};

Deno.stat = async (path: string) => {
    const stats = await fs.stat(path);
    return {
        size: stats.size,
        mtime: stats.mtime,
        atime: stats.atime,
        birthtime: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymlink: stats.isSymbolicLink(),
    };
};

Deno.readDir = async function* (dirPath: string) {
    try {
        const dir = await fs.opendir(dirPath);
        for await (const dirent of dir) {
            yield {
                name: dirent.name,
                isFile: dirent.isFile(),
                isDirectory: dirent.isDirectory(),
                isSymlink: dirent.isSymbolicLink(),
            };
        }
    } catch (e: any) {
        if (e.code === 'ENOENT') {
             throw new Deno.errors.NotFound(`No such file or directory: ${dirPath}`);
        }
        throw e;
    }
};

Deno.Command = class Command {
    command: string;
    options: any;

    constructor(command: string, options: any) {
        this.command = command;
        this.options = options || {};
    }

    output() {
        return new Promise((resolve, reject) => {
            const args = this.options.args || [];
            // Handle piped stdout/stderr options if needed, but for now we default to capturing

            const proc = child_process.spawn(this.command, args, {
                cwd: this.options.cwd,
                env: { ...process.env, ...(this.options.env || {}) },
                stdio: ['ignore', 'pipe', 'pipe']
            });

            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            if (proc.stdout) {
                proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
            }
            if (proc.stderr) {
                proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
            }

            proc.on('close', (code: number | null) => {
                resolve({
                    code: code || 0,
                    stdout: new Uint8Array(Buffer.concat(stdoutChunks)),
                    stderr: new Uint8Array(Buffer.concat(stderrChunks)),
                    success: code === 0,
                    signal: null
                });
            });

            proc.on('error', (err: any) => {
                if (err.code === 'ENOENT') {
                    // Deno throws NotFound if command not found? Or rejects?
                    // To match Deno.Command behavior closer, we might just return a failed result
                    // or let the validation above handle it.
                    // For now, resolving with failure is safer than crashing.
                    resolve({
                         code: 1,
                         stdout: new Uint8Array(),
                         stderr: new Uint8Array(Buffer.from(err.message)),
                         success: false,
                         signal: null
                    });
                } else {
                    reject(err);
                }
            });
        });
    }
};

Deno.errors = {
    AlreadyExists: class AlreadyExists extends Error { constructor(msg: string) { super(msg); this.name = "AlreadyExists"; } },
    NotFound: class NotFound extends Error { constructor(msg: string) { super(msg); this.name = "NotFound"; } },
    // Add others if needed
};

// Patch fs functions to throw Deno compatible errors if needed
// For now relying on standard errors or loose catching in codebase

// Server Polyfill
Deno.serve = (options: any, handler: any) => {
    if (typeof options === 'function') {
        handler = options;
        options = { port: 8000 };
    }

    const port = options.port || 8000;
    const hostname = options.hostname || "0.0.0.0";

    const server = http.createServer(async (req, res) => {
        try {
            // Convert IncomingMessage to Web Standard Request
            const url = `http://${req.headers.host || 'localhost'}${req.url}`;
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
                if (Array.isArray(value)) {
                    value.forEach(v => headers.append(key, v));
                } else if (value) {
                    headers.append(key, value);
                }
            }

            const method = req.method || 'GET';
            let body: any = null;
            if (method !== 'GET' && method !== 'HEAD') {
                const buffers = [];
                for await (const chunk of req) {
                    buffers.push(chunk);
                }
                body = Buffer.concat(buffers);
            }

            const request = new Request(url, {
                method,
                headers,
                body,
                // @ts-ignore: Node generic duplex issues
                duplex: body ? 'half' : undefined
            });

            // Handle
            const response = await handler(request);

            // Send Response
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
                res.setHeader(key, value);
            });

            if (response.body) {
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
            }
            res.end();

        } catch (e) {
            console.error("Server adapter error:", e);
            if (!res.headersSent) {
                res.statusCode = 500;
                res.end("Internal Server Error");
            }
        }
    });

    server.listen(port, hostname, () => {
        // Console log is handled by the caller usually, but Deno.serve prints automatically?
        // Deno.serve returns a Server object, the callback is printed by user code usually.
    });

    return {
        finished: new Promise(() => {}), // Never finishes
        shutdown: () => server.close()
    };
};

// Misc
Deno.version = {
    deno: "node-polyfill",
    v8: process.versions.v8,
    typescript: "unknown"
};

Deno.pid = process.pid;

Deno.memoryUsage = () => {
    const mem = process.memoryUsage();
    return {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external
    };
};

// Flag to help utils detect Node environment explicitly if needed
(globalThis as any).IS_NODE_COMPAT_MODE = true;
