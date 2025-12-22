
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import * as strava from './strava.ts';

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

        // --- STRAVA INTEGRATION ROUTES ---

        // Get Strava auth URL
        if (url.pathname === "/api/strava/auth" && method === "GET") {
            if (!strava.isStravaConfigured()) {
                return new Response(JSON.stringify({ error: "Strava not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET environment variables." }), { status: 500, headers });
            }
            const state = url.searchParams.get('state') || undefined;
            const authUrl = strava.getStravaAuthUrl(state);
            return new Response(JSON.stringify({ authUrl }), { headers });
        }

        // Handle OAuth callback
        if (url.pathname === "/api/strava/callback" && method === "GET") {
            try {
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');
                const origin = url.origin;

                console.log(`[Strava Callback] code=${code} error=${error} origin=${origin}`);

                if (error) {
                    console.log(`[Strava Callback] Strava error: ${error}`);
                    return Response.redirect(new URL('/profile?strava_error=' + error, origin).toString(), 302);
                }

                if (!code) {
                    return new Response(JSON.stringify({ error: "No authorization code" }), { status: 400, headers });
                }

                console.log(`[Strava Callback] Exchanging code...`);
                const tokens = await strava.exchangeStravaCode(code);
                if (!tokens) {
                    console.log(`[Strava Callback] Token exchange failed`);
                    return Response.redirect(new URL('/profile?strava_error=token_exchange_failed', origin).toString(), 302);
                }

                // Get user from state or session
                const token = req.headers.get("Authorization")?.replace("Bearer ", "") || url.searchParams.get('state');
                console.log(`[Strava Callback] User token/state: ${token}`);
                if (token) {
                    const session = await getSession(token);
                    console.log(`[Strava Callback] Session found: ${!!session}`);
                    if (session) {
                        // Save tokens for this user
                        await saveStravaTokens(session.userId, tokens);
                        console.log(`[Strava Callback] Tokens saved for user: ${session.userId}`);
                    }
                }

                // Redirect to profile with success
                return Response.redirect(new URL('/profile?strava_connected=true', origin).toString(), 302);
            } catch (err) {
                console.error(`[Strava Callback] CRASH:`, err);
                return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), { status: 500, headers });
            }
        }

        // Get Strava connection status
        if (url.pathname === "/api/strava/status" && method === "GET") {
            const token = req.headers.get("Authorization")?.replace("Bearer ", "");
            if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
            const session = await getSession(token);
            if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

            const stravaTokens = await getStravaTokens(session.userId);
            if (!stravaTokens) {
                return new Response(JSON.stringify({ connected: false }), { headers });
            }

            // Check if token is expired and refresh if needed
            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (refreshed) {
                    accessToken = refreshed.accessToken;
                    await saveStravaTokens(session.userId, {
                        ...stravaTokens,
                        accessToken: refreshed.accessToken,
                        refreshToken: refreshed.refreshToken,
                        expiresAt: refreshed.expiresAt,
                    });
                } else {
                    // Token refresh failed, disconnect
                    await deleteStravaTokens(session.userId);
                    return new Response(JSON.stringify({ connected: false, error: "Token expired" }), { headers });
                }
            }

            // Get athlete info
            const athlete = await strava.getStravaAthlete(accessToken);
            const stats = stravaTokens.athleteId ? await strava.getStravaAthleteStats(stravaTokens.athleteId, accessToken) : null;

            return new Response(JSON.stringify({
                connected: true,
                athlete: athlete ? {
                    id: athlete.id,
                    name: `${athlete.firstname} ${athlete.lastname}`,
                    avatar: athlete.profile,
                    city: athlete.city,
                    country: athlete.country,
                    premium: athlete.premium,
                } : null,
                stats: stats ? {
                    allTimeRuns: stats.all_run_totals.count,
                    allTimeRides: stats.all_ride_totals.count,
                    allTimeSwims: stats.all_swim_totals.count,
                    ytdDistance: Math.round((stats.ytd_run_totals.distance + stats.ytd_ride_totals.distance) / 1000),
                } : null,
                lastSync: stravaTokens.lastSync,
            }), { headers });
        }

        // Fetch Strava activities
        if (url.pathname === "/api/strava/activities" && method === "GET") {
            const token = req.headers.get("Authorization")?.replace("Bearer ", "");
            if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
            const session = await getSession(token);
            if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

            const stravaTokens = await getStravaTokens(session.userId);
            if (!stravaTokens) {
                return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });
            }

            // Check/refresh token
            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) {
                    return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                }
                accessToken = refreshed.accessToken;
                await saveStravaTokens(session.userId, {
                    ...stravaTokens,
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken,
                    expiresAt: refreshed.expiresAt,
                });
            }

            // Parse query params
            const after = url.searchParams.get('after') ? parseInt(url.searchParams.get('after')!) : undefined;
            const before = url.searchParams.get('before') ? parseInt(url.searchParams.get('before')!) : undefined;
            const page = parseInt(url.searchParams.get('page') || '1');

            const activities = await strava.getStravaActivities(accessToken, { after, before, page, perPage: 50 });
            const mapped = activities.map(strava.mapStravaActivityToExercise);

            // Update last sync time
            await saveStravaTokens(session.userId, { ...stravaTokens, lastSync: new Date().toISOString() });

            return new Response(JSON.stringify({
                activities: mapped,
                count: mapped.length,
            }), { headers });
        }

        // Disconnect Strava
        if (url.pathname === "/api/strava/disconnect" && method === "POST") {
            const token = req.headers.get("Authorization")?.replace("Bearer ", "");
            if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
            const session = await getSession(token);
            if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

            await deleteStravaTokens(session.userId);
            return new Response(JSON.stringify({ success: true }), { headers });
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

// ==========================================
// Strava Token Storage
// ==========================================

interface StoredStravaTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    athleteId: number;
    athleteName: string;
    lastSync?: string;
}

async function saveStravaTokens(userId: string, tokens: StoredStravaTokens) {
    await kv.set(['strava_tokens', userId], tokens);
}

async function getStravaTokens(userId: string): Promise<StoredStravaTokens | null> {
    const entry = await kv.get(['strava_tokens', userId]);
    return entry.value as StoredStravaTokens | null;
}

async function deleteStravaTokens(userId: string) {
    await kv.delete(['strava_tokens', userId]);
}
