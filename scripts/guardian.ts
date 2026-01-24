
import { join, dirname, fromFileUrl, basename } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/mod.ts";

const MAX_MEM_LOGS = 2000; // Keep recent logs in memory for quick access
const PORT = Number(Deno.env.get("GUARDIAN_PORT") || "9999");
const BACKEND_PORT = Number(Deno.env.get("PORT") || "8000");
const FRONTEND_PORT = 3000;
const RESTART_DELAY_MS = 3000;
const LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 3 months
const LOG_DIR = "logs";

// State
interface LogEntry {
    id: string;
    timestamp: string;
    source: "stdout" | "stderr" | "guardian" | "backend" | "frontend";
    message: string;
    pid?: number;
}

interface ProcessStats {
    status: "running" | "stopped" | "crashed" | "starting";
    pid: number | null;
    startTime: number | null;
    restartCount: number;
    lastExitCode: number | null;
    uptimeSeconds: number;
}

// In-memory buffer for the "Live" view
let liveLogs: LogEntry[] = [];

const stats: ProcessStats = {
    status: "stopped",
    pid: null,
    startTime: null,
    restartCount: 0,
    lastExitCode: null,
    uptimeSeconds: 0,
};

const interactionStats = {
    click: { restart: 0, pull: 0, build: 0, deploy: 0 },
    omnibox: { restart: 0, pull: 0, build: 0, deploy: 0 },
};

let dbStats = {
    foodCount: 0,
    recipeCount: 0,
    userCount: 0,
};

class LogManager {
    private currentLogPath: string | null = null;

    async init() {
        try {
            await ensureDir(LOG_DIR);
            await this.cleanupOldLogs();
            await this.rotate();
        } catch (e) {
            console.error("Failed to initialize LogManager:", e);
        }
    }

    async rotate() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `session-${timestamp}.jsonl`;
        this.currentLogPath = join(LOG_DIR, filename);

        // Clear in-memory live logs on rotation if desired,
        // OR we keep them to show context.
        // User said: "If we restart - its a new session with clean log."
        // So we clear the live buffer.
        liveLogs = [];

        this.log("guardian", `--- New Session Started: ${filename} ---`);
    }

    async cleanupOldLogs() {
        try {
            const now = Date.now();
            for await (const entry of Deno.readDir(LOG_DIR)) {
                if (!entry.isFile || !entry.name.startsWith("session-")) continue;

                const filePath = join(LOG_DIR, entry.name);
                const stat = await Deno.stat(filePath);

                // If created/modified > 3 months ago
                if (now - (stat.birthtime?.getTime() || stat.mtime?.getTime() || now) > LOG_RETENTION_MS) {
                    try {
                        await Deno.remove(filePath);
                        console.log(`[GUARDIAN] Deleted old log: ${entry.name}`);
                    } catch (e) {
                        console.error(`Failed to delete ${entry.name}:`, e);
                    }
                }
            }
        } catch (e) {
            console.error("Error cleaning logs:", e);
        }
    }

    log(source: LogEntry["source"], message: string, pid?: number) {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source,
            message: message.trimEnd(),
            pid
        };

        // 1. Add to Memory
        liveLogs.push(entry);
        if (liveLogs.length > MAX_MEM_LOGS) {
            liveLogs.shift();
        }

        // 2. Persist to File
        if (this.currentLogPath) {
            // We use JSONL (JSON Lines) for structured, searchable logging
            const line = JSON.stringify(entry) + "\n";
            Deno.writeTextFile(this.currentLogPath, line, { append: true }).catch(e => {
                console.error("Failed to write to log file:", e);
            });
        }

        // 3. Print to stdout (for the person running the guardian)
        if (source === "guardian") {
            console.log(`[GUARDIAN] ${message}`);
        } else {
             // Optional: suppress verbose child output if you only rely on dashboard
             // but usually safe to keep
             console.log(`[${source}] ${message}`);
        }
    }

    async listLogs() {
        const files = [];
        try {
            for await (const entry of Deno.readDir(LOG_DIR)) {
                if (entry.isFile && entry.name.endsWith(".jsonl")) {
                    const stat = await Deno.stat(join(LOG_DIR, entry.name));
                    files.push({
                        name: entry.name,
                        size: stat.size,
                        created: stat.birthtime || stat.mtime
                    });
                }
            }
        } catch(e) { /* ignore */ }
        // Sort newest first
        return files.sort((a, b) => (b.created?.getTime() || 0) - (a.created?.getTime() || 0));
    }

    async readLog(filename: string): Promise<LogEntry[]> {
        // Security check
        if (filename.includes("..") || !filename.endsWith(".jsonl")) {
            throw new Error("Invalid filename");
        }

        try {
            const path = join(LOG_DIR, filename);
            const content = await Deno.readTextFile(path);
            return content.trim().split('\n').map(line => {
                try { return JSON.parse(line); } catch { return null; }
            }).filter(Boolean);
        } catch (e) {
            return [{
                id: "err",
                timestamp: new Date().toISOString(),
                source: "guardian",
                message: `Error reading log file: ${e}`
            }];
        }
    }
}

