import { kv } from "../kv.ts";
import { AppData } from "../../models/types.ts";
import { activityRepo } from "../repositories/activityRepository.ts";

export async function getUserData(userId: string): Promise<AppData | null> {
    const res = await kv.get(["user_profiles", userId]);
    const userData = res.value as AppData;

    if (userData) {
        // Merge activities from the specific repository (Source of Truth for synced data)
        const activities = await activityRepo.getActivitiesByDateRange(userId, "2020-01-01", "2030-12-31");
        console.log(`[getUserData] userId=${userId}, foundActivities=${activities.length}`);
        userData.universalActivities = activities;
    }

    return userData;
}

export async function saveUserData(userId: string, data: AppData): Promise<void> {
    // CRITICAL: Deno KV has a 64KB limit per value.
    // Exclude large static arrays (foodItems, recipes) that come from sample data.
    // Also exclude universalActivities as they are stored separately in activityRepo.
    const { foodItems, recipes, universalActivities, ...userSpecificData } = data;

    await kv.set(["user_profiles", userId], { ...userSpecificData, updatedAt: new Date().toISOString() });
}
