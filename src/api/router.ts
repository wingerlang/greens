import { handleAuthRoutes } from "./handlers/auth.ts";
import { handleUserRoutes } from "./handlers/user.ts";
import { handleDataRoutes } from "./handlers/data.ts";
import { handleStravaRoutes } from "./handlers/strava.ts";
import { handleSocialRoutes } from "./handlers/social.ts";
import { handleActivityRoutes } from "./handlers/activities.ts";
import { handleAdminRoutes } from "./handlers/admin.ts";
import { handleStrengthRoutes } from "./handlers/strength.ts";
import { handleFeedRoutes } from "./handlers/feed.ts";
import { handleGoalRoutes } from "./handlers/goals.ts";
import { handlePeriodRoutes } from "./handlers/periods.ts";
import { handleParserRoutes } from "./handlers/parser.ts";
import { handleGetCommunityStats } from "./handlers/statistics.ts";
import { handleAdminKvRoutes } from "./handlers/adminKv.ts";
import { handleUploadRoutes } from "./handlers/upload.ts";
import { handleDebugRoutes } from "./handlers/debug.ts";
import { handleBackupRoutes } from "./handlers/backup.ts";
import { handleDeveloperRoutes } from "./handlers/developer.ts";
import { debugMiddleware } from "./middleware/debugMiddleware.ts";
import { handleRacePlanRoutes } from "./handlers/racePlans.ts";
import { handlePlanRoutes } from "./handlers/plans.ts";
import { handleExerciseMapperRoutes } from "./handlers/exerciseMapper.ts";
import { handleExerciseRoutes } from "./handlers/exercises.ts";
import { handleMuscleRoutes } from "./handlers/muscles.ts";
import { handleRecipeRoutes } from "./handlers/recipes.ts";
import { handleExerciseEntryRoutes } from "./handlers/exerciseEntries.ts";
import { handlePlannedActivityRoutes } from "./handlers/plannedActivities.ts";
import { handleAnalyticsRoutes } from "./handlers/analytics.ts";
import { handleQuickMealRoutes } from "./handlers/quickMeals.ts";
import { handleRecalculateCaloriesRoutes } from "./handlers/recalculateCalories.ts";
import { logError, logMetric } from "./utils/logger.ts";
import { sessionTracker } from "./utils/sessionTracker.ts";
import { handleAdminSessionRoutes } from "./handlers/adminSessions.ts";
import { checkRateLimit } from "./utils/rateLimit.ts";
import { authenticate } from "./middleware.ts";
import { serveDir } from "./utils/fileServer.ts";

export async function router(req: Request, remoteAddr: any): Promise<Response> {
    // Wrap with debug middleware
    return await debugMiddleware(req, async (req) => {
        return await internalRouter(req, remoteAddr);
    });
}

