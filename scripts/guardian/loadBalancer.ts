import { manager } from "./services.ts";

export class LoadBalancer {
    private static instance: LoadBalancer;
    private backends: string[] = [];
    private activeBackends: Set<string> = new Set(["backend"]);

    // RPS Tracking
    private requestCounts: number[] = [];

    // Bandwidth Tracking
    private bandwidthCounts: { timestamp: number, bytes: number, node: string }[] = [];

    private threshold = 10; // Requests per second per node
    private checkInterval: number | null = null;
    private scalingCooldown = false;
    private lastScaleTime = 0;

    // Predictive Stats
    private rpsTrend = 0;
    private timeToNextScale: number | null = null;

    // Enhanced stats tracking (from HEAD)
    private nodeRequestCounts: Map<string, number> = new Map();
    private nodeLatencies: Map<string, number[]> = new Map();
    private scalingHistory: { timestamp: number; action: string; node: string }[] = [];

    // Traffic simulator state (from HEAD)
    private simulatorInterval: number | null = null;
    private simulatorRps: number = 0;
    private simulatorTotalSent: number = 0;

    private constructor() {
        // Initialize backends list (backend, backend-2 ... backend-10)
        this.backends.push("backend");
        for (let i = 2; i <= 10; i++) {
            this.backends.push(`backend-${i}`);
        }

        // Initialize node stats
        for (const backend of this.backends) {
            this.nodeRequestCounts.set(backend, 0);
            this.nodeLatencies.set(backend, []);
        }

        // Start monitoring loop
        this.checkInterval = setInterval(() => this.monitor(), 1000);
        console.log("[LOAD BALANCER] Initialized 10-Node Pool. Monitoring load...");
    }

    public static getInstance(): LoadBalancer {
        if (!LoadBalancer.instance) {
            LoadBalancer.instance = new LoadBalancer();
        }
        return LoadBalancer.instance;
    }

    public recordRequest() {
        const now = Date.now();
        this.requestCounts.push(now);
        this.pruneData();
    }

    public recordBytes(node: string, bytes: number) {
        this.bandwidthCounts.push({ timestamp: Date.now(), bytes, node });
        if (this.bandwidthCounts.length > 5000) {
            const windowStart = Date.now() - 10000;
            this.bandwidthCounts = this.bandwidthCounts.filter(b => b.timestamp >= windowStart);
        }
    }

    private pruneData() {
        const now = Date.now();
        const windowStart = now - 10000;

        if (this.requestCounts.length > 0 && this.requestCounts[0] < windowStart) {
            this.requestCounts = this.requestCounts.filter(t => t >= windowStart);
        }
    }

    public getRps(): number {
        const now = Date.now();
        const windowStart = now - 10000;
        const count = this.requestCounts.filter(t => t >= windowStart).length;
        return count / 10;
    }

    public getBandwidth(): number {
        const now = Date.now();
        const windowStart = now - 10000;
        const totalBytes = this.bandwidthCounts
            .filter(b => b.timestamp >= windowStart)
            .reduce((acc, curr) => acc + curr.bytes, 0);

        return (totalBytes / 1024 / 1024) / 10; // MB/s
    }

    public getNodeStats() {
        const now = Date.now();
        const windowStart = now - 10000;
        const stats: Record<string, { rps: number, mbs: number }> = {};

        this.backends.forEach(b => stats[b] = { rps: 0, mbs: 0 });

        this.bandwidthCounts.filter(b => b.timestamp >= windowStart).forEach(b => {
            if (stats[b.node]) {
                stats[b.node].mbs += b.bytes;
            }
        });

        for (const node in stats) {
            stats[node].mbs = (stats[node].mbs / 1024 / 1024) / 10;
        }

        const totalRps = this.getRps();
        const activeCount = this.activeBackends.size;

        this.activeBackends.forEach(node => {
            if (stats[node]) stats[node].rps = totalRps / activeCount;
        });

        return stats;
    }

    private async monitor() {
        this.pruneData();

        // Calculate Trend
        const now = Date.now();
        const midPoint = now - 5000;
        const windowStart = now - 10000;

        const firstHalf = this.requestCounts.filter(t => t >= windowStart && t < midPoint).length / 5;
        const secondHalf = this.requestCounts.filter(t => t >= midPoint).length / 5;

        this.rpsTrend = secondHalf - firstHalf;

        const rps = this.getRps();
        const activeCount = this.activeBackends.size;

        // Predict Time to Next Scale
        const capacity = activeCount * this.threshold;
        const remainingCapacity = capacity - rps;

        if (this.rpsTrend > 0 && remainingCapacity > 0) {
            this.timeToNextScale = remainingCapacity / (Math.max(0.1, this.rpsTrend) * 0.2);
        } else if (remainingCapacity <= 0) {
            this.timeToNextScale = 0;
        } else {
            this.timeToNextScale = null;
        }

        if (this.scalingCooldown) return;

        // Sync with reality
        for (const name of this.backends) {
            const svc = manager.get(name);
            if (svc?.stats.status === "running") {
                this.activeBackends.add(name);
            } else if (name !== "backend") {
                this.activeBackends.delete(name);
            }
        }
        this.activeBackends.add("backend");

        // Scale Up Logic
        if (rps > (this.threshold * activeCount) && activeCount < this.backends.length) {
            await this.scaleUp();
        }
        // Scale Down Logic
        else if (activeCount > 1 && rps < (this.threshold * (activeCount - 1) * 0.7)) {
            await this.scaleDown();
        }
    }

