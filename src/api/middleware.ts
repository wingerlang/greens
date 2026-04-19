import { getSession, touchSession } from "./db/session.ts";
import { getUserById, DBUser } from "./db/user.ts";
import { logMetric, logError } from "./utils/logger.ts";

export interface AuthContext {
    user: DBUser;
    token: string;
}

/**
 * Validates the Authorization header and returns the authenticated user context.
 */
export async function authenticate(req: Request): Promise<AuthContext | null> {
    let token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token || token === "null" || token === "undefined" || token === "mock" || token.length < 10) {
        const cookie = req.headers.get("cookie");
        token = cookie?.split("auth_token=")[1]?.split(";")[0];
    }

    if (!token || token === "null" || token === "undefined") {
        // console.log("[AUTH] No token found in headers or cookies");
        return null;
    }

    const session = await getSession(token);
    if (!session) return null;

    // Update last seen
    await touchSession(session.id).catch(() => { }); // Fire and forget

    const user = await getUserById(session.userId);
    if (!user) return null;

    return { user, token };
}

/**
 * Checks if the user has a specific role.
 */
export function hasRole(ctx: AuthContext, role: 'user' | 'admin' | 'developer'): boolean {
    if (role === 'developer') return ctx.user.role === 'developer';
    if (role === 'admin') return ctx.user.role === 'admin' || ctx.user.role === 'developer';
    return true; // Everyone is a user
}
