import { initLogger } from "./logger.ts";
import { initRecorder } from "./recorder.ts";
import { manager } from "./services.ts";
import { updateSystemStats } from "./monitor.ts";
import { handleDashboardRequest } from "./dashboard.ts";
import { handleProxyRequest } from "./proxy.ts";
import { clearPort } from "./utils.ts";
import { loadBannedIps } from "./security.ts";
import { CONFIG } from "./config.ts";
import { startHealthChecks } from "./health.ts";

async function bootstrap() {
    console.log(`[GUARDIAN] Booting System ${CONFIG.version}...`);

    await initLogger();
    await initRecorder();
    await loadBannedIps();

    // Clear all relevant ports to avoid EADDRINUSE
    await clearPort(CONFIG.ports.proxyFrontend);
    await clearPort(CONFIG.ports.proxyBackend);
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
        // We override Vite's port via CLI
        command: ["deno", "task", "dev", "--port", String(CONFIG.ports.internalFrontend)],
        autoRestart: true,
        port: CONFIG.ports.internalFrontend
    });

    // 2. Start Services
    await manager.startAll();

    // 3. Start Monitor (System Stats)
    setInterval(updateSystemStats, 2000);

    // 4. Start Active Health Checks
    startHealthChecks();

    // 5. Start Dashboard (Admin UI)
    console.log(`[GUARDIAN] Dashboard listening on http://localhost:${CONFIG.ports.dashboard}`);
    Deno.serve({
        port: CONFIG.ports.dashboard,
        handler: handleDashboardRequest,
        onListen: () => {}
    });

    // 6. Start Frontend Gateway
    console.log(`[GUARDIAN] Frontend Gateway listening on http://localhost:${CONFIG.ports.proxyFrontend}`);
    Deno.serve({
        port: CONFIG.ports.proxyFrontend,
        handler: (req, info) => handleProxyRequest(req, info, CONFIG.ports.internalFrontend, "frontend"),
        onListen: () => {}
    });

    // 7. Start Backend Gateway
    console.log(`[GUARDIAN] Backend Gateway listening on http://localhost:${CONFIG.ports.proxyBackend}`);
    Deno.serve({
        port: CONFIG.ports.proxyBackend,
        handler: (req, info) => handleProxyRequest(req, info, CONFIG.ports.internalBackend, "backend"),
        onListen: () => {}
    });
}

bootstrap();