const logManager = new LogManager();


// Periodic DB counting
async function countDbItems() {
    if (typeof Deno.openKv !== "function") {
        logManager.log("guardian", "Error counting DB items: Deno.openKv is not available. Please run with --unstable-kv");
        return;
    }

    try {
        const kv = await Deno.openKv("./greens.db");

        let foods = 0;
        for await (const _ of kv.list({ prefix: ["foods"] })) foods++;

        let recipes = 0;
        for await (const _ of kv.list({ prefix: ["recipes"] })) recipes++;

        let users = 0;
        for await (const _ of kv.list({ prefix: ["users"] })) users++;

        dbStats = { foodCount: foods, recipeCount: recipes, userCount: users };
        await kv.close();
    } catch (e) {
        logManager.log("guardian", `Error counting DB items: ${e instanceof Error ? e.message : e}`);
    }
}

// Initial count and periodic update
countDbItems();
setInterval(countDbItems, 60000); // Every minute


class ProcessManager {
    private backendChild: Deno.ChildProcess | null = null;
    private frontendChild: Deno.ChildProcess | null = null;
    private shouldRun = true;

    async start() {
        this.shouldRun = true;
        stats.status = "starting";
        logManager.log("guardian", "Starting application (Backend & Frontend)...");

        try {
            // Start Backend
            const backendCmd = new Deno.Command("deno", {
                args: ["task", "server"],
                stdout: "piped",
                stderr: "piped",
                env: { "PORT": BACKEND_PORT.toString() }
            });
            this.backendChild = backendCmd.spawn();
            this.handleOutput(this.backendChild.stdout, "backend");
            this.handleOutput(this.backendChild.stderr, "backend"); // or stderr

            // Start Frontend
            const frontendCmd = new Deno.Command("deno", {
                args: ["task", "dev", "--port", FRONTEND_PORT.toString()],
                stdout: "piped",
                stderr: "piped",
            });
            this.frontendChild = frontendCmd.spawn();
            this.handleOutput(this.frontendChild.stdout, "frontend");
            this.handleOutput(this.frontendChild.stderr, "frontend");

            stats.pid = this.backendChild.pid; // Primary PID (Backend)
            stats.startTime = Date.now();
            stats.status = "running";

            logManager.log("guardian", `Processes started. Backend: ${this.backendChild.pid}, Frontend: ${this.frontendChild.pid}`);

            // Wait for either to exit
            Promise.race([
                this.backendChild.status,
                this.frontendChild.status
            ]).then((status) => {
                this.onExit(status.code);
            });

        } catch (e) {
            logManager.log("guardian", `CRITICAL: Failed to spawn processes: ${e}`);
            stats.status = "crashed";
        }
    }

    async stop() {
        this.shouldRun = false;
        if (this.backendChild) {
            try { this.backendChild.kill(); } catch (e) { }
            this.backendChild = null;
        }
        if (this.frontendChild) {
            try { this.frontendChild.kill(); } catch (e) { }
            this.frontendChild = null;
        }
        logManager.log("guardian", "Stopped all processes.");
        stats.status = "stopped";
    }

    async restart() {
        logManager.log("guardian", "Restarting system...");
        await this.stop();

        // Rotate logs on restart to ensure "Clean log" as requested
        await logManager.rotate();

        setTimeout(() => this.start(), 1000);
    }

    private async handleOutput(stream: ReadableStream<Uint8Array>, source: "backend" | "frontend") {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.trim()) logManager.log(source, line);
                }
            }
        } catch (e) {
            // Stream closed or error
        }
    }

    private onExit(code: number) {
        stats.status = "stopped";
        stats.pid = null;
        stats.lastExitCode = code;
        stats.startTime = null;

        if (this.shouldRun) {
            stats.status = "crashed";
            stats.restartCount++;
            logManager.log("guardian", `Process exited with code ${code}. Restarting everything in ${RESTART_DELAY_MS}ms...`);

            // Auto-restart
            // We do NOT rotate logs on crash auto-restart usually, to keep context of the crash?
            // User said: "If we restart- its a new session with clean log."
            // Assuming this applies to manual restarts or full resets.
            // For a crash-loop, keeping the log might be better, but let's stick to the directive strictly:
            // "If we restart- its a new session with clean log."
            // I will rotate here too to be safe.
            logManager.rotate().then(() => {
                setTimeout(() => this.start(), RESTART_DELAY_MS);
            });
        }
    }
}

const manager = new ProcessManager();

// --- Action Runners ---

async function runCommand(cmd: string, args: string[]) {
    logManager.log("guardian", `Running command: ${cmd} ${args.join(" ")}`);
    try {
        const command = new Deno.Command(cmd, {
            args,
            stdout: "piped",
            stderr: "piped",
        });
        const process = command.spawn();

        // Pipe output to logs
        const decoder = new TextDecoder();
        const output = await process.output();
        const stdout = decoder.decode(output.stdout);
        const stderr = decoder.decode(output.stderr);

        if (stdout) logManager.log("stdout", stdout);
        if (stderr) logManager.log("stderr", stderr);

        logManager.log("guardian", `Command finished with code ${output.code}`);
        return output.code === 0;
    } catch (e) {
        logManager.log("guardian", `Command execution failed: ${e}`);
        return false;
    }
}

