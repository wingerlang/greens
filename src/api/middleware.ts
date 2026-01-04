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
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return null;

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
export function hasRole(ctx: AuthContext, role: 'user' | 'admin'): boolean {
    if (role === 'admin') return ctx.user.role === 'admin';
    return true; // Everyone is a user
}
