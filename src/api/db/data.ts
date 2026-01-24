import { kv } from "../kv.ts";
import { AppData, User } from "../../models/types.ts";
import { DBUser } from "./user.ts";
import { activityRepo } from "../repositories/activityRepository.ts";
import { mealRepo } from "../repositories/mealRepository.ts";
import { weightRepo } from "../repositories/weightRepository.ts";
import { strengthRepo } from "../repositories/strengthRepository.ts";
import { goalRepo } from "../repositories/goalRepository.ts";
import { periodRepo } from "../repositories/periodRepository.ts";
import { foodRepo } from "../repositories/foodRepository.ts";
import { FoodItem } from "../../models/types.ts";
import { weeklyPlanRepo } from "../repositories/weeklyPlanRepository.ts";
import { recipeRepo } from "../repositories/recipeRepository.ts";
import { exerciseEntryRepo } from "../repositories/exerciseEntryRepository.ts";
import { quickMealRepo } from "../repositories/quickMealRepository.ts";

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
    foodItems: [],
    recipes: [],
  };

  // 0. Fetch Goals & Periods (Migration Support)
  // We combine legacy goals (from blob) with new repo goals.
  const repoGoals = await goalRepo.getGoals(userId);
  const legacyGoals = userData.performanceGoals || [];
  // Simple de-duplication by ID (Repo takes precedence)
  const goalMap = new Map();
  legacyGoals.forEach((g) => goalMap.set(g.id, g));
  repoGoals.forEach((g) => goalMap.set(g.id, g));
  userData.performanceGoals = Array.from(goalMap.values());

  // Fetch periods
  (userData as any).trainingPeriods = await periodRepo.getPeriods(userId);

  // Fetch weekly plans
  const repoPlans = await weeklyPlanRepo.getPlans(userId);
  if (repoPlans.length > 0) {
    userData.weeklyPlans = repoPlans;
  }

  // Fetch recipes
  const repoRecipes = await recipeRepo.getRecipes(userId);
  if (repoRecipes.length > 0) {
    userData.recipes = repoRecipes;
  }

  // Fetch exercise entries
  const repoExercises = await exerciseEntryRepo.getEntriesInRange(
    userId,
    "2000-01-01",
    "2099-12-31",
  );
  if (repoExercises.length > 0) {
    userData.exerciseEntries = repoExercises;
  }

  // Fetch quick meals
  const repoQuickMeals = await quickMealRepo.getQuickMeals(userId);
  if (repoQuickMeals.length > 0) {
    userData.quickMeals = repoQuickMeals;
  }

  // 1. Fetch meals (Source of truth is now mealRepo)
  const meals = await mealRepo.getMealsInRange(
    userId,
    "2000-01-01",
    "2099-12-31",
  );
  if (meals.length > 0) {
    userData.mealEntries = meals;
  }

  // 2. Fetch weight (Source of truth is now weightRepo)
  const weightHistory = await weightRepo.getWeightHistory(userId);
  if (weightHistory.length > 0) {
    userData.weightEntries = weightHistory;
  }

  // 3. Merge activities - Use getAllActivities to ensure no activities are missed
  const activities = await activityRepo.getAllActivities(userId);
  userData.universalActivities = activities;

  // 4. Fetch strength workouts
  const strengthSessions = await strengthRepo.getAllWorkouts(userId);
  if (strengthSessions.length > 0) {
    (userData as any).strengthSessions = strengthSessions;
  }

  // 5. Global Food Items Sync
  // Fetch from global repo and merge with profile-specific items
  const globalFoods = await foodRepo.getAllFoods();
  if (globalFoods.length > 0) {
    const foodMap = new Map();
    (userData.foodItems || []).forEach((f: FoodItem) => foodMap.set(f.id, f));
    globalFoods.forEach((f: FoodItem) => foodMap.set(f.id, f));
    userData.foodItems = Array.from(foodMap.values());
  }

  return userData;
}

export async function saveUserData(
  userId: string,
  data: AppData,
): Promise<void> {
  // 1. GRANULAR DATA DECOUPLING
  // We NO LONGER sync meals/weights here.
  // The frontend must use granular APIs (POST/PUT/DELETE) for these entities.
  // This prevents race conditions where an old monolithic payload wipes out new granular data.

  // 2. Save the rest as a profile blob (excluding large/granular items)
  // NOTE: performanceGoals are now excluded because they are handled via repo.
  // However, if we don't exclude them, they just sit there as legacy.
  // Ideally we strip them to keep blob small.
  // We also intercept them here to save to repo during migration.

  if (data.performanceGoals && data.performanceGoals.length > 0) {
    for (const goal of data.performanceGoals) {
      await goalRepo.saveGoal(userId, goal);
    }
  }

  if (
    (data as any).trainingPeriods && (data as any).trainingPeriods.length > 0
  ) {
    for (const period of (data as any).trainingPeriods) {
      await periodRepo.savePeriod(userId, period);
    }
  }

  if (data.weeklyPlans && data.weeklyPlans.length > 0) {
    for (const plan of data.weeklyPlans) {
      await weeklyPlanRepo.savePlan(userId, plan);
    }
  }

  if (data.recipes && data.recipes.length > 0) {
    for (const recipe of data.recipes) {
      await recipeRepo.saveRecipe(userId, recipe);
    }
  }

  if (data.exerciseEntries && data.exerciseEntries.length > 0) {
    for (const entry of data.exerciseEntries) {
      // Migration: Only valid entries
      if (entry.id && entry.date) {
        await exerciseEntryRepo.saveEntry(userId, entry);
      }
    }
  }

  if (data.quickMeals && data.quickMeals.length > 0) {
    for (const qm of data.quickMeals) {
      await quickMealRepo.saveQuickMeal(userId, qm);
    }
  }

  const {
    universalActivities,
    mealEntries,
    weightEntries,
    exerciseEntries, // Exclude from blob
    strengthSessions,
    performanceGoals, // Exclude from blob
    weeklyPlans, // Exclude from blob
    quickMeals, // Exclude from blob
    ...userSpecificData
  } = data;

  // Remove trainingPeriods from userSpecificData if it exists (it's typed as any above)
  delete (userSpecificData as any).trainingPeriods;

  await kv.set(["user_profiles", userId], {
    ...userSpecificData,
    updatedAt: new Date().toISOString(),
  });

  // 3. Sync settings back to primary user record if present in users list
  const currentUserInPayload = data.users?.find((u) => u.id === userId);
  if (currentUserInPayload) {
    const userEntry = await kv.get<DBUser>(["users", userId]);
    if (userEntry.value) {
      const user = userEntry.value;
      // Only update if settings are different
      if (
        JSON.stringify(user.settings) !==
          JSON.stringify(currentUserInPayload.settings)
      ) {
        user.settings = currentUserInPayload.settings;
        await kv.set(["users", userId], user);
        console.log(`[saveUserData] Synced settings for user ${userId}`);
      }
    }
  }
}
