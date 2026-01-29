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
    private rpsTrend = 0; // + or - RPS per second
    private timeToNextScale: number | null = null; // seconds

    private constructor() {
        // Initialize backends list (backend, backend-2 ... backend-10)
        this.backends.push("backend");
        for (let i = 2; i <= 10; i++) {
            this.backends.push(`backend-${i}`);
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
        // Pruning happens in recordRequest or monitor usually, but let's be safe
        if (this.bandwidthCounts.length > 5000) {
             const windowStart = Date.now() - 10000;
             this.bandwidthCounts = this.bandwidthCounts.filter(b => b.timestamp >= windowStart);
        }
    }

    private pruneData() {
        const now = Date.now();
        const windowStart = now - 10000; // 10s window

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

    public getBandwidth(): number { // Total MB/s
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

        // Initialize
        this.backends.forEach(b => stats[b] = { rps: 0, mbs: 0 });

        // Calculate Bandwidth per node
        this.bandwidthCounts.filter(b => b.timestamp >= windowStart).forEach(b => {
             if (stats[b.node]) {
                 stats[b.node].mbs += b.bytes;
             }
        });

        // Convert bytes sum to MB/s
        for (const node in stats) {
            stats[node].mbs = (stats[node].mbs / 1024 / 1024) / 10;
        }

        // Approximate RPS per node (assuming round robin/sticky distribution matches active)
        // Note: Ideally we'd tag requests with nodes too, but for now we average across active
        const totalRps = this.getRps();
        const activeCount = this.activeBackends.size;

        // This is an estimation for visualization unless we track per-node requests
        this.activeBackends.forEach(node => {
            if (stats[node]) stats[node].rps = totalRps / activeCount;
        });

        return stats;
    }

    private async monitor() {
        this.pruneData();

        // Calculate Trend (RPS now vs RPS 5s ago)
        // To do this accurately, we need history.
        // Simple approx: Compare first 5s of window vs last 5s
        const now = Date.now();
        const midPoint = now - 5000;
        const windowStart = now - 10000;

        const firstHalf = this.requestCounts.filter(t => t >= windowStart && t < midPoint).length / 5;
        const secondHalf = this.requestCounts.filter(t => t >= midPoint).length / 5;

        this.rpsTrend = secondHalf - firstHalf; // Change in RPS per 5s

        const rps = this.getRps();
        const activeCount = this.activeBackends.size;

        // Predict Time to Next Scale
        const capacity = activeCount * this.threshold;
        const remainingCapacity = capacity - rps;

        if (this.rpsTrend > 0 && remainingCapacity > 0) {
            // If gaining X RPS every 5s...
            // Rate of change per second approx = rpsTrend / 5
            const rate = this.rpsTrend; // Actually, let's treat trend as "RPS change"
            // Seconds until we hit capacity?
            // remaining / rate
             this.timeToNextScale = remainingCapacity / (Math.max(0.1, rate) * 0.2); // *0.2 factor to normalize
        } else if (remainingCapacity <= 0) {
            this.timeToNextScale = 0;
        } else {
            this.timeToNextScale = null; // Not trending up
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
        // Threshold is per node. Total Capacity = Threshold * ActiveNodes
        if (rps > (this.threshold * activeCount) && activeCount < this.backends.length) {
            await this.scaleUp();
        }
        // Scale Down Logic
        // Hysteresis: Only scale down if load is < (Active - 1) * Threshold * 0.7
        else if (activeCount > 1 && rps < (this.threshold * (activeCount - 1) * 0.7)) {
            // Wait for 10s stability? Handled by cooldown
            await this.scaleDown();
        }
    }

    private async scaleUp() {
        this.scalingCooldown = true;
        this.lastScaleTime = Date.now();

        const nextBackend = this.backends.find(b => !this.activeBackends.has(b));
        if (nextBackend) {
            console.log(`[LOAD BALANCER] Scale UP triggered (${this.getRps().toFixed(1)} RPS). Starting ${nextBackend}...`);
            const service = manager.get(nextBackend);
            if (service) {
                await service.start();
                this.activeBackends.add(nextBackend);
            }
        }
        setTimeout(() => { this.scalingCooldown = false; }, 3000); // 3s cooldown for fast ramp up
    }

    private async scaleDown() {
        this.scalingCooldown = true;
        this.lastScaleTime = Date.now();

        // Don't stop primary "backend"
        const candidates = Array.from(this.activeBackends).filter(b => b !== "backend");
        // Sort to stop highest index first
        // Assuming backend-10, backend-9... string sort might be tricky with numbers > 9
        // "backend-10" < "backend-2" in string sort? No.
        // Custom sort: extract number
        candidates.sort((a, b) => {
            const numA = parseInt(a.split('-')[1] || "1");
            const numB = parseInt(b.split('-')[1] || "1");
            return numB - numA; // Descending
        });

        const toStop = candidates[0];
        if (toStop) {
            console.log(`[LOAD BALANCER] Scale DOWN triggered (${this.getRps().toFixed(1)} RPS). Stopping ${toStop}...`);
            const service = manager.get(toStop);
            if (service) {
                await service.stop();
                this.activeBackends.delete(toStop);
            }
        }
        setTimeout(() => { this.scalingCooldown = false; }, 10000); // 10s cooldown for scale down (prevent flapping)
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
        const util = (rps / capacity) * 100;

        return {
            rps: rps,
            totalMbs: this.getBandwidth(),
            activeNodes: Array.from(this.activeBackends),
            nodeStats: this.getNodeStats(),
            threshold: this.threshold,
            cooldown: this.scalingCooldown,
            utilization: Math.min(100, util),
            totalCapacity: this.backends.length * this.threshold,
            timeToNextScale: this.timeToNextScale,
            activeCount
        };
    }

    public setThreshold(val: number) {
        this.threshold = val;
    }
}

export const loadBalancer = LoadBalancer.getInstance();
