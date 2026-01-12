import { getSession } from "../db/session.ts";
import { weeklyPlanRepo } from "../repositories/weeklyPlanRepository.ts";
import { WeeklyPlan } from "../../models/types.ts";

export async function handlePlanRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // GET /api/plans?start=YYYY-MM-DD
    // GET /api/plans (All)
    if (method === "GET") {
        const start = url.searchParams.get("start");
        if (start) {
            const plan = await weeklyPlanRepo.getPlan(userId, start);
            if (!plan) return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers });
            return new Response(JSON.stringify(plan), { headers });
        } else {
            const plans = await weeklyPlanRepo.getPlans(userId);
            return new Response(JSON.stringify({ plans }), { headers });
        }
    }

    // POST /api/plans (Create or Update)
    if (method === "POST") {
        try {
            const plan = await req.json() as WeeklyPlan;
            if (!plan.weekStartDate) {
                return new Response(JSON.stringify({ error: "weekStartDate is required" }), { status: 400, headers });
            }

            // Validate ownership/consistency if needed
            // For now, just save
            await weeklyPlanRepo.savePlan(userId, plan);

            return new Response(JSON.stringify({ success: true, plan }), { headers });
        } catch (e) {
            console.error("Plan save error:", e);
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
        }
    }

    // DELETE /api/plans?start=YYYY-MM-DD
    if (method === "DELETE") {
        const start = url.searchParams.get("start");
        if (!start) return new Response(JSON.stringify({ error: "weekStartDate parameter required" }), { status: 400, headers });

        await weeklyPlanRepo.deletePlan(userId, start);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
