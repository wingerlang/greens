import { getSession } from "../db/session.ts";
import { getUserData, saveUserData } from "../db/data.ts";

export async function handleDataRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    if (url.pathname === "/api/data" && method === "GET") {
        const data = await getUserData(session.userId);
        return new Response(JSON.stringify(data || {}), { headers });
    }

    if (url.pathname === "/api/data" && method === "POST") {
        try {
            const body = await req.json();
            await saveUserData(session.userId, body);
            return new Response(JSON.stringify({ success: true, timestamp: new Date() }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
