import { existsSync } from "https://deno.land/std@0.224.0/fs/mod.ts";

const CONFIG_FILE = "guardian.config.json";

export interface GuardianConfig {
    ports: {
        frontend: number;
        backend: number;
        dashboard: number;
        internalFrontend: number;
        internalBackend: number;
    };
    features: {
        waf: boolean;
        botDefense: boolean;
        rateLimit: boolean;
        smartCache: boolean;
        circuitBreaker: boolean;
        recorder: boolean;
        geoIp: boolean;
        compression: boolean;
        securityHeaders: boolean;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
        tokenBucket: {
            capacity: number;
            fillRate: number;
        };
    };
    smartCache: {
        maxSize: number;
        ttl: number;
        paths: string[];
    };
    timeouts: {
        proxyConnect: number;
        proxyRead: number;
    };
    securityHeaders: {
        hsts: boolean;
        hstsMaxAge: number;
        csp: string;
        xFrameOptions: string;
        xContentTypeOptions: string;
        referrerPolicy: string;
    };
}

const DEFAULT_CONFIG: GuardianConfig = {
    ports: {
        frontend: 3000,
        backend: 8000,
        dashboard: 9999,
        internalFrontend: 3001,
        internalBackend: 8001
    },
    features: {
        waf: true,
        botDefense: true,
        rateLimit: true,
        smartCache: true,
        circuitBreaker: true,
        recorder: true,
        geoIp: true,
        compression: true,
        securityHeaders: true
    },
    rateLimit: {
        windowMs: 10000,
        maxRequests: 1000,
        tokenBucket: {
            capacity: 500,
            fillRate: 100,
        }
    },
    smartCache: {
        maxSize: 50 * 1024 * 1024,
        ttl: 600 * 1000,
        paths: ["/assets/", ".png", ".jpg", ".jpeg", ".svg", ".css", ".js", ".woff2"]
    },
    timeouts: {
        proxyConnect: 3000,
        proxyRead: 30000,
    },
    securityHeaders: {
        hsts: true,
        hstsMaxAge: 31536000,
        csp: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ws: wss:;",
        xFrameOptions: "SAMEORIGIN",
        xContentTypeOptions: "nosniff",
        referrerPolicy: "strict-origin-when-cross-origin"
    }
};

let currentConfig = { ...DEFAULT_CONFIG };

// Initial Load
try {
    if (existsSync(CONFIG_FILE)) {
        const text = Deno.readTextFileSync(CONFIG_FILE);
        const json = JSON.parse(text);
        currentConfig = { ...DEFAULT_CONFIG, ...json };
        console.log("[CONFIG] Loaded " + CONFIG_FILE);
    } else {
        console.log("[CONFIG] Creating default " + CONFIG_FILE);
        Deno.writeTextFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 4));
    }
} catch (e) {
    console.error("[CONFIG] Failed to load config:", e);
}

// Watcher
(async () => {
    try {
        const watcher = Deno.watchFs(CONFIG_FILE);
        for await (const event of watcher) {
            if (event.kind === "modify") {
                // Debounce slightly?
                setTimeout(async () => {
                    try {
                        const text = await Deno.readTextFile(CONFIG_FILE);
                        const json = JSON.parse(text);
                        currentConfig = { ...DEFAULT_CONFIG, ...json };
                        console.log("[CONFIG] Hot-reloaded configuration.");
                    } catch (e) {
                        console.error("[CONFIG] Reload failed:", e);
                    }
                }, 100);
            }
        }
    } catch (e) {
        // Ignored
    }
})();

export const CONFIG = new Proxy<GuardianConfig>(currentConfig as GuardianConfig, {
    get: (_target, prop) => {
        return (currentConfig as any)[prop];
    }
});