    private async scaleUp() {
        this.scalingCooldown = true;
        this.lastScaleTime = Date.now();

        const nextBackend = this.backends.find(b => !this.activeBackends.has(b));
        if (nextBackend) {
            console.log(`[LOAD BALANCER] Scale UP (${this.getRps().toFixed(1)} RPS). Starting ${nextBackend}...`);
            this.scalingHistory.push({ timestamp: Date.now(), action: "scale-up", node: nextBackend });
            const service = manager.get(nextBackend);
            if (service) {
                await service.start();
                this.activeBackends.add(nextBackend);
            }
        }
        setTimeout(() => { this.scalingCooldown = false; }, 3000);
    }

    private async scaleDown() {
        this.scalingCooldown = true;
        this.lastScaleTime = Date.now();

        const candidates = Array.from(this.activeBackends).filter(b => b !== "backend");
        candidates.sort((a, b) => {
            const numA = parseInt(a.split('-')[1] || "1");
            const numB = parseInt(b.split('-')[1] || "1");
            return numB - numA;
        });

        const toStop = candidates[0];
        if (toStop) {
            console.log(`[LOAD BALANCER] Scale DOWN (${this.getRps().toFixed(1)} RPS). Stopping ${toStop}...`);
            this.scalingHistory.push({ timestamp: Date.now(), action: "scale-down", node: toStop });
            const service = manager.get(toStop);
            if (service) {
                await service.stop();
                this.activeBackends.delete(toStop);
            }
        }
        setTimeout(() => { this.scalingCooldown = false; }, 10000);
    }

    public getTarget(req: Request): { name: string, port: number } {
        const cookieHeader = req.headers.get("cookie");
        let assigned: string | undefined;

        if (cookieHeader) {
            const match = cookieHeader.match(/G_NODE=([^;]+)/);
            if (match) {
                const node = match[1];
                if (this.activeBackends.has(node)) {
                    assigned = node;
                }
            }
        }

        if (!assigned) {
            const candidates = Array.from(this.activeBackends);
            assigned = candidates[Math.floor(Math.random() * candidates.length)];
        }

        const service = manager.get(assigned);
        return { name: assigned, port: service?.config.port || 8001 };
    }

    public getStats() {
        const activeCount = this.activeBackends.size;
        const rps = this.getRps();
        const capacity = activeCount * this.threshold;
        const util = capacity > 0 ? (rps / capacity) * 100 : 0;

        const nodeStats = Array.from(this.backends).map(name => {
            const latencies = this.nodeLatencies.get(name) || [];
            const avgLatency = latencies.length > 0
                ? latencies.reduce((a, b) => a + b, 0) / latencies.length
                : 0;
            const isActive = this.activeBackends.has(name);
            const service = manager.get(name);

            return {
                name,
                active: isActive,
                status: service?.stats.status || "unknown",
                requests: this.nodeRequestCounts.get(name) || 0,
                avgLatency: Math.round(avgLatency),
                port: service?.config.port || 0
            };
        });

        const totalRequests = Array.from(this.nodeRequestCounts.values()).reduce((a, b) => a + b, 0);

        return {
            rps: rps,
            totalMbs: this.getBandwidth(),
            activeNodes: Array.from(this.activeBackends),
            nodeStats: this.getNodeStats(),
            threshold: this.threshold,
            cooldown: this.scalingCooldown,
            nodes: nodeStats,
            totalRequests,
            scalingHistory: this.scalingHistory.slice(-20),
            simulator: {
                running: this.simulatorInterval !== null,
                rps: this.simulatorRps,
                totalSent: this.simulatorTotalSent
            },
            utilization: Math.min(100, util),
            totalCapacity: this.backends.length * this.threshold,
            timeToNextScale: this.timeToNextScale,
            activeCount
        };
    }

    public setThreshold(val: number) {
        this.threshold = val;
    }

    public recordNodeRequest(nodeName: string, latencyMs: number) {
        const count = this.nodeRequestCounts.get(nodeName) || 0;
        this.nodeRequestCounts.set(nodeName, count + 1);

        const latencies = this.nodeLatencies.get(nodeName) || [];
        latencies.push(latencyMs);
        if (latencies.length > 100) latencies.shift();
        this.nodeLatencies.set(nodeName, latencies);
    }

    public startSimulator(rps: number) {
        if (this.simulatorInterval) this.stopSimulator();

        this.simulatorRps = rps;
        console.log(`[LOAD BALANCER] Traffic simulator started: ${rps} RPS`);

        const msPerRequest = 1000 / rps;
        this.simulatorInterval = setInterval(async () => {
            try {
                const start = performance.now();
                const target = this.getTarget(new Request("http://localhost/api/health"));

                await fetch(`http://localhost:${target.port}/health`, {
                    method: "GET",
                    signal: AbortSignal.timeout(5000)
                }).catch(() => { });

                const latency = performance.now() - start;
                this.recordRequest();
                this.recordNodeRequest(target.name, latency);
                this.simulatorTotalSent++;
            } catch {
                // Ignore errors
            }
        }, msPerRequest);
    }

    public stopSimulator() {
        if (this.simulatorInterval) {
            clearInterval(this.simulatorInterval);
            this.simulatorInterval = null;
            this.simulatorRps = 0;
            console.log("[LOAD BALANCER] Traffic simulator stopped");
        }
    }

    public setSimulatorRps(rps: number) {
        if (rps <= 0) {
            this.stopSimulator();
        } else {
            this.startSimulator(rps);
        }
    }

    public resetStats() {
        for (const backend of this.backends) {
            this.nodeRequestCounts.set(backend, 0);
            this.nodeLatencies.set(backend, []);
        }
        this.scalingHistory = [];
        this.simulatorTotalSent = 0;
    }
}

export const loadBalancer = LoadBalancer.getInstance();
