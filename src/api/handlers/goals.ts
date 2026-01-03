import { getSession } from "../db/session.ts";
import { goalRepo } from "../repositories/goalRepository.ts";
import { PerformanceGoal } from "../../models/types.ts";

export async function handleGoalRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // GET /api/goals
    if (method === "GET") {
        const goals = await goalRepo.getGoals(userId);
        return new Response(JSON.stringify(goals), { headers });
    }

    // POST /api/goals (Create/Update)
    if (method === "POST") {
        try {
            const goal = await req.json() as PerformanceGoal;
            if (!goal.id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
            await goalRepo.saveGoal(userId, goal);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
        }
    }

    // DELETE /api/goals?id=...
    if (method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
        await goalRepo.deleteGoal(userId, id);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
