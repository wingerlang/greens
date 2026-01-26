import { initLogger } from "./logger.ts";
import { initRecorder } from "./recorder.ts";
import { manager } from "./services.ts";
import { updateSystemStats } from "./monitor.ts";
import { startHealthMonitor } from "./health.ts";
import { handleDashboardRequest } from "./dashboard.ts";
import { clearPort } from "./utils.ts";
import { loadBannedIps } from "./security.ts";
import { CONFIG } from "./config.ts";

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
import { GuardianContext } from "./middleware/types.ts";

async function bootstrap() {
    console.log("[GUARDIAN] Booting System 3.0 (Middleware Architecture)...");

    await initLogger();
    await initRecorder();
    await loadBannedIps();

    // Clear ports
    await clearPort(CONFIG.ports.frontend);
    await clearPort(CONFIG.ports.backend);
    await clearPort(CONFIG.ports.dashboard);
    await clearPort(CONFIG.ports.internalBackend);
    await clearPort(CONFIG.ports.internalFrontend);

    // 1. Register Services
    manager.register({
        name: "backend",
        command: ["deno", "task", "server"],
        env: { "PORT": String(CONFIG.ports.internalBackend) },
        autoRestart: true,
        port: CONFIG.ports.internalBackend
    });

    manager.register({
        name: "frontend",
        command: ["deno", "task", "dev", "--port", String(CONFIG.ports.internalFrontend), "--host", "127.0.0.1"],
        autoRestart: true,
        port: CONFIG.ports.internalFrontend
    });

    // 2. Start Services
    await manager.startAll();

    // 3. Start Monitor
    setInterval(updateSystemStats, 2000);
    startHealthMonitor();

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
            state: new Map()
        };

        return await pipeline.execute(ctx);
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
