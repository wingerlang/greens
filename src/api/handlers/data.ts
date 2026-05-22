import { getSession } from "../db/session.ts";
import { getUserById } from "../db/user.ts";
import { getUserData, saveUserData } from "../db/data.ts";
import { mealRepo } from "../repositories/mealRepository.ts";
import { activityRepo } from "../repositories/activityRepository.ts";
import { logAudit } from "../utils/audit.ts";
import { MealEntrySchema, WeightEntrySchema } from "../utils/schemas.ts";
import { sanitizeObject } from "../utils/sanitize.ts";
import { weightRepo } from "../repositories/weightRepository.ts";
import { foodRepo } from "../repositories/foodRepository.ts";
import { foodService } from "../services/foodService.ts";
import { FoodItem } from "../../models/types.ts";
import { measurementRepo } from "../repositories/measurementRepository.ts";
import { vitalsRepo } from "../repositories/vitalsRepository.ts";


export async function handleDataRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    let token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token || token === "mock" || token === "null" || token.length < 10) {
        token = req.headers.get("cookie")?.split("auth_token=")[1]?.split(";")[0] || null;
    }
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    if (url.pathname === "/api/data" && method === "GET") {
        let targetUserId = userId;
        const requestedUserId = url.searchParams.get("userId");

        if (requestedUserId && requestedUserId !== userId) {
            // BOLA PROTECTION
            const targetUser = await getUserById(requestedUserId);
            if (!targetUser) {
                return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });
            }

            // Simple BOLA check: Only allow if profile is public or requester is admin
            const requester = await getUserById(userId);
            const isAdmin = requester?.role === 'admin' || requester?.role === 'developer';

            if (!isAdmin && !targetUser.privacy?.isPublic) {
                return new Response(JSON.stringify({ error: "Access denied (Private Profile)" }), { status: 403, headers });
            }
            targetUserId = requestedUserId;
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

    // POST /api/meals
    if (url.pathname === "/api/meals" && method === "POST") {
        try {
            const body = await req.json();
            const result = MealEntrySchema.safeParse(body);
            if (!result.success) {
                return new Response(JSON.stringify({ error: result.error.issues[0].message }), { status: 400, headers });
            }

            let entry = result.data;
            entry = sanitizeObject(entry);

            // Fix createdAt lint by ensuring it's a string
            const mealToSave = {
                ...entry,
                createdAt: entry.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            } as any;

            await mealRepo.saveMeal(userId, mealToSave);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
        }
    }

    // --- Granular Routes ---


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

        // Validation: Ensure required fields exist
        if (typeof entry.weight !== 'number' || !entry.date || !entry.id) {
            console.error('[API] Invalid weight entry payload:', entry);
            return new Response(JSON.stringify({ error: "Invalid weight entry: weight(number), date(string), id(string) required" }), { status: 400, headers });
        }

        await weightRepo.saveWeight(userId, entry);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Measurements
    if (url.pathname === "/api/measurements" && method === "GET") {
        const history = await measurementRepo.getMeasurementHistory(userId);
        return new Response(JSON.stringify({ history }), { headers });
    }

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
        const results = await foodService.searchFoods(query);
        return new Response(JSON.stringify(results), { headers });
    }

    // Food Database Create
    if (url.pathname === "/api/foods" && method === "POST") {
        const item = await req.json() as FoodItem;
        const created = await foodService.createFood(item);
        return new Response(JSON.stringify({ success: true, item: created }), { headers });
    }

    // Food Database Update
    if (url.pathname.startsWith("/api/foods/") && method === "PUT") {
        const id = url.pathname.split("/").pop()!;
        const updates = await req.json() as Partial<FoodItem>;
        const updated = await foodService.updateFood(id, updates);
        if (!updated) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
        return new Response(JSON.stringify({ success: true, item: updated }), { headers });
    }

    // Food Database Delete
    if (url.pathname.startsWith("/api/foods/") && method === "DELETE") {
        const id = url.pathname.split("/").pop()!;
        const deleted = await foodService.deleteFood(id);
        if (!deleted) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
        return new Response(JSON.stringify({ success: true }), { headers });
    }


    // Vitals
    if (url.pathname === "/api/vitals" && method === "POST") {
        try {
            const { date, vitals } = await req.json();
            if (!date || !vitals) {
                return new Response(JSON.stringify({ error: "Date and vitals object required" }), { status: 400, headers });
            }
            await vitalsRepo.saveVitals(userId, date, vitals);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
        }
    }

    // Purchases
    if (url.pathname === "/api/purchases" && method === "POST") {
        try {
            const purchaseLog = await req.json();
            if (!purchaseLog || !purchaseLog.id) {
                return new Response(JSON.stringify({ error: "Invalid purchase log" }), { status: 400, headers });
            }
            
            // Append to user blob
            const userData = await getUserData(userId);
            if (userData) {
                if (!userData.purchaseLogs) userData.purchaseLogs = [];
                userData.purchaseLogs.push(purchaseLog);
                await saveUserData(userId, userData);
            }
            
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
