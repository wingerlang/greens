
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

const MAX_LOGS = 2000;
const PORT = Number(Deno.env.get("GUARDIAN_PORT") || "9999");
const BACKEND_PORT = Number(Deno.env.get("PORT") || "8000");
const FRONTEND_PORT = 3000;
const RESTART_DELAY_MS = 3000;

// State Interfaces
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

interface SessionInfo {
    id: string;
    startTime: string;
    endTime: string | null;
    date: string; // YYYY-MM-DD
}

interface DailyStats {
    date: string;
    restarts: number;
    gitPulls: number;
    builds: number;
    deploys: number;
}

// In-memory state (mirrored to KV)
const logs: LogEntry[] = [];
const stats: ProcessStats = {
    status: "stopped",
    pid: null,
    startTime: null,
    restartCount: 0,
    lastExitCode: null,
    uptimeSeconds: 0,
};

let currentSessionId = crypto.randomUUID();
let kv: Deno.Kv;

const interactionStats = {
    click: { restart: 0, pull: 0, build: 0, deploy: 0 },
    omnibox: { restart: 0, pull: 0, build: 0, deploy: 0 },
};

let dbStats = {
    foodCount: 0,
    recipeCount: 0,
    userCount: 0,
};

let lastCoverage = { percent: 0, timestamp: 0 };

// --- Persistence Helpers ---

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

async function persistLog(entry: LogEntry) {
    if (!kv) return;
    // Key: ["guardian", "logs", sessionId, timestamp, logId]
    // Value: LogEntry
    // Also keeping a recent list in memory for quick access
    try {
        await kv.set(
            ["guardian", "logs", currentSessionId, entry.timestamp, entry.id],
            entry,
            { expireIn: 30 * 24 * 60 * 60 * 1000 } // Auto-expire after 30 days
        );
    } catch (e) {
        console.error("Failed to persist log:", e);
    }
}

async function updateDailyStat(type: 'restarts' | 'gitPulls' | 'builds' | 'deploys', count: number = 1) {
    if (!kv) return;
    const date = getTodayStr();
    const key = ["guardian", "stats", date];

    try {
        await kv.atomic()
            .mutate({
                type: "sum",
                key: [...key, type],
                value: new Deno.KvU64(BigInt(count))
            })
            .commit();
    } catch (e) {
        console.error("Failed to update daily stats:", e);
    }
}

async function initSession() {
    if (!kv) return;
    const now = new Date();
    const session: SessionInfo = {
        id: currentSessionId,
        startTime: now.toISOString(),
        endTime: null,
        date: getTodayStr()
    };

    // Save session info
    await kv.set(["guardian", "sessions", session.date, session.id], session);
    await kv.set(["guardian", "active_session"], session.id);

    addLog("guardian", `Session started: ${currentSessionId}`);
}

