
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";

// ==========================================
// Types
// ==========================================

export interface User {
    id: string;
    username: string;
    passHash: string;
    salt: string;
    role: 'admin' | 'user';
    createdAt: string;
    email?: string;
}

export interface LoginStat {
    userId: string;
    timestamp: string;
    ip: string;
    userAgent: string;
    success: boolean;
}

export interface Session {
    id: string;
    userId: string;
    expiresAt: number;
}

// ==========================================
// Database Logic (Deno KV)
// ==========================================

const kv = await Deno.openKv();

async function createUser(username: string, password: string, email?: string): Promise<User | null> {
    // Check if exists
    const existing = await kv.get(['users_by_username', username]);
    if (existing.value) return null; // Already exists

    const salt = crypto.randomUUID();
    const passHash = await hashPassword(password, salt);

    const user: User = {
        id: crypto.randomUUID(),
        username,
        passHash,
        salt,
        role: 'user', // Default role
        createdAt: new Date().toISOString(),
        email
    };

    // Atomic transaction
    const res = await kv.atomic()
        .set(['users', user.id], user)
        .set(['users_by_username', username], user.id)
        .commit();

    return res.ok ? user : null;
}

async function getUser(username: string): Promise<User | null> {
    const idEntry = await kv.get(['users_by_username', username]);
    if (!idEntry.value) return null;
    const userEntry = await kv.get(['users', idEntry.value as string]);
    return userEntry.value as User;
}

async function getUserById(id: string): Promise<User | null> {
    const entry = await kv.get(['users', id]);
    return entry.value as User;
}

async function createSession(userId: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session: Session = {
        id: sessionId,
        userId,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
    };
    await kv.set(['sessions', sessionId], session);
    return sessionId;
}

async function getSession(sessionId: string): Promise<Session | null> {
    const entry = await kv.get(['sessions', sessionId]);
    const session = entry.value as Session;
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        await kv.delete(['sessions', sessionId]);
        return null;
    }
    return session;
}

async function logLoginAttempt(userId: string, success: boolean, ip: string, userAgent: string) {
    const timestamp = new Date().toISOString();
    const stat: LoginStat = { userId, timestamp, ip, userAgent, success };
    // Key: ['stats', 'logins', userId, timestamp] -> allows easy querying by user
    await kv.set(['stats', 'logins', userId, timestamp], stat);
    // Also global log for admin
    await kv.set(['stats', 'all_logins', timestamp], stat);
}

export async function getUserLoginStats(userId: string) {
    const iter = kv.list({ prefix: ['stats', 'logins', userId] }, { limit: 50, reverse: true });
    const stats: LoginStat[] = [];
    for await (const entry of iter) {
        stats.push(entry.value as LoginStat);
    }
    return stats;
}

export async function getAllUsers() {
    const iter = kv.list({ prefix: ['users'] });
    const users: User[] = [];
    for await (const entry of iter) {
        // Safe user object (no auth data)
        const u = entry.value as User;
        users.push(u);
    }
    return users;
}

// ==========================================
// Crypto Helpers
// ==========================================

async function hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        key,
        256
    );

    return encodeBase64(bits);
}

// ==========================================
// HTTP Server
// ==========================================

export async function startServer(port: number) {
    Deno.serve({ port }, async (req) => {
        const url = new URL(req.url);
        const method = req.method;

        // CORS / Headers
        const headers = new Headers({
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*", // Configure for prod later
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        });

        if (method === "OPTIONS") {
            return new Response(null, { headers });
        }

        // --- AUTH ROUTES ---

        if (url.pathname === "/api/auth/register" && method === "POST") {
            try {
                const body = await req.json();
                if (!body.username || !body.password) throw new Error("Missing fields");

                const user = await createUser(body.username, body.password, body.email);
                if (!user) {
                    return new Response(JSON.stringify({ error: "Username taken" }), { status: 409, headers });
                }

                // Auto-login
                const sessionId = await createSession(user.id);
                return new Response(JSON.stringify({ user: sanitizeUser(user), token: sessionId }), { status: 201, headers });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 400, headers });
            }
        }

        if (url.pathname === "/api/auth/login" && method === "POST") {
            try {
                const body = await req.json();
                const user = await getUser(body.username);
                const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0];
                const ua = req.headers.get("user-agent") || "unknown";

                if (!user) {
                    // Log failed attempt (unknown user? maybe log it differently or ignore)
                    return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
                }

                const hash = await hashPassword(body.password, user.salt);
                if (hash !== user.passHash) {
                    await logLoginAttempt(user.id, false, ip, ua);
                    return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers });
                }

                // Success
                await logLoginAttempt(user.id, true, ip, ua);
                const sessionId = await createSession(user.id);
                return new Response(JSON.stringify({ user: sanitizeUser(user), token: sessionId }), { headers });

            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 400, headers });
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
            // In a real app, middleware auth check here
            const token = req.headers.get("Authorization")?.replace("Bearer ", "");
            if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
            const session = await getSession(token);
            if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

            const stats = await getUserLoginStats(session.userId);
            return new Response(JSON.stringify({ stats }), { headers });
        }

        // --- ADMIN ROUTES ---
        if (url.pathname === "/api/admin/users") {
            // TODO: Add Admin Role Check
            const users = await getAllUsers();
            return new Response(JSON.stringify({ users: users.map(sanitizeUser) }), { headers });
        }

        // --- DATA SYNC ROUTES ---

        if (url.pathname === "/api/data" && method === "GET") {
            const token = req.headers.get("Authorization")?.replace("Bearer ", "");
            if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
            const session = await getSession(token);
            if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

            const data = await getUserData(session.userId);
            return new Response(JSON.stringify(data || {}), { headers });
        }

        if (url.pathname === "/api/data" && method === "POST") {
            const token = req.headers.get("Authorization")?.replace("Bearer ", "");
            if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
            const session = await getSession(token);
            if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

            try {
                const body = await req.json();
                await saveUserData(session.userId, body);
                return new Response(JSON.stringify({ success: true, timestamp: new Date() }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400, headers });
            }
        }

        return new Response("Not Found", { status: 404, headers });
    });
}

// ==========================================
// Data Persistence Helpers
// ==========================================

async function getUserData(userId: string) {
    const entry = await kv.get(['app_data', userId]);
    return entry.value;
}

async function saveUserData(userId: string, data: any) {
    await kv.set(['app_data', userId], data);
}

function sanitizeUser(u: User) {
    const { passHash, salt, ...rest } = u;
    return rest;
}
