import { analyticsRepository } from '../repositories/analyticsRepository.ts';
import { PageView, InteractionEvent } from '../../models/types.ts';

/**
 * Analytics API Handler
 * Dispatches requests to specific repository methods based on path and method.
 */
export async function handleAnalyticsRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const path = url.pathname.replace("/api/usage", "");
    const method = req.method;

    // Helper to return JSON Response
    const json = (data: any, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });

    try {
        // POST /view - Log a page view
        if (path === "/view" && method === "POST") {
            const body = await req.json() as PageView;
            if (!body.userId || !body.path) return json({ error: "Missing required fields" }, 400);

            await analyticsRepository.logPageView(body);
            return json({ success: true }, 201);
        }

        // POST /event - Log an interaction event
        if (path === "/event" && method === "POST") {
            const body = await req.json() as InteractionEvent;
            if (!body.userId || !body.type || !body.label) return json({ error: "Missing required fields" }, 400);

            await analyticsRepository.logEvent(body);
            return json({ success: true }, 201);
        }

        // GET /stats - Get aggregated dashboard stats
        if (path === "/stats" && method === "GET") {
            const stats = await analyticsRepository.getStats(30);
            return json(stats);
        }

        // GET /events - Get filtered raw events
        if (path === "/events" && method === "GET") {
            const userId = url.searchParams.get('userId') || undefined;
            const type = url.searchParams.get('type') || undefined;
            const daysBack = parseInt(url.searchParams.get('days') || '7');
            const limit = parseInt(url.searchParams.get('limit') || '100');

            const data = await analyticsRepository.getEventsFiltered({ userId, type, daysBack, limit });
            return json(data);
        }

        // GET /users - Get per-user activity stats
        if (path === "/users" && method === "GET") {
            const daysBack = parseInt(url.searchParams.get('days') || '30');
            const users = await analyticsRepository.getUserActivityStats(daysBack);
            return json({ users });
        }

        // GET /omnibox - Get Omnibox-specific analytics
        if (path === "/omnibox" && method === "GET") {
            const daysBack = parseInt(url.searchParams.get('days') || '30');
            const stats = await analyticsRepository.getOmniboxStats(daysBack);
            return json(stats);
        }

        // GET /daily - Get daily activity for charts
        if (path === "/daily" && method === "GET") {
            const daysBack = parseInt(url.searchParams.get('days') || '30');
            const daily = await analyticsRepository.getDailyActivity(daysBack);
            return json({ daily });
        }

        return json({ error: "Not Found" }, 404);

    } catch (error) {
        console.error("Analytics API Error:", error);
        return json({ error: "Internal Server Error" }, 500);
    }
}
