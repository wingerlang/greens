import { getSession } from "../db/session.ts";
import { plannedActivityRepo } from "../repositories/plannedActivityRepository.ts";
import { PlannedActivity } from "../../models/types.ts";

export async function handlePlannedActivityRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // GET /api/planned-activities
    if (method === "GET") {
        const activities = await plannedActivityRepo.getActivities(userId);
        return new Response(JSON.stringify({ activities }), { headers });
    }

    // POST /api/planned-activities (Create or Update Single or List)
    if (method === "POST") {
        try {
            const body = await req.json();

            if (Array.isArray(body)) {
                // Bulk save
                const activities = body as PlannedActivity[];
                await plannedActivityRepo.saveActivities(userId, activities);
                return new Response(JSON.stringify({ success: true, count: activities.length }), { headers });
            } else {
                // Single save
                const activity = body as PlannedActivity;
                if (!activity.id) {
                    return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
                }
                await plannedActivityRepo.saveActivity(userId, activity);
                return new Response(JSON.stringify({ success: true, activity }), { headers });
            }
        } catch (e) {
            console.error("Planned Activity save error:", e);
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
        }
    }

    // DELETE /api/planned-activities?id=XXX
    if (method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "id parameter required" }), { status: 400, headers });

        await plannedActivityRepo.deleteActivity(userId, id);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
