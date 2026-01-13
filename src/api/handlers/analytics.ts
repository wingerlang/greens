import { analyticsRepository } from '../repositories/analyticsRepository.ts';
import { PageView, InteractionEvent } from '../../models/types.ts';

/**
 * Analytics API Handler
 * Dispatches requests to specific repository methods based on path and method.
 */
export async function handleAnalyticsRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const path = url.pathname.replace("/api/analytics", "");
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

        return json({ error: "Not Found" }, 404);

    } catch (error) {
        console.error("Analytics API Error:", error);
        return json({ error: "Internal Server Error" }, 500);
    }
}
