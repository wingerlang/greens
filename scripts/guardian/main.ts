import { initLogger } from "./logger.ts";
import { initRecorder } from "./recorder.ts";
import { manager } from "./services.ts";
import { updateSystemStats } from "./monitor.ts";
import { startHealthMonitor } from "./health.ts";
import { handleDashboardRequest, stopBroadcasting } from "./dashboard.ts";
import { clearPort } from "./utils.ts";
import { loadBannedIps } from "./security.ts";
import { CONFIG } from "./config.ts";
import { stats } from "./logger.ts";
import { recordLatency, recordMemorySample } from "./prometheus.ts";

import { Pipeline } from "./middleware/pipeline.ts";
import { LoggerMiddleware } from "./middleware/logger.ts";
import { BlockListMiddleware } from "./middleware/blockList.ts";
import { TokenBucketRateLimitMiddleware } from "./middleware/rateLimit.ts";
import { BotDefenseMiddleware } from "./middleware/botDefense.ts";
import { WafMiddleware } from "./middleware/waf.ts";
import { SmartCacheMiddleware } from "./middleware/smartCache.ts";
import { CircuitBreakerMiddleware } from "./middleware/circuitBreaker.ts";
import { RecorderMiddleware } from "./middleware/recorder.ts";
import { ProxyMiddleware } from "./middleware/proxy.ts";
import { GeoIpMiddleware } from "./middleware/geoIp.ts";
import { CompressionMiddleware } from "./middleware/compression.ts";
import { SecurityHeadersMiddleware } from "./middleware/securityHeaders.ts";
import { CorsMiddleware } from "./middleware/cors.ts";
import { BodySizeLimitMiddleware } from "./middleware/bodySizeLimit.ts";
import { GuardianContext } from "./middleware/types.ts";

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[GUARDIAN] Received ${signal}, initiating graceful shutdown...`);

    // Stop accepting new connections (dashboard WS)
    stopBroadcasting();

    // Stop all managed services
    console.log("[GUARDIAN] Stopping managed services...");
    await manager.stopAll();

    console.log("[GUARDIAN] Shutdown complete.");
    Deno.exit(0);
}

// Register signal handlers (Windows only supports SIGINT and SIGBREAK)
Deno.addSignalListener("SIGINT", () => gracefulShutdown("SIGINT"));
if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

async function bootstrap() {
    console.log("[GUARDIAN] Booting System 3.0 (Middleware Architecture)...");

    await initLogger();
    await initRecorder();
    await loadBannedIps();

    // Clear ports
    await clearPort(CONFIG.ports.frontend);
    await clearPort(CONFIG.ports.backend);
    await clearPort(CONFIG.ports.dashboard);
    await clearPort(CONFIG.ports.internalBackend); // 8001
    await clearPort(CONFIG.ports.internalBackend + 1); // 8002
    await clearPort(CONFIG.ports.internalBackend + 2); // 8003
    await clearPort(CONFIG.ports.internalFrontend);

    // 1. Register Services

    // Primary Backend (Always On)
    manager.register({
        name: "backend",
        command: ["deno", "task", "server"],
        env: { "PORT": String(CONFIG.ports.internalBackend) },
        autoRestart: true,
        port: CONFIG.ports.internalBackend
    });

    // Replica Backends (On Demand, up to 10 nodes)
    // backend-2 (8002) to backend-10 (8010)
    for (let i = 1; i < 10; i++) {
        const port = CONFIG.ports.internalBackend + i;
        await clearPort(port); // Ensure port is clear

        manager.register({
            name: `backend-${i + 1}`,
            command: ["deno", "task", "server"],
            env: { "PORT": String(port) },
            autoRestart: false, // Started by LoadBalancer
            port: port
        });
    }

    const isProd = CONFIG.mode === "prod";
    const frontendCmd = isProd
        ? ["deno", "run", "-A", "scripts/guardian/serve_frontend.ts", "--port", String(CONFIG.ports.internalFrontend)]
        : ["deno", "task", "dev", "--port", String(CONFIG.ports.internalFrontend), "--host", "127.0.0.1"];

    if (isProd) {
         console.log("[GUARDIAN] Running in PRODUCTION mode (serving dist/).");
    } else {
         console.log("[GUARDIAN] Running in DEVELOPMENT mode (Vite).");
    }

    manager.register({
        name: "frontend",
        command: frontendCmd,
        autoRestart: true,
        port: CONFIG.ports.internalFrontend
    });

    // 2. Start Services
    await manager.startAll();

    // 3. Start Monitor
    setInterval(updateSystemStats, 2000);
    startHealthMonitor();

    // 4. Live Terminal Status
    setInterval(() => {
        const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
        const msg = `\r\x1b[32m[GUARDIAN LIVE] Requests: ${stats.totalRequests} | RPS: ${stats.rps.toFixed(2)} | Uptime: ${uptime}s\x1b[0m`;
        Deno.stdout.write(new TextEncoder().encode(msg));
    }, 1000);

    // Periodically log status to history (every 30s)
    setInterval(() => {
        const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
        const msg = `Requests: ${stats.totalRequests} | RPS: ${stats.rps.toFixed(2)} | Uptime: ${uptime}s`;
        manager.get("guardian")?.addLog("info", msg);
    }, 30000);

    // Memory sampling for dashboard (every 10s)
    setInterval(() => {
        recordMemorySample();
    }, 10000);
    recordMemorySample(); // Initial sample

    // 4. Start Dashboard
    console.log(`[GUARDIAN] Dashboard listening on http://localhost:${CONFIG.ports.dashboard}`);
    Deno.serve({
        port: CONFIG.ports.dashboard,
        handler: handleDashboardRequest,
        onListen: () => { }
    });

    // Pipeline Setup
    // Note: We create a fresh pipeline for each request or reuse one?
    // The Pipeline class maintains state (middlewares array), so reuse is fine.
    // The middleware instances themselves might maintain state (like cache, buckets), so we reuse them.
    const pipeline = new Pipeline()
        .use(new LoggerMiddleware())
        .use(new RecorderMiddleware())
        .use(new CorsMiddleware())  // Handle CORS early for preflight
        .use(new BodySizeLimitMiddleware())  // Block oversized requests early
        .use(new BlockListMiddleware())
        .use(new GeoIpMiddleware())
        .use(new TokenBucketRateLimitMiddleware())
        .use(new BotDefenseMiddleware())
        .use(new WafMiddleware())
        .use(new SecurityHeadersMiddleware())
        .use(new CompressionMiddleware())
        .use(new SmartCacheMiddleware())
        .use(new CircuitBreakerMiddleware())
        .use(new ProxyMiddleware());

    const handleRequest = async (req: Request, info: Deno.ServeHandlerInfo, targetPort: number, serviceName: string) => {
        const ctx: GuardianContext = {
            req,
            info,
            targetPort,
            serviceName,
            requestId: crypto.randomUUID(),
            ip: info.remoteAddr.transport === 'tcp' ? (info.remoteAddr as Deno.NetAddr).hostname : "0.0.0.0",
            userAgent: req.headers.get("user-agent") || "unknown",
            url: new URL(req.url),
            state: new Map(),
            log: (source, message) => {
                manager.get(serviceName)?.addLog(source, message);
            }
        };

        const startTime = Date.now();
        const result = await pipeline.execute(ctx);

        // Record latency for Prometheus
        const latency = Date.now() - startTime;
        recordLatency(serviceName, latency);

        return result;
    };

    // 5. Start Frontend Gateway
    console.log(`[GUARDIAN] Frontend Gateway listening on http://localhost:${CONFIG.ports.frontend}`);
    Deno.serve({
        port: CONFIG.ports.frontend,
        handler: (req: Request, info: any) => {
            const url = new URL(req.url);
            let targetPort = CONFIG.ports.internalFrontend;
            let serviceName = "frontend";

            if (url.pathname === "/ws" || url.pathname.startsWith("/api") || url.pathname.startsWith("/uploads")) {
                targetPort = CONFIG.ports.internalBackend;
                serviceName = "backend";
            }

            return handleRequest(req, info, targetPort, serviceName);
        },
        onListen: () => { }
    });

    // 6. Start Backend Gateway
    console.log(`[GUARDIAN] Backend Gateway listening on http://localhost:${CONFIG.ports.backend}`);
    Deno.serve({
        port: CONFIG.ports.backend,
        handler: (req: Request, info: any) => handleRequest(req, info, CONFIG.ports.internalBackend, "backend"),
        onListen: () => { }
    });
}

bootstrap();
