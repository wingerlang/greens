import { getAllUsers, sanitizeUser, getUserById, saveUser } from "../db/user.ts";
import { getAllSessions } from "../db/session.ts";
import { authenticate, hasRole } from "../middleware.ts";
import { getErrorLogs, getMetrics } from "../utils/logger.ts";
import { kv } from "../kv.ts";

export async function handleAdminRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const ctx = await authenticate(req);
    if (!ctx || !hasRole(ctx, 'admin')) {
        return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), { status: 403, headers });
    }

    if (url.pathname === "/api/admin/health") {
        const memory = Deno.memoryUsage();
        const system = {
            denoVersion: Deno.version,
            memory: {
                rss: Math.round(memory.rss / 1024 / 1024) + " MB",
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + " MB",
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + " MB",
            },
            pid: Deno.pid,
            uptime: Math.round(performance.now() / 1000) + " s",
            // Approx KV check
            kvStatus: "connected" // Implicit if we are here
        };
        return new Response(JSON.stringify(system), { headers });
    }

    if (url.pathname === "/api/admin/logs") {
        const logs = await getErrorLogs(100);
        return new Response(JSON.stringify({ logs }), { headers });
    }

    if (url.pathname === "/api/admin/metrics") {
        const responseTimes = await getMetrics("response_time", 500);
        const reqCounts = await getMetrics("request_count", 500);

        // Simple aggregation
        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((acc, curr) => acc + curr.value, 0) / responseTimes.length
            : 0;

        return new Response(JSON.stringify({
            metrics: {
                avgResponseTime,
                totalRequestsLogged: reqCounts.length,
                recentResponseTimes: responseTimes.slice(0, 50)
            }
        }), { headers });
    }

    if (url.pathname === "/api/admin/database") {
        // Count keys (approx)
        let keyCount = 0;
        for await (const _entry of kv.list({ prefix: [] })) {
            keyCount++;
        }
        return new Response(JSON.stringify({ keyCount }), { headers });
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

    // Delete User (Admin only)
    if (url.pathname.startsWith("/api/admin/users/") && !url.pathname.endsWith("/role") && req.method === "DELETE") {
        try {
            const userId = url.pathname.split("/")[4]; // /api/admin/users/:id

            // Prevent self-deletion
            if (userId === ctx.user.id) {
                return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400, headers });
            }

            const user = await getUserById(userId);
            if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // Import the KV and data functions
            const { kv } = await import("../kv.ts");
            const { revokeAllUserSessions } = await import("../db/session.ts");

            // Delete all user data
            await kv.atomic()
                .delete(["users", userId])
                .delete(["user_data", userId])
                .delete(["user_profiles", userId])
                .delete(["users_by_username", user.username])
                .delete(["users_by_handle", user.handle || ""])
                .commit();

            // Also revoke all sessions
            await revokeAllUserSessions(userId);

            // Delete strength data
            const strengthIter = kv.list({ prefix: ["strength_sessions", userId] });
            for await (const entry of strengthIter) {
                await kv.delete(entry.key);
            }

            // Delete activities
            const activityIter = kv.list({ prefix: ["activities", userId] });
            for await (const entry of activityIter) {
                await kv.delete(entry.key);
            }

            // Delete PRs
            const prIter = kv.list({ prefix: ["prs", userId] });
            for await (const entry of prIter) {
                await kv.delete(entry.key);
            }

            console.log(`[Admin] Deleted user ${user.username} (${userId}) and all their data`);

            return new Response(JSON.stringify({ success: true, deleted: user.username }), { headers });
        } catch (e) {
            console.error("[Admin] Delete user error:", e);
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}

