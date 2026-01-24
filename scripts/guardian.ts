
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

const MAX_LOGS = 2000;
const PORT = Number(Deno.env.get("GUARDIAN_PORT") || "9999");
const BACKEND_PORT = Number(Deno.env.get("PORT") || "8000");
const FRONTEND_PORT = 3000;

// Config
const RESTART_DELAY_MS = 3000;

async function clearPort(port: number) {
    if (Deno.build.os === "windows") {
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
                    const killCmd = new Deno.Command("taskkill", { args: ["/F", "/PID", pid] });
                    await killCmd.output();
                }
            }
        } catch (e) { /* ignore */ }
    } else {
        // Linux/Mac
        try {
            const cmd = new Deno.Command("lsof", { args: ["-t", "-i", `:${port}`] });
            const output = await cmd.output();
            const pids = new TextDecoder().decode(output.stdout).trim().split('\n');
            for (const pid of pids) {
                if (pid && parseInt(pid) !== Deno.pid) {
                     const kill = new Deno.Command("kill", { args: ["-9", pid] });
                     await kill.output();
                }
            }
        } catch (e) { /* ignore */ }
    }
}

// --- Interfaces ---

interface LogEntry {
    id: string;
    timestamp: string;
    service: string; // "backend", "frontend", "guardian", "system"
    source: "stdout" | "stderr" | "info";
    message: string;
}

interface ServiceStats {
    name: string;
    status: "running" | "stopped" | "crashed" | "starting" | "stopping";
    pid: number | null;
    cpu: number; // Percentage
    memory: number; // RSS in bytes
    uptime: number; // Seconds
    restarts: number;
    startTime: number | null;
    lastExitCode: number | null;
}

interface ServiceConfig {
    name: string;
    command: string[];
    env?: Record<string, string>;
    cwd?: string;
    autoRestart: boolean;
}

// --- Persistence ---

let kv: Deno.Kv;
let currentSessionId = crypto.randomUUID();

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

async function persistLog(entry: LogEntry) {
    if (!kv) return;
    try {
        // Index by Session -> Service -> Time
        await kv.set(
            ["guardian", "logs", currentSessionId, entry.service, entry.timestamp, entry.id],
            entry,
            { expireIn: 7 * 24 * 60 * 60 * 1000 } // 7 days retention
        );
    } catch (e) {
        console.error("Failed to persist log:", e);
    }
}

async function updateServiceStat(serviceName: string, type: string, count: number = 1) {
    if (!kv) return;
    const date = getTodayStr();
    try {
        await kv.atomic()
            .mutate({
                type: "sum",
                key: ["guardian", "stats", date, serviceName, type],
                value: new Deno.KvU64(BigInt(count))
            })
            .commit();
    } catch (e) { /* ignore */ }
}

// --- Service Class ---

class Service {
    config: ServiceConfig;
    stats: ServiceStats;
    logs: LogEntry[] = [];
    process: Deno.ChildProcess | null = null;
    shouldRun: boolean = false;

    constructor(config: ServiceConfig) {
        this.config = config;
        this.stats = {
            name: config.name,
            status: "stopped",
            pid: null,
            cpu: 0,
            memory: 0,
            uptime: 0,
            restarts: 0,
            startTime: null,
            lastExitCode: null,
        };
        this.shouldRun = config.autoRestart;
        this.loadStats();
    }

    async loadStats() {
        if (!kv) return;
        try {
            const date = getTodayStr();
            const res = await kv.get<Deno.KvU64>(["guardian", "stats", date, this.config.name, "restarts"]);
            if (res.value) {
                this.stats.restarts = Number(res.value.value);
            }
        } catch (e) { /* ignore */ }
    }

    addLog(source: "stdout" | "stderr" | "info", message: string) {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            service: this.config.name,
            source,
            message: message.trimEnd(),
        };

        this.logs.push(entry);
        if (this.logs.length > MAX_LOGS) {
            this.logs.shift();
        }

