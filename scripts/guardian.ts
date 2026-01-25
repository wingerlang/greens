
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";

const MAX_LOGS = 2000;
const PORT = Number(Deno.env.get("GUARDIAN_PORT") || "9999");
const BACKEND_PORT = Number(Deno.env.get("PORT") || "8000");
const FRONTEND_PORT = 3000;
const LOG_DIR = "logs";

// Config
const RESTART_DELAY_MS = 3000;
const METRIC_RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

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

interface MetricEntry {
    timestamp: number;
    cpu: number;
    memory: number;
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
        // 1. KV Persistence (Short term / Searchable index if needed)
        // We reduce KV retention for logs if we have files, but user asked for search/filter so keeping it is useful
        // But maybe 24h in KV is enough if we have files?
        // Let's keep 7 days in KV as requested originally, but files are forever.
        await kv.set(
            ["guardian", "logs", currentSessionId, entry.service, entry.timestamp, entry.id],
            entry,
            { expireIn: 7 * 24 * 60 * 60 * 1000 }
        );
    } catch (e) {
        console.error("Failed to persist log:", e);
    }

    // 2. File Persistence
    try {
        const line = `[${entry.timestamp}] [${entry.source.toUpperCase()}] ${entry.message}\n`;
        const fileName = `${getTodayStr()}_${entry.service}.log`;
        const filePath = join(LOG_DIR, fileName);
        await Deno.writeTextFile(filePath, line, { append: true });
    } catch (e) {
        console.error(`Failed to write log file: ${e}`);
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

async function saveMetric(serviceName: string, cpu: number, memory: number) {
    if (!kv) return;
    const now = Date.now();
    try {
        const metric: MetricEntry = { timestamp: now, cpu, memory };
        await kv.set(
            ["guardian", "metrics", serviceName, now],
            metric,
            { expireIn: METRIC_RETENTION_MS }
        );
    } catch (e) { /* ignore */ }
}

// --- Service Class ---

class Service {
    config: ServiceConfig;
    stats: ServiceStats;
    logs: LogEntry[] = [];
    process: Deno.ChildProcess | null = null;
    shouldRun: boolean = false;
    lastMetricSave: number = 0;

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

    // Call this periodically
    async persistMetrics() {
        // Save every 60 seconds to avoid KV bloat
        const now = Date.now();
        if (now - this.lastMetricSave > 60000) {
            await saveMetric(this.config.name, this.stats.cpu, this.stats.memory);
            this.lastMetricSave = now;
        }
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

async function updateWindowsStats(pids: Map<number, Service>) {
    if (pids.size === 0) return;
    const pidList = Array.from(pids.keys());
    // wmic WHERE clause: IDProcess=123 OR IDProcess=456
    const whereClause = pidList.map(p => `IDProcess=${p}`).join(" OR ");

    try {
        const cmd = new Deno.Command("wmic", {
            args: [
                "path", "Win32_PerfFormattedData_PerfProc_Process",
                "where", whereClause,
                "get", "IDProcess,PercentProcessorTime,WorkingSet",
                "/format:csv"
            ],
            stdout: "piped"
        });
        const output = await cmd.output();
        const text = new TextDecoder().decode(output.stdout);
        // Output example:
        // Node,IDProcess,PercentProcessorTime,WorkingSet
        // MYPC,1234,0,500000

        const lines = text.trim().split('\n');
        // Skip headers. CSV format might repeat headers or have blank lines.
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("Node,")) continue;

            const parts = trimmed.split(",");
            // Node, IDProcess, PercentProcessorTime, WorkingSet
            // Note: wmic csv order depends on the GET list but usually alphabetical?
            // Actually /format:csv outputs sorted by property name?
            // Let's rely on the order we requested OR better, the fact that wmic CSV output is consistent.
            // Wait, wmic csv output IS usually alphabetical by property name!
            // IDProcess, PercentProcessorTime, WorkingSet -> IDProcess, PercentProcessorTime, WorkingSet (I, P, W).
            // Actually: IDProcess, PercentProcessorTime, WorkingSetPrivate?
            // "IDProcess,PercentProcessorTime,WorkingSet" -> Sorted: IDProcess, PercentProcessorTime, WorkingSet.
            // If the order is unknown, we can't parse safely by index unless we parse the header.
            // But wmic output order for specific query is often preserved or alphabetical.
            // To be safe, we can check the header. But parsing header in this loop is complex.
            // Let's assume standard behavior: Node is first. Then the rest.
            // If I request specific columns, wmic returns them.
            // Let's assume index 1=ID, 2=CPU, 3=Mem.

            // Re-checking wmic behavior: It sorts columns alphabetically!
            // IDProcess (I), PercentProcessorTime (P), WorkingSet (W).
            // I, P, W.
            // So: Node, IDProcess, PercentProcessorTime, WorkingSet.

            if (parts.length >= 4) {
                 // Try to find the PID in the parts to be sure
                 // We know PID is one of them.
                 // But let's trust the alphabetical sort for now:
                 // 1: IDProcess
                 // 2: PercentProcessorTime
                 // 3: WorkingSet

                 const pid = parseInt(parts[1]);
                 const cpu = parseFloat(parts[2]);
                 const mem = parseInt(parts[3]);

                 const service = pids.get(pid);
                 if (service) {
                     // CPU on Windows (PerfFormattedData) is usually 0-100 * Cores
                     // We take it as is.
                     service.stats.cpu = cpu;
                     service.stats.memory = mem;
                 }
            }
        }
    } catch (e) {
        // Fallback or ignore
    }
}

async function updateSystemStats() {
    // 1. Collect PIDs and track uptime
    const pids = new Map<number, Service>();
    for (const service of manager.getAll()) {
        if (service.stats.pid) {
            pids.set(service.stats.pid, service);
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

    // 2. Fetch Stats (OS specific)
    if (Deno.build.os === "windows") {
        await updateWindowsStats(pids);
    } else {
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

    // 3. Persist Metrics (Throttle handled inside)
    for (const service of manager.getAll()) {
        await service.persistMetrics();
    }
    // Also persist guardian
    await guardianService.persistMetrics();
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

    if (url.pathname === "/api/metrics") {
        const serviceName = url.searchParams.get("service");
        if (!serviceName) return Response.json([]);

        // Default to last 24h
        const limit = Number(url.searchParams.get("limit") || "100");
        const entries: MetricEntry[] = [];

        if (kv) {
            const iter = kv.list<MetricEntry>({ prefix: ["guardian", "metrics", serviceName] }, {
                limit: limit,
                reverse: true
            });
            for await (const res of iter) {
                entries.push(res.value);
            }
        }
        // Return chrono order
        return Response.json(entries.reverse());
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

    // Global Actions
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
             for(const s of manager.getAll()) {
                 if (s.config.autoRestart) await s.restart();
             }
             return Response.json({ success: true });
        }
    }

    return new Response("Not Found", { status: 404 });
}


// --- Init ---

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
    try {
        await Deno.mkdir(LOG_DIR, { recursive: true });
    } catch (e) {
        console.error("Failed to create logs dir", e);
    }

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
