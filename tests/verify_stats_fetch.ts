
import { fetchAllStrengthWorkouts, fetchAllActivities } from '../src/api/services/statisticsService.ts';

// Mock dependencies if needed, or rely on the actual DB if seeded
// For this environment, we assume the DB has some data or we are testing the function logic.

console.log("Starting verification of Statistics Service Fetch Logic...");

try {
    const workouts = await fetchAllStrengthWorkouts();
    console.log(`✅ Strength Workouts Fetched: ${workouts.length}`);
    if (workouts.length > 0) {
        console.log("Sample Workout:", workouts[0].id, workouts[0].name);
    }

    const activities = await fetchAllActivities();
    console.log(`✅ Activities Fetched: ${activities.length}`);
    if (activities.length > 0) {
        console.log("Sample Activity:", activities[0].id, activities[0].performance?.activityType);
    }

} catch (error) {
    console.error("❌ Verification Failed:", error);
    Deno.exit(1);
}