        persistLog(entry);
    }

    async start() {
        if (this.stats.status === "running" || this.stats.status === "starting") return;

        this.shouldRun = true;
        this.stats.status = "starting";
        this.addLog("info", "Starting service...");

        try {
            const cmd = new Deno.Command(this.config.command[0], {
                args: this.config.command.slice(1),
                env: { ...Deno.env.toObject(), ...this.config.env },
                cwd: this.config.cwd || Deno.cwd(),
                stdout: "piped",
                stderr: "piped",
            });

            this.process = cmd.spawn();
            this.stats.pid = this.process.pid;
            this.stats.startTime = Date.now();
            this.stats.status = "running";
            this.addLog("info", `Service started (PID: ${this.process.pid})`);

            // Stream logs
            this.readStream(this.process.stdout, "stdout");
            this.readStream(this.process.stderr, "stderr");

            // Wait for exit
            this.process.status.then((status) => this.onExit(status.code));

        } catch (e) {
            this.addLog("stderr", `Failed to start: ${e}`);
            this.stats.status = "crashed";
            this.retry();
        }
    }

    async stop() {
        this.shouldRun = false;
        if (this.process) {
            this.addLog("info", "Stopping service...");
            try {
                this.process.kill();
            } catch (e) {
                this.addLog("stderr", `Error stopping: ${e}`);
            }
        }
        // Force status update (in case onExit is slow)
        this.stats.status = "stopping";
    }

    async restart() {
        await this.stop();
        // Wait a bit to ensure process is dead
        setTimeout(() => this.start(), 1000);
        this.stats.restarts++;
        updateServiceStat(this.config.name, "restarts");
    }

    private async readStream(stream: ReadableStream<Uint8Array>, source: "stdout" | "stderr") {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line) this.addLog(source, line);
                }
            }
        } catch (e) { /* ignore */ }
    }

    private onExit(code: number) {
        this.stats.pid = null;
        this.stats.lastExitCode = code;
        this.process = null;
        this.stats.cpu = 0;
        this.stats.memory = 0;

        if (!this.shouldRun) {
            this.stats.status = "stopped";
            this.addLog("info", "Service stopped by user.");
            return;
        }

        this.stats.status = "crashed";
        this.addLog("info", `Service exited with code ${code}.`);
        this.stats.restarts++;
        updateServiceStat(this.config.name, "restarts");
        this.retry();
    }

    private retry() {
        if (!this.shouldRun) return;
        this.addLog("info", `Restarting in ${RESTART_DELAY_MS}ms...`);
        setTimeout(() => this.start(), RESTART_DELAY_MS);
    }
}

// --- Service Manager ---

class ServiceManager {
    services: Map<string, Service> = new Map();

    register(config: ServiceConfig) {
        const service = new Service(config);
        this.services.set(config.name, service);
        return service;
    }

    get(name: string) {
        return this.services.get(name);
    }

    getAll() {
        return Array.from(this.services.values());
    }

    async startAll() {
        for (const service of this.services.values()) {
            if (service.config.autoRestart) {
                service.start();
            }
        }
    }

    // For manual injection of logs (e.g. Guardian self-logs)
    getOrAdd(name: string): Service {
        let s = this.services.get(name);
        if (!s) {
            // Virtual service
            s = new Service({ name, command: [], autoRestart: false });
            s.stats.status = "running";
            this.services.set(name, s);
        }
        return s;
    }

    async stopAll() {
        for (const service of this.services.values()) {
            await service.stop();
        }
    }
}

const manager = new ServiceManager();

// --- System Monitor ---

async function updateSystemStats() {
    if (Deno.build.os === "windows") return; // Skip ps on windows for now

    // Collect PIDs
    const pids = new Map<number, Service>();

    for (const service of manager.getAll()) {
        if (service.stats.pid) {
            pids.set(service.stats.pid, service);
            // Update uptime
            if (service.stats.startTime) {
                service.stats.uptime = Math.floor((Date.now() - service.stats.startTime) / 1000);
            }
        }
    }

    // Also track Guardian
    const guardianService = manager.getOrAdd("guardian");
    guardianService.stats.pid = Deno.pid;
    guardianService.stats.uptime = Math.floor(performance.now() / 1000);
    pids.set(Deno.pid, guardianService);

    if (pids.size === 0) return;

    try {
        const cmd = new Deno.Command("ps", {
            args: ["-p", Array.from(pids.keys()).join(','), "-o", "pid,pcpu,rss"],
            stdout: "piped"
        });
        const output = await cmd.output();
        const text = new TextDecoder().decode(output.stdout);
        const lines = text.trim().split('\n');

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(/\s+/);
            if (parts.length >= 3) {
                const pid = parseInt(parts[0]);
                const cpu = parseFloat(parts[1]);
                const rss = parseInt(parts[2]) * 1024;

                const service = pids.get(pid);
                if (service) {
                    service.stats.cpu = cpu;
                    service.stats.memory = rss;
                }
            }
        }
    } catch (e) { /* ignore */ }
}

