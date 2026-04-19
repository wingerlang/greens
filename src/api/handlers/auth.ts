import { hashPassword, verifyPassword, simulatePasswordCheck } from "../utils/crypto.ts";
import { createUser, getUser, getUserById, sanitizeUser, saveUser } from "../db/user.ts";
import { createSession, getSession, revokeSession } from "../db/session.ts";
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
            const isSecure = url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
            headers.append("Set-Cookie", `auth_token=${sessionId}; HttpOnly; ${isSecure ? "Secure;" : ""} SameSite=Lax; Path=/; Max-Age=2592000`);
            return new Response(JSON.stringify({ user: sanitizeUser(user) }), { status: 201, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }
    }

    if (url.pathname === "/api/auth/login" && method === "POST") {
        // Rate limit: 10 attempts per 1 minute (increased for dev)
        // Use x-real-ip first (from Guardian), then x-forwarded-for, then fallback
        const clientIp = req.headers.get("x-real-ip")
            || (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()
            || "unknown";

        // Skip rate limiting for localhost/internal requests (e.g., load balancer simulator)
        const isInternal = clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "localhost" || clientIp === "unknown";

        // Skip rate limiting for Guardian Simulator
        const userAgent = req.headers.get("user-agent") || "";
        const isSimulator = userAgent.includes("GuardianSimulator");

        if (!isInternal && !isSimulator) {
            const isAllowed = await checkRateLimit(clientIp, 10, 60 * 1000);
            if (!isAllowed) {
                return new Response(JSON.stringify({ error: "Too many login attempts. Please try again later." }), { status: 429, headers });
            }
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

            if (!user) {
                // Timing attack protection: Simulate work
                await simulatePasswordCheck();
                return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
            }

            const { isValid, needsUpgrade } = await verifyPassword(password, user.salt, user.passHash);

            if (!isValid) {
                await logLoginAttempt(user.id, false, ip, ua);
                return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
            }

            if (needsUpgrade) {
                // Upgrade hash to new standard
                user.passHash = await hashPassword(password, user.salt);
                await saveUser(user);
            }

            await logLoginAttempt(user.id, true, ip, ua);
            const sessionId = await createSession(user.id);
            const isSecure = url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
            headers.append("Set-Cookie", `auth_token=${sessionId}; HttpOnly; ${isSecure ? "Secure;" : ""} SameSite=Lax; Path=/; Max-Age=2592000`);
            return new Response(JSON.stringify({ user: sanitizeUser(user) }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
        }
    }

    if (url.pathname === "/api/auth/logout" && method === "POST") {
        const cookie = req.headers.get("cookie");
        const token = cookie?.split("auth_token=")[1]?.split(";")[0];

        if (token) {
            const session = await getSession(token);
            if (session) {
                await revokeSession(token, session.userId);
            }
        }

        const isSecure = url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
        headers.append("Set-Cookie", `auth_token=; HttpOnly; ${isSecure ? "Secure;" : ""} SameSite=Lax; Path=/; Max-Age=0`);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (url.pathname === "/api/auth/me") {
        let token = req.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token || token === "mock" || token === "null" || token.length < 10) {
            const cookie = req.headers.get("cookie");
            token = cookie?.split("auth_token=")[1]?.split(";")[0];
        }

        if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

        const session = await getSession(token);
        if (!session) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers });

        const user = await getUserById(session.userId);
        if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

        return new Response(JSON.stringify({ user: sanitizeUser(user) }), { headers });
    }

    if (url.pathname === "/api/auth/stats") {
        let token = req.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token || token === "mock" || token === "null" || token.length < 10) {
            const cookie = req.headers.get("cookie");
            token = cookie?.split("auth_token=")[1]?.split(";")[0];
        }

        if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
        const session = await getSession(token);
        if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

        const stats = await getUserLoginStats(session.userId);
        return new Response(JSON.stringify({ stats }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
