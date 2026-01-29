import { manager } from "./services.ts";

export class LoadBalancer {
    private static instance: LoadBalancer;
    private backends = ["backend", "backend-2", "backend-3"];
    private activeBackends: Set<string> = new Set(["backend"]);
    private requestCounts: number[] = []; // Timestamps of requests
    private threshold = 10; // Requests per second to trigger scale up (Start low for testing)
    private checkInterval: number | null = null;
    private scalingCooldown = false;

    private constructor() {
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
        return {
            rps: this.getRps(),
            activeNodes: Array.from(this.activeBackends),
            threshold: this.threshold,
            cooldown: this.scalingCooldown
        };
    }

    public setThreshold(val: number) {
        this.threshold = val;
    }
}

export const loadBalancer = LoadBalancer.getInstance();
