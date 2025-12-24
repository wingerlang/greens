import { activityRepo } from "../repositories/activityRepository.ts";
import { getSession } from "../db/session.ts";
import { UniversalActivity } from "../../models/types.ts";

export async function handleActivityRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    // GET /api/activities
    if (url.pathname === "/api/activities" && method === "GET") {
        try {
            const startDate = url.searchParams.get('start');
            const endDate = url.searchParams.get('end');

            if (!startDate || !endDate) {
                return new Response(JSON.stringify({ error: "Missing start/end date params" }), { status: 400, headers });
            }

            const activities = await activityRepo.getActivitiesByDateRange(session.userId, startDate, endDate);
            return new Response(JSON.stringify({ activities }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // POST /api/activities
    if (url.pathname === "/api/activities" && method === "POST") {
        try {
            const activity = await req.json() as UniversalActivity;
            if (activity.userId !== session.userId) {
                return new Response(JSON.stringify({ error: "UserId mismatch" }), { status: 403, headers });
            }
            await activityRepo.saveActivity(activity);
            return new Response(JSON.stringify({ success: true, id: activity.id }), { status: 200, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // DELETE /api/activities/:id
    if (url.pathname.startsWith("/api/activities/") && method === "DELETE") {
        try {
            const parts = url.pathname.split('/');
            const activityId = parts[3];
            const date = url.searchParams.get('date');

            if (!activityId || !date) {
                return new Response(JSON.stringify({ error: "Missing ID or Date" }), { status: 400, headers });
            }

            const activity = await activityRepo.getActivity(session.userId, date, activityId);
            if (!activity) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

            await activityRepo.deleteActivity(activity);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
