import { getSession, getUserSessions, revokeAllUserSessions, revokeSession } from "../db/session.ts";
import { getUserById, getAllUsers, saveUser, sanitizeUser } from "../db/user.ts";
import { strengthRepo } from "../repositories/strengthRepository.ts";
import { kv } from "../kv.ts";
import { getUserData, saveUserData } from "../db/data.ts";
import { UniversalActivity } from "../../models/types.ts";
import { AuthContext } from "../middleware.ts";

async function granularReset(userId: string, type: 'meals' | 'exercises' | 'weight' | 'sleep' | 'water' | 'caffeine' | 'food' | 'all') {
    if (type === 'all') {
        const user = await getUserById(userId);
        if (user) {
            await kv.atomic()
                .delete(["users", userId])
                .delete(["user_profiles", userId])
                .delete(["users_by_username", user.username])
                .delete(["users_by_handle", user.handle || ""])
                .commit();
            await revokeAllUserSessions(userId);
        }
        return;
    }

    const data = await getUserData(userId) as any;
    if (!data) return;

    if (type === 'meals') {
        data.mealEntries = [];
    } else if (type === 'exercises') {
        data.exerciseEntries = [];
        data.trainingCycles = [];
        data.plannedActivities = [];
        await strengthRepo.clearUserStrengthData(userId);
    } else if (type === 'weight') {
        data.weightEntries = [];
    } else if (type === 'sleep') {
        // Clear sleep entries from vitals
        if (data.vitals) {
            data.vitals = data.vitals.map((v: any) => ({ ...v, sleepHours: undefined, sleepQuality: undefined }));
        }
        if (data.sleepLogs) data.sleepLogs = [];
    } else if (type === 'water') {
        // Clear water entries from vitals
        if (data.vitals) {
            data.vitals = data.vitals.map((v: any) => ({ ...v, water: undefined }));
        }
    } else if (type === 'caffeine') {
        // Clear caffeine entries from vitals
        if (data.vitals) {
            data.vitals = data.vitals.map((v: any) => ({ ...v, caffeine: undefined }));
        }
    } else if (type === 'food') {
        data.mealEntries = [];
    }

    await saveUserData(userId, data);
}

