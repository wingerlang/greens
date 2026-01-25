import { initLogger } from "./logger.ts";
import { manager } from "./services.ts";
import { updateSystemStats } from "./monitor.ts";
import { handleDashboardRequest } from "./dashboard.ts";
import { handleProxyRequest } from "./proxy.ts";
import { clearPort } from "./utils.ts";
import { loadBannedIps } from "./security.ts";

const PROXY_PORT = 3000;
const DASHBOARD_PORT = 9999;
const BACKEND_PORT = 8001;
const FRONTEND_PORT = 3001;

async function bootstrap() {
    console.log("[GUARDIAN] Booting System 2.5...");

    await initLogger();
    await loadBannedIps();

    await clearPort(PROXY_PORT);
    await clearPort(DASHBOARD_PORT);
    await clearPort(BACKEND_PORT);
    await clearPort(FRONTEND_PORT);

    // 1. Register Services
    manager.register({
        name: "backend",
        command: ["deno", "task", "server"],
        env: { "PORT": String(BACKEND_PORT) },
        autoRestart: true,
        port: BACKEND_PORT
    });

    manager.register({
        name: "frontend",
        // We override Vite's port via CLI
        command: ["deno", "task", "dev", "--port", String(FRONTEND_PORT)],
        autoRestart: true,
        port: FRONTEND_PORT
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

    // 5. Start Proxy (Public Gateway)
    console.log(`[GUARDIAN] Gateway listening on http://localhost:${PROXY_PORT}`);
    Deno.serve({
        port: PROXY_PORT,
        handler: handleProxyRequest,
        onListen: () => {}
    });
}

bootstrap();
