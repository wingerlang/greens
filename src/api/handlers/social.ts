import { SocialRepository } from "../repositories/socialRepository.ts";
import { getSession } from "../db/session.ts";

export async function handleSocialRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    if (url.pathname.startsWith("/api/social/follow/") && method === "POST") {
        try {
            const targetId = url.pathname.split('/').pop();
            if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });
            await SocialRepository.followUser(session.userId, targetId);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    if (url.pathname.startsWith("/api/social/unfollow/") && method === "POST") {
        try {
            const targetId = url.pathname.split('/').pop();
            if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });
            await SocialRepository.unfollowUser(session.userId, targetId);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
