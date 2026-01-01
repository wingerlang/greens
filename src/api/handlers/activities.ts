import { activityRepo } from "../repositories/activityRepository.ts";
import { getSession } from "../db/session.ts";
import { UniversalActivity } from "../../models/types.ts";
import { createMergedActivity, validateMerge } from "../services/activityMergeService.ts";

export async function handleActivityRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });
    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    // GET /api/activities
    if (url.pathname === "/api/activities" && method === "GET") {
        try {
            const startDate = url.searchParams.get('start');
            const endDate = url.searchParams.get('end');

            if (!startDate || !endDate) {
                return new Response(JSON.stringify({ error: "Missing start/end date params" }), { status: 400, headers });
            }

            const activities = await activityRepo.getActivitiesByDateRange(session.userId, startDate, endDate);
            return new Response(JSON.stringify({ activities }), { headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // POST /api/activities
    if (url.pathname === "/api/activities" && method === "POST") {
        try {
            const activity = await req.json() as UniversalActivity;
            if (activity.userId !== session.userId) {
                return new Response(JSON.stringify({ error: "UserId mismatch" }), { status: 403, headers });
            }
            await activityRepo.saveActivity(activity);
            return new Response(JSON.stringify({ success: true, id: activity.id }), { status: 200, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // POST /api/activities/merge - Merge multiple activities into one
    if (url.pathname === "/api/activities/merge" && method === "POST") {
        try {
            const { activityIds, activities: providedActivities } = await req.json() as {
                activityIds?: string[];
                activities?: UniversalActivity[];
            };

            // Either get activities by ID or use provided activities
            let activitiesToMerge: UniversalActivity[] = [];

            if (providedActivities && providedActivities.length >= 2) {
                activitiesToMerge = providedActivities;
            } else if (activityIds && activityIds.length >= 2) {
                // Fetch activities by ID (need date for each - use a range)
                const allActivities = await activityRepo.getActivitiesByDateRange(
                    session.userId,
                    '2020-01-01',
                    new Date().toISOString().split('T')[0]
                );
                activitiesToMerge = allActivities.filter(a => activityIds.includes(a.id));
            }

            if (activitiesToMerge.length < 2) {
                return new Response(JSON.stringify({ error: "Need at least 2 activities to merge" }), { status: 400, headers });
            }

            // Validate merge
            const validation = validateMerge(activitiesToMerge);
            if (!validation.valid) {
                return new Response(JSON.stringify({ error: validation.error }), { status: 400, headers });
            }

            // Create merged activity
            const mergedActivity = createMergedActivity(activitiesToMerge, session.userId);

            // Save merged activity
            await activityRepo.saveActivity(mergedActivity);

            // Mark original activities as hidden by setting mergedIntoId
            for (const original of activitiesToMerge) {
                original.mergedIntoId = mergedActivity.id;
                original.updatedAt = new Date().toISOString();
                await activityRepo.saveActivity(original);
            }

            return new Response(JSON.stringify({
                success: true,
                mergedActivity,
                warning: validation.warning
            }), { status: 200, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // POST /api/activities/:id/separate - Separate a merged activity back to originals
    if (url.pathname.match(/^\/api\/activities\/[^/]+\/separate$/) && method === "POST") {
        try {
            const parts = url.pathname.split('/');
            const mergedActivityId = parts[3];

            // Get the merged activity
            const allActivities = await activityRepo.getActivitiesByDateRange(
                session.userId,
                '2020-01-01',
                new Date().toISOString().split('T')[0]
            );

            const mergedActivity = allActivities.find(a => a.id === mergedActivityId);
            if (!mergedActivity) {
                return new Response(JSON.stringify({ error: "Merged activity not found" }), { status: 404, headers });
            }

            if (!mergedActivity.mergeInfo?.isMerged) {
                return new Response(JSON.stringify({ error: "Activity is not merged" }), { status: 400, headers });
            }

            // Get original activities and clear their mergedIntoId
            const originalIds = mergedActivity.mergeInfo.originalActivityIds;
            const originalActivities = allActivities.filter(a => originalIds.includes(a.id));

            // Clear mergedIntoId on originals to make them visible again
            for (const original of originalActivities) {
                delete original.mergedIntoId;
                original.updatedAt = new Date().toISOString();
                await activityRepo.saveActivity(original);
            }

            // Delete the merged activity
            await activityRepo.deleteActivity(mergedActivity);

            return new Response(JSON.stringify({
                success: true,
                originalActivities,
                separatedCount: originalActivities.length
            }), { status: 200, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // DELETE /api/activities/:id
    if (url.pathname.startsWith("/api/activities/") && method === "DELETE") {
        try {
            const parts = url.pathname.split('/');
            const activityId = parts[3];
            const date = url.searchParams.get('date');

            if (!activityId || !date) {
                return new Response(JSON.stringify({ error: "Missing ID or Date" }), { status: 400, headers });
            }

            const activity = await activityRepo.getActivity(session.userId, date, activityId);
            if (!activity) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

            await activityRepo.deleteActivity(activity);
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}

