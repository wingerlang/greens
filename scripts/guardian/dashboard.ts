import { manager } from "./services.ts";
import { getKv, registerLogClient, removeLogClient, stats } from "./logger.ts";
import { MetricEntry } from "./types.ts";
// @ts-nocheck
/// <reference lib="deno.ns" />
import { join, dirname, fromFileUrl } from "@std/path";
import {
    getTopEndpoints,
    getTopEndpointsHistory,
    getTopIps,
    getTrafficStats,
    getServiceStats,
    getServiceDailyStats,
    getTypeStats,
    getSessions,
    getCountryStats,
    getRequestCountInWindow,
    getSizeStats,
    getUptimeStats,
    getServiceUptimeHistory,
    getActiveSessionBuckets,
    getHourlyTraffic,
    getStatusBreakdownHistory,
    getLatencyHistory
} from "./analytics.ts";
import { bannedIps, banIp, unbanIp } from "./security.ts";
import { setRecording, getRecordingStatus, listTraces, replayTrace } from "./recorder.ts";
import { getWafEvents } from "./waf.ts";
import { getCircuitsSnapshot, resetCircuit } from "./circuitBreaker.ts";
import { generatePrometheusMetrics, getLatencyStats, getMemoryHistory, getAggregateLatency } from "./prometheus.ts";
import { CONFIG } from "./config.ts";
import { TextLineStream } from "jsr:@std/streams/text-line-stream";
import { loadBalancer } from "./loadBalancer.ts";
import { simulator } from "./simulator.ts";
import { getDebugLog, clearDebugLog } from "./debug.ts";
import { runCiPipeline } from "./ci.ts";

// WebSocket clients for real-time updates
const wsClients: Set<WebSocket> = new Set();

// Broadcast stats to all connected clients
let broadcastInterval: number | null = null;
let initialTotalUptime = 0;
let initialTotalRequests = 0;
let initialTotalStatsFetched = false;

async function startBroadcasting() {
    if (broadcastInterval) return;

    // Ensure initial stats are loaded if broadcast didn't start yet
    if (!initialTotalStatsFetched) {
        const kv = getKv();
        if (kv) {
            try {
                const [uptimeRes, requestsRes] = await Promise.all([
                    kv.get<Deno.KvU64>(["guardian", "uptime_total", "guardian"]),
                    kv.get<Deno.KvU64>(["guardian", "stats_total", "requests"])
                ]);
                initialTotalUptime = uptimeRes.value ? Number(uptimeRes.value.value) : 0;
                initialTotalRequests = requestsRes.value ? Number(requestsRes.value.value) : 0;
                initialTotalStatsFetched = true;
            } catch (e) { /* ignore */ }
        }
    }

    broadcastInterval = setInterval(async () => {
        if (wsClients.size === 0) return;

        try {
            const circuits = getCircuitsSnapshot();
            const services = manager.getAll().map(s => ({
                ...s.stats,
                circuit: circuits[s.config.name] || { status: "CLOSED", failures: 0 }
            }));

            const lbStats = loadBalancer.getStats();
            const uptime = Math.floor((Date.now() - stats.startTime) / 1000);

            const data = JSON.stringify({
                type: "stats",
                services,
                rps: stats.rps || 0,
                totalRequests: initialTotalRequests + stats.totalRequests,
                avgLatency: getAggregateLatency(),
                uptime: uptime,
                totalUptime: initialTotalUptime + uptime,
                startTime: stats.startTime,
                loadBalancer: lbStats,
                activeSessions: await getActiveSessionBuckets()
            });

            for (const client of wsClients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            }
        } catch (e) {
            // Ignore broadcast errors
        }
    }, 500); // Update every 500ms for real-time feel
}

export function stopBroadcasting() {
    if (broadcastInterval) {
        clearInterval(broadcastInterval);
        broadcastInterval = null;
    }
    for (const client of wsClients) {
        client.close();
    }
    wsClients.clear();
}

