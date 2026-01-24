import { getSession, touchSession } from "./db/session.ts";
import { DBUser, getUserById } from "./db/user.ts";
import { logError, logMetric } from "./utils/logger.ts";

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
  await touchSession(session.id).catch(() => {}); // Fire and forget

  const user = await getUserById(session.userId);
  if (!user) return null;

  return { user, token };
}

/**
 * Checks if the user has a specific role.
 */
export function hasRole(
  ctx: AuthContext,
  role: "user" | "admin" | "developer",
): boolean {
  if (role === "developer") return ctx.user.role === "developer";
  if (role === "admin") {
    return ctx.user.role === "admin" || ctx.user.role === "developer";
  }
  return true; // Everyone is a user
}
