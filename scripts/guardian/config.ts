import { existsSync } from "@std/fs";
import { parseArgs } from "jsr:@std/cli/parse-args";

const CONFIG_FILE = Deno.env.get("GUARDIAN_CONFIG_FILE") || "guardian.config.json";

export interface GuardianConfig {
    mode: "dev" | "prod";
    adminSecret: string;
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
    cors: {
        enabled: boolean;
        allowedOrigins: string[];
        allowedMethods: string[];
        allowedHeaders: string[];
        exposeHeaders: string[];
        allowCredentials: boolean;
        maxAge: number;
    };
    dashboard: {
        auth: {
            enabled: boolean;
            username: string;
            password: string;
        };
    };
    limits: {
        maxBodySize: number;
    };
    alerting: {
        enabled: boolean;
        webhookUrl: string;
        debounceMs: number;
    };
}

const DEFAULT_CONFIG: GuardianConfig = {
    mode: "dev",
    adminSecret: "change-me",
    ports: {
        frontend: 3000,
        backend: 8000,
        dashboard: 9999,
        internalFrontend: 3001,
        internalBackend: 8001
    },
    features: {
        waf: false,
        botDefense: false,
        rateLimit: false,
        smartCache: false,
        circuitBreaker: false,
        recorder: true, // Keep remote logging
        geoIp: false,
        compression: true,
        securityHeaders: false // CSP can be annoying in dev
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
    },
    cors: {
        enabled: true,
        allowedOrigins: ["*"],
        allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Guardian-ID"],
        exposeHeaders: ["X-Request-ID", "X-Guardian-ID"],
        allowCredentials: true,
        maxAge: 86400
    },
    dashboard: {
        auth: {
            enabled: false,  // Set to true and configure username/password to enable
            username: "admin",
            password: "guardian"
        }
    },
    limits: {
        maxBodySize: 10 * 1024 * 1024  // 10MB default
    },
    alerting: {
        enabled: false,  // Set to true and add webhookUrl to enable
        webhookUrl: "",  // Discord or Slack webhook URL
        debounceMs: 60000  // 1 minute debounce
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
if (!Deno.env.has("DENO_CURRENT_TEST")) {
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
                            applyOverrides();
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
}

// CLI Overrides
function applyOverrides() {
    try {
        const args = parseArgs(Deno.args);
        if (args.mode && (args.mode === "dev" || args.mode === "prod")) {
            currentConfig.mode = args.mode;
            console.log(`[CONFIG] CLI Override: mode = ${currentConfig.mode}`);
        }
        if (args.adminSecret) {
            currentConfig.adminSecret = String(args.adminSecret);
        }
    } catch (e) {
        // Ignored - args parsing might fail if unrelated flags passed, but usually fine
    }
}

// Apply overrides on initial load
applyOverrides();

export const CONFIG = new Proxy<GuardianConfig>(currentConfig as GuardianConfig, {
    get: (_target, prop) => {
        return (currentConfig as any)[prop];
    }
});
