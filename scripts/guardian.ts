
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

const MAX_LOGS = 2000;
const PORT = Number(Deno.env.get("GUARDIAN_PORT") || "9999");
const BACKEND_PORT = Number(Deno.env.get("PORT") || "8000");
const FRONTEND_PORT = 3000;
const RESTART_DELAY_MS = 3000;

// State
interface LogEntry {
    id: string;
    timestamp: string;
    source: "stdout" | "stderr" | "guardian";
    message: string;
}

interface ProcessStats {
    status: "running" | "stopped" | "crashed" | "starting";
    pid: number | null;
    startTime: number | null;
    restartCount: number;
    lastExitCode: number | null;
    uptimeSeconds: number;
}

const logs: LogEntry[] = [];
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

// Periodic DB counting
async function countDbItems() {
    if (typeof Deno.openKv !== "function") {
        addLog("guardian", "Error counting DB items: Deno.openKv is not available. Please run with --unstable-kv");
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
        addLog("guardian", `Error counting DB items: ${e instanceof Error ? e.message : e}`);
    }
}

// Initial count and periodic update
countDbItems();
setInterval(countDbItems, 60000); // Every minute

function addLog(source: "stdout" | "stderr" | "guardian", message: string) {
    const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source,
        message: message.trimEnd(),
    };
    logs.push(entry);
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }
    // Also print to real console so we can see it in the terminal running the guardian
    if (source === "guardian") {
        console.log(`[GUARDIAN] ${message}`);
    } else {
        // We don't re-print child logs to avoid double logging if piping,
        // but usually we want to see them.
        console.log(message);
    }
}

class ProcessManager {
    private backendChild: Deno.ChildProcess | null = null;
    private frontendChild: Deno.ChildProcess | null = null;
    private shouldRun = true;

    async start() {
        this.shouldRun = true;
        stats.status = "starting";
        addLog("guardian", "Starting application (Backend & Frontend)...");

        // Start Backend
        const backendCmd = new Deno.Command("deno", {
            args: ["task", "server"],
            stdout: "piped",
            stderr: "piped",
            env: { "PORT": BACKEND_PORT.toString() }
        });
        this.backendChild = backendCmd.spawn();
        this.handleOutput(this.backendChild.stdout, "stdout");
        this.handleOutput(this.backendChild.stderr, "stderr");

        // Start Frontend
        const frontendCmd = new Deno.Command("deno", {
            args: ["task", "dev", "--port", FRONTEND_PORT.toString()],
            stdout: "piped",
            stderr: "piped",
        });
        this.frontendChild = frontendCmd.spawn();
        this.handleOutput(this.frontendChild.stdout, "stdout");
        this.handleOutput(this.frontendChild.stderr, "stderr");

        stats.pid = this.backendChild.pid; // Primary PID
        stats.startTime = Date.now();
        stats.status = "running";

        addLog("guardian", `Processes started. Backend: ${this.backendChild.pid}, Frontend: ${this.frontendChild.pid}`);

        // Wait for either to exit
        Promise.race([
            this.backendChild.status,
            this.frontendChild.status
        ]).then((status) => {
            this.onExit(status.code);
        });
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
        addLog("guardian", "Stopped all processes.");
        stats.status = "stopped";
    }

    async restart() {
        await this.stop();
        setTimeout(() => this.start(), 1000);
    }

    private async handleOutput(stream: ReadableStream<Uint8Array>, source: "stdout" | "stderr") {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line) addLog(source, line);
                }
            }
        } catch (e) { }
    }

    private onExit(code: number) {
        stats.status = "stopped";
        stats.pid = null;
        stats.lastExitCode = code;
        stats.startTime = null;

        if (this.shouldRun) {
            stats.status = "crashed";
            stats.restartCount++;
            addLog("guardian", `Process exited with code ${code}. Restarting everything in ${RESTART_DELAY_MS}ms...`);
            setTimeout(() => this.start(), RESTART_DELAY_MS);
        }
    }
}

const manager = new ProcessManager();

// --- Action Runners ---

async function runCommand(cmd: string, args: string[]) {
    addLog("guardian", `Running command: ${cmd} ${args.join(" ")}`);
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

    if (stdout) addLog("stdout", stdout);
    if (stderr) addLog("stderr", stderr);

    addLog("guardian", `Command finished with code ${output.code}`);
    return output.code === 0;
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

    // API
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

    if (url.pathname === "/api/logs") {
        // Optional: filter by source or last N
        return Response.json(logs);
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
                if (success) addLog("guardian", "Git pull successful");
                else addLog("guardian", "Git pull failed");
            });
            return Response.json({ success: true, message: "Git pull started" });
        }

        if (url.pathname === "/api/build") {
            const source = url.searchParams.get("source") === "omnibox" ? "omnibox" : "click";
            interactionStats[source].build++;
            runCommand("deno", ["task", "build"]).then(success => {
                if (success) addLog("guardian", "Build successful");
                else addLog("guardian", "Build failed");
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
    if (Deno.build.os !== "windows") return;

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

                addLog("guardian", `Found existing process on port ${port} (PID: ${pid}). Killing it...`);
                const killCmd = new Deno.Command("taskkill", { args: ["/F", "/PID", pid] });
                await killCmd.output();
            }
        }
    } catch (e) {
        addLog("guardian", `Error clearing port ${port}: ${e}`);
    }
}

// Start everything
async function bootstrap() {
    addLog("guardian", `Clearing ports and initializing...`);
    await clearPort(PORT);
    await clearPort(FRONTEND_PORT);
    await clearPort(BACKEND_PORT);

    addLog("guardian", `Guardian starting on port ${PORT}...`);
    addLog("guardian", `Application will be available at http://localhost:${FRONTEND_PORT}`);
    manager.start();

    Deno.serve({ port: PORT, handler: handleRequest });
}

bootstrap();