// --- API & Server ---

async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Serve Dashboard
    if (url.pathname === "/" || url.pathname === "/index.html") {
        try {
            const htmlPath = join(dirname(fromFileUrl(import.meta.url)), "guardian_dashboard.html");
            const html = await Deno.readTextFile(htmlPath);
            return new Response(html, { headers: { "content-type": "text/html" } });
        } catch (e) {
            return new Response("Dashboard not found.", { status: 404 });
        }
    }

    if (url.pathname === "/api/status") {
        // Ensure Guardian is in the list
        manager.getOrAdd("guardian");
        const services = manager.getAll().map(s => s.stats);

        return Response.json({
            services: services,
            system: Deno.systemMemoryInfo(),
            load: Deno.loadavg()
        });
    }

    if (url.pathname === "/api/logs") {
        const serviceName = url.searchParams.get("service");
        if (!serviceName) return Response.json([]);

        const service = manager.get(serviceName);
        if (service) {
            return Response.json(service.logs);
        }
        return Response.json([]);
    }

    if (req.method === "POST" && url.pathname === "/api/control") {
        const serviceName = url.searchParams.get("service");
        const action = url.searchParams.get("action");

        if (!serviceName || !action) return new Response("Missing params", { status: 400 });

        const service = manager.get(serviceName);
        if (!service) return new Response("Service not found", { status: 404 });

        try {
            if (action === "start") await service.start();
            if (action === "stop") await service.stop();
            if (action === "restart") await service.restart();

            return Response.json({ success: true, status: service.stats.status });
        } catch (e) {
            return Response.json({ success: false, error: String(e) });
        }
    }

    // Git Pull / Build / Deploy - Global Actions
    if (req.method === "POST" && url.pathname === "/api/global") {
        const action = url.searchParams.get("action");
        if (action === "git-pull") {
             const p = new Deno.Command("git", { args: ["pull"] });
             const out = await p.output();
             return Response.json({ success: out.code === 0 });
        }
        if (action === "build") {
             const p = new Deno.Command("deno", { args: ["task", "build"] });
             const out = await p.output();
             return Response.json({ success: out.code === 0 });
        }
        if (action === "restart-all") {
             // Restart each managed service
             for(const s of manager.getAll()) {
                 if (s.config.autoRestart) await s.restart();
             }
             return Response.json({ success: true });
        }
    }

    return new Response("Not Found", { status: 404 });
}


// --- Init ---

// --- Console Override ---

function setupGuardianLogging() {
    const guardian = manager.getOrAdd("guardian");
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
        const msg = args.map(a => String(a)).join(" ");
        guardian.addLog("info", msg);
        originalLog(...args);
    };

    console.error = (...args) => {
        const msg = args.map(a => String(a)).join(" ");
        guardian.addLog("stderr", msg);
        originalError(...args);
    };
}

async function bootstrap() {
    setupGuardianLogging();

    try {
        kv = await Deno.openKv("./greens.db");
    } catch (e) {
        console.error("KV Init failed", e);
    }

    console.log("[GUARDIAN] Initializing services...");

    await clearPort(PORT);
    await clearPort(BACKEND_PORT);
    await clearPort(FRONTEND_PORT);

    // Register Services
    manager.register({
        name: "backend",
        command: ["deno", "task", "server"],
        env: { "PORT": String(BACKEND_PORT) },
        autoRestart: true
    });

    manager.register({
        name: "frontend",
        command: ["deno", "task", "dev", "--port", String(FRONTEND_PORT)],
        autoRestart: true
    });

    // Start
    await manager.startAll();

    // Start Monitor Loop
    setInterval(updateSystemStats, 2000);

    // Start Server
    console.log(`[GUARDIAN] Dashboard on port ${PORT}`);
    Deno.serve({ port: PORT, handler: handleRequest });
}

bootstrap();
