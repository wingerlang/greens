import { getSession, getUserSessions, revokeAllUserSessions, revokeSession } from "../db/session.ts";
import { getUserById, resetUserData } from "../db/user.ts"; // Note: resetUserData to be moved or imported
import { kv } from "../kv.ts";
import { getUserData, saveUserData } from "../db/data.ts";

async function granularReset(userId: string, type: 'meals' | 'exercises' | 'weight' | 'all') {
    if (type === 'all') {
        const user = await getUserById(userId);
        if (user) {
            await kv.atomic()
                .delete(["users", userId])
                .delete(["user_profiles", userId])
                .delete(["users_by_username", user.username])
                .delete(["users_by_handle", user.handle || ""])
                .commit();
            await revokeAllUserSessions(userId);
        }
        return;
    }

    const data = await getUserData(userId);
    if (!data) return;

    if (type === 'meals') data.mealEntries = [];
    else if (type === 'exercises') {
        data.exerciseEntries = [];
        data.trainingCycles = [];
        data.plannedActivities = [];
    }
    else if (type === 'weight') data.weightEntries = [];

    await saveUserData(userId, data);
}

export async function handleUserRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;

    // Auth Check
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    // Session Management
    if (url.pathname === "/api/user/sessions") {
        if (method === "GET") {
            const sessions = await getUserSessions(session.userId);
            const clientSessions = sessions.map(s => ({
                token: s.id,
                userId: s.userId,
                createdAt: s.start,
                isCurrent: s.id === session.id
            }));
            return new Response(JSON.stringify({ sessions: clientSessions }), { headers });
        }
        if (method === "DELETE") {
            await revokeAllUserSessions(session.userId, session.id);
            return new Response(JSON.stringify({ success: true }), { headers });
        }
    }

    if (url.pathname === "/api/user/profile" && method === "GET") {
        const data = await getUserData(session.userId);
        return new Response(JSON.stringify({
            userId: session.userId,
            settings: data?.userSettings,
            // Add other profile fields if needed by the frontend
        }), { headers });
    }

    if (url.pathname.startsWith("/api/user/sessions/") && method === "DELETE") {
        const tokenToRevoke = url.pathname.split("/").pop();
        if (tokenToRevoke) await revokeSession(tokenToRevoke, session.userId);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Danger Zone
    if (url.pathname === "/api/user/reset" && method === "POST") {
        try {
            const body = await req.json();
            if (!['meals', 'exercises', 'weight', 'all'].includes(body.type)) {
                return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers });
            }
            await granularReset(session.userId, body.type);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message || "Failed" }), { status: 500, headers });
        }
    }

    // Weight logging (specific endpoint)
    if (url.pathname === "/api/user/weight" && method === "POST") {
        try {
            const body = await req.json();
            if (!body.weight || !body.date) throw new Error("Missing weight or date");

            const currentData = await getUserData(session.userId) || { weightEntries: [] };
            const newEntry = {
                id: crypto.randomUUID(),
                weight: Number(body.weight),
                date: body.date,
                createdAt: new Date().toISOString()
            };

            const updatedEntries = [...(currentData.weightEntries || []), newEntry]
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            await saveUserData(session.userId, {
                ...currentData,
                weightEntries: updatedEntries
            });

            return new Response(JSON.stringify({ success: true, entry: newEntry }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400, headers });
        }
    }

    // Weight history (GET)
    if (url.pathname === "/api/user/weight" && method === "GET") {
        try {
            const data = await getUserData(session.userId);
            return new Response(JSON.stringify({ history: data?.weightEntries || [] }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (GET all)
    if (url.pathname === "/api/user/prs" && method === "GET") {
        try {
            const prs: any[] = [];
            const iter = kv.list({ prefix: ['prs', session.userId] });
            for await (const entry of iter) {
                prs.push(entry.value);
            }
            return new Response(JSON.stringify({ prs }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (POST - save)
    if (url.pathname === "/api/user/prs" && method === "POST") {
        try {
            const body = await req.json();
            const { category, time, date, activityId, isManual } = body;
            if (!category || !time) {
                return new Response(JSON.stringify({ error: "Missing category or time" }), { status: 400, headers });
            }
            const pr = {
                category,
                time,
                date: date || new Date().toISOString().split('T')[0],
                activityId: activityId || null,
                isManual: isManual ?? true,
                createdAt: new Date().toISOString()
            };
            await kv.set(['prs', session.userId, category], pr);
            return new Response(JSON.stringify({ success: true, pr }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (Detect)
    if (url.pathname === "/api/user/prs/detect" && method === "GET") {
        try {
            // Simplified detection - return empty for now, can be expanded later
            return new Response(JSON.stringify({ detected: [] }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (DELETE)
    if (url.pathname.startsWith("/api/user/prs/") && method === "DELETE") {
        try {
            const category = decodeURIComponent(url.pathname.split('/').pop() || '');
            await kv.delete(['prs', session.userId, category]);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
