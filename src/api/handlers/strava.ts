import * as strava from "../strava.ts";
import { getSession } from "../db/session.ts";
import { reconciliationService } from "../services/reconciliationService.ts";
import { kv } from "../kv.ts";

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


export async function handleStravaRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
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

            const token = req.headers.get("Authorization")?.replace("Bearer ", "") || url.searchParams.get('state');
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

    // Authenticated routes
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    // Status
    if (url.pathname === "/api/strava/status" && method === "GET") {
        const stravaTokens = await getStravaTokens(session.userId);
        if (!stravaTokens) return new Response(JSON.stringify({ connected: false }), { headers });

        let accessToken = stravaTokens.accessToken;
        if (Date.now() > stravaTokens.expiresAt) {
            const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
            if (refreshed) {
                accessToken = refreshed.accessToken;
                await saveStravaTokens(session.userId, { ...stravaTokens, ...refreshed });
            } else {
                await deleteStravaTokens(session.userId);
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

    // Sync
    if (url.pathname === "/api/strava/sync" && method === "POST") {
        try {
            const stravaTokens = await getStravaTokens(session.userId);
            if (!stravaTokens) return new Response(JSON.stringify({ error: "Strava not connected" }), { status: 400, headers });

            let accessToken = stravaTokens.accessToken;
            if (Date.now() > stravaTokens.expiresAt) {
                const refreshed = await strava.refreshStravaToken(stravaTokens.refreshToken);
                if (!refreshed) return new Response(JSON.stringify({ error: "Token expired" }), { status: 401, headers });
                accessToken = refreshed.accessToken;
                await saveStravaTokens(session.userId, { ...stravaTokens, ...refreshed });
            }

            const fullSync = url.searchParams.get('full') === 'true';
            const lastSyncDate = (!fullSync && stravaTokens.lastSync) ? new Date(stravaTokens.lastSync).getTime() / 1000 : undefined;

            const activities = await strava.getStravaActivities(accessToken, { after: lastSyncDate, perPage: 200 });
            const result = await reconciliationService.reconcileStravaActivities(session.userId, activities);

            await saveStravaTokens(session.userId, { ...stravaTokens, lastSync: new Date().toISOString() });
            return new Response(JSON.stringify({ success: true, result }), { headers });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
