import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import * as strava from './strava.ts';
import { activityRepo } from './repositories/activityRepository.ts';
import { UniversalActivity } from '../models/types.ts';
import { reconciliationService } from './services/reconciliationService.ts';

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

// ==========================================
// Database Logic (Deno KV)
// ==========================================

import { kv } from './kv.ts';

// const kv = await Deno.openKv(); // REPLACED with shared instance

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

            // Update last sync time - REMOVED to prevent breaking the Sync logic
            // await saveStravaTokens(session.userId, { ...stravaTokens, lastSync: new Date().toISOString() });

            return new Response(JSON.stringify({
                activities: mapped,
                count: mapped.length,
            }), { headers });
        }

        // --- ACTIVITY ROUTES (Universal Model) ---

        // GET /api/activities?start=2024-01-01&end=2024-01-31
        if (url.pathname === "/api/activities" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const startDate = url.searchParams.get('start');
                const endDate = url.searchParams.get('end');

                if (!startDate || !endDate) {
                    return new Response(JSON.stringify({ error: "Missing start/end date params" }), { status: 400, headers });
                }

                const activities = await activityRepo.getActivitiesByDateRange(session.userId, startDate, endDate);
                return new Response(JSON.stringify({ activities }), { headers });
            } catch (e) {
                console.error("GET /api/activities error:", e);
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
            }
        }

        // POST /api/activities (Create/Update)
        if (url.pathname === "/api/activities" && method === "POST") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const activity = await req.json() as UniversalActivity;

                // Security check: Ensure userId matches session
                if (activity.userId !== session.userId) {
                    return new Response(JSON.stringify({ error: "UserId mismatch" }), { status: 403, headers });
                }

                await activityRepo.saveActivity(activity);
                return new Response(JSON.stringify({ success: true, id: activity.id }), { status: 200, headers });
            } catch (e) {
                console.error("POST /api/activities error:", e);
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
            }
        }

        // DELETE /api/activities/:id/:date
        // Note: We need the date for the key, so pass it in query or path
        // url pattern: /api/activities/123?date=2024-01-01
        if (url.pathname.startsWith("/api/activities/") && method === "DELETE") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const parts = url.pathname.split('/');
                const activityId = parts[3];
                const date = url.searchParams.get('date');

                if (!activityId || !date) {
                    return new Response(JSON.stringify({ error: "Missing ID or Date" }), { status: 400, headers });
                }

                // Verify ownership before delete
                const activity = await activityRepo.getActivity(session.userId, date, activityId);
                if (!activity) {
                    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
                }

                await activityRepo.deleteActivity(activity);
                return new Response(JSON.stringify({ success: true }), { status: 200, headers });

            } catch (e) {
                console.error("DELETE /api/activities error:", e);
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
            }
        }

        // Sync Strava Activities (Trigger Reconciliation)
        if (url.pathname === "/api/strava/sync" && method === "POST") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const stravaTokens = await getStravaTokens(session.userId);
                if (!stravaTokens) {
                    return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });
                }

                // Check/refresh token (reuse logic? ideally extract into helper)
                let accessToken = stravaTokens.accessToken;
                if (Date.now() > stravaTokens.expiresAt) {
                    const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                    if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                    accessToken = refreshed.accessToken;
                    await saveStravaTokens(session.userId, {
                        ...stravaTokens,
                        accessToken: refreshed.accessToken,
                        refreshToken: refreshed.refreshToken,
                        expiresAt: refreshed.expiresAt
                    });
                }

                // Fetch last 30 activities (or use 'after' param based on lastSync)
                // If ?full=true is passed, we ignore lastSync to force a full re-scan
                const fullSync = url.searchParams.get('full') === 'true';
                const lastSyncDate = (!fullSync && stravaTokens.lastSync) ? new Date(stravaTokens.lastSync).getTime() / 1000 : undefined;

                // Fetch from Strava
                const activities = await strava.getStravaActivities(accessToken, {
                    after: lastSyncDate,
                    perPage: 30
                });

                // Reconcile
                const result = await reconciliationService.reconcileStravaActivities(session.userId, activities);

                // Update last sync
                await saveStravaTokens(session.userId, { ...stravaTokens, lastSync: new Date().toISOString() });

                return new Response(JSON.stringify({ success: true, result }), { headers });

            } catch (e) {
                console.error("POST /api/strava/sync error:", e);
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
            }
        }

        // ==========================================
        // Social API Routes 🌍
        // ==========================================

        // POST /api/social/follow/:targetId
        if (url.pathname.startsWith("/api/social/follow/") && method === "POST") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const targetId = url.pathname.split('/').pop();
                if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });

                await SocialRepository.followUser(session.userId, targetId);
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // POST /api/social/unfollow/:targetId
        if (url.pathname.startsWith("/api/social/unfollow/") && method === "POST") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const targetId = url.pathname.split('/').pop();
                if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });

                await SocialRepository.unfollowUser(session.userId, targetId);
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/u/:handle (Public Profile)
        if (url.pathname.startsWith("/api/u/") && method === "GET") {
            try {
                const handle = url.pathname.split('/api/u/')[1].toLowerCase();
                const userId = await SocialRepository.getUserIdByHandle(handle);

                if (!userId) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

                const user = await getUser(userId);
                if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

                // Construct Safe Public Profile adhering to privacy
                const privacy = user.privacy || { isPublic: true, allowFollowers: true, showWeight: false, showAge: false, showHeight: false, showDetailedTraining: false, showSleep: false, showCalories: false, showNutrition: false, showRunning: true, showLifting: true }; // Should use Default but locally defined here

                const publicProfile: Partial<User> & { isFollowing?: boolean } = {
                    id: user.id,
                    name: user.name,
                    handle: user.handle,
                    bio: user.bio,
                    location: user.location,
                    avatarUrl: user.avatarUrl,
                    privacy: user.privacy,
                    followersCount: user.followersCount || 0,
                    followingCount: user.followingCount || 0,
                    createdAt: user.createdAt,

                    // Conditionally included fields based on privacy
                    settings: {
                        ...user.settings,
                        // Mask settings if needed or just don't send full settings
                    } as UserSettings
                };

                // If the viewing user is authenticated, we could check "isFollowing" here, but for now client does it separately or we parse token if present.
                // Let's keep it simple: Public profile returns safe user object.

                return new Response(JSON.stringify(publicProfile), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }


        // GET /api/social/is-following/:targetId
        if (url.pathname.startsWith("/api/social/is-following/") && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ isFollowing: false }), { status: 200, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const targetId = url.pathname.split('/').pop();
                if (!targetId) return new Response(JSON.stringify({ error: "Missing target ID" }), { status: 400, headers });

                const isFollowing = await SocialRepository.isFollowing(session.userId, targetId);
                return new Response(JSON.stringify({ isFollowing }), { status: 200, headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }


        // ==========================================
        // User Profile API Routes 👤
        // ==========================================

        // GET /api/user/profile - Get current user's full profile
        if (url.pathname === "/api/user/profile" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const user = await getUserById(session.userId);
                if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

                const profile = await getUserProfile(session.userId);
                return new Response(JSON.stringify({
                    ...sanitizeUser(user),
                    ...profile,
                    streak: await calculateStreak(session.userId)
                }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // PATCH /api/user/profile - Update profile fields
        if (url.pathname === "/api/user/profile" && method === "PATCH") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const body = await req.json();
                const allowedFields = ['name', 'bio', 'location', 'handle', 'birthdate', 'avatarUrl', 'website', 'phone'];
                const updates: Record<string, any> = {};

                for (const field of allowedFields) {
                    if (body[field] !== undefined) {
                        updates[field] = body[field];
                    }
                }

                // Handle uniqueness check
                if (updates.handle) {
                    const existingUser = await kv.get(['users_by_handle', updates.handle.toLowerCase()]);
                    if (existingUser.value && existingUser.value !== session.userId) {
                        return new Response(JSON.stringify({ error: "Handle taken" }), { status: 409, headers });
                    }
                    // Reserve handle
                    await kv.set(['users_by_handle', updates.handle.toLowerCase()], session.userId);
                }

                await updateUserProfile(session.userId, updates);
                return new Response(JSON.stringify({ success: true, ...updates }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/user/check-handle/:handle - Check if handle is available
        if (url.pathname.startsWith("/api/user/check-handle/") && method === "GET") {
            try {
                const handle = url.pathname.split('/').pop()?.toLowerCase();
                if (!handle || handle.length < 3) {
                    return new Response(JSON.stringify({ available: false, reason: "Too short" }), { headers });
                }
                if (!/^[a-z0-9_]+$/.test(handle)) {
                    return new Response(JSON.stringify({ available: false, reason: "Invalid characters" }), { headers });
                }

                const existing = await kv.get(['users_by_handle', handle]);
                const available = !existing.value;
                return new Response(JSON.stringify({ available, handle }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // PATCH /api/user/privacy - Update privacy settings
        if (url.pathname === "/api/user/privacy" && method === "PATCH") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const body = await req.json();
                const profile = await getUserProfile(session.userId);
                const newPrivacy = { ...(profile?.privacy || {}), ...body };

                await updateUserProfile(session.userId, { privacy: newPrivacy });
                return new Response(JSON.stringify({ success: true, privacy: newPrivacy }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/user/streak - Get current streak
        if (url.pathname === "/api/user/streak" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const streak = await calculateStreak(session.userId);
                return new Response(JSON.stringify({ streak }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // ==========================================
        // Weight History & Data Export API 📊
        // ==========================================

        // POST /api/user/weight - Log a weight entry
        if (url.pathname === "/api/user/weight" && method === "POST") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const body = await req.json();
                const weight = Number(body.weight);
                const date = body.date || new Date().toISOString().split('T')[0];

                if (!weight || weight < 20 || weight > 500) {
                    return new Response(JSON.stringify({ error: "Invalid weight" }), { status: 400, headers });
                }

                await kv.set(['weight_history', session.userId, date], { weight, date, timestamp: Date.now() });
                return new Response(JSON.stringify({ success: true, weight, date }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/user/weight - Get weight history
        if (url.pathname === "/api/user/weight" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const entries: { weight: number, date: string }[] = [];
                const iter = kv.list({ prefix: ['weight_history', session.userId] }, { limit: 365 });
                for await (const entry of iter) {
                    entries.push(entry.value as { weight: number, date: string });
                }
                entries.sort((a, b) => a.date.localeCompare(b.date));
                return new Response(JSON.stringify({ history: entries }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/user/export - Export all user data as JSON
        if (url.pathname === "/api/user/export" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const user = await getUserById(session.userId);
                const profile = await getUserProfile(session.userId);

                // Get weight history
                const weightHistory: any[] = [];
                const weightIter = kv.list({ prefix: ['weight_history', session.userId] });
                for await (const entry of weightIter) weightHistory.push(entry.value);

                // Get activities
                const activities: any[] = [];
                const actIter = kv.list({ prefix: ['activities', session.userId] });
                for await (const entry of actIter) activities.push(entry.value);

                // Get PRs
                const prs = await getUserPRs(session.userId);

                // Get app data
                const appData = await getUserData(session.userId);

                const exportData = {
                    exportedAt: new Date().toISOString(),
                    user: user ? sanitizeUser(user) : null,
                    profile,
                    weightHistory,
                    activities,
                    personalRecords: prs,
                    appData
                };

                return new Response(JSON.stringify(exportData, null, 2), {
                    headers: {
                        ...Object.fromEntries(headers.entries()),
                        'Content-Disposition': 'attachment; filename="greens-export.json"'
                    }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // ==========================================
        // Personal Records (PR) API 🏆
        // ==========================================

        // GET /api/user/prs - Get all PRs
        if (url.pathname === "/api/user/prs" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const prs = await getUserPRs(session.userId);
                return new Response(JSON.stringify({ prs }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/user/prs/detect - Detect potential PRs from activities
        if (url.pathname === "/api/user/prs/detect" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const detected = await detectPotentialPRs(session.userId);
                return new Response(JSON.stringify({ detected }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // POST /api/user/prs - Save a PR (manual or approved)
        if (url.pathname === "/api/user/prs" && method === "POST") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const body = await req.json();
                const { category, time, date, activityId, isManual } = body;

                if (!category || !time) {
                    return new Response(JSON.stringify({ error: "Missing category or time" }), { status: 400, headers });
                }

                const pr = {
                    category,
                    time,
                    date: date || new Date().toISOString().split('T')[0],
                    activityId: activityId || null,
                    isManual: isManual ?? true,
                    createdAt: new Date().toISOString()
                };

                await kv.set(['prs', session.userId, category], pr);
                return new Response(JSON.stringify({ success: true, pr }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // DELETE /api/user/prs/:category - Delete a PR
        if (url.pathname.startsWith("/api/user/prs/") && method === "DELETE") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const category = decodeURIComponent(url.pathname.split('/').pop() || '');
                await kv.delete(['prs', session.userId, category]);
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // ==========================================
        // HR Zone Detection & Activity Stats 💓
        // ==========================================

        // GET /api/user/hr-zones/detect - Auto-detect HR zones from activities
        if (url.pathname === "/api/user/hr-zones/detect" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const detected = await detectHRZones(session.userId);
                return new Response(JSON.stringify(detected), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // POST /api/user/hr-zones - Save HR zones
        if (url.pathname === "/api/user/hr-zones" && method === "POST") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const body = await req.json();
                await kv.set(['hr_zones', session.userId], { ...body, savedAt: new Date().toISOString() });
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/user/hr-zones - Get saved HR zones
        if (url.pathname === "/api/user/hr-zones" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const entry = await kv.get(['hr_zones', session.userId]);
                return new Response(JSON.stringify(entry.value || null), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // GET /api/user/stats - Get activity statistics (weekly/monthly/yearly)
        if (url.pathname === "/api/user/stats" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const stats = await calculateActivityStats(session.userId);
                return new Response(JSON.stringify(stats), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }
        // ==========================================
        // Notification Settings 🔔
        // ==========================================

        // GET /api/user/notifications - Get notification settings
        if (url.pathname === "/api/user/notifications" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const entry = await kv.get(['notifications', session.userId]);
                const defaults = {
                    emailDigest: true,
                    pushWorkouts: true,
                    pushGoals: true,
                    pushSocial: false,
                    pushReminders: true,
                    weeklyReport: true,
                    marketingEmails: false
                };
                return new Response(JSON.stringify(entry.value || defaults), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // PATCH /api/user/notifications - Update notification settings
        if (url.pathname === "/api/user/notifications" && method === "PATCH") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const body = await req.json();
                const current = (await kv.get(['notifications', session.userId])).value || {};
                const updated = { ...current, ...body, updatedAt: new Date().toISOString() };
                await kv.set(['notifications', session.userId], updated);
                return new Response(JSON.stringify(updated), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // ==========================================
        // Session Management 📱
        // ==========================================

        // GET /api/user/sessions - Get all active sessions
        if (url.pathname === "/api/user/sessions" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const sessions = await getUserSessions(session.userId);
                // Mark current session
                const sessionsWithCurrent = sessions.map(s => ({
                    ...s,
                    isCurrent: s.token === token
                }));
                return new Response(JSON.stringify({ sessions: sessionsWithCurrent }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // DELETE /api/user/sessions/:sessionId - Revoke a session
        if (url.pathname.startsWith("/api/user/sessions/") && method === "DELETE") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const sessionId = url.pathname.split('/').pop() || '';
                await revokeSession(session.userId, sessionId);
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // DELETE /api/user/sessions - Revoke all other sessions
        if (url.pathname === "/api/user/sessions" && method === "DELETE") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                await revokeAllSessionsExcept(session.userId, token);
                return new Response(JSON.stringify({ success: true }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
            }
        }

        // ==========================================
        // Social Counts 👥
        // ==========================================

        // GET /api/user/social-counts - Get follower/following counts
        if (url.pathname === "/api/user/social-counts" && method === "GET") {
            try {
                const token = req.headers.get("Authorization")?.replace("Bearer ", "");
                if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
                const session = await getSession(token);
                if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

                const counts = await getSocialCounts(session.userId);
                return new Response(JSON.stringify(counts), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
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

// ==========================================
// User Profile Storage
// ==========================================

interface UserProfile {
    name?: string;
    bio?: string;
    location?: string;
    handle?: string;
    birthdate?: string;
    avatarUrl?: string;
    website?: string;
    phone?: string;
    privacy?: {
        isPublic?: boolean;
        allowFollowers?: boolean;
        showWeight?: boolean;
        showAge?: boolean;
        showCalories?: boolean;
        showDetailedTraining?: boolean;
        showSleep?: boolean;
    };
}

async function getUserProfile(userId: string): Promise<UserProfile | null> {
    const entry = await kv.get(['user_profiles', userId]);
    return entry.value as UserProfile | null;
}

async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
    const existing = await getUserProfile(userId) || {};
    const merged = { ...existing, ...updates };
    await kv.set(['user_profiles', userId], merged);
}

// ==========================================
// Streak Calculation
// ==========================================

async function calculateStreak(userId: string): Promise<number> {
    // Get all activities for user, sorted by date desc
    const activities: { date: string }[] = [];
    const iter = kv.list({ prefix: ['activities', userId] }, { limit: 365, reverse: true });

    for await (const entry of iter) {
        const activity = entry.value as { date: string };
        if (activity?.date) {
            activities.push(activity);
        }
    }

    if (activities.length === 0) return 0;

    // Get unique dates
    const uniqueDates = [...new Set(activities.map(a => a.date.split('T')[0]))].sort().reverse();

    // Calculate consecutive days from today
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDates.length; i++) {
        const activityDate = new Date(uniqueDates[i]);
        activityDate.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);

        if (activityDate.getTime() === expectedDate.getTime()) {
            streak++;
        } else if (activityDate.getTime() === expectedDate.getTime() - 86400000) {
            // Allow 1 day gap for "yesterday" on first check
            if (i === 0) {
                streak++;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    return streak;
}

// ==========================================
// Personal Records (PR) Helpers
// ==========================================

interface PersonalRecord {
    category: string;
    time: string;
    date: string;
    activityId?: string | null;
    isManual: boolean;
    createdAt: string;
}

async function getUserPRs(userId: string): Promise<PersonalRecord[]> {
    const prs: PersonalRecord[] = [];
    const iter = kv.list({ prefix: ['prs', userId] });
    for await (const entry of iter) {
        prs.push(entry.value as PersonalRecord);
    }
    return prs;
}

// PR categories and distance thresholds in meters
const PR_CATEGORIES = [
    { name: '1 km', distance: 1000, tolerance: 100 },
    { name: '5 km', distance: 5000, tolerance: 250 },
    { name: '10 km', distance: 10000, tolerance: 500 },
    { name: 'Halvmarathon', distance: 21097, tolerance: 500 },
    { name: 'Marathon', distance: 42195, tolerance: 1000 },
];

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseDuration(time: string): number {
    const parts = time.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0] * 60 + (parts[1] || 0);
}

interface DetectedPR {
    category: string;
    time: string;
    timeSeconds: number;
    date: string;
    activityId: string;
    activityName: string;
    isBetterThanCurrent: boolean;
    currentTime?: string;
}

async function detectPotentialPRs(userId: string): Promise<DetectedPR[]> {
    // Get current PRs
    const currentPRs = await getUserPRs(userId);
    const prMap = new Map(currentPRs.map(pr => [pr.category, pr]));

    // Get all running activities
    const activities: any[] = [];
    const iter = kv.list({ prefix: ['activities', userId] }, { limit: 1000 });
    for await (const entry of iter) {
        const act = entry.value as any;
        // Only consider running activities with distance and time
        if (act && act.type === 'Run' && act.distance && act.duration) {
            activities.push(act);
        }
    }

    const detected: DetectedPR[] = [];

    for (const act of activities) {
        const distance = act.distance; // in meters
        const duration = act.duration; // in seconds

        for (const cat of PR_CATEGORIES) {
            // Check if activity distance matches this category
            if (Math.abs(distance - cat.distance) <= cat.tolerance) {
                const timeStr = formatDuration(duration);
                const timeSeconds = duration;

                const currentPR = prMap.get(cat.name);
                let isBetter = true;

                if (currentPR) {
                    const currentSeconds = parseDuration(currentPR.time);
                    isBetter = timeSeconds < currentSeconds;
                }

                // Only add if it's better or there's no current PR
                if (isBetter || !currentPR) {
                    // Check if we already have a better one detected
                    const existing = detected.find(d => d.category === cat.name);
                    if (!existing || timeSeconds < existing.timeSeconds) {
                        // Remove existing if any
                        const idx = detected.findIndex(d => d.category === cat.name);
                        if (idx >= 0) detected.splice(idx, 1);

                        detected.push({
                            category: cat.name,
                            time: timeStr,
                            timeSeconds,
                            date: act.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                            activityId: act.id || '',
                            activityName: act.name || `Run on ${act.date}`,
                            isBetterThanCurrent: isBetter && !!currentPR,
                            currentTime: currentPR?.time
                        });
                    }
                }
            }
        }
    }

    // Sort by distance (category order)
    detected.sort((a, b) => {
        const aIdx = PR_CATEGORIES.findIndex(c => c.name === a.category);
        const bIdx = PR_CATEGORIES.findIndex(c => c.name === b.category);
        return aIdx - bIdx;
    });

    return detected;
}

// ==========================================
// HR Zone Detection from Activities
// ==========================================

interface HRZoneDetection {
    maxHR: number;
    maxHRActivity: { name: string, date: string } | null;
    estimatedRestingHR: number;
    estimatedLTHR: number;
    zones: {
        zone1: { min: number, max: number, name: string };
        zone2: { min: number, max: number, name: string };
        zone3: { min: number, max: number, name: string };
        zone4: { min: number, max: number, name: string };
        zone5: { min: number, max: number, name: string };
    };
    activitiesAnalyzed: number;
    confidence: 'low' | 'medium' | 'high';
}

async function detectHRZones(userId: string): Promise<HRZoneDetection> {
    const activities: any[] = [];
    const iter = kv.list({ prefix: ['activities', userId] }, { limit: 500 });

    for await (const entry of iter) {
        const act = entry.value as any;
        if (act && (act.maxHeartrate || act.averageHeartrate)) {
            activities.push(act);
        }
    }

    if (activities.length === 0) {
        // Default zones based on age-estimated max HR (assume age 30)
        const defaultMax = 190;
        return generateZones(defaultMax, 60, null, 0, 'low');
    }

    // Find max HR across all activities
    let maxHR = 0;
    let maxHRActivity: { name: string, date: string } | null = null;

    for (const act of activities) {
        const actMax = act.maxHeartrate || 0;
        if (actMax > maxHR) {
            maxHR = actMax;
            maxHRActivity = { name: act.name || 'Unknown', date: act.date || '' };
        }
    }

    // Estimate resting HR from lowest average HR in easy activities
    const avgHRs = activities
        .filter(a => a.averageHeartrate && a.averageHeartrate > 40)
        .map(a => a.averageHeartrate)
        .sort((a, b) => a - b);

    // Estimate resting HR as ~60% of lowest observed average (rough estimate)
    const lowestAvgHR = avgHRs[0] || 120;
    const estimatedRestingHR = Math.max(40, Math.round(lowestAvgHR * 0.5));

    // Estimate LTHR (typically 85-90% of max HR)
    const estimatedLTHR = Math.round(maxHR * 0.88);

    const confidence = activities.length >= 20 ? 'high' : activities.length >= 5 ? 'medium' : 'low';

    return generateZones(maxHR, estimatedRestingHR, maxHRActivity, activities.length, confidence);
}

function generateZones(
    maxHR: number,
    restingHR: number,
    maxHRActivity: { name: string, date: string } | null,
    activitiesAnalyzed: number,
    confidence: 'low' | 'medium' | 'high'
): HRZoneDetection {
    // Using Karvonen formula: Target HR = ((Max HR - Resting HR) × %Intensity) + Resting HR
    // But simplified using % of max HR for zone boundaries

    return {
        maxHR,
        maxHRActivity,
        estimatedRestingHR: restingHR,
        estimatedLTHR: Math.round(maxHR * 0.88),
        zones: {
            zone1: { min: Math.round(maxHR * 0.50), max: Math.round(maxHR * 0.60), name: 'Återhämtning' },
            zone2: { min: Math.round(maxHR * 0.60), max: Math.round(maxHR * 0.70), name: 'Uthållighet' },
            zone3: { min: Math.round(maxHR * 0.70), max: Math.round(maxHR * 0.80), name: 'Tempo' },
            zone4: { min: Math.round(maxHR * 0.80), max: Math.round(maxHR * 0.90), name: 'Tröskel' },
            zone5: { min: Math.round(maxHR * 0.90), max: maxHR, name: 'VO2max' },
        },
        activitiesAnalyzed,
        confidence
    };
}

// ==========================================
// Activity Statistics Calculator
// ==========================================

interface ActivityStats {
    thisWeek: PeriodStats;
    lastWeek: PeriodStats;
    thisMonth: PeriodStats;
    lastMonth: PeriodStats;
    thisYear: PeriodStats;
    allTime: PeriodStats;
    byType: { [key: string]: { count: number, distance: number, duration: number } };
    recentActivities: any[];
}

interface PeriodStats {
    activities: number;
    totalDistance: number; // meters
    totalDuration: number; // seconds
    totalCalories: number;
    avgPace?: number; // seconds per km
    longestRun?: number; // meters
}

async function calculateActivityStats(userId: string): Promise<ActivityStats> {
    const activities: any[] = [];
    const iter = kv.list({ prefix: ['activities', userId] });

    for await (const entry of iter) {
        const act = entry.value as any;
        if (act) activities.push(act);
    }

    // Sort by date desc
    activities.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const now = new Date();
    const startOfWeek = getStartOfWeek(now);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const byType: { [key: string]: { count: number, distance: number, duration: number } } = {};

    const thisWeek = createEmptyPeriodStats();
    const lastWeek = createEmptyPeriodStats();
    const thisMonth = createEmptyPeriodStats();
    const lastMonth = createEmptyPeriodStats();
    const thisYear = createEmptyPeriodStats();
    const allTime = createEmptyPeriodStats();

    for (const act of activities) {
        const actDate = new Date(act.date || '');
        const distance = act.distance || 0;
        const duration = act.duration || 0;
        const calories = act.calories || 0;
        const type = act.type || 'Other';

        // By type
        if (!byType[type]) byType[type] = { count: 0, distance: 0, duration: 0 };
        byType[type].count++;
        byType[type].distance += distance;
        byType[type].duration += duration;

        // All time
        addToStats(allTime, distance, duration, calories);

        // This year
        if (actDate >= startOfYear) {
            addToStats(thisYear, distance, duration, calories);
        }

        // This month
        if (actDate >= startOfMonth) {
            addToStats(thisMonth, distance, duration, calories);
        }

        // Last month
        if (actDate >= startOfLastMonth && actDate < startOfMonth) {
            addToStats(lastMonth, distance, duration, calories);
        }

        // This week
        if (actDate >= startOfWeek) {
            addToStats(thisWeek, distance, duration, calories);
        }

        // Last week
        if (actDate >= startOfLastWeek && actDate < startOfWeek) {
            addToStats(lastWeek, distance, duration, calories);
        }
    }

    // Calculate avg pace for each period (for running activities)
    [thisWeek, lastWeek, thisMonth, lastMonth, thisYear, allTime].forEach(stats => {
        if (stats.totalDistance > 0 && stats.totalDuration > 0) {
            stats.avgPace = Math.round((stats.totalDuration / (stats.totalDistance / 1000)));
        }
    });

    return {
        thisWeek,
        lastWeek,
        thisMonth,
        lastMonth,
        thisYear,
        allTime,
        byType,
        recentActivities: activities.slice(0, 10)
    };
}

function getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    return new Date(d.setDate(diff));
}

function createEmptyPeriodStats(): PeriodStats {
    return { activities: 0, totalDistance: 0, totalDuration: 0, totalCalories: 0 };
}

function addToStats(stats: PeriodStats, distance: number, duration: number, calories: number) {
    stats.activities++;
    stats.totalDistance += distance;
    stats.totalDuration += duration;
    stats.totalCalories += calories;
    if (distance > (stats.longestRun || 0)) {
        stats.longestRun = distance;
    }
}

// ==========================================
// Session Management Helpers
// ==========================================

interface UserSession {
    token: string;
    userId: string;
    createdAt: string;
    lastActive?: string;
    userAgent?: string;
    ip?: string;
}

async function getUserSessions(userId: string): Promise<UserSession[]> {
    const sessions: UserSession[] = [];
    const iter = kv.list({ prefix: ['sessions'] });

    for await (const entry of iter) {
        const session = entry.value as UserSession;
        if (session && session.userId === userId) {
            // Don't expose full token, just first/last chars
            sessions.push({
                ...session,
                token: session.token.substring(0, 4) + '...' + session.token.substring(session.token.length - 4)
            });
        }
    }

    return sessions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

async function revokeSession(userId: string, sessionTokenPartial: string): Promise<void> {
    const iter = kv.list({ prefix: ['sessions'] });

    for await (const entry of iter) {
        const session = entry.value as UserSession;
        if (session && session.userId === userId) {
            const partial = session.token.substring(0, 4) + '...' + session.token.substring(session.token.length - 4);
            if (partial === sessionTokenPartial) {
                await kv.delete(entry.key);
                break;
            }
        }
    }
}

async function revokeAllSessionsExcept(userId: string, keepToken: string): Promise<number> {
    let count = 0;
    const iter = kv.list({ prefix: ['sessions'] });

    for await (const entry of iter) {
        const session = entry.value as UserSession;
        if (session && session.userId === userId && session.token !== keepToken) {
            await kv.delete(entry.key);
            count++;
        }
    }

    return count;
}

// ==========================================
// Social Counts Helper
// ==========================================

interface SocialCounts {
    followers: number;
    following: number;
}

async function getSocialCounts(userId: string): Promise<SocialCounts> {
    let followers = 0;
    let following = 0;

    // Count followers
    const followerIter = kv.list({ prefix: ['followers', userId] });
    for await (const _ of followerIter) {
        followers++;
    }

    // Count following
    const followingIter = kv.list({ prefix: ['following', userId] });
    for await (const _ of followingIter) {
        following++;
    }

    return { followers, following };
}
