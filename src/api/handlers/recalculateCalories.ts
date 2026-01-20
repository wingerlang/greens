import { getSession } from "../db/session.ts";
import { getUserById } from "../db/user.ts";
import { activityRepo } from "../repositories/activityRepository.ts";
import { calculateStravaCalories } from "../strava.ts";

export async function handleRecalculateCaloriesRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // POST /api/recalculate-calories
    if (url.pathname === "/api/recalculate-calories" && method === "POST") {
        try {
            // Get user settings for calorie formula
            const user = await getUserById(userId);
            const userSettings = user?.settings || {};

            // Get all activities for this user
            const activities = await activityRepo.getAllActivities(userId);

            let updatedCount = 0;
            let skippedStravaCalories = 0;

            for (const activity of activities) {
                // Only process Strava activities
                if (activity.performance?.source?.source !== 'strava') continue;

                const currentBreakdown = activity.performance.calorieBreakdown || '';

                // STEP 1: If we already have Strava's OWN calories, don't touch them!
                // These are the most accurate and come directly from Strava's algorithms
                if (currentBreakdown.includes('Strava API')) {
                    skippedStravaCalories++;
                    continue;
                }

                // STEP 2: This activity was calculated with our fallback formula - recalculate it
                const stravaLikeActivity = {
                    id: parseInt(activity.performance.source.externalId || '0'),
                    name: activity.performance.notes || '',
                    type: mapActivityType(activity.performance.activityType || 'running'),
                    sport_type: mapActivityType(activity.performance.activityType || 'running'),
                    start_date: activity.date,
                    start_date_local: activity.date,
                    elapsed_time: (activity.performance.elapsedTimeSeconds || (activity.performance.durationMinutes || 60) * 60),
                    moving_time: (activity.performance.durationMinutes || 60) * 60,
                    distance: (activity.performance.distanceKm || 0) * 1000,
                    total_elevation_gain: activity.performance.elevationGain || 0,
                    average_heartrate: activity.performance.avgHeartRate,
                    max_heartrate: activity.performance.maxHeartRate,
                    calories: undefined, // Don't pass old value - let formula recalculate
                    average_speed: 0,
                    max_speed: 0,
                    has_heartrate: !!activity.performance.avgHeartRate,
                    pr_count: 0,
                    kudos_count: 0,
                    achievement_count: 0,
                };

                const calorieResult = calculateStravaCalories(stravaLikeActivity as any, userSettings as any);

                // Only update if value changed significantly (more than 1 kcal difference)
                if (Math.abs((activity.performance.calories || 0) - calorieResult.calories) > 1) {
                    activity.performance.calories = calorieResult.calories;
                    activity.performance.calorieBreakdown = calorieResult.breakdown;
                    activity.updatedAt = new Date().toISOString();

                    await activityRepo.saveActivity(activity);
                    updatedCount++;
                }
            }

            console.log(`[RecalculateCalories] User ${userId}: Updated ${updatedCount}, Skipped ${skippedStravaCalories} (already have Strava calories)`);

            return new Response(JSON.stringify({
                success: true,
                updated: updatedCount,
                skipped: skippedStravaCalories,
                total: activities.length
            }), { headers });

        } catch (e) {
            console.error('[RecalculateCalories] Error:', e);
            return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });
}

// Map our internal type back to Strava type for formula lookup
function mapActivityType(type: string): string {
    const mapping: Record<string, string> = {
        'running': 'Run',
        'cycling': 'Ride',
        'swimming': 'Swim',
        'strength': 'WeightTraining',
        'walking': 'Walk',
        'yoga': 'Yoga',
        'other': 'Workout'
    };
    return mapping[type] || 'Workout';
}