// --- Server ---

async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Serve Dashboard HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
        try {
            const htmlPath = join(dirname(fromFileUrl(import.meta.url)), "guardian_dashboard.html");
            const html = await Deno.readTextFile(htmlPath);
            return new Response(html, { headers: { "content-type": "text/html" } });
        } catch (e) {
            return new Response("Dashboard file not found. Please create scripts/guardian_dashboard.html", { status: 404 });
        }
    }

    // API Status
    if (url.pathname === "/api/status") {
        const currentUptime = stats.startTime ? Math.floor((Date.now() - stats.startTime) / 1000) : 0;

        let memory = { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 };
        try {
            memory = Deno.memoryUsage();
        } catch { }

        return Response.json({
            ...stats,
            uptimeSeconds: currentUptime,
            memory,
            systemMemory: Deno.systemMemoryInfo(),
            loadAvg: Deno.loadavg(),
            hostname: Deno.hostname(),
            platform: Deno.build.os,
            appUrl: `http://localhost:${FRONTEND_PORT}`,
            denoVersion: Deno.version.deno,
            v8Version: Deno.version.v8,
            typescriptVersion: Deno.version.typescript,
            timestamp: Date.now(),
            dbStats,
            interactionStats
        });
    }

    // API Logs
    if (url.pathname === "/api/logs") {
        // Return live logs
        return Response.json(liveLogs);
    }

    // API Log History
    if (url.pathname === "/api/logs/list") {
        const files = await logManager.listLogs();
        return Response.json(files);
    }

    if (url.pathname.startsWith("/api/logs/view")) {
        const filename = url.searchParams.get("file");
        if (!filename) return new Response("Missing file param", { status: 400 });
        const content = await logManager.readLog(filename);
        return Response.json(content);
    }

    if (req.method === "POST") {
        if (url.pathname === "/api/restart") {
            const source = url.searchParams.get("source") === "omnibox" ? "omnibox" : "click";
            interactionStats[source].restart++;
            manager.restart();
            return Response.json({ success: true, message: "Restart triggered" });
        }

        if (url.pathname === "/api/git-pull") {
            const source = url.searchParams.get("source") === "omnibox" ? "omnibox" : "click";
            interactionStats[source].pull++;
            // Run in background to not block
            runCommand("git", ["pull"]).then(success => {
                if (success) logManager.log("guardian", "Git pull successful");
                else logManager.log("guardian", "Git pull failed");
            });
            return Response.json({ success: true, message: "Git pull started" });
        }

        if (url.pathname === "/api/build") {
            const source = url.searchParams.get("source") === "omnibox" ? "omnibox" : "click";
            interactionStats[source].build++;
            runCommand("deno", ["task", "build"]).then(success => {
                if (success) logManager.log("guardian", "Build successful");
                else logManager.log("guardian", "Build failed");
            });
            return Response.json({ success: true, message: "Build started" });
        }

        if (url.pathname === "/api/deploy") {
            const source = url.searchParams.get("source") === "omnibox" ? "omnibox" : "click";
            interactionStats[source].deploy++;
            // Chain commands
            (async () => {
                const pull = await runCommand("git", ["pull"]);
                if (!pull) return;
                const build = await runCommand("deno", ["task", "build"]);
                if (!build) return;
                manager.restart();
            })();
            return Response.json({ success: true, message: "Deploy sequence started" });
        }
    }

    return new Response("Not Found", { status: 404 });
}

// --- Cleanup ---
async function clearPort(port: number) {
    if (Deno.build.os !== "windows") return; // Linux/Mac usually handle reuse addr better or require 'lsof'

    try {
        const cmd = new Deno.Command("netstat", { args: ["-ano"] });
        const { stdout } = await cmd.output();
        const output = new TextDecoder().decode(stdout);
        const lines = output.split("\n");
        const pattern = new RegExp(`:${port}\\s+.*LISTENING\\s+(\\d+)`);

        for (const line of lines) {
            const match = line.match(pattern);
            if (match) {
                const pid = match[1];
                if (parseInt(pid) === Deno.pid) continue;

                logManager.log("guardian", `Found existing process on port ${port} (PID: ${pid}). Killing it...`);
                const killCmd = new Deno.Command("taskkill", { args: ["/F", "/PID", pid] });
                await killCmd.output();
            }
        }
    } catch (e) {
        logManager.log("guardian", `Error clearing port ${port}: ${e}`);
    }
}

// Start everything
async function bootstrap() {
    await logManager.init(); // Init logging first

    logManager.log("guardian", `Clearing ports and initializing...`);
    await clearPort(PORT);
    await clearPort(FRONTEND_PORT);
    await clearPort(BACKEND_PORT);

    logManager.log("guardian", `Guardian starting on port ${PORT}...`);
    logManager.log("guardian", `Application will be available at http://localhost:${FRONTEND_PORT}`);
    manager.start();

    Deno.serve({ port: PORT, handler: handleRequest });
}

bootstrap();
