import { getAllUsers, sanitizeUser, getUserById, saveUser } from "../db/user.ts";
import { getAllSessions } from "../db/session.ts";
import { authenticate, hasRole } from "../middleware.ts";

export async function handleAdminRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const ctx = await authenticate(req);
    if (!ctx || !hasRole(ctx, 'admin')) {
        return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), { status: 403, headers });
    }

    if (url.pathname === "/api/admin/users") {
        const users = await getAllUsers();
        const sessions = await getAllSessions();
        const now = Date.now();
        const onlineUserIds = new Set(sessions
            .filter(s => {
                const lastSeen = s.lastSeen ? new Date(s.lastSeen).getTime() : new Date(s.start).getTime();
                return now - lastSeen < 5 * 60 * 1000;
            })
            .map(s => s.userId)
        );

        const usersWithStatus = users.map(u => ({
            ...sanitizeUser(u),
            isOnline: onlineUserIds.has(u.id)
        }));

        return new Response(JSON.stringify({ users: usersWithStatus }), { headers });
    }

    if (url.pathname === "/api/admin/sessions") {
        const sessions = await getAllSessions();
        return new Response(JSON.stringify({ sessions }), { headers });
    }

    // Update User Role
    if (url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/role") && req.method === "PATCH") {
        try {
            const userId = url.pathname.split("/")[4]; // /api/admin/users/:id/role
            const body = await req.json();

            if (!['user', 'admin'].includes(body.role)) {
                return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400, headers });
            }

            // Perform update using saveUser from db/user (need to import)
            const user = await getUserById(userId);
            if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            user.role = body.role;
            await saveUser(user);

            return new Response(JSON.stringify({ success: true, user: sanitizeUser(user) }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}

