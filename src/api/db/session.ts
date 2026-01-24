import { kv } from "../kv.ts";

export interface Session {
  id: string;
  userId: string;
  start: string;
  lastSeen: string;
  expires: number;
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  // 30 days
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const now = new Date().toISOString();
  const session: Session = {
    id: sessionId,
    userId,
    start: now,
    lastSeen: now,
    expires,
  };

  const primaryKey = ["sessions", sessionId];
  const userSessionKey = ["user_sessions", userId, sessionId];

  const res = await kv.atomic()
    .set(primaryKey, session)
    .set(userSessionKey, session)
    .commit();

  if (!res.ok) throw new Error("Failed to create session");
  return sessionId;
}

export async function touchSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  // Only update if > 1 minute has passed to reduce writes
  const lastSeenTime = new Date(session.lastSeen).getTime();
  if (Date.now() - lastSeenTime < 60 * 1000) return;

  session.lastSeen = new Date().toISOString();
  session.expires = Date.now() + 1000 * 60 * 60 * 24 * 30; // Extend session

  await kv.atomic()
    .set(["sessions", sessionId], session)
    .set(["user_sessions", session.userId, sessionId], session)
    .commit();
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const res = await kv.get<Session>(["sessions", sessionId]);
  if (!res.value) return null;
  if (Date.now() > res.value.expires) {
    await kv.delete(["sessions", sessionId]);
    // Lazy cleanup of user index not critical here, happens on list
    return null;
  }
  return res.value;
}

export async function getUserSessions(userId: string): Promise<Session[]> {
  const iter = kv.list<Session>({ prefix: ["user_sessions", userId] });
  const sessions: Session[] = [];
  for await (const entry of iter) {
    if (entry.value.expires > Date.now()) {
      sessions.push(entry.value);
    } else {
      // Clean up expired (lazy cleanup)
      kv.atomic()
        .delete(entry.key)
        .delete(["sessions", entry.value.id])
        .commit();
    }
  }
  return sessions;
}

export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  await kv.atomic()
    .delete(["sessions", sessionId])
    .delete(["user_sessions", userId, sessionId])
    .commit();
}

export async function revokeAllUserSessions(
  userId: string,
  keepSessionId?: string,
): Promise<void> {
  const sessions = await getUserSessions(userId);
  let atomic = kv.atomic();
  for (const s of sessions) {
    if (s.id !== keepSessionId) {
      atomic = atomic
        .delete(["sessions", s.id])
        .delete(["user_sessions", userId, s.id]);
    }
  }
  await atomic.commit();
}
export async function getAllSessions(): Promise<Session[]> {
  const iter = kv.list<Session>({ prefix: ["sessions"] });
  const sessions: Session[] = [];
  for await (const entry of iter) {
    if (entry.value.expires > Date.now()) {
      sessions.push(entry.value);
    }
  }
  return sessions;
}