async function internalRouter(req: Request, remoteAddr: any): Promise<Response> {
    const start = performance.now();
    const url = new URL(req.url);
    const method = req.method;

    // Secure IP Detection (Trust proxy only if local)
    const isLocal = remoteAddr.hostname === "127.0.0.1" || remoteAddr.hostname === "::1";
    const clientIp = isLocal
        ? (req.headers.get("x-forwarded-for") || remoteAddr.hostname).split(",")[0].trim()
        : remoteAddr.hostname;

    // CORS / Security Headers
    const origin = req.headers.get("Origin");
    const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    });

    if (method === "OPTIONS") {
        return new Response(null, { headers });
    }

    // CSRF Protection
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        const hasAuthCookie = (req.headers.get("cookie") || "").includes("auth_token=");
        if (hasAuthCookie) {
            const host = req.headers.get("x-forwarded-host") || req.headers.get("Host");
            const referer = req.headers.get("Referer");

            let isCsrfSafe = false;
            if (origin) {
                try {
                    const originHost = new URL(origin).host;
                    if (originHost === host) isCsrfSafe = true;
                } catch { }
            } else if (referer) {
                try {
                    const refererHost = new URL(referer).host;
                    if (refererHost === host) isCsrfSafe = true;
                } catch { }
            }

            // If we have a cookie but origin/referer don't match host, block it
            // Note: If origin/referer are missing, we might assume it's a non-browser tool, but for robustness with cookies, we can block.
            if ((origin || referer) && !isCsrfSafe) {
                return new Response(JSON.stringify({ error: "CSRF Check Failed" }), { status: 403, headers });
            }
        }
    }

    // Global Rate Limit (100 requests per minute per IP)
    const isAllowed = await checkRateLimit(clientIp, 100, 60 * 1000);
    if (!isAllowed) {
        return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers });
    }

    // Auth Middleware for protected routes
    const publicPaths = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/stats/community",
        "/api/strava/callback",
        "/api/strava/auth",
        "/api/debug-activities"
    ];
    const isPublicPath = publicPaths.some(path => url.pathname.startsWith(path));

    // Some /api/u/ paths are public profiles
    const isPublicProfile = url.pathname.startsWith("/api/u/");

    let ctx = null;
    if (!isPublicPath && !isPublicProfile && url.pathname.startsWith("/api/")) {
        ctx = await authenticate(req);
        if (!ctx) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
        }
    } else if (url.pathname.startsWith("/api/")) {
        // Optional auth for tracking on public paths
        ctx = await authenticate(req).catch(() => null);
    }

    // Track Session for analytics
    if (!url.pathname.startsWith("/api/debug/client-error")) {
        sessionTracker.track(req, clientIp, ctx?.user ? { id: ctx.user.id, username: ctx.user.username } : undefined);
    }

    // Static File Serving for Uploads
    if (url.pathname.startsWith("/uploads/")) {
        return await serveDir(req, {
            fsRoot: "./uploads",
            urlRoot: "uploads",
        });
    }

    let response: Response;

    try {
        // Dispatch to handlers
        if (url.pathname === "/api/debug-activities") {
            const { kv } = await import("./kv.ts");
            const dateIso = "2026-01-20";
            const actList = [];
            for await (const entry of kv.list({ prefix: ["activities"] })) {
                const item = entry.value as any;
                if (item.date && item.date.startsWith(dateIso)) actList.push(item);
            }
            const strList = [];
            for await (const entry of kv.list({ prefix: ["strength_workouts"] })) {
                const item = entry.value as any;
                if (item.date && item.date.startsWith(dateIso)) strList.push(item);
            }
            return new Response(JSON.stringify({ universal: actList, strength: strList }), { headers });
        } else if (url.pathname.startsWith("/api/auth")) {
            response = await handleAuthRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/user")) {
            response = await handleUserRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/u/")) {
            response = await handleUserRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/users")) {
            response = await handleUserRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/data")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/meals")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/weight")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/measurements")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/foods")) {
            response = await handleDataRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/strava")) {
            response = await handleStravaRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/social")) {
            response = await handleSocialRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/activities") || url.pathname.startsWith("/api/tours")) {
            response = await handleActivityRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/admin/kv")) {
            response = await handleAdminKvRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/admin/sessions")) {
            response = await handleAdminSessionRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/admin")) {
            response = await handleAdminRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/strength")) {
            response = await handleStrengthRoutes(req, url, headers, ctx);
        } else if (url.pathname.startsWith("/api/feed")) {
            response = await handleFeedRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/goals")) {
            response = await handleGoalRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/periods")) {
            response = await handlePeriodRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/parse-url")) {
            response = await handleParserRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/race-plans")) {
            response = await handleRacePlanRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/plans")) {
            response = await handlePlanRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/exercises/map")) {
            response = await handleExerciseMapperRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/exercises")) {
            response = await handleExerciseRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/exercise-entries")) {
            response = await handleExerciseEntryRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/recipes")) {
            response = await handleRecipeRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/muscles")) {
            response = await handleMuscleRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/upload-temp") || url.pathname.startsWith("/api/parse-image")) {
            response = await handleUploadRoutes(req, url, headers);
        } else if (url.pathname === "/api/stats/community") {
            response = await handleGetCommunityStats(req);
        } else if (url.pathname.startsWith("/api/debug/client-error")) {
            response = await handleAdminSessionRoutes(req, url, headers, clientIp);
        } else if (url.pathname.startsWith("/api/debug")) {
            response = await handleDebugRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/backup")) {
            response = await handleBackupRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/developer")) {
            response = await handleDeveloperRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/planned-activities")) {
            response = await handlePlannedActivityRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/quick-meals")) {
            response = await handleQuickMealRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/recalculate-calories")) {
            response = await handleRecalculateCaloriesRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/usage")) {
            response = await handleAnalyticsRoutes(req, url, headers);
        } else {
            response = new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
        }
    } catch (e) {
        console.error("Internal Server Error:", e);
        // Log to KV
        await logError(e instanceof Error ? e : String(e), { url: url.toString(), method }, undefined, url.pathname);
        response = new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
    }

    // Metrics Logging
    const duration = performance.now() - start;
    await logMetric("response_time", duration, { path: url.pathname, method, status: String(response.status) });
    await logMetric("request_count", 1, { path: url.pathname, method, status: String(response.status) });

    return response;
}
