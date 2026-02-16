import { CONFIG } from "./config.ts";

// Personas define the behavior mix
type Persona = "browser" | "athlete" | "social" | "heavy";

interface SimulationConfig {
    targetUsers: number;
    rampRate: number; // users per second
    personas: Record<Persona, number>; // Weights
}

class CookieJar {
    cookies: Map<string, string> = new Map();

    store(headers: Headers) {
        const setCookie = headers.get("set-cookie");
        if (setCookie) {
            // Simple parser for multiple cookies
            const parts = setCookie.split(/,(?=\s*[^;]+=[^;]+)/); // Split by comma not in date
            for (const part of parts) {
                const [pair] = part.split(";");
                const [key, val] = pair.trim().split("=");
                if (key && val) this.cookies.set(key, val);
            }
        }
    }

    getHeader(): string {
        return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
    }
}

class VirtualUser {
    id: number;
    username: string;
    persona: Persona;
    jar: CookieJar = new CookieJar();
    active = false;
    running = false;

    // Stats
    requests = 0;
    errors = 0;



    async start() {
        this.active = true;
        if (this.running) return;
        this.running = true;

        console.log(`[SIM] User ${this.id} (${this.persona}) starting...`);

        try {
            await this.ensureAuth();
            while (this.active) {
                await this.performAction();
                // Think time
                const delay = Math.random() * 2000 + 500; // 0.5 - 2.5s
                await new Promise(r => setTimeout(r, delay));
            }
        } catch (e) {
            console.error(`[SIM] User ${this.id} crashed:`, e);
            this.errors++;
        } finally {
            this.running = false;
            console.log(`[SIM] User ${this.id} stopped.`);
        }
    }

    stop() {
        this.active = false;
    }

    private get baseUrl() {
        return `http://127.0.0.1:${CONFIG.ports.frontend}`;
    }

    country: string = "US";
    ip: string = "127.0.0.1";

    constructor(id: number, persona: Persona) {
        this.id = id;
        this.username = `sim_user_${id}`;
        this.persona = persona;
        this.assignGeo();
    }

    private assignGeo() {
        const geos = [
            { c: "US", w: 0.4, ip: "104.244.42.1" },
            { c: "DE", w: 0.15, ip: "85.214.132.117" },
            { c: "SE", w: 0.15, ip: "193.10.252.19" },
            { c: "GB", w: 0.1, ip: "81.2.69.142" },
            { c: "JP", w: 0.05, ip: "202.232.2.164" },
            { c: "BR", w: 0.05, ip: "177.126.180.1" },
            { c: "AU", w: 0.05, ip: "1.1.1.1" }, // Cloudflare (often maps to AU/US)
            { c: "IN", w: 0.05, ip: "103.25.231.1" }
        ];

        const rand = Math.random();
        let cumulative = 0;
        for (const g of geos) {
            cumulative += g.w;
            if (rand <= cumulative) {
                this.country = g.c;
                // Randomize last octet to avoid exact IP dupes
                this.ip = g.ip.split('.').slice(0, 3).join('.') + '.' + Math.floor(Math.random() * 254 + 1);
                break;
            }
        }
    }

    private async req(method: string, path: string, body?: any) {
        const opts: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/json",
                "Cookie": this.jar.getHeader(),
                "User-Agent": `GuardianSimulator/1.0 (${this.persona})`,
                "X-Forwarded-For": this.ip,
                "X-Sim-Country": this.country // Hint for GeoIP middleware to avoid rate limits
            }
        };
        if (body) opts.body = JSON.stringify(body);

        try {
            const res = await fetch(`${this.baseUrl}${path}`, opts);
            this.jar.store(res.headers);
            this.requests++;

            // Log errors for debugging
            if (!res.ok && res.status !== 404) {
                console.error(`[SIM] User ${this.id} got ${res.status} on ${method} ${path}`);
            }

            return res;
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`[SIM] User ${this.id} req failed on ${method} ${path}:`, message);
            this.errors++;
            // Don't throw - let the user continue with next action
            return new Response(null, { status: 0 }); // Return dummy response
        }
    }

    private async ensureAuth() {
        // Try Login
        let res = await this.req("POST", "/api/auth/login", {
            username: this.username,
            password: "password123!"
        });

        if (res.status !== 200) {
            // Register
            res = await this.req("POST", "/api/auth/register", {
                username: this.username,
                password: "password123!",
                role: "user"
            });

            if (res.status !== 201 && res.status !== 200) {
                console.error(`[SIM] Auth failed for User ${this.id}: Login=${res.status}, will continue anyway`);
            }
        }
    }

    private async performAction() {
        const rand = Math.random();

        // 30% chance to just ping status (Low impact)
        if (rand < 0.3) {
            await this.req("GET", "/api/status");
            return;
        }

        // 20% chance to hit static assets (Frontend Traffic)
        if (rand < 0.5) {
            const assets = ["/", "/index.html", "/components/styles.css", "/components/client.js", "/assets/logo.png"];
            const asset = assets[Math.floor(Math.random() * assets.length)];
            await this.req("GET", asset);
            return;
        }

        switch (this.persona) {
            case "browser":
                // Read heavy
                await this.req("GET", "/api/user/me");
                if (Math.random() > 0.5) await this.req("GET", "/api/workouts");
                break;

            case "athlete":
                // Write heavy
                await this.req("POST", "/api/workouts", {
                    date: new Date().toISOString(),
                    type: "strength",
                    notes: "Simulated Workout"
                });
                break;

            case "social":
                // Interactive
                await this.req("POST", "/api/messages", {
                    to: "admin",
                    content: `Hello from ${this.username} in ${this.country}`,
                    isSecret: false
                });
                break;

            case "heavy":
                // Heavy payload
                await this.req("POST", "/api/workouts", {
                    date: new Date().toISOString(),
                    type: "strength",
                    notes: "A".repeat(10000) // 10KB
                });
                break;
        }
    }
}

