import { initLogger } from "./logger.ts";
import { initRecorder } from "./recorder.ts";
import { manager } from "./services.ts";
import { updateSystemStats } from "./monitor.ts";
import { handleDashboardRequest } from "./dashboard.ts";
import { handleProxyRequest } from "./proxy.ts";
import { clearPort } from "./utils.ts";
import { loadBannedIps } from "./security.ts";

// Configuration (Defaults)
// TODO: Load from KV if customized
const PROXY_FE_PORT = 3000;
const PROXY_BE_PORT = 8000;
const DASHBOARD_PORT = 9999;
const INTERNAL_BE_PORT = 8001;
const INTERNAL_FE_PORT = 3001;

async function bootstrap() {
    console.log("[GUARDIAN] Booting System 2.6.0...");

    await initLogger();
    await initRecorder();
    await loadBannedIps();

    // Clear all relevant ports to avoid EADDRINUSE
    await clearPort(PROXY_FE_PORT);
    await clearPort(PROXY_BE_PORT);
    await clearPort(DASHBOARD_PORT);
    await clearPort(INTERNAL_BE_PORT);
    await clearPort(INTERNAL_FE_PORT);

    // 1. Register Services
    manager.register({
        name: "backend",
        command: ["deno", "task", "server"],
        env: { "PORT": String(INTERNAL_BE_PORT) },
        autoRestart: true,
        port: INTERNAL_BE_PORT
    });

    manager.register({
        name: "frontend",
        // We override Vite's port via CLI
        command: ["deno", "task", "dev", "--port", String(INTERNAL_FE_PORT)],
        autoRestart: true,
        port: INTERNAL_FE_PORT
    });

    // 2. Start Services
    await manager.startAll();

    // 3. Start Monitor (System Stats)
    setInterval(updateSystemStats, 2000);

    // 4. Start Dashboard (Admin UI)
    console.log(`[GUARDIAN] Dashboard listening on http://localhost:${DASHBOARD_PORT}`);
    Deno.serve({
        port: DASHBOARD_PORT,
        handler: handleDashboardRequest,
        onListen: () => {}
    });

    // 5. Start Frontend Gateway (3000 -> 3001)
    console.log(`[GUARDIAN] Frontend Gateway listening on http://localhost:${PROXY_FE_PORT}`);
    Deno.serve({
        port: PROXY_FE_PORT,
        handler: (req, info) => handleProxyRequest(req, info, INTERNAL_FE_PORT, "frontend"),
        onListen: () => {}
    });

    // 6. Start Backend Gateway (8000 -> 8001)
    console.log(`[GUARDIAN] Backend Gateway listening on http://localhost:${PROXY_BE_PORT}`);
    Deno.serve({
        port: PROXY_BE_PORT,
        handler: (req, info) => handleProxyRequest(req, info, INTERNAL_BE_PORT, "backend"),
        onListen: () => {}
    });
}

bootstrap();
