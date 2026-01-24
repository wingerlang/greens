import { activityRepo } from "../repositories/activityRepository.ts";
import { strengthRepo } from "../repositories/strengthRepository.ts";
import { getSession } from "../db/session.ts";
import { UniversalActivity } from "../../models/types.ts";
import {
  createMergedActivity,
  validateMerge,
} from "../services/activityMergeService.ts";

export async function handleActivityRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  const method = req.method;
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "No token" }), {
      status: 401,
      headers,
    });
  }
  const session = await getSession(token);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers,
    });
  }

  // GET /api/activities
  if (url.pathname === "/api/activities" && method === "GET") {
    try {
      const startDate = url.searchParams.get("start");
      const endDate = url.searchParams.get("end");

      if (!startDate || !endDate) {
        return new Response(
          JSON.stringify({ error: "Missing start/end date params" }),
          { status: 400, headers },
        );
      }

      const activities = await activityRepo.getActivitiesByDateRange(
        session.userId,
        startDate,
        endDate,
      );
      return new Response(JSON.stringify({ activities }), { headers });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers,
      });
    }
  }

  // POST /api/activities
  if (url.pathname === "/api/activities" && method === "POST") {
    try {
      const activity = await req.json() as UniversalActivity;
      // Always enforce session user
      activity.userId = session.userId;

      await activityRepo.saveActivity(activity);
      return new Response(JSON.stringify({ success: true, id: activity.id }), {
        status: 200,
        headers,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers,
      });
    }
  }

  // POST /api/activities/merge - Merge multiple activities into one
  if (url.pathname === "/api/activities/merge" && method === "POST") {
    try {
      const { activityIds, activities: providedActivities } = await req
        .json() as {
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
          "2020-01-01",
          new Date().toISOString().split("T")[0],
        );
        activitiesToMerge = allActivities.filter((a) =>
          activityIds.includes(a.id)
        );
      }

      if (activitiesToMerge.length < 2) {
        return new Response(
          JSON.stringify({ error: "Need at least 2 activities to merge" }),
          { status: 400, headers },
        );
      }

      // Validate merge
      const validation = validateMerge(activitiesToMerge);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers,
        });
      }

      // Create merged activity
      const mergedActivity = createMergedActivity(
        activitiesToMerge,
        session.userId,
      );

      // Save merged activity
      await activityRepo.saveActivity(mergedActivity);

      // Mark original activities as hidden by setting mergedIntoId
      for (const original of activitiesToMerge) {
        original.mergedIntoId = mergedActivity.id;
        original.updatedAt = new Date().toISOString();
        await activityRepo.saveActivity(original);
      }

      return new Response(
        JSON.stringify({
          success: true,
          mergedActivity,
          warning: validation.warning,
        }),
        { status: 200, headers },
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500,
        headers,
      });
    }
  }

  // POST /api/activities/:id/separate - Separate a merged activity back to originals
  if (
    url.pathname.match(/^\/api\/activities\/[^/]+\/separate$/) &&
    method === "POST"
  ) {
    try {
      const parts = url.pathname.split("/");
      const mergedActivityId = parts[3];

      // Get the merged activity
      const allActivities = await activityRepo.getActivitiesByDateRange(
        session.userId,
        "2020-01-01",
        new Date().toISOString().split("T")[0],
      );

      const mergedActivity = allActivities.find((a) =>
        a.id === mergedActivityId
      );
      if (!mergedActivity) {
        return new Response(
          JSON.stringify({ error: "Merged activity not found" }),
          { status: 404, headers },
        );
      }

      if (!mergedActivity.mergeInfo?.isMerged) {
        return new Response(
          JSON.stringify({ error: "Activity is not merged" }),
          { status: 400, headers },
        );
      }

      // Get original activities and clear their mergedIntoId
      const originalIds = mergedActivity.mergeInfo.originalActivityIds;
      const originalActivities = allActivities.filter((a) =>
        originalIds.includes(a.id)
      );

      // Clear mergedIntoId on originals to make them visible again
      for (const original of originalActivities) {
        delete original.mergedIntoId;
        original.updatedAt = new Date().toISOString();
        await activityRepo.saveActivity(original);
      }

      // Delete the merged activity
      await activityRepo.deleteActivity(mergedActivity);

      return new Response(
        JSON.stringify({
          success: true,
          originalActivities,
          separatedCount: originalActivities.length,
        }),
        { status: 200, headers },
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500,
        headers,
      });
    }
  }

  // PATCH /api/activities/:id - Partial update (e.g. title)
  if (url.pathname.startsWith("/api/activities/") && method === "PATCH") {
    try {
      const parts = url.pathname.split("/");
      const activityId = parts[3];
      const dateParams = url.searchParams.get("date");

      const updates = await req.json();

      let activity: UniversalActivity | null = null;

      // 1. Try direct lookup if date provided
      if (dateParams) {
        activity = await activityRepo.getActivity(
          session.userId,
          dateParams,
          activityId,
        );
      }

      // 2. Fallback: Scan if not found or no date
      if (!activity) {
        // Determine search range - could be huge, but for now let's try reasonable bounds or just scan all if needed.
        // Since this is a "fix" operation, scanning all for user is acceptable performance-wise temporarily.
        const all = await activityRepo.getAllActivities(session.userId);
        activity = all.find((a) => a.id === activityId) || null;
      }

      if (!activity) {
        // 3. Fallback to Strength Repo: Maybe this is a merged activity using a strength ID
        const workout = await strengthRepo.getWorkout(
          session.userId,
          activityId,
        );
        if (workout) {
          console.log(
            `[PATCH /api/activities] Found strength workout for ID ${activityId}, applying updates...`,
          );

          if (updates.title !== undefined) workout.name = updates.title;
          if (updates.notes !== undefined) workout.notes = updates.notes;
          if (updates.durationMinutes !== undefined) {
            workout.duration = updates.durationMinutes;
          }
          if (updates.excludeFromStats !== undefined) {
            workout.excludeFromStats = updates.excludeFromStats;
          }
          if (updates.intensity !== undefined) {
            // Strength sessions don't have intensity yet, but we can store it in notes or ignore
          }

          workout.updatedAt = new Date().toISOString();
          await strengthRepo.saveWorkout(workout);

          return new Response(
            JSON.stringify({
              success: true,
              message: "Strength workout updated",
            }),
            { status: 200, headers },
          );
        }

        return new Response(JSON.stringify({ error: "Activity not found" }), {
          status: 404,
          headers,
        });
      }

      // Auto-migrate legacy/flat structure to Universal
      const legacy = activity as any;
      if (!activity.performance && legacy.durationMinutes !== undefined) {
        activity.performance = {
          durationMinutes: legacy.durationMinutes || 0,
          calories: legacy.calories || 0,
          distanceKm: legacy.distance || legacy.distanceKm || 0,
          activityType: legacy.type || "other",
          source: legacy.source,
          notes: legacy.notes,
          excludeFromStats: legacy.excludeFromStats,
        };
        // Ensure date is preserved if moving
      }
      if (
        !activity.plan &&
        (legacy.title || legacy.type || activity.performance?.notes)
      ) {
        activity.plan = {
          title: legacy.title || activity.performance?.notes || "Aktivitet",
          activityType: legacy.type || activity.performance?.activityType ||
            "other",
          distanceKm: legacy.distance || legacy.distanceKm ||
            activity.performance?.distanceKm || 0,
          durationMinutes: legacy.durationMinutes ||
            activity.performance?.durationMinutes,
        };
      }

      // Apply updates
      // Map flat "title" to plan.title
      if (updates.title !== undefined) {
        if (!activity.plan) {
          // Create minimal valid plan section
          const type = activity.performance?.activityType || "other";
          activity.plan = {
            title: updates.title,
            activityType: type,
            distanceKm: activity.performance?.distanceKm || 0,
          };
        } else {
          activity.plan.title = updates.title;
        }
      }

      // Map flat "notes" to plan.description or performance.notes
      if (updates.notes !== undefined) {
        if (!activity.performance) {
          activity.performance = {
            durationMinutes: 0,
            calories: 0,
            notes: updates.notes,
          };
        } else {
          activity.performance.notes = updates.notes;
        }

        // Also update plan description if it exists
        if (activity.plan) activity.plan.description = updates.notes;
      }

      // Handle excludeFromStats direct update
      if (updates.excludeFromStats !== undefined) {
        if (!activity.performance) {
          activity.performance = {
            durationMinutes: 0,
            calories: 0,
            excludeFromStats: updates.excludeFromStats,
          };
        } else {
          activity.performance.excludeFromStats = updates.excludeFromStats;
        }
      }

      // Handle performance object updates (e.g., subType for race marking)
      if (updates.performance !== undefined) {
        if (!activity.performance) {
          activity.performance = {
            durationMinutes: 0,
            calories: 0,
            ...updates.performance,
          };
        } else {
          // Merge performance updates
          activity.performance = {
            ...activity.performance,
            ...updates.performance,
          };
        }
      }

      // Handle direct subType update (shorthand)
      if (updates.subType !== undefined) {
        if (!activity.performance) {
          activity.performance = {
            durationMinutes: 0,
            calories: 0,
            subType: updates.subType,
          };
        } else {
          activity.performance.subType = updates.subType;
        }
      }

      // Handle direct activity type update (Recategorization)
      if (updates.type !== undefined || updates.activityType !== undefined) {
        const newType = updates.type || updates.activityType;

        if (!activity.performance) {
          activity.performance = {
            durationMinutes: 0,
            calories: 0,
            activityType: newType,
          };
        } else {
          activity.performance.activityType = newType;
        }

        if (!activity.plan) {
          activity.plan = {
            title: legacy.title || activity.performance?.notes || "Aktivitet",
            activityType: newType,
            distanceKm: activity.performance?.distanceKm || 0,
          };
        } else {
          activity.plan.activityType = newType;
        }
      }

      activity.updatedAt = new Date().toISOString();
      await activityRepo.saveActivity(activity);

      return new Response(JSON.stringify({ success: true, activity }), {
        status: 200,
        headers,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 500,
        headers,
      });
    }
  }

  // DELETE /api/activities/:id
  if (url.pathname.startsWith("/api/activities/") && method === "DELETE") {
    try {
      const parts = url.pathname.split("/");
      const activityId = parts[3];
      const date = url.searchParams.get("date");

      if (!activityId || !date) {
        return new Response(JSON.stringify({ error: "Missing ID or Date" }), {
          status: 400,
          headers,
        });
      }

      const activity = await activityRepo.getActivity(
        session.userId,
        date,
        activityId,
      );
      if (!activity) {
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers,
        });
      }

      // If it's a merged activity, we must restore original activities
      if (
        activity.mergeInfo?.isMerged && activity.mergeInfo.originalActivityIds
      ) {
        // We need all activities to find the originals efficiently if we don't know their dates
        // Actually we can just scan for them or assume they are on the same date (usually they are)
        // But for safety, let's scan all for user (performance is fine for individual delete)
        const all = await activityRepo.getAllActivities(session.userId);
        const originalIds = activity.mergeInfo.originalActivityIds;
        const originals = all.filter((a) => originalIds.includes(a.id));

        for (const original of originals) {
          delete original.mergedIntoId;
          original.updatedAt = new Date().toISOString();
          await activityRepo.saveActivity(original);
        }
      }

      await activityRepo.deleteActivity(activity);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers,
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers,
  });
}
