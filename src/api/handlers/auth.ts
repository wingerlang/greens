import { hashPassword } from "../utils/crypto.ts";
import { createUser, getUser, getUserById, sanitizeUser } from "../db/user.ts";
import { createSession, getSession } from "../db/session.ts";
import { logLoginAttempt, getUserLoginStats } from "../db/stats.ts";
import { checkRateLimit } from "../utils/rateLimit.ts";
import { LoginSchema, RegisterSchema } from "../utils/schemas.ts";

export async function handleAuthRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0];

    if (url.pathname === "/api/auth/register" && method === "POST") {
        try {
            const body = await req.json();
            const result = RegisterSchema.safeParse(body);
            if (!result.success) {
                return new Response(JSON.stringify({ error: result.error.issues[0].message }), { status: 400, headers });
            }

            const { username, password, email } = result.data;
            const user = await createUser(username, password, email || undefined);
            if (!user) return new Response(JSON.stringify({ error: "Username taken" }), { status: 409, headers });

            const sessionId = await createSession(user.id);
            return new Response(JSON.stringify({ user: sanitizeUser(user), token: sessionId }), { status: 201, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }
    }

    if (url.pathname === "/api/auth/login" && method === "POST") {
        // Rate limit: 5 attempts per 1 minute
        const isAllowed = await checkRateLimit(ip, 5, 60 * 1000);
        if (!isAllowed) {
            return new Response(JSON.stringify({ error: "Too many login attempts. Please try again later." }), { status: 429, headers });
        }

        try {
            const body = await req.json();
            const result = LoginSchema.safeParse(body);
            if (!result.success) {
                return new Response(JSON.stringify({ error: "Username or password too short" }), { status: 400, headers });
            }

            const { username, password } = result.data;
            const user = await getUser(username);
            const ua = req.headers.get("user-agent") || "unknown";

            if (!user) return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });

            const hash = await hashPassword(password, user.salt);
            if (hash !== user.passHash) {
                await logLoginAttempt(user.id, false, ip, ua);
                return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
            }

            await logLoginAttempt(user.id, true, ip, ua);
            const sessionId = await createSession(user.id);
            return new Response(JSON.stringify({ user: sanitizeUser(user), token: sessionId }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }
    }

    if (url.pathname === "/api/auth/me") {
        const token = req.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

        const session = await getSession(token);
        if (!session) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers });

        const user = await getUserById(session.userId);
        if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

        return new Response(JSON.stringify({ user: sanitizeUser(user) }), { headers });
    }

    if (url.pathname === "/api/auth/stats") {
        const token = req.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
        const session = await getSession(token);
        if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

        const stats = await getUserLoginStats(session.userId);
        return new Response(JSON.stringify({ stats }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
