import * as fs from "node:fs/promises";
import * as http from "node:http";
import * as path from "node:path";
import * as os from "node:os";
import * as child_process from "node:child_process";
import { openKv } from "@deno/kv";
import { WebSocketServer, WebSocket as NodeWebSocket } from 'ws';

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
Deno.openKv = async (path?: string) => {
    const originalOpenKv = Deno.openKv;
    delete (globalThis as any).Deno.openKv;
    try {
        return await openKv(path);
    } finally {
        (globalThis as any).Deno.openKv = originalOpenKv;
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
};

// WebSocket Logic
const wss = new WebSocketServer({ noServer: true });

Deno.upgradeWebSocket = (req: Request) => {
    // Check if we attached the node request
    const nodeReq = (req as any)._nodeReq;
    const nodeSocket = (req as any)._nodeSocket;
    const nodeHead = (req as any)._nodeHead;

    if (!nodeReq || !nodeSocket || !nodeHead) {
        throw new Error("Cannot upgrade WebSocket: Missing Node.js request context. This polyfill requires Deno.serve to be used.");
    }

    // Create a shim socket that will be bridged to the real one
    // We implement a minimal subset of WebSocket for the handler
    const socketShim = new EventTarget() as any;
    socketShim.send = (data: any) => {
        if (socketShim._realWs && socketShim._realWs.readyState === NodeWebSocket.OPEN) {
            socketShim._realWs.send(data);
        }
    };
    socketShim.close = (code?: number, reason?: string) => {
        if (socketShim._realWs) socketShim._realWs.close(code, reason);
    };

    // We attach the upgrade logic to the response so Deno.serve can execute it
    const response = new Response(null, { status: 101, headers: { "Upgrade": "websocket", "Connection": "Upgrade" } });
    (response as any)._upgradeAction = () => {
        wss.handleUpgrade(nodeReq, nodeSocket, nodeHead, (ws) => {
            socketShim._realWs = ws;
            socketShim._readyState = NodeWebSocket.OPEN;

            // Bridge events
            ws.on('message', (data, isBinary) => {
                const event = new MessageEvent('message', { data: isBinary ? data : data.toString() });
                socketShim.dispatchEvent(event);
                if (socketShim.onmessage) socketShim.onmessage(event);
            });

            ws.on('close', (code, reason) => {
                const event = new CloseEvent('close', { code, reason: reason.toString(), wasClean: true });
                socketShim.dispatchEvent(event);
                if (socketShim.onclose) socketShim.onclose(event);
            });

            ws.on('error', (err) => {
                const event = new Event('error');
                (event as any).error = err;
                socketShim.dispatchEvent(event);
                if (socketShim.onerror) socketShim.onerror(event);
            });

            // Trigger open
            const openEvent = new Event('open');
            socketShim.dispatchEvent(openEvent);
            if (socketShim.onopen) socketShim.onopen(openEvent);
        });
    };

    return { socket: socketShim, response };
};


// Server Polyfill
Deno.serve = (options: any, handler: any) => {
    if (typeof options === 'function') {
        handler = options;
        options = { port: 8000 };
    }

    const port = options.port || 8000;
    const hostname = options.hostname || "0.0.0.0";

    const server = http.createServer();

    // Handle standard requests
    server.on('request', async (req, res) => {
        try {
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
                // @ts-ignore: Node duplex
                duplex: body ? 'half' : undefined
            });

            // Attach Node context for WebSocket upgrade later if needed (though upgrade event usually handles it separately)
            // But if the handler returns 101 based on this request, we are too late for `server.on('upgrade')`?
            // `server.on('upgrade')` is for the initial handshake.
            // Deno.serve logic: The handler is called. If it returns response, we send it.
            // But for WS, standard Node http server does NOT emit 'request' event for upgrades if 'upgrade' listener exists.
            // So we must handle 'upgrade' separately and create a synthetic Request?

            // Wait, if I add 'upgrade' listener, 'request' is NOT emitted for upgrade requests.
            // So I need to route 'upgrade' events into the handler too?
            // Yes.

            const info = {
                remoteAddr: {
                    transport: "tcp",
                    hostname: req.socket.remoteAddress || "127.0.0.1",
                    port: req.socket.remotePort || 0
                }
            };

            const response = await handler(request, info);

            // Normal response handling
            res.statusCode = response.status;
            response.headers.forEach((value: string, key: string) => {
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

    // Handle Upgrade Requests
    server.on('upgrade', async (req, socket, head) => {
        try {
            const url = `http://${req.headers.host || 'localhost'}${req.url}`;
            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
                if (Array.isArray(value)) {
                    value.forEach(v => headers.append(key, v));
                } else if (value) {
                    headers.append(key, value);
                }
            }

            const request = new Request(url, {
                method: req.method,
                headers,
            });

            // Attach context
            (request as any)._nodeReq = req;
            (request as any)._nodeSocket = socket;
            (request as any)._nodeHead = head;

            const info = {
                remoteAddr: {
                    transport: "tcp",
                    hostname: socket.remoteAddress || "127.0.0.1",
                    port: socket.remotePort || 0
                }
            };

            const response = await handler(request, info);

            if (response.status === 101 && (response as any)._upgradeAction) {
                (response as any)._upgradeAction();
            } else {
                socket.destroy();
            }

        } catch (e) {
            console.error("Upgrade error:", e);
            socket.destroy();
        }
    });

    server.listen(port, hostname, () => {
        // console.log(`Server listening on ${hostname}:${port}`);
    });

    return {
        finished: new Promise(() => {}),
        shutdown: () => server.close()
    };
};

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

(globalThis as any).IS_NODE_COMPAT_MODE = true;
