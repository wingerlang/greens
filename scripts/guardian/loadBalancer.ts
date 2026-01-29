import { manager } from "./services.ts";

export class LoadBalancer {
    private static instance: LoadBalancer;
    private backends = ["backend", "backend-2", "backend-3"];
    private activeBackends: Set<string> = new Set(["backend"]);
    private requestCounts: number[] = []; // Timestamps of requests
    private threshold = 10; // Requests per second to trigger scale up (Start low for testing)
    private checkInterval: number | null = null;
    private scalingCooldown = false;

    // Enhanced stats tracking
    private nodeRequestCounts: Map<string, number> = new Map();
    private nodeLatencies: Map<string, number[]> = new Map();
    private scalingHistory: { timestamp: number; action: string; node: string }[] = [];

    // Traffic simulator state
    private simulatorInterval: number | null = null;
    private simulatorRps: number = 0;
    private simulatorTotalSent: number = 0;

    private constructor() {
        // Initialize node stats
        for (const backend of this.backends) {
            this.nodeRequestCounts.set(backend, 0);
            this.nodeLatencies.set(backend, []);
        }
        // Start monitoring loop
        this.checkInterval = setInterval(() => this.monitor(), 1000);
        console.log("[LOAD BALANCER] Initialized. Monitoring load...");
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

        // Prune old (keep last 10s)
        const windowStart = now - 10000;
        // Optimization: only shift if needed
        if (this.requestCounts[0] < windowStart) {
            this.requestCounts = this.requestCounts.filter(t => t >= windowStart);
        }
    }

    public getRps(): number {
        const now = Date.now();
        const windowStart = now - 10000;
        // Filter purely for calculation to be accurate
        const count = this.requestCounts.filter(t => t >= windowStart).length;
        return count / 10;
    }

    private async monitor() {
        if (this.scalingCooldown) return;

        const rps = this.getRps();
        const activeCount = this.activeBackends.size;

        // Ensure we know what's really running (in case of manual stops/crashes)
        // This sync step ensures activeBackends matches reality
        for (const name of this.backends) {
            const svc = manager.get(name);
            if (svc?.stats.status === "running") {
                this.activeBackends.add(name);
            } else if (name !== "backend") { // Don't remove primary if it's just restarting
                this.activeBackends.delete(name);
            }
        }

        // Always keep primary in the set for logic, even if briefly crashed
        this.activeBackends.add("backend");

        // Scale Up
        // If RPS > Threshold * ActiveNodes -> Need more nodes
        if (rps > this.threshold * activeCount && activeCount < this.backends.length) {
            await this.scaleUp();
        }
        // Scale Down
        // If RPS < Threshold * (ActiveNodes - 1) * 0.8 -> Can remove one node
        // (Factor 0.8 provides buffer so we don't flap)
        else if (activeCount > 1 && rps < (this.threshold * (activeCount - 1) * 0.8)) {
            await this.scaleDown();
        }
    }

    private async scaleUp() {
        this.scalingCooldown = true;
        const nextBackend = this.backends.find(b => !this.activeBackends.has(b));
        if (nextBackend) {
            console.log(`[LOAD BALANCER] High Load (${this.getRps().toFixed(1)} RPS). Spinning up ${nextBackend}...`);
            this.scalingHistory.push({ timestamp: Date.now(), action: "scale-up", node: nextBackend });
            const service = manager.get(nextBackend);
            if (service) {
                await service.start();
                this.activeBackends.add(nextBackend);
            }
        }
        setTimeout(() => { this.scalingCooldown = false; }, 5000); // 5s cooldown
    }

    private async scaleDown() {
        this.scalingCooldown = true;
        // Don't stop primary "backend"
        const candidates = Array.from(this.activeBackends).filter(b => b !== "backend");
        // Sort to stop highest index first (backend-3 before backend-2)
        candidates.sort().reverse();

        const toStop = candidates[0];
        if (toStop) {
            console.log(`[LOAD BALANCER] Load Decreased (${this.getRps().toFixed(1)} RPS). Stopping ${toStop}...`);
            this.scalingHistory.push({ timestamp: Date.now(), action: "scale-down", node: toStop });
            const service = manager.get(toStop);
            if (service) {
                await service.stop();
                this.activeBackends.delete(toStop);
            }
        }
        setTimeout(() => { this.scalingCooldown = false; }, 5000);
    }

    public getTarget(req: Request): { name: string, port: number } {
        // Sticky Session Logic
        const cookieHeader = req.headers.get("cookie");
        let assigned: string | undefined;

        if (cookieHeader) {
            const match = cookieHeader.match(/G_NODE=([^;]+)/);
            if (match) {
                const node = match[1];
                // Check if the requested node is active
                if (this.activeBackends.has(node)) {
                    assigned = node;
                }
            }
        }

        if (!assigned) {
            // Round Robin or Random
            const candidates = Array.from(this.activeBackends);
            assigned = candidates[Math.floor(Math.random() * candidates.length)];
        }

        const service = manager.get(assigned);
        // Fallback to 8001 if something goes wrong
        return { name: assigned, port: service?.config.port || 8001 };
    }

    public getStats() {
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
            rps: this.getRps(),
            activeNodes: Array.from(this.activeBackends),
            threshold: this.threshold,
            cooldown: this.scalingCooldown,
            nodes: nodeStats,
            totalRequests,
            scalingHistory: this.scalingHistory.slice(-20),
            simulator: {
                running: this.simulatorInterval !== null,
                rps: this.simulatorRps,
                totalSent: this.simulatorTotalSent
            }
        };
    }

    public setThreshold(val: number) {
        this.threshold = val;
    }

    // Track request to a specific node
    public recordNodeRequest(nodeName: string, latencyMs: number) {
        const count = this.nodeRequestCounts.get(nodeName) || 0;
        this.nodeRequestCounts.set(nodeName, count + 1);

        const latencies = this.nodeLatencies.get(nodeName) || [];
        latencies.push(latencyMs);
        // Keep last 100 latencies
        if (latencies.length > 100) latencies.shift();
        this.nodeLatencies.set(nodeName, latencies);
    }

    // Traffic Simulator Controls
    public startSimulator(rps: number) {
        if (this.simulatorInterval) this.stopSimulator();

        this.simulatorRps = rps;
        console.log(`[LOAD BALANCER] Traffic simulator started: ${rps} RPS`);

        // Distributor: send requests at specified RPS
        const msPerRequest = 1000 / rps;
        this.simulatorInterval = setInterval(async () => {
            try {
                const start = performance.now();
                const target = this.getTarget(new Request("http://localhost/api/health"));

                // Make actual request to backend
                await fetch(`http://localhost:${target.port}/health`, {
                    method: "GET",
                    signal: AbortSignal.timeout(5000)
                }).catch(() => { });

                const latency = performance.now() - start;
                this.recordRequest();
                this.recordNodeRequest(target.name, latency);
                this.simulatorTotalSent++;
            } catch (e) {
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
