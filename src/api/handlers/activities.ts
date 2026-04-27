import { activityRepo } from "../repositories/activityRepository.ts";
import { strengthRepo } from "../repositories/strengthRepository.ts";
import { getSession } from "../db/session.ts";
import { UniversalActivity } from "../../models/types.ts";
import { createMergedActivity, validateMerge } from "../services/activityMergeService.ts";
import { sanitizeObject } from "../utils/sanitize.ts";
import { logAudit } from "../utils/audit.ts";
import { ActivitySchema } from "../utils/schemas.ts";
import { AuthContext } from "../middleware.ts";
import { getUserData, saveUserData } from "../db/data.ts";
import { Tour } from "../../models/types.ts";

export async function handleActivityRoutes(req: Request, url: URL, headers: Headers, ctx: AuthContext | null): Promise<Response> {
    const method = req.method;
    if (!ctx) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const { user: session, token } = ctx;
    const userId = session.id; // ctx.user.id is string

    // GET /api/activities/:id
    if (url.pathname.startsWith("/api/activities/") && method === "GET") {
        const parts = url.pathname.split('/');
        if (parts.length === 4) {
            try {
                const activityId = parts[3];
                const activity = await activityRepo.getActivityById(activityId);

                if (!activity || activity.userId !== userId) {
                    return new Response(JSON.stringify({ error: "Activity not found" }), { status: 404, headers });
                }

                return new Response(JSON.stringify(activity), { headers });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
            }
        }
    }

    // GET /api/activities
    if (url.pathname === "/api/activities" && method === "GET") {
        try {
            const startDate = url.searchParams.get('start') || '1970-01-01';
            const endDate = url.searchParams.get('end') || '2100-01-01';

            const activities = await activityRepo.getActivitiesByDateRange(userId, startDate, endDate);
            return new Response(JSON.stringify({ activities }), { headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // POST /api/activities
    if (url.pathname === "/api/activities" && method === "POST") {
        try {
            const body = await req.json();
            const result = ActivitySchema.safeParse(body);
            if (!result.success) {
                return new Response(JSON.stringify({ error: result.error.issues[0].message }), { status: 400, headers });
            }

            let activity = result.data as UniversalActivity;
            // Always enforce session user
            activity.userId = userId;

            // Sanitize
            activity = sanitizeObject(activity);

            await activityRepo.saveActivity(activity);
            return new Response(JSON.stringify({ success: true, id: activity.id }), { status: 200, headers });
        } catch (e: any) {
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
                // Fetch activities by ID (using the new ID index for efficiency)
                for (const aid of activityIds) {
                    const act = await activityRepo.getActivityById(aid);
                    if (act && act.userId === userId) {
                        activitiesToMerge.push(act);
                    }
                }
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
            const mergedActivity = createMergedActivity(activitiesToMerge, userId);

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

            // Get the merged activity using ID index
            const mergedActivity = await activityRepo.getActivityById(mergedActivityId);
            if (!mergedActivity || mergedActivity.userId === userId) {
                return new Response(JSON.stringify({ error: "Merged activity not found" }), { status: 404, headers });
            }

            if (!mergedActivity.mergeInfo?.isMerged) {
                return new Response(JSON.stringify({ error: "Activity is not merged" }), { status: 400, headers });
            }

            // Get original activities
            const originalIds = mergedActivity.mergeInfo.originalActivityIds;
            const originalActivities: UniversalActivity[] = [];
            for (const oid of originalIds) {
                const act = await activityRepo.getActivityById(oid);
                if (act) originalActivities.push(act);
            }

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


    // PATCH /api/activities/:id - Partial update (e.g. title)
    if (url.pathname.startsWith("/api/activities/") && method === "PATCH") {
        try {
            const parts = url.pathname.split('/');
            const activityId = parts[3];
            const updates = await req.json();

            let activity: UniversalActivity | null = null;

            // Use the new ID index (avoids scans!)
            activity = await activityRepo.getActivityById(activityId);

            // Fallback for older activities missing the ID index
            const urlDate = url.searchParams.get('date');
            if (!activity && urlDate) {
                activity = await activityRepo.getActivity(userId, urlDate, activityId);
            }

            if (!activity || activity.userId !== userId) {
                // If not found in activities, try strength repo
                const workout = await strengthRepo.getWorkout(userId, activityId);
                if (workout) {
                    console.log(`[PATCH /api/activities] Found strength workout for ID ${activityId}, applying updates...`);

                    if (updates.title !== undefined) workout.name = updates.title;
                    if (updates.notes !== undefined) workout.notes = updates.notes;
                    if (updates.durationMinutes !== undefined) workout.duration = updates.durationMinutes;
                    if (updates.excludeFromStats !== undefined) workout.excludeFromStats = updates.excludeFromStats;

                    workout.updatedAt = new Date().toISOString();
                    await strengthRepo.saveWorkout(workout);

                    await logAudit({ actorId: userId, action: "UPDATE_STRENGTH_WORKOUT", targetId: activityId });

                    return new Response(JSON.stringify({ success: true, message: "Strength workout updated" }), { status: 200, headers });
                }

                return new Response(JSON.stringify({ error: "Activity not found" }), { status: 404, headers });
            }

            // Validate updates if performance or plan is provided
            if (updates.performance || updates.plan) {
                // We partial parse here or just validate the relevant section
                // For now, let's keep it simple as it's a PATCH
            }

            // Auto-migrate legacy/flat structure to Universal
            const legacy = activity as any;
            if (!activity.performance && legacy.durationMinutes !== undefined) {
                activity.performance = {
                    durationMinutes: legacy.durationMinutes || 0,
                    calories: legacy.calories || 0,
                    distanceKm: legacy.distance || legacy.distanceKm || 0,
                    activityType: legacy.type || 'other',
                    source: legacy.source,
                    notes: legacy.notes,
                    excludeFromStats: legacy.excludeFromStats
                };
            }
            if (!activity.plan && (legacy.title || legacy.type || activity.performance?.notes)) {
                activity.plan = {
                    title: legacy.title || activity.performance?.notes || 'Aktivitet',
                    activityType: legacy.type || activity.performance?.activityType || 'other',
                    distanceKm: legacy.distance || legacy.distanceKm || activity.performance?.distanceKm || 0,
                    durationMinutes: legacy.durationMinutes || activity.performance?.durationMinutes
                };
            }

            // Support both flat updates and nested performance object
            if (updates.title !== undefined) {
                if (!activity.plan) {
                    const type = activity.performance?.activityType || 'other';
                    activity.plan = { title: updates.title, activityType: type, distanceKm: activity.performance?.distanceKm || 0 };
                } else {
                    activity.plan.title = updates.title;
                }
            }
            if (updates.notes !== undefined) {
                if (!activity.performance) {
                    activity.performance = { durationMinutes: 0, calories: 0, notes: updates.notes };
                } else {
                    activity.performance.notes = updates.notes;
                }
                if (activity.plan) activity.plan.description = updates.notes;
            }
            if (updates.excludeFromStats !== undefined) {
                if (!activity.performance) {
                    activity.performance = { durationMinutes: 0, calories: 0, excludeFromStats: updates.excludeFromStats };
                } else {
                    activity.performance.excludeFromStats = updates.excludeFromStats;
                }
            }

            // Top-level fields
            if (updates.location !== undefined) activity.location = updates.location;
            if (updates.raceDetails !== undefined) activity.raceDetails = updates.raceDetails;
            if (updates.hyroxStats !== undefined) activity.hyroxStats = updates.hyroxStats;
            if (updates.isHiddenInCalendar !== undefined) {
                activity.isHiddenInCalendar = updates.isHiddenInCalendar;
                if (activity.performance) activity.performance.isHiddenInCalendar = updates.isHiddenInCalendar;
            }

            // Performance related fields (support both top-level and performance object)
            const perfUpdates: any = {};
            if (updates.averageWatts !== undefined) perfUpdates.averageWatts = updates.averageWatts;
            if (updates.maxWatts !== undefined) perfUpdates.maxWatts = updates.maxWatts;
            if (updates.distance !== undefined) perfUpdates.distanceKm = updates.distance;
            if (updates.distanceKm !== undefined) perfUpdates.distanceKm = updates.distanceKm;
            if (updates.durationMinutes !== undefined) perfUpdates.durationMinutes = updates.durationMinutes;
            if (updates.calories !== undefined) perfUpdates.calories = updates.calories;
            if (updates.caloriesBurned !== undefined) perfUpdates.calories = updates.caloriesBurned;
            if (updates.isCalorieAdjusted !== undefined) perfUpdates.isCalorieAdjusted = updates.isCalorieAdjusted;
            if (updates.originalCalories !== undefined) perfUpdates.originalCalories = updates.originalCalories;
            if (updates.subType !== undefined) perfUpdates.subType = updates.subType;
            if (updates.type !== undefined || updates.activityType !== undefined) {
                perfUpdates.activityType = updates.type || updates.activityType;
            }

            // Physiological data
            if (updates.heartRateAvg !== undefined) perfUpdates.avgHeartRate = updates.heartRateAvg;
            if (updates.heartRateMax !== undefined) perfUpdates.maxHeartRate = updates.heartRateMax;

            // Apply flat performance updates
            if (Object.keys(perfUpdates).length > 0) {
                activity.performance = { ...(activity.performance || { durationMinutes: 0, calories: 0 }), ...perfUpdates };
                // Also update plan type if changed
                if (perfUpdates.activityType && activity.plan) {
                    activity.plan.activityType = perfUpdates.activityType;
                }
            }

            // Nested performance object update (highest precedence)
            if (updates.performance !== undefined) {
                activity.performance = { ...(activity.performance || { durationMinutes: 0, calories: 0 }), ...updates.performance };
            }

            activity.updatedAt = new Date().toISOString();
            await activityRepo.saveActivity(activity);

            return new Response(JSON.stringify({ success: true, activity }), { status: 200, headers });
        } catch (e) {
            return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
        }
    }

    // DELETE /api/activities/:id
    if (url.pathname.startsWith("/api/activities/") && method === "DELETE") {
        try {
            const parts = url.pathname.split('/');
            const activityId = parts[3];

            if (!activityId) {
                return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
            }

            let activity = await activityRepo.getActivityById(activityId);

            // Fallback for older activities missing the ID index
            const urlDate = url.searchParams.get('date');
            if (!activity && urlDate) {
                activity = await activityRepo.getActivity(userId, urlDate, activityId);
            }

            if (!activity || activity.userId !== userId) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

            // If it's a merged activity, we must restore original activities
            if (activity.mergeInfo?.isMerged && activity.mergeInfo.originalActivityIds) {
                const originalIds = activity.mergeInfo.originalActivityIds;
                for (const oid of originalIds) {
                    const original = await activityRepo.getActivityById(oid);
                    if (original && original.userId === userId) {
                        delete original.mergedIntoId;
                        original.updatedAt = new Date().toISOString();
                        await activityRepo.saveActivity(original);
                    }
                }
            }

            await activityRepo.deleteActivity(activity);
            await logAudit({ actorId: userId, action: "DELETE_ACTIVITY", targetId: activityId });
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // POST /api/tours - Create or update a tour
    if (url.pathname === "/api/tours" && method === "POST") {
        try {
            const body = await req.json() as Tour;
            if (!body.id || !body.name || !body.date) {
                return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
            }

            const data = await getUserData(userId);
            const currentData = data || {};
            const currentTours = currentData.tours || [];

            const existingIndex = currentTours.findIndex(t => t.id === body.id);
            if (existingIndex >= 0) {
                currentTours[existingIndex] = body;
            } else {
                currentTours.push(body);
            }

            await saveUserData(userId, { ...currentData, tours: currentTours } as any);

            return new Response(JSON.stringify({ success: true, tour: body }), { headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // DELETE /api/tours - Delete a tour
    if (url.pathname === "/api/tours" && method === "DELETE") {
        try {
            const id = url.searchParams.get("id");
            if (!id) return new Response(JSON.stringify({ error: "Missing id" }), { status: 400, headers });

            const data = await getUserData(userId);
            if (!data || !data.tours) {
                return new Response(JSON.stringify({ success: true }), { headers });
            }

            const currentTours = data.tours.filter(t => t.id !== id);
            await saveUserData(userId, { ...data, tours: currentTours } as any);

            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    // GET /api/tours/:id/standings - Get cross-user standings for a tour
    if (url.pathname.startsWith("/api/tours/") && url.pathname.endsWith("/standings") && method === "GET") {
        try {
            const tourId = url.pathname.split('/')[3];
            const data = await getUserData(userId);
            const tour = data?.tours?.find(t => t.id === tourId);

            if (!tour) {
                return new Response(JSON.stringify({ error: "Tour not found" }), { status: 404, headers });
            }

            // Get all race definitions for this tour
            const tourRaces = (data?.raceDefinitions || []).filter(rd => tour.raceDefinitionIds.includes(rd.id));
            const raceNames = tourRaces.flatMap(rd => [rd.name, ...(rd.aliases || [])]);
            const tourYear = tour.date.split('-')[0];

            // Find all matching activities from ALL users
            const activities = await activityRepo.findActivitiesForRaces(raceNames, tourYear);

            // Group activities by race name (id) and user
            const standings = activities.map(a => ({
                userId: a.userId,
                activityId: a.id,
                date: a.date,
                title: a.plan?.title || a.performance?.notes || '',
                distanceKm: a.performance?.distanceKm || 0,
                durationMinutes: a.performance?.durationMinutes || 0,
                // Match back to race definition ID
                raceDefinitionId: tourRaces.find(rd => 
                    (a.plan?.title || '').toLowerCase().includes(rd.name.toLowerCase()) ||
                    (rd.aliases || []).some(alias => (a.plan?.title || '').toLowerCase().includes(alias.toLowerCase()))
                )?.id
            })).filter(s => s.raceDefinitionId);

            return new Response(JSON.stringify({ standings }), { headers });
        } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