export class Simulator {
    private static instance: Simulator;
    private users: Map<number, VirtualUser> = new Map();
    private config: SimulationConfig = {
        targetUsers: 0,
        rampRate: 5,
        personas: {
            browser: 0.4,
            athlete: 0.3,
            social: 0.2,
            heavy: 0.1
        }
    };
    private loopInterval: any = null;

    private constructor() {
        this.loopInterval = setInterval(() => this.tick(), 1000);
    }

    public static getInstance() {
        if (!Simulator.instance) Simulator.instance = new Simulator();
        return Simulator.instance;
    }

    public updateConfig(cfg: Partial<SimulationConfig>) {
        if (cfg.targetUsers !== undefined) cfg.targetUsers = Number(cfg.targetUsers);
        if (cfg.rampRate !== undefined) cfg.rampRate = Number(cfg.rampRate);
        if (cfg.personas !== undefined) {
            for (const p in cfg.personas) {
                cfg.personas[p as Persona] = Number(cfg.personas[p as Persona]);
            }
        }
        this.config = { ...this.config, ...cfg };
    }

    public getStatus() {
        let active = 0;
        let running = 0;
        let totalReq = 0;
        let totalErr = 0;

        for (const u of this.users.values()) {
            if (u.active) active++;
            if (u.running) running++;
            totalReq += u.requests;
            totalErr += u.errors;
        }

        return {
            target: this.config.targetUsers,
            active,
            running,
            totalReq,
            totalErr,
            config: this.config
        };
    }

    private tick() {
        const currentCount = Array.from(this.users.values()).filter(u => u.active).length;
        const diff = this.config.targetUsers - currentCount;

        if (diff === 0) return;

        // Ramp Up/Down limit
        const change = Math.min(Math.abs(diff), this.config.rampRate);
        const direction = diff > 0 ? 1 : -1;

        if (direction > 0) {
            // Add users
            for (let i = 0; i < change; i++) {
                this.spawnUser();
            }
        } else {
            // Remove users
            this.despawnUsers(change);
        }
    }

    private spawnUser() {
        // Find next ID
        let id = 1;
        while (this.users.has(id) && this.users.get(id)!.active) {
            id++;
        }

        // Pick Persona
        const rand = Math.random();
        let cumulative = 0;
        let persona: Persona = "browser";
        for (const [p, weight] of Object.entries(this.config.personas)) {
            cumulative += weight;
            if (rand <= cumulative) {
                persona = p as Persona;
                break;
            }
        }

        let user = this.users.get(id);
        if (!user) {
            user = new VirtualUser(id, persona);
            this.users.set(id, user);
        } else {
            user.persona = persona;
            // Re-roll geo for variety on reuse
            (user as any).assignGeo();
        }

        user.start();
    }

    private despawnUsers(count: number) {
        let stopped = 0;
        // Stop highest IDs first
        const activeIds = Array.from(this.users.keys()).filter(id => this.users.get(id)!.active).sort((a, b) => b - a);

        for (const id of activeIds) {
            if (stopped >= count) break;
            this.users.get(id)!.stop();
            stopped++;
        }
    }
}

export const simulator = Simulator.getInstance();