async function loadHistory(sessionId: string): Promise<LogEntry[]> {
    if (!kv) return [];
    const entries: LogEntry[] = [];
    const prefix = ["guardian", "logs", sessionId];
    for await (const entry of kv.list<LogEntry>({ prefix })) {
        entries.push(entry.value);
    }
    // Sort by timestamp
    return entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

async function getSessionsForDate(date: string): Promise<SessionInfo[]> {
    if (!kv) return [];
    const sessions: SessionInfo[] = [];
    for await (const entry of kv.list<SessionInfo>({ prefix: ["guardian", "sessions", date] })) {
        sessions.push(entry.value);
    }
    return sessions;
}

// Periodic DB counting
async function countDbItems() {
    if (!kv) return;

    try {
        // We use the same KV for app data and guardian data, potentially dangerous but convenient here
        // Assuming app data is in the same DB file

        // Actually, let's open a separate connection for app data if needed, 
        // or just reuse if it's the same file. The Plan implied reuse.

        let foods = 0;
        for await (const _ of kv.list({ prefix: ["foods"] })) foods++;

        let recipes = 0;
        for await (const _ of kv.list({ prefix: ["recipes"] })) recipes++;

        let users = 0;
        for await (const _ of kv.list({ prefix: ["users"] })) users++;

        dbStats = { foodCount: foods, recipeCount: recipes, userCount: users };
    } catch (e) {
        addLog("guardian", `Error counting DB items: ${e instanceof Error ? e.message : e}`);
    }
}

function addLog(source: "stdout" | "stderr" | "guardian", message: string) {
    const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source,
        message: message.trimEnd(),
    };

    // Memory buffer
    logs.push(entry);
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }

    // Persist
    persistLog(entry);

    // Console output
    if (source === "guardian") {
        console.log(`[GUARDIAN] ${message}`);
    } else {
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

        // Track restart
        stats.restartCount++;
        await updateDailyStat("restarts");
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
            // Wait before restart
            addLog("guardian", `Process exited with code ${code}. Restarting everything in ${RESTART_DELAY_MS}ms...`);

            // Track restart due to crash
            stats.restartCount++;
            updateDailyStat("restarts");

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

        // Get daily stats
        const date = getTodayStr();
        const dailyStats: any = {};
        if (kv) {
            const keys = ["restarts", "gitPulls", "builds", "deploys"];
            for (const k of keys) {
                const res = await kv.get<Deno.KvU64>(["guardian", "stats", date, k]);
                dailyStats[k] = res.value ? Number(res.value.value) : 0;
            }
        }

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
            interactionStats,
            dailyStats: dailyStats,
            sessionId: currentSessionId
        });
    }

    if (url.pathname === "/api/logs") {
        const sessionId = url.searchParams.get("sessionId");
        if (sessionId && sessionId !== currentSessionId) {
            // Fetch history
            const history = await loadHistory(sessionId);
            return Response.json(history);
        }
        // Return current buffer
        return Response.json(logs);
    }

    if (url.pathname === "/api/history") {
        // List sessions for a date (default today)
        const date = url.searchParams.get("date") || getTodayStr();
        const sessions = await getSessionsForDate(date);
        return Response.json({ date, sessions });
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
            await updateDailyStat("gitPulls");

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
            await updateDailyStat("builds");

            runCommand("deno", ["task", "build"]).then(success => {
                if (success) addLog("guardian", "Build successful");
                else addLog("guardian", "Build failed");
            });
            return Response.json({ success: true, message: "Build started" });
        }

        if (url.pathname === "/api/deploy") {
            const source = url.searchParams.get("source") === "omnibox" ? "omnibox" : "click";
            interactionStats[source].deploy++;
            await updateDailyStat("deploys");

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

        if (url.pathname === "/api/test") {
            addLog("guardian", "Starting tests...");
            const covDir = "coverage_guardian";

            // Clean up old coverage
            try { await Deno.remove(covDir, { recursive: true }); } catch {}

            // Run tests
            runCommand("deno", ["test", "-A", `--coverage=${covDir}`]).then(async (success) => {
                if (success) {
                    addLog("guardian", "Tests passed. Calculating coverage...");

                    // Generate summary
                    const cmd = new Deno.Command("deno", {
                        args: ["coverage", covDir],
                        stdout: "piped",
                        stderr: "piped"
                    });
                    const output = await cmd.output();
                    const text = new TextDecoder().decode(output.stdout);

                    if (text) {
                        addLog("stdout", text);
                        // Extract percentage (naive regex)
                        const match = text.match(/Covered (\d+(\.\d+)?)%/); // e.g. "Covered 85.5% of lines"
                         // Actually Deno output format is:
                         // "Covered 85.5% (lines)" or similar?
                         // Deno 1.4x: "Covered 92.5% of lines"
                        if (match) {
                            lastCoverage = { percent: parseFloat(match[1]), timestamp: Date.now() };
                        }
                    }
                } else {
                    addLog("guardian", "Tests failed.");
                }
            });

            return Response.json({ success: true, message: "Tests started" });
        }
    }

    if (url.pathname === "/api/coverage") {
        return Response.json(lastCoverage);
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
    // Open KV
    try {
        kv = await Deno.openKv("./greens.db");
    } catch (e) {
        console.error("Failed to open KV:", e);
    }

    await initSession();

    // Check if we recovered from a crash/restart based on previous stats?
    // For now, simpler to just say we started a new session.
    addLog("guardian", "Guardian initialized. State persistence enabled.");

    addLog("guardian", `Clearing ports and initializing...`);
    await clearPort(PORT);
    await clearPort(FRONTEND_PORT);
    await clearPort(BACKEND_PORT);

    addLog("guardian", `Guardian starting on port ${PORT}...`);
    addLog("guardian", `Application will be available at http://localhost:${FRONTEND_PORT}`);
    manager.start();

    // Initial Db count
    countDbItems();
    setInterval(countDbItems, 60000);

    Deno.serve({ port: PORT, handler: handleRequest });
}

bootstrap();
