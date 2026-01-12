import { getSession } from "../db/session.ts";
import { exerciseEntryRepo } from "../repositories/exerciseEntryRepository.ts";
import { ExerciseEntry } from "../../models/types.ts";

export async function handleExerciseEntryRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // GET /api/exercise-entries?start=...&end=...
    if (method === "GET") {
        const start = url.searchParams.get("start") || "2000-01-01";
        const end = url.searchParams.get("end") || "2099-12-31";
        const entries = await exerciseEntryRepo.getEntriesInRange(userId, start, end);
        return new Response(JSON.stringify({ entries }), { headers });
    }

    // POST /api/exercise-entries
    if (method === "POST") {
        try {
            const entry = await req.json() as ExerciseEntry;
            if (!entry.id || !entry.date) return new Response(JSON.stringify({ error: "ID and Date required" }), { status: 400, headers });

            await exerciseEntryRepo.saveEntry(userId, entry);
            return new Response(JSON.stringify({ success: true, entry }), { headers });
        } catch (e) {
            console.error("Exercise entry create error:", e);
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
        }
    }

    // PUT /api/exercise-entries/:id
    if (method === "PUT") {
        try {
            const pathParts = url.pathname.split("/");
            const id = pathParts[pathParts.length - 1];
            const updates = await req.json() as Partial<ExerciseEntry>;

            // We need the date to find the old entry if date is changing, or just to key it.
            // If date is changing, we must delete old and create new.
            // Current client usually sends full object or we might need to look it up.
            // But lookups by ID across all time are expensive if we don't know the date.
            // So we require `date` in the payload (old date) if not provided in updates?

            // Simplification: We assume the client knows the date.
            if (!updates.date) return new Response(JSON.stringify({ error: "Date required for update" }), { status: 400, headers });

            // If we are strictly updating an ID, we might just overwrite.
            // Ideally we check if it exists.
            const existingList = await exerciseEntryRepo.getEntriesByDate(userId, updates.date);
            const existing = existingList.find(e => e.id === id);

            if (!existing) return new Response(JSON.stringify({ error: "Entry not found" }), { status: 404, headers });

            const updated = { ...existing, ...updates, id }; // Ensure ID matches
            await exerciseEntryRepo.saveEntry(userId, updated);

            return new Response(JSON.stringify({ success: true, entry: updated }), { headers });
        } catch (e) {
            console.error("Exercise entry update error:", e);
            return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
        }
    }

    // DELETE /api/exercise-entries/:id?date=YYYY-MM-DD
    if (method === "DELETE") {
        const pathParts = url.pathname.split("/");
        const id = pathParts[pathParts.length - 1];
        const date = url.searchParams.get("date");

        if (!date) return new Response(JSON.stringify({ error: "Date required" }), { status: 400, headers });

        await exerciseEntryRepo.deleteEntry(userId, date, id);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
