import { manager } from "./services.ts";
import { getKv, registerLogClient, removeLogClient } from "./logger.ts";
import { MetricEntry } from "./types.ts";
import { join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";
import { getTopEndpoints, getTopIps, getTrafficStats, getServiceStats, getTypeStats, getSessions } from "./analytics.ts";
import { bannedIps, banIp, unbanIp } from "./security.ts";
import { setRecording, getRecordingStatus, listTraces, replayTrace } from "./recorder.ts";
import { getWafEvents } from "./waf.ts";
import { getCircuitsSnapshot } from "./circuitBreaker.ts";

export async function handleDashboardRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Serve HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
        try {
            const htmlPath = join(dirname(fromFileUrl(import.meta.url)), "dashboard.html");
            const html = await Deno.readTextFile(htmlPath);
            return new Response(html, { headers: { "content-type": "text/html" } });
        } catch (e) {
            return new Response("Dashboard not found.", { status: 404 });
        }
    }

    if (url.pathname === "/api/status") {
        manager.getOrAdd("guardian");
        const services = manager.getAll().map(s => s.stats);
        const circuits = getCircuitsSnapshot();

        // Enrich services with circuit data
        const enriched = services.map(s => ({
            ...s,
            circuit: circuits[s.name] || { status: "CLOSED", failures: 0 }
        }));

        return Response.json({
            services: enriched,
            system: Deno.systemMemoryInfo(),
            load: Deno.loadavg()
        });
    }

    if (url.pathname === "/api/waf/events") {
        const events = await getWafEvents();
        return Response.json(events);
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

    if (url.pathname === "/api/analytics") {
        const [endpoints, ips, traffic] = await Promise.all([
            getTopEndpoints(),
            getTopIps(),
            getTrafficStats()
        ]);
        return Response.json({ endpoints, ips, traffic });
    }

    if (url.pathname === "/api/analytics/granular") {
        const [services, types] = await Promise.all([
            getServiceStats(),
            getTypeStats()
        ]);
        return Response.json({ services, types });
    }

    if (url.pathname === "/api/sessions") {
        const sessions = await getSessions();
        return Response.json(sessions);
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

    if (req.method === "POST" && url.pathname === "/api/recording") {
        const enabled = url.searchParams.get("enabled") === "true";
        setRecording(enabled);
        return Response.json({ success: true, enabled });
    }

    if (url.pathname === "/api/traces") {
        const traces = await listTraces();
        return Response.json(traces);
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

            return Response.json({ success: true, status: service.stats.status });
        } catch (e) {
            return Response.json({ success: false, error: String(e) });
        }
    }

    if (req.method === "POST" && url.pathname === "/api/global") {
        const action = url.searchParams.get("action");
        if (action === "restart-all") {
             for(const s of manager.getAll()) {
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
    }

    return new Response("Not Found", { status: 404 });
}
