import * as strava from "../strava.ts";
import { getSession } from "../db/session.ts";
import { reconciliationService } from "../services/reconciliationService.ts";
import { kv } from "../kv.ts";
import { AuthContext } from "../middleware.ts";

// Helper to manage Strava tokens in KV (should ideally be in a db module)
interface StravaTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    athleteId?: number;
    lastSync?: string;
}

async function saveStravaTokens(userId: string, tokens: StravaTokens) {
    await kv.set(['strava_tokens', userId], tokens);
}

async function getStravaTokens(userId: string): Promise<StravaTokens | null> {
    const res = await kv.get<StravaTokens>(['strava_tokens', userId]);
    return res.value;
}

async function deleteStravaTokens(userId: string) {
    await kv.delete(['strava_tokens', userId]);
}

export async function handleStravaRoutes(req: Request, url: URL, headers: Headers, ctx: AuthContext | null): Promise<Response> {
    const method = req.method;

    // Public/Callback route (doesn't require standard auth header, handles its own state)
    if (url.pathname === "/api/strava/callback" && method === "GET") {
        try {
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            const origin = url.origin;

            if (error) return Response.redirect(new URL('/profile?strava_error=' + error, origin).toString(), 302);
            if (!code) return new Response(JSON.stringify({ error: "No authorization code" }), { status: 400, headers });

            const tokens = await strava.exchangeStravaCode(code);
            if (!tokens) return Response.redirect(new URL('/profile?strava_error=token_exchange_failed', origin).toString(), 302);

            const token = ctx?.token || url.searchParams.get('state');
            if (token) {
                const session = await getSession(token);
                if (session) await saveStravaTokens(session.userId, tokens);
            }
            return Response.redirect(new URL('/profile?strava_connected=true', origin).toString(), 302);
        } catch (err) {
            return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers });
        }
    }

    if (url.pathname === "/api/strava/auth" && method === "GET") {
        if (!strava.isStravaConfigured()) return new Response(JSON.stringify({ error: "Strava not configured" }), { status: 500, headers });
        const state = url.searchParams.get('state') || undefined;
        return new Response(JSON.stringify({ authUrl: strava.getStravaAuthUrl(state) }), { headers });
    }

    // Authenticated routes - using ctx from router
    if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const { user, token } = ctx;

    // Status
    if (url.pathname === "/api/strava/status" && method === "GET") {
        const stravaTokens = await getStravaTokens(user.id);
        if (!stravaTokens) return new Response(JSON.stringify({ connected: false }), { headers });

        let accessToken = stravaTokens.accessToken;
        if (Date.now() > stravaTokens.expiresAt) {
            const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
            if (refreshed) {
                accessToken = refreshed.accessToken;
                await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            } else {
                await deleteStravaTokens(user.id);
                return new Response(JSON.stringify({ connected: false, error: "Token expired" }), { headers });
            }
        }

        const athlete = await strava.getStravaAthlete(accessToken);
        const stats = stravaTokens.athleteId ? await strava.getStravaAthleteStats(stravaTokens.athleteId, accessToken) : null;

        return new Response(JSON.stringify({
            connected: true,
            athlete: athlete ? {
                id: athlete.id,
                name: `${athlete.firstname} ${athlete.lastname}`,
                avatar: athlete.profile,
                city: athlete.city, country: athlete.country, premium: athlete.premium
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



    // Fetch individual activity splits
    if (url.pathname.match(/^\/api\/strava\/activities\/[^\/]+\/splits$/) && method === "GET") {
        try {
            const parts = url.pathname.split('/');
            const activityIdStr = parts[4];
            console.log(`[STRAVA API] Requested splits for activity: ${activityIdStr}`);
            // Ensure we strip any 'strava_' prefix if it exists (for legacy/universal compatibility)
            const sanitizedIdStr = activityIdStr.replace('strava_', '');
            const activityId = parseInt(sanitizedIdStr, 10);
            console.log(`[STRAVA API] Sanitized ID: ${sanitizedIdStr}, Parsed: ${activityId}`);

            if (isNaN(activityId)) {
                console.error(`[STRAVA API] Invalid activity ID: ${sanitizedIdStr}`);
                return new Response(JSON.stringify({ error: "Invalid activity ID" }), { status: 400, headers });
            }

            const stravaTokens = await getStravaTokens(user.id);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                accessToken = refreshed.accessToken;
                await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            }

            const detailedActivity = await strava.getStravaActivityDetail(activityId, accessToken);

            if (!detailedActivity) {
                return new Response(JSON.stringify({ error: "Activity not found on Strava" }), { status: 404, headers });
            }

            return new Response(JSON.stringify({ 
                splits: detailedActivity.splits_metric || [], 
                laps: detailedActivity.laps || [],
                description: detailedActivity.description || "",
                name: detailedActivity.name || ""
            }), { headers });

        } catch (e) {
            console.error("❌ [STRAVA API] Fetch splits failed:", e);
            return new Response(JSON.stringify({ 
                error: e instanceof Error ? e.message : "Unknown error",
                details: "Failed to fetch activity details from Strava API"
            }), { status: 500, headers });
        }
    }

    // Fetch activity kudos
    if (url.pathname.match(/^\/api\/strava\/activities\/[^\/]+\/kudos$/) && method === "GET") {
        try {
            const parts = url.pathname.split('/');
            const activityIdStr = parts[4];
            const sanitizedIdStr = activityIdStr.replace('strava_', '');
            
            if (!sanitizedIdStr) {
                return new Response(JSON.stringify({ error: "Invalid activity ID" }), { status: 400, headers });
            }

            const stravaTokens = await getStravaTokens(user.id);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                accessToken = refreshed.accessToken;
                await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            }

            const kudos = await strava.getStravaKudos(sanitizedIdStr, accessToken);
            return new Response(JSON.stringify({ kudos }), { headers });

        } catch (e) {
            console.error("❌ [STRAVA API] Fetch kudos failed:", e);
            return new Response(JSON.stringify({ 
                error: e instanceof Error ? e.message : "Unknown error",
                details: "Failed to fetch athlete kudos from Strava API"
            }), { status: 500, headers });
        }
    }

    // Scan (Sync 2.0)
    if (url.pathname === "/api/strava/scan" && method === "POST") {
        try {
            const stravaTokens = await getStravaTokens(user.id);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                accessToken = refreshed.accessToken;
                await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            }

            const body = await req.json().catch(() => ({}));
            const { fromDate } = body;

            const report = await reconciliationService.scanStravaActivities(user.id, accessToken, { fromDate });
            return new Response(JSON.stringify(report), { headers });

        } catch (e) {
            console.error("Scan failed", e);
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers });
        }
    }

    // Import (Sync 2.0)
    if (url.pathname === "/api/strava/import" && method === "POST") {
        try {
            const stravaTokens = await getStravaTokens(user.id);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            // Token refresh check (duplicate for safety)
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (refreshed) await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            }

            const { activities, forceUpdate } = await req.json();
            if (!activities || !Array.isArray(activities)) {
                return new Response(JSON.stringify({ error: "Invalid activities payload" }), { status: 400, headers });
            }

            const result = await reconciliationService.syncActivities(user.id, activities, { 
                forceUpdate, 
                accessToken: stravaTokens.accessToken 
            });

            // Update last sync time? Maybe only if we synced new stuff.
            if (result.created > 0 || result.updated > 0) {
                await saveStravaTokens(user.id, { ...stravaTokens, lastSync: new Date().toISOString() });
            }

            return new Response(JSON.stringify(result), { headers });

        } catch (e) {
            console.error("Import failed", e);
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers });
        }
    }

    // Sync (Legacy - preserved for now)
    if (url.pathname === "/api/strava/sync" && method === "POST") {
        try {
            const stravaTokens = await getStravaTokens(user.id);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                accessToken = refreshed.accessToken;
                await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            }

            const fullSync = url.searchParams.get('full') === 'true';
            const lastSyncDate = (!fullSync && stravaTokens.lastSync) ? new Date(stravaTokens.lastSync).getTime() / 1000 : undefined;

            const activities = await strava.getStravaActivities(accessToken, { after: lastSyncDate, perPage: 200 });
            const result = await reconciliationService.reconcileStravaActivities(user.id, activities);

            await saveStravaTokens(user.id, { ...stravaTokens, lastSync: new Date().toISOString() });
            return new Response(JSON.stringify({ success: true, result }), { headers });

        } catch (e) {
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers });
        }
    }

    // NEW: Migrate start times for existing activities
    if (url.pathname === "/api/strava/migrate-start-times" && method === "POST") {
        try {
            const stravaTokens = await getStravaTokens(user.id);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                accessToken = refreshed.accessToken;
                await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            }

            // Fetch ALL Strava activities
            const stravaActivities = await strava.getAllStravaActivities(accessToken);

            // Build a map of strava id -> start_date_local
            const stravaTimeMap = new Map<number, string>();
            stravaActivities.forEach(a => {
                stravaTimeMap.set(a.id, a.start_date_local);
            });

            // Iterate all universal activities for this user and update
            const { activityRepo } = await import("../repositories/activityRepository.ts");
            const allActivities = await activityRepo.getAllActivities(user.id);

            let updated = 0;
            let skipped = 0;
            let notFound = 0;

            for (const activity of allActivities) {
                // Check if already has startTimeLocal
                if (activity.performance?.startTimeLocal) {
                    skipped++;
                    continue;
                }

                // Find matching Strava activity by external ID
                const externalId = activity.performance?.source?.externalId;
                if (!externalId) {
                    notFound++;
                    continue;
                }

                const stravaId = parseInt(externalId, 10);
                const startTimeLocal = stravaTimeMap.get(stravaId);

                if (startTimeLocal && activity.performance) {
                    // Update the activity with startTimeLocal
                    activity.performance.startTimeLocal = startTimeLocal;
                    activity.updatedAt = new Date().toISOString();
                    await activityRepo.saveActivity(activity);
                    updated++;
                } else {
                    notFound++;
                }
            }

            return new Response(JSON.stringify({
                success: true,
                stravaActivitiesFound: stravaActivities.length,
                updated,
                skipped,
                notFound
            }), { headers });

        } catch (e) {
            console.error("Migrate start times failed", e);
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers });
        }
    }

    // NEW: Backfill Best Efforts
    if (url.pathname === "/api/strava/backfill-best-efforts" && method === "POST") {
        try {
            const stravaTokens = await getStravaTokens(user.id);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                accessToken = refreshed.accessToken;
                await saveStravaTokens(user.id, { ...stravaTokens, ...refreshed });
            }

            const body = await req.json().catch(() => ({}));
            const year = body.year || new Date().getFullYear().toString();

            const result = await reconciliationService.backfillBestEfforts(user.id, accessToken, year);
            return new Response(JSON.stringify(result), { headers });

        } catch (e) {
            console.error("Backfill failed", e);
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