export async function handleDashboardRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Health check endpoints (no auth required)
    if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    if (url.pathname === "/ready") {
        const services = manager.getAll();
        const allReady = services.every(s =>
            s.stats.status === "running" || !s.config.autoRestart
        );

        return new Response(JSON.stringify({
            ready: allReady,
            services: services.map(s => ({ name: s.config.name, status: s.stats.status }))
        }), {
            status: allReady ? 200 : 503,
            headers: { "Content-Type": "application/json" }
        });
    }

    // Basic Auth check (skip for metrics, health, ready, and WebSocket)
    const dashboardAuth = (CONFIG as any).dashboard?.auth;
    if (dashboardAuth?.enabled &&
        url.pathname !== "/metrics" &&
        url.pathname !== "/ws") {

        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Basic ")) {
            return new Response("Unauthorized", {
                status: 401,
                headers: { "WWW-Authenticate": 'Basic realm="Guardian Dashboard"' }
            });
        }

        try {
            const credentials = atob(authHeader.slice(6));
            const [username, password] = credentials.split(":");

            if (username !== dashboardAuth.username || password !== dashboardAuth.password) {
                return new Response("Unauthorized", {
                    status: 401,
                    headers: { "WWW-Authenticate": 'Basic realm="Guardian Dashboard"' }
                });
            }
        } catch {
            return new Response("Unauthorized", {
                status: 401,
                headers: { "WWW-Authenticate": 'Basic realm="Guardian Dashboard"' }
            });
        }
    }

    // Serve Assembled Dashboard
    if (url.pathname === "/" || url.pathname === "/index.html") {
        try {
            const baseDir = dirname(fromFileUrl(import.meta.url));
            const componentsDir = join(baseDir, "components");

            // Read Layout
            const layoutPath = join(componentsDir, "layout.html");
            let html = await Deno.readTextFile(layoutPath);

            // Read Sidebar
            const sidebarPath = join(componentsDir, "sidebar.html");
            const sidebar = await Deno.readTextFile(sidebarPath);

            // Read Components
            const components = [
                "tab-overview.html",
                "tab-simulator.html",
                "tab-traffic.html",
                "tab-sessions.html",
                "tab-console.html",
                "tab-ci.html",
                "tab-tools.html",
                "tab-service-detail.html",
                "tab-security.html",
                "tab-waf.html",
                "tab-load-balancer.html",
                "tab-waf.html",
                "tab-debug.html",
                "tab-settings.html",
                "tab-analytics.html"
            ];

            let componentsHtml = "";
            for (const c of components) {
                try {
                    const content = await Deno.readTextFile(join(componentsDir, c));
                    componentsHtml += content + "\n";
                } catch (e) {
                    console.error(`Failed to load component ${c}:`, e);
                }
            }

            // Assembly
            html = html.replace("<!-- {{SIDEBAR}} -->", sidebar);
            html = html.replace("<!-- {{COMPONENTS}} -->", componentsHtml);

            return new Response(html, { headers: { "content-type": "text/html" } });
        } catch (e) {
            console.error("Dashboard assembly failed:", e);
            return new Response("Dashboard unavailable due to server error.", { status: 500 });
        }
    }

    // Serve Component Static Assets
    if (url.pathname === "/components/styles.css") {
        try {
            const path = join(dirname(fromFileUrl(import.meta.url)), "components", "styles.css");
            const css = await Deno.readTextFile(path);
            return new Response(css, { headers: { "content-type": "text/css" } });
        } catch {
            return new Response("Not found", { status: 404 });
        }
    }

    if (url.pathname === "/components/client.js") {
        try {
            const path = join(dirname(fromFileUrl(import.meta.url)), "components", "client.js");
            const js = await Deno.readTextFile(path);
            return new Response(js, { headers: { "content-type": "application/javascript" } });
        } catch {
            return new Response("Not found", { status: 404 });
        }
    }

    if (url.pathname === "/api/status") {
        manager.getOrAdd("guardian");
        const services = manager.getAll();
        const circuits = getCircuitsSnapshot();
        const uptimes = await getUptimeStats();


        const enriched = await Promise.all(services.map(async s => {
            const [req10m, req60m] = await Promise.all([
                getRequestCountInWindow(s.config.name, 10 * 60 * 1000),
                getRequestCountInWindow(s.config.name, 60 * 60 * 1000)
            ]);

            return {
                ...s.stats,
                req10m,
                req60m,
                circuit: circuits[s.config.name] || { status: "CLOSED", failures: 0 },
                persistedUptime: uptimes[s.config.name] || { daily: 0, total: 0, firstSeen: Date.now() }
            };
        }));

        return Response.json({
            services: enriched,
            system: (Deno as any).systemMemoryInfo ? Deno.systemMemoryInfo() : { total: 0, free: 0, available: 0 },
            load: (Deno as any).loadavg ? Deno.loadavg() : [0, 0, 0],
            uptime: Math.floor((Date.now() - stats.startTime) / 1000),
            totalUptime: initialTotalUptime + Math.floor((Date.now() - stats.startTime) / 1000),
            startTime: stats.startTime,
            totalRequests: initialTotalRequests + stats.totalRequests,
            rps: stats.rps || 0,
            avgLatency: getAggregateLatency(),
            firstSeen: initialTotalStatsFetched ? (await getKv()?.get(["guardian", "service_first_seen", "guardian"]).then(r => r?.value) || Date.now()) : Date.now()
        });
    }

    if (url.pathname === "/api/waf/events") {
        const events = await getWafEvents();
        return Response.json(events);
    }

    if (url.pathname === "/api/top-endpoints") {
        const days = Number(url.searchParams.get("days") || "7");
        const limit = Number(url.searchParams.get("limit") || "10");
        const endpoints = await getTopEndpointsHistory(days, limit);
        return Response.json(endpoints);
    }

    if (url.pathname === "/api/logs") {
        const serviceName = url.searchParams.get("service");
        if (!serviceName) return Response.json([]);

        const service = manager.get(serviceName);
        if (service) {
            return Response.json(service.logs);
        }
        return Response.json([]);
    }

    if (url.pathname === "/api/live-logs") {
        const body = new ReadableStream({
            start(controller) {
                registerLogClient(controller);
            },
            cancel(controller) {
                removeLogClient(controller);
            }
        });
        return new Response(body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });
    }

    if (url.pathname === "/api/logs") {
        const serviceName = url.searchParams.get("service");
        if (!serviceName) return Response.json([]);
        const service = manager.get(serviceName);
        if (!service) return Response.json([]);
        return Response.json(service.logs);
    }

    if (url.pathname === "/api/analytics") {
        const [endpoints, historyEndpoints, ips, traffic] = await Promise.all([
            getTopEndpoints(),
            getTopEndpointsHistory(7),
            getTopIps(),
            getTrafficStats()
        ]);
        return Response.json({ endpoints, historyEndpoints, ips, traffic });
    }

    if (url.pathname === "/api/analytics/granular") {
        const [services, types, countries] = await Promise.all([
            getServiceStats(),
            getTypeStats(),
            getCountryStats()
        ]);
        return Response.json({ services, types, countries });
    }

    if (url.pathname === "/api/analytics/frontend") {
        const [sizeStats, typeStats] = await Promise.all([
            getSizeStats(),
            getTypeStats()
        ]);
        return Response.json({ size: sizeStats, counts: typeStats });
    }

    if (url.pathname === "/api/analytics/service-history") {
        const serviceName = url.searchParams.get("service");
        const days = Number(url.searchParams.get("days") || "7");
        if (!serviceName) return Response.json([]);

        const stats = await getServiceDailyStats(serviceName, days);
        return Response.json(stats);
    }

    if (url.pathname === "/api/analytics/uptime-history") {
        const serviceName = url.searchParams.get("service");
        const days = Number(url.searchParams.get("days") || "14");
        if (!serviceName) return Response.json([]);

        const stats = await getServiceUptimeHistory(serviceName, days);
        return Response.json(stats);
    }

    if (url.pathname === "/api/sessions") {
        const sessions = await getSessions();
        return Response.json(sessions);
    }

    if (url.pathname === "/api/analytics/sessions-active") {
        const buckets = await getActiveSessionBuckets();
        return Response.json(buckets);
    }

    if (url.pathname === "/api/banned") {
        return Response.json(Array.from(bannedIps));
    }

    if (url.pathname === "/api/config") {
        // TODO: Load from KV when implemented
        return Response.json({
            frontendPort: 3000,
            backendPort: 8000,
            dashboardPort: 9999,
            recording: getRecordingStatus()
        });
    }

    // Debug trace log
    if (url.pathname === "/api/debug") {
        if (req.method === "DELETE") {
            clearDebugLog();
            return Response.json({ success: true, message: "Debug log cleared" });
        }
        return Response.json(getDebugLog());
    }

    if (req.method === "POST" && url.pathname === "/api/recording") {
        const enabled = url.searchParams.get("enabled") === "true";
        setRecording(enabled);
        return Response.json({ success: true, enabled });
    }

    if (url.pathname === "/api/traces") {
        const traces = await listTraces();
        return Response.json(traces);
    }

    // Latency histogram data for dashboard
    if (url.pathname === "/api/latency") {
        const latencyStats = getLatencyStats();
        return Response.json(latencyStats);
    }

    // Memory history for dashboard chart
    if (url.pathname === "/api/memory-history") {
        const history = getMemoryHistory();
        return Response.json(history);
    }

    if (url.pathname === "/api/analytics/hourly-traffic") {
        const date = url.searchParams.get("date") || undefined;
        const stats = await getHourlyTraffic(date);
        return Response.json(stats);
    }

    if (url.pathname === "/api/analytics/status-history") {
        const days = Number(url.searchParams.get("days") || "7");
        const stats = await getStatusBreakdownHistory(days);
        return Response.json(stats);
    }

    if (url.pathname === "/api/analytics/latency-history") {
        const days = Number(url.searchParams.get("days") || "14");
        const stats = await getLatencyHistory(days);
        return Response.json(stats);
    }

    // Load Balancer endpoints
    // Load Balancer stats (GET)
    if (req.method === "GET" && url.pathname === "/api/load-balancer") {
        return Response.json(loadBalancer.getStats());
    }

    if (req.method === "POST" && url.pathname === "/api/load-balancer/simulator/start") {
        const rps = parseInt(url.searchParams.get("rps") || "10");
        loadBalancer.startSimulator(rps);
        return Response.json({ success: true, message: `Simulator started at ${rps} RPS` });
    }

    if (req.method === "POST" && url.pathname === "/api/load-balancer/simulator/stop") {
        loadBalancer.stopSimulator();
        return Response.json({ success: true, message: "Simulator stopped" });
    }

    if (req.method === "POST" && url.pathname === "/api/load-balancer/simulator/set-rps") {
        const rps = parseInt(url.searchParams.get("rps") || "10");
        loadBalancer.setSimulatorRps(rps);
        return Response.json({ success: true, message: `Simulator RPS set to ${rps}` });
    }

    if (req.method === "POST" && url.pathname === "/api/load-balancer/reset-stats") {
        loadBalancer.resetStats();
        return Response.json({ success: true, message: "Stats reset" });
    }

    if (req.method === "POST" && url.pathname === "/api/load-balancer/scale-up") {
        const node = url.searchParams.get("node");
        if (node) {
            loadBalancer.scaleUp();
            return Response.json({ success: true, message: `Node ${node} started` });
        }
        return Response.json({ success: false, message: "Node name required" });
    }

    if (req.method === "POST" && url.pathname === "/api/load-balancer/scale-down") {
        const node = url.searchParams.get("node");
        if (node) {
            loadBalancer.scaleDown();
            return Response.json({ success: true, message: `Node ${node} stopped` });
        }
        return Response.json({ success: false, message: "Node name required" });
    }

    // Quick actions endpoints
    if (req.method === "POST" && url.pathname === "/api/quick-action") {
        const action = url.searchParams.get("action");

        switch (action) {
            case "flush-cache":
                // Import smartCache and clear it
                try {
                    const { clearCache } = await import("./middleware/smartCache.ts");
                    clearCache();
                    return Response.json({ success: true, message: "Cache flushed" });
                } catch {
                    return Response.json({ success: false, message: "Cache module not found" });
                }

            case "clear-bans":
                // Clear all banned IPs
                for (const ip of [...bannedIps]) {
                    unbanIp(ip);
                }
                return Response.json({ success: true, message: `Cleared ${bannedIps.size} bans` });

            case "restart-frontend":
                manager.get("frontend")?.restart();
                return Response.json({ success: true, message: "Frontend restarting" });

            case "restart-backend":
                manager.get("backend")?.restart();
                return Response.json({ success: true, message: "Backend restarting" });

            default:
                return Response.json({ success: false, message: "Unknown action" });
        }
    }

    if (req.method === "POST" && url.pathname === "/api/replay") {
        const file = url.searchParams.get("file");
        if (file) {
            try {
                const result = await replayTrace(file);
                return Response.json({ success: true, result });
            } catch (e) {
                return Response.json({ success: false, error: String(e) });
            }
        }
    }

    if (url.pathname === "/api/metrics") {
        const serviceName = url.searchParams.get("service");
        if (!serviceName) return Response.json([]);

        const limit = Number(url.searchParams.get("limit") || "100");
        const entries: MetricEntry[] = [];
        const kv = getKv();

        if (kv) {
            const iter = kv.list<MetricEntry>({ prefix: ["guardian", "metrics", serviceName] }, {
                limit: limit,
                reverse: true
            });
            for await (const res of iter) {
                entries.push(res.value);
            }
        }
        return Response.json(entries.reverse());
    }

    if (req.method === "POST" && url.pathname === "/api/control") {
        const serviceName = url.searchParams.get("service");
        const action = url.searchParams.get("action");

        if (!serviceName || !action) return new Response("Missing params", { status: 400 });

        const service = manager.get(serviceName);
        if (!service) return new Response("Service not found", { status: 404 });

        try {
            if (action === "start") await service.start();
            if (action === "stop") await service.stop();
            if (action === "restart") await service.restart();
            if (action === "reset-circuit") resetCircuit(serviceName);

            return Response.json({ success: true, status: service.stats.status });
        } catch (e) {
            return Response.json({ success: false, error: String(e) });
        }
    }

    if (req.method === "POST" && url.pathname === "/api/global") {
        const action = url.searchParams.get("action");
        if (action === "restart-all") {
            for (const s of manager.getAll()) {
                if (s.config.autoRestart) await s.restart();
            }
            return Response.json({ success: true });
        }
        if (action === "ban") {
            const ip = url.searchParams.get("ip");
            if (ip) {
                await banIp(ip, "Manual Ban from Dashboard");
                return Response.json({ success: true });
            }
        }
        if (action === "unban") {
            const ip = url.searchParams.get("ip");
            if (ip) {
                await unbanIp(ip);
                return Response.json({ success: true });
            }
        }
        if (action === "restart-guardian") {
            // Trigger graceful shutdown with special exit code 42
            setTimeout(() => {
                console.log("[GUARDIAN] Restart requested via Dashboard.");
                // Stop all managed services first
                manager.stopAll().then(() => {
                    Deno.exit(42);
                });
            }, 100);
            return Response.json({ success: true, message: "Restarting..." });
        }
    }

    // Load Balancer API
    if (url.pathname === "/api/load-balancer") {
        if (req.method === "POST") {
            const action = url.searchParams.get("action");

            switch (action) {
                case "threshold": {
                    const threshold = Number(url.searchParams.get("value"));
                    if (!isNaN(threshold) && threshold > 0) {
                        loadBalancer.setThreshold(threshold);
                        return Response.json({ success: true, threshold });
                    }
                    return Response.json({ success: false, error: "Invalid threshold" });
                }

                case "simulator-start": {
                    const rps = Number(url.searchParams.get("rps") || 10);
                    loadBalancer.setSimulatorRps(rps);
                    return Response.json({ success: true, rps });
                }

                case "simulator-stop": {
                    loadBalancer.stopSimulator();
                    return Response.json({ success: true });
                }

                case "simulator-set": {
                    const rps = Number(url.searchParams.get("rps") || 0);
                    loadBalancer.setSimulatorRps(rps);
                    return Response.json({ success: true, rps });
                }

                case "reset-stats": {
                    loadBalancer.resetStats();
                    return Response.json({ success: true });
                }

                case "scale-up": {
                    const nodeName = url.searchParams.get("node");
                    if (nodeName) {
                        const service = manager.get(nodeName);
                        if (service) {
                            service.start();
                            return Response.json({ success: true, node: nodeName });
                        }
                    }
                    return Response.json({ success: false, error: "Invalid node" });
                }

                case "scale-down": {
                    const nodeName = url.searchParams.get("node");
                    if (nodeName && nodeName !== "backend") {
                        const service = manager.get(nodeName);
                        if (service) {
                            service.stop();
                            return Response.json({ success: true, node: nodeName });
                        }
                    }
                    return Response.json({ success: false, error: "Invalid node or cannot stop primary" });
                }

                default:
                    // Legacy threshold support
                    const threshold = Number(url.searchParams.get("threshold"));
                    if (!isNaN(threshold) && threshold > 0) {
                        loadBalancer.setThreshold(threshold);
                        return Response.json({ success: true, threshold });
                    }
                    return Response.json({ success: false, error: "Unknown action" });
            }
        }
        return Response.json(loadBalancer.getStats());
    }

    // Simulator API
    if (url.pathname === "/api/simulator") {
        if (req.method === "POST") {
            try {
                const body = await req.json();
                simulator.updateConfig(body);
                return Response.json({ success: true, status: simulator.getStatus() });
            } catch (e) {
                return Response.json({ success: false, error: "Invalid JSON" });
            }
        }
        return Response.json(simulator.getStatus());
    }

    // CI/CD Endpoints
    if (url.pathname === "/api/ci/status") {
        try {
            const report = await Deno.readTextFile("data/ci_report.json");
            return new Response(report, { headers: { "Content-Type": "application/json" } });
        } catch {
            return Response.json({ status: "unknown", coverage: { percent: 0 } });
        }
    }

    if (req.method === "POST" && url.pathname === "/api/ci/run") {
        runCiPipeline(); // Run in background
        return Response.json({ success: true, message: "Pipeline started" });
    }

    // Database Sync Endpoint
    if (req.method === "POST" && url.pathname === "/api/db/sync") {
        const secret = req.headers.get("x-admin-secret");
        if (secret !== CONFIG.adminSecret) {
            return new Response("Unauthorized", { status: 401 });
        }

        const mode = url.searchParams.get("mode") || "merge";
        const kv = getKv();
        if (!kv || !req.body) return new Response("KV not ready or body missing", { status: 400 });

        try {
            const lines = req.body
                .pipeThrough(new TextDecoderStream())
                .pipeThrough(new TextLineStream());

            let count = 0;
            let ops = 0;
            let atomic = kv.atomic();

            const reader = lines.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const line = value;

                    if (!line.trim()) continue;
                    try {
                        const entry = JSON.parse(line);
                        if (entry.key && entry.value !== undefined) {
                            if (mode === "merge") {
                                // Check existence
                                const current = await kv.get(entry.key);
                                if (!current.value) {
                                    atomic.set(entry.key, entry.value);
                                    ops++;
                                    count++;
                                }
                            } else {
                                // Overwrite (Upsert)
                                atomic.set(entry.key, entry.value);
                                ops++;
                                count++;
                            }

                            if (ops >= 20) {
                                await atomic.commit();
                                atomic = kv.atomic();
                                ops = 0;
                            }
                        }
                    } catch {
                        // ignore parse error
                    }
                }
            } finally {
                reader.releaseLock();
            }
            if (ops > 0) await atomic.commit();

            return Response.json({ success: true, count, mode });
        } catch (e) {
            return Response.json({ success: false, error: String(e) }, { status: 500 });
        }
    }

    // Prometheus metrics endpoint
    if (url.pathname === "/metrics") {
        const metrics = await generatePrometheusMetrics();
        return new Response(metrics, {
            headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" }
        });
    }

    // WebSocket for real-time updates
    if (url.pathname === "/ws") {
        if (req.headers.get("upgrade") === "websocket") {
            const { socket, response } = Deno.upgradeWebSocket(req);

            socket.onopen = () => {
                wsClients.add(socket);
                startBroadcasting();
            };

            socket.onclose = () => {
                wsClients.delete(socket);
            };

            socket.onerror = () => {
                wsClients.delete(socket);
            };

            return response;
        }
        return new Response("WebSocket upgrade required", { status: 426 });
    }

    return new Response("Not Found", { status: 404 });
}
