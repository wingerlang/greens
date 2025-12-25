import { handleAuthRoutes } from "./handlers/auth.ts";
import { handleUserRoutes } from "./handlers/user.ts";
import { handleDataRoutes } from "./handlers/data.ts";
import { handleStravaRoutes } from "./handlers/strava.ts";
import { handleSocialRoutes } from "./handlers/social.ts";
import { handleActivityRoutes } from "./handlers/activities.ts";
import { handleAdminRoutes } from "./handlers/admin.ts";
import { handleStrengthRoutes } from "./handlers/strength.ts";

export async function router(req: Request): Promise<Response> {
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

    try {
        // Dispatch to handlers
        if (url.pathname.startsWith("/api/auth")) return await handleAuthRoutes(req, url, headers);
        if (url.pathname.startsWith("/api/user")) return await handleUserRoutes(req, url, headers);
        if (url.pathname.startsWith("/api/data")) return await handleDataRoutes(req, url, headers);
        if (url.pathname.startsWith("/api/strava")) return await handleStravaRoutes(req, url, headers);
        if (url.pathname.startsWith("/api/social")) return await handleSocialRoutes(req, url, headers);
        if (url.pathname.startsWith("/api/activities")) return await handleActivityRoutes(req, url, headers);
        if (url.pathname.startsWith("/api/admin")) return await handleAdminRoutes(req, url, headers);
        if (url.pathname.startsWith("/api/strength")) return await handleStrengthRoutes(req, url, headers);

        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
    } catch (e) {
        console.error("Internal Server Error:", e);
        return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
    }
}