export async function handleUserRoutes(req: Request, url: URL, headers: Headers, ctx: AuthContext | null): Promise<Response> {
    const method = req.method;

    // Public Profile by Handle (Moved up as it might not need auth, but we should check privacy)
    if (url.pathname.startsWith("/api/u/") && method === "GET" && !url.pathname.endsWith("/stats")) {
        const handle = url.pathname.split("/").pop();
        if (!handle) return new Response(JSON.stringify({ error: "Missing handle" }), { status: 400, headers });

        try {
            // 1. Lookup ID by handle or username (both indexed now)
            const handleKey = handle.toLowerCase();
            const idEntry = await kv.get(["users_by_handle", handleKey]);
            let id = idEntry.value || (await kv.get(["users_by_username", handleKey])).value;

            if (!id) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // 2. Fetch User
            const user = await getUserById(id as string);
            if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // 3. Return Sanitized User
            return new Response(JSON.stringify({ ...sanitizeUser(user) }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Authenticated routes - now using ctx from router
    if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const { user, token } = ctx;
    const userId = user.id;

    // Session Management
    if (url.pathname === "/api/user/sessions") {
        if (method === "GET") {
            const sessions = await getUserSessions(userId);
            const clientSessions = sessions.map(s => ({
                token: s.id,
                userId: s.userId,
                createdAt: s.start,
                isCurrent: s.id === token
            }));
            return new Response(JSON.stringify({ sessions: clientSessions }), { headers });
        }
        if (method === "DELETE") {
            await revokeAllUserSessions(userId, token);
            return new Response(JSON.stringify({ success: true }), { headers });
        }
    }

    // Public Profile by Handle
    if (url.pathname.startsWith("/api/u/") && method === "GET") {
        const handle = url.pathname.split("/").pop();
        if (!handle) return new Response(JSON.stringify({ error: "Missing handle" }), { status: 400, headers });

        try {
            // 1. Lookup ID by handle or username (both indexed now)
            const handleKey = handle.toLowerCase();
            const idEntry = await kv.get(["users_by_handle", handleKey]);
            let id = idEntry.value || (await kv.get(["users_by_username", handleKey])).value;

            if (!id) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // 2. Fetch User
            const user = await getUserById(id as string);
            if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // 3. Return Sanitized User
            return new Response(JSON.stringify({ ...sanitizeUser(user) }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    if (url.pathname === "/api/user/profile" && method === "GET") {
        const data = await getUserData(userId);
        const user = await getUserById(userId);

        return new Response(JSON.stringify({
            userId: userId,
            name: user?.name,
            handle: user?.handle,
            bio: user?.bio,
            location: user?.location,
            website: user?.website,
            avatarUrl: user?.avatarUrl,
            email: user?.email,
            createdAt: user?.createdAt,
            // Settings from AppData
            settings: data?.userSettings,
            // Privacy from User or AppData? user.ts creates User with privacy.
            privacy: user?.privacy
        }), { headers });
    }

    if (url.pathname.startsWith("/api/user/sessions/") && method === "DELETE") {
        const tokenToRevoke = url.pathname.split("/").pop();
        if (tokenToRevoke) await revokeSession(tokenToRevoke, userId);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Danger Zone
    if (url.pathname === "/api/user/reset" && method === "POST") {
        try {
            const body = await req.json();
            if (!['meals', 'exercises', 'weight', 'sleep', 'water', 'caffeine', 'food', 'all'].includes(body.type)) {
                return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers });
            }
            await granularReset(userId, body.type);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message || "Failed" }), { status: 500, headers });
        }
    }

    // Weight logging (specific endpoint)
    if (url.pathname === "/api/user/weight" && method === "POST") {
        try {
            const body = await req.json();
            if (!body.weight || !body.date) throw new Error("Missing weight or date");

            const currentData = await getUserData(userId) || { weightEntries: [] };
            const newEntry = {
                id: crypto.randomUUID(),
                weight: Number(body.weight),
                date: body.date,
                createdAt: new Date().toISOString()
            };

            const updatedEntries = [...(currentData.weightEntries || []), newEntry]
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            await saveUserData(userId, {
                ...currentData,
                weightEntries: updatedEntries
            } as any);

            return new Response(JSON.stringify({ success: true, entry: newEntry }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400, headers });
        }
    }

    // Weight history (GET)
    if (url.pathname === "/api/user/weight" && method === "GET") {
        try {
            const data = await getUserData(userId);
            return new Response(JSON.stringify({ history: data?.weightEntries || [] }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Profile Update (PATCH)
    if (url.pathname === "/api/user/profile" && method === "PATCH") {
        try {
            const updates = await req.json();

            // Check handle uniqueness if handle is being updated
            if (updates.handle) {
                const user = await getUserById(userId);
                if (user && updates.handle !== user.handle) {
                    const existingId = (await kv.get(["users_by_handle", updates.handle])).value;
                    if (existingId && existingId !== userId) {
                        return new Response(JSON.stringify({ error: "Handle already taken" }), { status: 409, headers });
                    }
                }
            }

            const currentData = await getUserData(userId);

            // Handle AppData updates
            if (currentData) {
                const newData = {
                    ...currentData,
                    userSettings: { ...currentData.userSettings, ...updates },
                };

                // Handle specific top-level fields in AppData if they exist there too
                if (updates.maxHr) newData.userSettings = { ...newData.userSettings, maxHr: updates.maxHr };
                // ... map other specific fields if necessary or just rely on spread

                await saveUserData(userId, newData);
            }

            // Also update the core User object if name/handle/avatar/bio are present
            const user = await getUserById(userId);
            if (user) {
                let userChanged = false;
                if (updates.name !== undefined) { user.name = updates.name; userChanged = true; }
                if (updates.handle !== undefined) { user.handle = updates.handle; userChanged = true; }
                if (updates.avatarUrl !== undefined) { user.avatarUrl = updates.avatarUrl; userChanged = true; }
                if (updates.bio !== undefined) { user.bio = updates.bio; userChanged = true; }
                if (updates.location !== undefined) { user.location = updates.location; userChanged = true; }
                if (updates.website !== undefined) { user.website = updates.website; userChanged = true; }

                if (userChanged) {
                    await saveUser(user);
                }
            }

            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Subscription Update (POST)
    if (url.pathname === "/api/user/subscription" && method === "POST") {
        try {
            const body = await req.json();
            const { tier } = body;
            if (tier !== 'free' && tier !== 'evergreen') {
                return new Response(JSON.stringify({ error: "Invalid tier" }), { status: 400, headers });
            }

            const user = await getUserById(userId);
            if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // Update subscription
            user.subscription = {
                ...user.subscription,
                tier,
                status: 'active',
                history: [
                    {
                        id: crypto.randomUUID(),
                        date: new Date().toISOString(),
                        type: tier === 'evergreen' ? 'upgrade' : 'downgrade',
                        tier,
                        note: 'Manual update via user settings'
                    },
                    ...(user.subscription.history || [])
                ]
            };

            await saveUser(user);

            return new Response(JSON.stringify({ success: true, subscription: user.subscription }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Community Users List (GET)
    if (url.pathname === "/api/users" && method === "GET") {
        try {
            const allUsersResult = await getAllUsers();

            // Period for stats
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            // Fetch extra data for all users in parallel
            const communityUsers = await Promise.all(allUsersResult.users.map(async u => {
                // Fetch activities for stats
                const activities: any[] = [];
                const iter = kv.list({ prefix: ['activities', u.id] });
                for await (const entry of iter) {
                    const act = entry.value as any;
                    // Note: We scan all to find latest, but filter for 30d stats
                    activities.push(act);
                }

                // Calculate 30d stats
                let totalDistance = 0;
                let totalDuration = 0;
                let totalTonnage = 0;
                let sessions = 0;
                const typeCounts: Record<string, number> = {};

                activities.forEach(act => {
                    if (act.status === 'COMPLETED' && new Date(act.date) >= thirtyDaysAgo) {
                        sessions++;
                        const type = act.type || act.performance?.activityType || 'other';
                        typeCounts[type] = (typeCounts[type] || 0) + 1;

                        if (act.performance?.distanceKm) totalDistance += act.performance.distanceKm;
                        if (act.performance?.durationMinutes) totalDuration += act.performance.durationMinutes;
                        if (act.performance?.tonnage) totalTonnage += act.performance.tonnage;
                    }
                });

                // Latest activity
                const latestAct = activities
                    .filter(a => a.status === 'COMPLETED')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                // Calculate simple streak (last 14 days)
                const activityDates = new Set(activities
                    .filter(a => a.status === 'COMPLETED')
                    .map(a => a.date.split('T')[0])
                );

                let streak = 0;
                let check = new Date();
                while (true) {
                    const ds = check.toISOString().split('T')[0];
                    if (activityDates.has(ds)) {
                        streak++;
                        check.setDate(check.getDate() - 1);
                    } else {
                        // If it's today and not yet logged, check yesterday to maintain streak
                        if (streak === 0 && ds === new Date().toISOString().split('T')[0]) {
                            check.setDate(check.getDate() - 1);
                            continue;
                        }
                        break;
                    }
                    if (streak > 365) break;
                }

                return {
                    id: u.id,
                    username: u.username,
                    name: u.name,
                    handle: u.handle,
                    role: u.role,
                    avatarUrl: u.avatarUrl,
                    bio: u.bio,
                    settings: u.settings,
                    subscription: u.subscription,
                    createdAt: u.createdAt,
                    stats: {
                        distance: Math.round(totalDistance * 10) / 10,
                        duration: Math.round(totalDuration),
                        tonnage: Math.round(totalTonnage),
                        sessions
                    },
                    latestActivity: latestAct ? {
                        type: latestAct.type || latestAct.performance?.activityType,
                        date: latestAct.date,
                        title: latestAct.title || latestAct.name,
                        distance: latestAct.performance?.distanceKm,
                        duration: latestAct.performance?.durationMinutes
                    } : null,
                    streak,
                    topExercises: Object.entries(typeCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(e => e[0])
                };
            }));

            return new Response(JSON.stringify({ users: communityUsers }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (GET all)
    if (url.pathname === "/api/user/prs" && method === "GET") {
        try {
            const targetUserId = url.searchParams.get("userId") || userId;
            const prs: any[] = [];
            const iter = kv.list({ prefix: ['prs', targetUserId] });
            for await (const entry of iter) {
                prs.push(entry.value);
            }
            return new Response(JSON.stringify({ prs }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (POST - save)
    if (url.pathname === "/api/user/prs" && method === "POST") {
        try {
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
            await kv.set(['prs', userId, category], pr);
            return new Response(JSON.stringify({ success: true, pr }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (Detect)
    if (url.pathname === "/api/user/prs/detect" && method === "GET") {
        try {
            const targetUserId = url.searchParams.get("userId") || userId;
            const detected: any[] = [];

            // 1. Get all activities (simplified list for scanning)
            const activities: UniversalActivity[] = [];
            const iter = kv.list<UniversalActivity>({ prefix: ['activities', targetUserId] });
            for await (const entry of iter) {
                activities.push(entry.value);
            }

            const runs = activities.filter(a => a.performance?.activityType === 'running' && a.status === 'COMPLETED');

            const STANDARD_DISTANCES = [
                { id: '5k', km: 5 },
                { id: '10k', km: 10 },
                { id: 'half_marathon', km: 21.0975 },
                { id: 'marathon', km: 42.195 }
            ];

            for (const dist of STANDARD_DISTANCES) {
                let bestTime = Infinity;
                let bestActivity: any = null;

                for (const run of runs) {
                    const perf = run.performance!;
                    const runDist = perf.distanceKm || 0;
                    const runDuration = perf.durationMinutes * 60; // seconds

                    // Sanity Check 1: Speed limit (World Record 5k is ~24km/h)
                    // If speed > 25km/h, it's likely cycling or error
                    const speedKmh = runDist / (run.performance!.durationMinutes / 60);
                    if (speedKmh > 25) continue;

                    // Sanity Check 2: Minimum activity duration (e.g. < 2 mins for 5k is impossible)
                    // 5k world record ~12 mins. Let's say < 10 mins for 5km is impossible.
                    // This creates a robust filter against short segments being mapped to long distances
                    if (dist.km >= 5 && run.performance!.durationMinutes < 10) continue;
                    if (dist.km >= 10 && run.performance!.durationMinutes < 25) continue;
                    if (dist.km >= 21 && run.performance!.durationMinutes < 55) continue;

                    // Logic: best activity within 5% of distance or longer
                    if (runDist >= dist.km * 0.95) {
                        // Project pace to standard distance
                        const pace = runDuration / runDist;
                        const projectedTime = pace * dist.km;

                        if (projectedTime < bestTime) {
                            bestTime = projectedTime;
                            bestActivity = run;
                        }
                    }
                }

                if (bestActivity) {
                    const pr = {
                        category: dist.id,
                        time: Math.round(bestTime),
                        date: bestActivity.date,
                        activityId: bestActivity.id,
                        isManual: false,
                        createdAt: new Date().toISOString()
                    };
                    detected.push(pr);

                    // Persistence: Auto-save if better than existing
                    const existingKey = ['prs', targetUserId, dist.id];
                    const existingRes = await kv.get<any>(existingKey);

                    // Only auto-save if significantly better? Or just logic as before.
                    // Logic was: if (!existing || better) -> save.
                    if (!existingRes.value || existingRes.value.time > pr.time) {
                        await kv.set(existingKey, pr);
                    }
                }
            }

            return new Response(JSON.stringify({ detected }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Privacy Update (PATCH)
    if (url.pathname === "/api/user/privacy" && method === "PATCH") {
        try {
            const updates = await req.json();
            const user = await getUserById(userId);
            if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // Merge privacy settings
            const currentPrivacy = user.privacy || {
                isPublic: true,
                allowFollowers: true,
                sharing: { training: 'FRIENDS', nutrition: 'FRIENDS', health: 'PRIVATE', social: 'FRIENDS', body: 'PRIVATE' },
                whitelistedUsers: [],
                showWeight: false,
                showHeight: false,
                showBirthYear: false,
                showDetailedTraining: true
            };

            // Deep merge for 'sharing' if present
            const newPrivacy = { ...currentPrivacy, ...updates };
            if (updates.sharing) {
                newPrivacy.sharing = { ...currentPrivacy.sharing, ...updates.sharing };
            }

            user.privacy = newPrivacy;
            await saveUser(user);

            return new Response(JSON.stringify({ success: true, privacy: user.privacy }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (DELETE)
    if (url.pathname.startsWith("/api/user/prs/") && method === "DELETE") {
        try {
            const category = decodeURIComponent(url.pathname.split('/').pop() || '');
            await kv.delete(['prs', userId, category]);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Public Stats by Handle
    if (url.pathname.startsWith("/api/u/") && url.pathname.endsWith("/stats") && method === "GET") {
        const handle = url.pathname.split("/")[3]; // /api/u/:handle/stats
        if (!handle) return new Response(JSON.stringify({ error: "Missing handle" }), { status: 400, headers });

        try {
            // 1. Resolve User
            const idEntry = await kv.get(["users_by_handle", handle.toLowerCase()]);
            let id = idEntry.value || (await kv.get(["users_by_username", handle])).value;

            if (!id) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            const user = await getUserById(id as string);
            if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers });

            // 2. Privacy Check
            const privacy = user.privacy || { isPublic: true, sharing: { training: 'FRIENDS' } };
            // Allow if public AND training is explicitly PUBLIC, OR if checking my own stats
            const isMe = userId === id;

            // Simplified Privacy Logic:
            // If strictly private -> Block (unless Me)
            // If training is PRIVATE -> Block (unless Me)
            // If training is PUBLIC -> Allow
            // If training is FRIENDS -> Allow (for now, simplistic "Public Profile" often implies some visibility, or we assume friends check passed elsewhere? 
            // Actually, for a pure Public landing page, we should respect strict PUBLIC. 
            // However, existing "Private" block in frontend handles the main lock. 
            // Let's go with: If user is !isPublic -> Block. If sharing.training === PRIVATE -> Block.

            if (!isMe) {
                if (privacy.isPublic === false) return new Response(JSON.stringify({ error: "Private profile" }), { status: 403, headers });
                if (privacy.sharing?.training === 'PRIVATE') return new Response(JSON.stringify({ stats: null, privacy: 'private' }), { headers });
            }

            // 3. Calculate Stats (Last 30 Days)
            const dailyDataMap: Record<string, { date: string; runningDistance: number; strengthTonnage: number }> = {};
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            // Initialize daily map
            for (let i = 0; i <= 30; i++) {
                const date = new Date(thirtyDaysAgo);
                date.setDate(date.getDate() + i);
                const ds = date.toISOString().split('T')[0];
                dailyDataMap[ds] = { date: ds, runningDistance: 0, strengthTonnage: 0 };
            }

            let totalDistance = 0;
            let totalDuration = 0;
            let count = 0;

            const iter = kv.list<UniversalActivity>({ prefix: ['activities', id] });
            for await (const entry of iter) {
                const act = entry.value;
                const date = new Date(act.date);
                const ds = act.date.split('T')[0];

                if (date >= thirtyDaysAgo && date <= now && act.status === 'COMPLETED') {
                    count++;
                    const dist = act.performance?.distanceKm || 0;
                    const ton = act.performance?.tonnage || 0;

                    totalDistance += dist;
                    totalDuration += act.performance?.durationMinutes || 0;

                    if (dailyDataMap[ds]) {
                        dailyDataMap[ds].runningDistance += dist;
                        dailyDataMap[ds].strengthTonnage += ton;
                    }
                }
            }

            const dailyStats = Object.values(dailyDataMap).sort((a, b) => a.date.localeCompare(b.date));

            return new Response(JSON.stringify({
                stats: {
                    distance: Math.round(totalDistance * 10) / 10,
                    duration: Math.round(totalDuration), // minutes
                    count,
                    dailyStats
                }
            }), { headers });

        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
