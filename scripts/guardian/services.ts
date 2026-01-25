import { ServiceConfig, ServiceStats, LogEntry } from "./types.ts";
import { persistLog, updateServiceStat, saveMetric, getKv } from "./logger.ts";

const RESTART_DELAY_MS = 3000;
const MAX_LOGS = 2000;

export class Service {
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
            port: config.port,
            url: config.port ? `http://localhost:${config.port}` : undefined
        };
        this.shouldRun = config.autoRestart;
        this.loadStats();
    }

    async loadStats() {
        const kv = getKv();
        if (!kv) return;
        try {
            const date = new Date().toISOString().split('T')[0];
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

    async persistMetrics() {
        const now = Date.now();
        // Persist every 60s
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

            this.readStream(this.process.stdout, "stdout");
            this.readStream(this.process.stderr, "stderr");

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
        this.stats.status = "stopping";
    }

    async restart() {
        await this.stop();
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

export class ServiceManager {
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

    getOrAdd(name: string): Service {
        let s = this.services.get(name);
        if (!s) {
            s = new Service({ name, command: [], autoRestart: false });
            s.stats.status = "running";
            this.services.set(name, s);
        }
        return s;
    }

    async startAll() {
        for (const service of this.services.values()) {
            if (service.config.autoRestart) {
                service.start();
            }
        }
    }

    async stopAll() {
        for (const service of this.services.values()) {
            await service.stop();
        }
    }
}

export const manager = new ServiceManager();
