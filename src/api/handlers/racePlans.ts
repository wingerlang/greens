import { kv } from "../kv.ts";
import { RaceProfile, RunnerProfile, IntakeEvent, PacingStrategy } from "../../utils/racePlannerCalculators.ts";
import { getSession } from "../db/session.ts";

export interface RacePlan {
    id: string;
    userId: string;
    name: string;
    createdAt: string;
    updatedAt: string;

    // Config
    raceProfile: RaceProfile;
    runnerProfile: RunnerProfile;
    environment: {
        temperatureC: number;
        humidityPercent: number;
        sunsetTime?: string;
    };

    // Strategy
    pacingStrategy: PacingStrategy;

    // Logistics
    intakeEvents: IntakeEvent[];
    dropbagKms: number[];
}

/**
 * Save a race plan for a user.
 * Key: ['race_plans', userId, planId]
 */
export async function saveRacePlan(userId: string, plan: Omit<RacePlan, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { id?: string }): Promise<RacePlan> {
    const planId = plan.id || crypto.randomUUID();
    const now = new Date().toISOString();

    // Fetch existing to preserve createdAt if not provided
    let createdAt = now;
    if (plan.id) {
        const existing = await getRacePlan(userId, plan.id);
        if (existing) {
            createdAt = existing.createdAt;
        }
    }

    const fullPlan: RacePlan = {
        ...plan,
        id: planId,
        userId,
        createdAt: (plan as any).createdAt || createdAt,
        updatedAt: now
    };

    await kv.set(['race_plans', userId, planId], fullPlan);
    return fullPlan;
}

/**
 * Get all race plans for a user.
 */
export async function getRacePlans(userId: string): Promise<RacePlan[]> {
    const iter = kv.list({ prefix: ['race_plans', userId] });
    const plans: RacePlan[] = [];
    for await (const entry of iter) {
        plans.push(entry.value as RacePlan);
    }
    // Sort by updated desc
    return plans.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Get a specific plan
 */
export async function getRacePlan(userId: string, planId: string): Promise<RacePlan | null> {
    const res = await kv.get(['race_plans', userId, planId]);
    return res.value as RacePlan;
}

/**
 * Delete a race plan.
 */
export async function deleteRacePlan(userId: string, planId: string): Promise<void> {
    await kv.delete(['race_plans', userId, planId]);
}

/**
 * Handle HTTP routes for Race Plans
 */
export async function handleRacePlanRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // GET /api/race-plans
    if (method === "GET") {
        const plans = await getRacePlans(userId);
        return new Response(JSON.stringify(plans), { headers });
    }

    // POST /api/race-plans (Create/Update)
    if (method === "POST") {
        try {
            const body = await req.json();
            const plan = await saveRacePlan(userId, body);
            return new Response(JSON.stringify(plan), { headers });
        } catch (e) {
            console.error(e);
            return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
        }
    }

    // DELETE /api/race-plans?id=...
    if (method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
        await deleteRacePlan(userId, id);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
