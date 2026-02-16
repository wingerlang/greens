import { SocialRepository } from "../repositories/socialRepository.ts";
import { AuthContext } from "../middleware.ts";

export async function handleSocialRoutes(req: Request, url: URL, headers: Headers, ctx: AuthContext | null): Promise<Response> {
    const method = req.method;
    if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const { user: session, token } = ctx;

    if (url.pathname.startsWith("/api/social/follow/") && method === "POST") {
        try {
            const targetId = url.pathname.split('/').pop();
            if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });
            await SocialRepository.followUser(session.id, targetId);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    if (url.pathname.startsWith("/api/social/unfollow/") && method === "POST") {
        try {
            const targetId = url.pathname.split('/').pop();
            if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });
            await SocialRepository.unfollowUser(session.id, targetId);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    if (url.pathname.startsWith("/api/social/is-following/") && method === "GET") {
        try {
            const targetId = url.pathname.split('/').pop();
            if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });
            const isFollowing = await SocialRepository.isFollowing(session.id, targetId);
            return new Response(JSON.stringify({ isFollowing }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
