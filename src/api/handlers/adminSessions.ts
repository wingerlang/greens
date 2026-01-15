
import { sessionTracker } from "../utils/sessionTracker.ts";

export async function handleAdminSessionRoutes(req: Request, url: URL, headers: Headers, clientIp?: string): Promise<Response> {
    if (url.pathname === "/api/admin/sessions" && req.method === "GET") {
        return new Response(JSON.stringify({
            sessions: sessionTracker.getSessions(),
            errors: sessionTracker.getErrors()
        }), { headers });
    }

    if (url.pathname === "/api/debug/client-error" && req.method === "POST") {
        try {
            const body = await req.json();
            sessionTracker.logClientError({
                ...body,
                userAgent: req.headers.get("user-agent") || "unknown"
            }, clientIp || "unknown");
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            console.error("Failed to log client error:", e);
            return new Response(JSON.stringify({ error: "Failed to log" }), { status: 400, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
