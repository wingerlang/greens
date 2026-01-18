import { getSession } from "../db/session.ts";
import { quickMealRepo } from "../repositories/quickMealRepository.ts";

export async function handleQuickMealRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // GET /api/quick-meals
    if (url.pathname === "/api/quick-meals" && method === "GET") {
        const meals = await quickMealRepo.getQuickMeals(userId);
        return new Response(JSON.stringify(meals), { headers });
    }

    // POST /api/quick-meals (Create/Update)
    if (url.pathname === "/api/quick-meals" && method === "POST") {
        try {
            const meal = await req.json();
            if (!meal.id || !meal.name || !Array.isArray(meal.items)) {
                return new Response(JSON.stringify({ error: "Invalid quick meal data" }), { status: 400, headers });
            }
            await quickMealRepo.saveQuickMeal(userId, meal);
            return new Response(JSON.stringify({ success: true, meal }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
        }
    }

    // DELETE /api/quick-meals/:id or ?id=...
    if (url.pathname.startsWith("/api/quick-meals") && method === "DELETE") {
        // Support both RESTful path and query param
        let id = url.searchParams.get("id");
        if (!id) {
            const parts = url.pathname.split("/");
            // /api/quick-meals/123
            if (parts.length > 3) id = parts[3];
        }

        if (!id) return new Response(JSON.stringify({ error: "ID required" }), { status: 400, headers });

        await quickMealRepo.deleteQuickMeal(userId, id);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
}
