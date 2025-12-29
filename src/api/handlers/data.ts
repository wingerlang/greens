import { getSession } from "../db/session.ts";
import { getUserData, saveUserData } from "../db/data.ts";
import { mealRepo } from "../repositories/mealRepository.ts";
import { weightRepo } from "../repositories/weightRepository.ts";
import { foodRepo } from "../repositories/foodRepository.ts";

export async function handleDataRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // --- Legacy Monolithic Routes ---
    if (url.pathname === "/api/data" && method === "GET") {
        const data = await getUserData(userId);
        return new Response(JSON.stringify(data || {}), { headers });
    }

    if (url.pathname === "/api/data" && method === "POST") {
        try {
            const body = await req.json();
            await saveUserData(userId, body);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
        }
    }

    // --- Granular Routes ---

    // Meals
    if (url.pathname === "/api/meals" && method === "POST") {
        const meal = await req.json();
        await mealRepo.saveMeal(userId, meal);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Weight
    if (url.pathname === "/api/weight" && method === "POST") {
        const entry = await req.json();
        await weightRepo.saveWeight(userId, entry);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Food Database Search
    if (url.pathname === "/api/foods" && method === "GET") {
        const query = url.searchParams.get("q") || "";
        const results = await foodRepo.searchFoods(query);
        return new Response(JSON.stringify(results), { headers });
    }


    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
