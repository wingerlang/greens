
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

const MAX_LOGS = 2000;
const PORT = 9999;
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
    private child: Deno.ChildProcess | null = null;
    private shouldRun = true;

    async start() {
        if (this.child) return;

        this.shouldRun = true;
        stats.status = "starting";
        addLog("guardian", "Starting application...");

        const cmd = new Deno.Command("deno", {
            args: ["task", "server"],
            stdout: "piped",
            stderr: "piped",
        });

        this.child = cmd.spawn();
        stats.pid = this.child.pid;
        stats.startTime = Date.now();
        stats.status = "running";

        addLog("guardian", `Application started with PID ${this.child.pid}`);

        this.handleOutput(this.child.stdout, "stdout");
        this.handleOutput(this.child.stderr, "stderr");

        const { code } = await this.child.status;

        this.onExit(code);
    }

    async stop() {
        this.shouldRun = false;
        if (this.child) {
            addLog("guardian", "Stopping application...");
            try {
                this.child.kill();
            } catch (e) {
                addLog("guardian", `Error killing process: ${e}`);
            }
            this.child = null;
        }
    }

    async restart() {
        await this.stop();
        // Give it a moment to release ports
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
        } catch (e) {
            // Ignore errors here, stream might close
        }
    }

    private onExit(code: number) {
        stats.status = "stopped";
        stats.pid = null;
        stats.lastExitCode = code;
        stats.startTime = null; // Reset uptime counter logic base

        if (this.shouldRun) {
            stats.status = "crashed";
            stats.restartCount++;
            addLog("guardian", `Application exited with code ${code}. Restarting in ${RESTART_DELAY_MS}ms...`);
            setTimeout(() => this.start(), RESTART_DELAY_MS);
        } else {
            addLog("guardian", `Application exited cleanly with code ${code}.`);
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
        } catch {}

        return Response.json({
            ...stats,
            uptimeSeconds: currentUptime,
            memory,
            systemMemory: Deno.systemMemoryInfo(),
            timestamp: Date.now()
        });
    }

    if (url.pathname === "/api/logs") {
        // Optional: filter by source or last N
        return Response.json(logs);
    }

    if (req.method === "POST") {
        if (url.pathname === "/api/restart") {
            manager.restart();
            return Response.json({ success: true, message: "Restart triggered" });
        }

        if (url.pathname === "/api/git-pull") {
            // Run in background to not block
            runCommand("git", ["pull"]).then(success => {
                 if (success) addLog("guardian", "Git pull successful");
                 else addLog("guardian", "Git pull failed");
            });
            return Response.json({ success: true, message: "Git pull started" });
        }

        if (url.pathname === "/api/build") {
             runCommand("deno", ["task", "build"]).then(success => {
                 if (success) addLog("guardian", "Build successful");
                 else addLog("guardian", "Build failed");
            });
            return Response.json({ success: true, message: "Build started" });
        }

        if (url.pathname === "/api/deploy") {
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

// Start everything
addLog("guardian", `Guardian starting on port ${PORT}...`);
manager.start();
Deno.serve({ port: PORT, handler: handleRequest });
