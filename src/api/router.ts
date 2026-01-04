import { handleAuthRoutes } from "./handlers/auth.ts";
import { handleUserRoutes } from "./handlers/user.ts";
import { handleDataRoutes } from "./handlers/data.ts";
import { handleStravaRoutes } from "./handlers/strava.ts";
import { handleSocialRoutes } from "./handlers/social.ts";
import { handleActivityRoutes } from "./handlers/activities.ts";
import { handleAdminRoutes } from "./handlers/admin.ts";
import { handleStrengthRoutes } from "./handlers/strength.ts";
import { handleFeedRoutes } from "./handlers/feed.ts";
import { handleGoalRoutes } from "./handlers/goals.ts";
import { handlePeriodRoutes } from "./handlers/periods.ts";
import { handleParserRoutes } from "./handlers/parser.ts";
import { handleGetCommunityStats } from "./handlers/statistics.ts";
import { logError, logMetric } from "./utils/logger.ts";

export async function router(req: Request): Promise<Response> {
    const start = performance.now();
    const url = new URL(req.url);
    const method = req.method;

    // CORS / Headers
    const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    });

    if (method === "OPTIONS") {
        return new Response(null, { headers });
    }

    let response: Response;

    try {
        // Dispatch to handlers
        if (url.pathname.startsWith("/api/auth")) {
            response = await handleAuthRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/user")) {
            response = await handleUserRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/u/")) {
            response = await handleUserRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/users")) {
            response = await handleUserRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/data")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/meals")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/weight")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/foods")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/strava")) {
            response = await handleStravaRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/social")) {
            response = await handleSocialRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/activities")) {
            response = await handleActivityRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/admin")) {
            response = await handleAdminRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/strength")) {
            response = await handleStrengthRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/feed")) {
            response = await handleFeedRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/goals")) {
            response = await handleGoalRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/periods")) {
            response = await handlePeriodRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/parse-url")) {
            response = await handleParserRoutes(req, url, headers);
        } else if (url.pathname === "/api/stats/community") {
            response = await handleGetCommunityStats(req);
        } else {
            response = new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
        }
    } catch (e) {
        console.error("Internal Server Error:", e);
        // Log to KV
        await logError(e instanceof Error ? e : String(e), { url: url.toString(), method }, undefined, url.pathname);
        response = new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
    }

    // Metrics Logging
    const duration = performance.now() - start;
    await logMetric("response_time", duration, { path: url.pathname, method, status: String(response.status) });
    await logMetric("request_count", 1, { path: url.pathname, method, status: String(response.status) });

    return response;
}
