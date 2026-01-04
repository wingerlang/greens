import { getSession } from "../db/session.ts";
import { getUserById } from "../db/user.ts";
import { getUserData, saveUserData } from "../db/data.ts";
import { mealRepo } from "../repositories/mealRepository.ts";
import { weightRepo } from "../repositories/weightRepository.ts";
import { foodRepo } from "../repositories/foodRepository.ts";
import { FoodItem } from "../../models/types.ts";
import { measurementRepo } from "../repositories/measurementRepository.ts";

export async function handleDataRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // --- Legacy Monolithic Routes ---
    if (url.pathname === "/api/data" && method === "GET") {
        let targetUserId = userId;
        const requestedUserId = url.searchParams.get("userId");

        if (requestedUserId && requestedUserId !== userId) {
            const user = await getUserById(userId);
            if (user?.role === "admin") {
                targetUserId = requestedUserId;
            } else {
                return new Response(JSON.stringify({ error: "Unauthorized access to other user data" }), { status: 403, headers });
            }
        }

        const data = await getUserData(targetUserId);
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

    if (url.pathname.startsWith("/api/meals/") && method === "PUT") {
        const id = url.pathname.split("/").pop()!;
        const updates = await req.json();

        // 1. Check if updates include the date (required for lookup)
        if (!updates.date) {
            return new Response(JSON.stringify({ error: "Date is required for updates" }), { status: 400, headers });
        }

        // 2. Fetch existing to ensure we don't overwrite with partial data
        const existingList = await mealRepo.getMealsByDate(userId, updates.date);
        const existing = existingList.find(m => m.id === id);

        if (!existing) {
            return new Response(JSON.stringify({ error: "Meal not found" }), { status: 404, headers });
        }

        // 3. Merge and Save
        const merged = { ...existing, ...updates, id }; // Ensure ID matches
        await mealRepo.saveMeal(userId, merged);

        return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (url.pathname.startsWith("/api/meals/") && method === "DELETE") {
        const id = url.pathname.split("/").pop()!;
        // We need the date to delete. Either passed in query param or body.
        // Standard REST DELETE often doesn't have body. Query param is best.
        const date = url.searchParams.get("date");
        if (!date) return new Response(JSON.stringify({ error: "Date required" }), { status: 400, headers });
        await mealRepo.deleteMeal(userId, date, id);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Weight
    if (url.pathname === "/api/weight" && method === "POST") {
        const entry = await req.json();
        await weightRepo.saveWeight(userId, entry);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Measurements
    if (url.pathname === "/api/measurements" && method === "POST") {
        const entry = await req.json();
        await measurementRepo.saveMeasurement(userId, entry);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (url.pathname.startsWith("/api/weight/") && method === "PUT") {
        const id = url.pathname.split("/").pop()!;
        const updates = await req.json();

        // 1. Fetch existing (WeightRepo is simple Key-Value, but key includes date)
        if (!updates.date) {
            return new Response(JSON.stringify({ error: "Date is required" }), { status: 400, headers });
        }

        const history = await weightRepo.getWeightHistory(userId);
        const existing = history.find(w => w.id === id);

        if (!existing) {
            return new Response(JSON.stringify({ error: "Weight entry not found" }), { status: 404, headers });
        }

        const merged = { ...existing, ...updates, id };

        // Edge case: If date changed, we need to delete the old one?
        if (existing.date !== merged.date) {
            await weightRepo.deleteWeight(userId, existing.date, id);
        }

        await weightRepo.saveWeight(userId, merged);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (url.pathname.startsWith("/api/weight/") && method === "DELETE") {
        const id = url.pathname.split("/").pop()!;
        const date = url.searchParams.get("date");
        if (!date) return new Response(JSON.stringify({ error: "Date required" }), { status: 400, headers });
        await weightRepo.deleteWeight(userId, date, id);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Food Database Search
    if (url.pathname === "/api/foods" && method === "GET") {
        const query = url.searchParams.get("q") || "";
        const results = await foodRepo.searchFoods(query);
        return new Response(JSON.stringify(results), { headers });
    }

    // Food Database Create
    if (url.pathname === "/api/foods" && method === "POST") {
        const item = await req.json() as FoodItem;

        // Handle Image Moving (Temp -> Permanent)
        if (item.imageUrl && item.imageUrl.startsWith("uploads/temp/")) {
            const oldPath = item.imageUrl;
            const newPath = oldPath.replace("uploads/temp/", "uploads/food-images/");
            try {
                await Deno.rename(oldPath, newPath);
                item.imageUrl = newPath;
            } catch (e) {
                console.error("Failed to move image:", e);
                // Fallback: keep temp URL or handle error? Keeping temp URL for now to avoid data loss
            }
        }

        await foodRepo.saveFood(item);
        return new Response(JSON.stringify({ success: true, item }), { headers });
    }

    // Food Database Update
    if (url.pathname.startsWith("/api/foods/") && method === "PUT") {
        const id = url.pathname.split("/").pop()!;
        const updates = await req.json() as Partial<FoodItem>;

        const existing = await foodRepo.getFood(id);
        if (!existing) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

        const updatedItem = { ...existing, ...updates };

        // Handle Image Moving
        if (updatedItem.imageUrl && updatedItem.imageUrl.startsWith("uploads/temp/")) {
            const oldPath = updatedItem.imageUrl;
            const newPath = oldPath.replace("uploads/temp/", "uploads/food-images/");
            try {
                await Deno.rename(oldPath, newPath);
                updatedItem.imageUrl = newPath;

                // Delete old image if it existed and was different
                if (existing.imageUrl && existing.imageUrl !== updatedItem.imageUrl && existing.imageUrl.startsWith("uploads/")) {
                    try { await Deno.remove(existing.imageUrl); } catch { }
                }

            } catch (e) {
                console.error("Failed to move image:", e);
            }
        }

        await foodRepo.saveFood(updatedItem);
        return new Response(JSON.stringify({ success: true, item: updatedItem }), { headers });
    }

    // Food Database Delete
    if (url.pathname.startsWith("/api/foods/") && method === "DELETE") {
        const id = url.pathname.split("/").pop()!;
        const existing = await foodRepo.getFood(id);

        if (existing) {
            // Delete image file if exists
            if (existing.imageUrl && existing.imageUrl.startsWith("uploads/")) {
                try {
                    await Deno.remove(existing.imageUrl);
                } catch (e) {
                    console.error("Failed to delete food image:", e);
                }
            }
            await foodRepo.deleteFood(id);
        }

        return new Response(JSON.stringify({ success: true }), { headers });
    }


    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
