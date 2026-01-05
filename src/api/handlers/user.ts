import { getSession, getUserSessions, revokeAllUserSessions, revokeSession } from "../db/session.ts";
import { getUserById, getAllUsers, saveUser, sanitizeUser } from "../db/user.ts";
import { strengthRepo } from "../repositories/strengthRepository.ts";
import { kv } from "../kv.ts";
import { getUserData, saveUserData } from "../db/data.ts";
import { UniversalActivity } from "../../models/types.ts";

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

export async function handleUserRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;

    // Auth Check
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    // Session Management
    if (url.pathname === "/api/user/sessions") {
        if (method === "GET") {
            const sessions = await getUserSessions(session.userId);
            const clientSessions = sessions.map(s => ({
                token: s.id,
                userId: s.userId,
                createdAt: s.start,
                isCurrent: s.id === session.id
            }));
            return new Response(JSON.stringify({ sessions: clientSessions }), { headers });
        }
        if (method === "DELETE") {
            await revokeAllUserSessions(session.userId, session.id);
            return new Response(JSON.stringify({ success: true }), { headers });
        }
    }

    // Public Profile by Handle
    if (url.pathname.startsWith("/api/u/") && method === "GET") {
        const handle = url.pathname.split("/").pop();
        if (!handle) return new Response(JSON.stringify({ error: "Missing handle" }), { status: 400, headers });

        try {
            // 1. Lookup ID by handle
            const idEntry = await kv.get(["users_by_handle", handle.toLowerCase()]);
            let id = idEntry.value || (await kv.get(["users_by_username", handle])).value;

            // Self-Healing Fallback: If index fails, scan users (slow path)
            if (!id) {
                console.log(`⚠️ Index miss for ${handle}, attempting slow scan repair...`);
                const allUsersResult = await getAllUsers();
                const match = allUsersResult.users.find(u =>
                    (u.handle && u.handle.toLowerCase() === handle.toLowerCase()) ||
                    u.username.toLowerCase() === handle.toLowerCase()
                );

                if (match) {
                    console.log(`✅ Found user ${match.username} via scan. Repairing index...`);
                    id = match.id;
                    // Repair index on the fly
                    await kv.set(["users_by_handle", handle.toLowerCase()], id);
                }
            }

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
        const data = await getUserData(session.userId);
        const user = await getUserById(session.userId);

        return new Response(JSON.stringify({
            userId: session.userId,
            name: user?.name,
            handle: user?.handle,
            bio: user?.bio,
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
        if (tokenToRevoke) await revokeSession(tokenToRevoke, session.userId);
        return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Danger Zone
    if (url.pathname === "/api/user/reset" && method === "POST") {
        try {
            const body = await req.json();
            if (!['meals', 'exercises', 'weight', 'sleep', 'water', 'caffeine', 'food', 'all'].includes(body.type)) {
                return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers });
            }
            await granularReset(session.userId, body.type);
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

            const currentData = await getUserData(session.userId) || { weightEntries: [] };
            const newEntry = {
                id: crypto.randomUUID(),
                weight: Number(body.weight),
                date: body.date,
                createdAt: new Date().toISOString()
            };

            const updatedEntries = [...(currentData.weightEntries || []), newEntry]
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            await saveUserData(session.userId, {
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
            const data = await getUserData(session.userId);
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
                const user = await getUserById(session.userId);
                if (user && updates.handle !== user.handle) {
                    const existingId = (await kv.get(["users_by_handle", updates.handle])).value;
                    if (existingId && existingId !== session.userId) {
                        return new Response(JSON.stringify({ error: "Handle already taken" }), { status: 409, headers });
                    }
                }
            }

            const currentData = await getUserData(session.userId);

            // Handle AppData updates
            if (currentData) {
                const newData = {
                    ...currentData,
                    userSettings: { ...currentData.userSettings, ...updates },
                };

                // Handle specific top-level fields in AppData if they exist there too
                if (updates.maxHr) newData.userSettings = { ...newData.userSettings, maxHr: updates.maxHr };
                // ... map other specific fields if necessary or just rely on spread

                await saveUserData(session.userId, newData);
            }

            // Also update the core User object if name/handle/avatar/bio are present
            const user = await getUserById(session.userId);
            if (user) {
                let userChanged = false;
                if (updates.name !== undefined) { user.name = updates.name; userChanged = true; }
                if (updates.handle !== undefined) { user.handle = updates.handle; userChanged = true; }
                if (updates.avatarUrl !== undefined) { user.avatarUrl = updates.avatarUrl; userChanged = true; }
                if (updates.bio !== undefined) { user.bio = updates.bio; userChanged = true; }

                if (userChanged) {
                    await saveUser(user);
                }
            }

            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Community Users List (GET)
    if (url.pathname === "/api/users" && method === "GET") {
        try {
            const allUsersResult = await getAllUsers();
            // Sanitize and return relevant fields for community view
            const communityUsers = allUsersResult.users.map(u => ({
                id: u.id,
                username: u.username,
                name: u.name,
                handle: u.handle,
                role: u.role,
                avatarUrl: u.avatarUrl,
                bio: u.bio,
                settings: u.settings,
                createdAt: u.createdAt
            }));
            return new Response(JSON.stringify({ users: communityUsers }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (GET all)
    if (url.pathname === "/api/user/prs" && method === "GET") {
        try {
            const targetUserId = url.searchParams.get("userId") || session.userId;
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
            await kv.set(['prs', session.userId, category], pr);
            return new Response(JSON.stringify({ success: true, pr }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // Personal Records (Detect)
    if (url.pathname === "/api/user/prs/detect" && method === "GET") {
        try {
            const targetUserId = url.searchParams.get("userId") || session.userId;
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
            const user = await getUserById(session.userId);
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
            await kv.delete(['prs', session.userId, category]);
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
