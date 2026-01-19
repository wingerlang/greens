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
import { getSession } from "./db/session.ts";
import { getUserById } from "./db/user.ts";

export async function router(req: Request, remoteAddr: Deno.NetAddr): Promise<Response> {
    // Wrap with debug middleware
    return await debugMiddleware(req, async (req) => {
        return await internalRouter(req, remoteAddr);
    });
}

async function internalRouter(req: Request, remoteAddr: Deno.NetAddr): Promise<Response> {
    const start = performance.now();
    const url = new URL(req.url);
    const method = req.method;
    const clientIp = remoteAddr.hostname;

    // Track Session (excluding internal APIs if desired, but good to track all)
    if (!url.pathname.startsWith("/api/debug/client-error")) {
        // Try to resolve user if auth header exists
        let userForTracking = undefined;
        const authHeader = req.headers.get("Authorization");
        if (authHeader) {
            const token = authHeader.replace("Bearer ", "");
            try {
                // Determine user without touching session (avoid write overhead)
                const session = await getSession(token);
                if (session) {
                    const user = await getUserById(session.userId);
                    if (user) {
                        userForTracking = { id: user.id, username: user.username };
                    }
                }
            } catch (e) {
                // Ignore tracking errors
            }
        }
        sessionTracker.track(req, clientIp, userForTracking);
    }

    // CORS / Headers
    const headers = new Headers({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    });

    if (method === "OPTIONS") {
        return new Response(null, { headers });
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
        if (url.pathname.startsWith("/api/auth")) {
            response = await handleAuthRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/user")) {
            response = await handleUserRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/u/")) {
            response = await handleUserRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/users")) {
            response = await handleUserRoutes(req, url, headers);
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
            response = await handleStravaRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/social")) {
            response = await handleSocialRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/activities")) {
            response = await handleActivityRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/admin/kv")) {
            response = await handleAdminKvRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/admin/sessions")) {
            response = await handleAdminSessionRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/admin")) {
            response = await handleAdminRoutes(req, url, headers);
        } else if (url.pathname.startsWith("/api/strength")) {
            response = await handleStrengthRoutes(req, url, headers);
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
