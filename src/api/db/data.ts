import { kv } from "../kv.ts";
import { AppData, User } from "../../models/types.ts";
import { DBUser } from "./user.ts";
import { activityRepo } from "../repositories/activityRepository.ts";
import { mealRepo } from "../repositories/mealRepository.ts";
import { weightRepo } from "../repositories/weightRepository.ts";
import { strengthRepo } from "../repositories/strengthRepository.ts";

export async function getUserData(userId: string): Promise<AppData | null> {
    const res = await kv.get(["user_profiles", userId]);
    const userData = (res.value as AppData) || {
        mealEntries: [],
        weightEntries: [],
        exerciseEntries: [],
        trainingCycles: [],
        plannedActivities: [],
        pantryItems: [],
        pantryQuantities: {},
    };

    // 1. Fetch meals (Source of truth is now mealRepo)
    const meals = await mealRepo.getMealsInRange(userId, "2000-01-01", "2099-12-31");
    if (meals.length > 0) {
        userData.mealEntries = meals;
    }

    // 2. Fetch weight (Source of truth is now weightRepo)
    const weightHistory = await weightRepo.getWeightHistory(userId);
    if (weightHistory.length > 0) {
        userData.weightEntries = weightHistory;
    }

    // 3. Merge activities
    const activities = await activityRepo.getActivitiesByDateRange(userId, "2020-01-01", "2030-12-31");
    userData.universalActivities = activities;

    // 4. Fetch strength workouts
    const strengthSessions = await strengthRepo.getAllWorkouts(userId);
    if (strengthSessions.length > 0) {
        (userData as any).strengthSessions = strengthSessions;
    }

    return userData;
}

export async function saveUserData(userId: string, data: AppData): Promise<void> {
    // 1. Distribute granular data to repositories if present in payload
    if (data.mealEntries && data.mealEntries.length > 0) {
        for (const meal of data.mealEntries) {
            await mealRepo.saveMeal(userId, meal);
        }
    }

    if (data.weightEntries && data.weightEntries.length > 0) {
        for (const entry of data.weightEntries) {
            await weightRepo.saveWeight(userId, entry);
        }
    }

    // 2. Save the rest as a profile blob (excluding large/granular items)
    const {
        foodItems,
        recipes,
        universalActivities,
        mealEntries,
        weightEntries,
        strengthSessions,
        ...userSpecificData
    } = data;

    await kv.set(["user_profiles", userId], { ...userSpecificData, updatedAt: new Date().toISOString() });

    // 3. Sync settings back to primary user record if present in users list
    const currentUserInPayload = data.users?.find(u => u.id === userId);
    if (currentUserInPayload) {
        const userEntry = await kv.get<DBUser>(["users", userId]);
        if (userEntry.value) {
            const user = userEntry.value;
            // Only update if settings are different
            if (JSON.stringify(user.settings) !== JSON.stringify(currentUserInPayload.settings)) {
                user.settings = currentUserInPayload.settings;
                await kv.set(["users", userId], user);
                console.log(`[saveUserData] Synced settings for user ${userId}`);
            }
        }
    }
}

