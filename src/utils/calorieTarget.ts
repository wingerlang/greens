/**
 * Centralized Calorie Target Utilities
 *
 * "One function to rule them all" - This module provides the single source of truth
 * for getting the active calorie target from training periods and performance goals.
 */

import {
  PerformanceGoal,
  TrainingCycle,
  TrainingPeriod,
} from "../models/types";

export interface CalorieTargetResult {
  calories: number;
  source: "period_goal" | "period_direct" | "settings" | "default";
  goalId?: string;
  periodId?: string;
  goalName?: string;
}

/**
 * Get the active calorie target for a given date.
 *
 * Priority order:
 * 1. Active PerformanceGoal with type='nutrition' and period='daily' linked to active period
 * 2. Active PerformanceGoal with type='nutrition' and period='daily' (no period link)
 * 3. trainingPeriod.nutritionGoal.calories (if set directly on period/cycle)
 * 4. settings.dailyCalorieGoal (with TrainingCycle goal adjustment if applicable)
 * 5. Default fallback (2000)
 *
 * @param date - ISO date string (YYYY-MM-DD) to check for active period
 * @param trainingPeriods - All training periods or cycles
 * @param performanceGoals - All performance goals
 * @param settingsCalorieGoal - User's dailyCalorieGoal from settings
 * @param defaultCalories - Fallback value (default: 2000)
 * @param calorieMode - 'tdee' or 'fixed'
 * @param burnedCalories - Calories burned from exercise for the day
 */
export function getActiveCalorieTarget(
  date: string,
  trainingPeriods: (TrainingPeriod | TrainingCycle)[],
  performanceGoals: PerformanceGoal[],
  settingsCalorieGoal?: number,
  defaultCalories: number = 2000,
  calorieMode: "tdee" | "fixed" = "tdee",
  burnedCalories: number = 0,
): CalorieTargetResult {
  // Step 1: Find active training period for the date
  const activePeriod = trainingPeriods.find(
    (p) => {
      const start = p.startDate;
      const end = p.endDate || "9999-12-31";
      return date >= start && date <= end;
    },
  );

  let baseCalories = defaultCalories;
  let source: CalorieTargetResult["source"] = "default";
  let goalId: string | undefined;
  let periodId: string | undefined;
  let goalName: string | undefined;

  // Step 2: Find nutrition goals
  // Priority: Goal linked to active period > Any active daily nutrition goal

  // Helper to extract calories from a nutrition goal
  const getCaloriesFromGoal = (goal: PerformanceGoal): number | undefined => {
    if (goal.nutritionMacros?.calories && goal.nutritionMacros.calories > 0) {
      return goal.nutritionMacros.calories;
    }
    if (goal.targets && goal.targets.length > 0) {
      const target = goal.targets[0];
      if (target.nutritionType === "calories" || goal.type === "nutrition") {
        if (target.value && target.value > 0) {
          return target.value;
        }
      }
    }
    return undefined;
  };

  let foundGoal = false;

  if (activePeriod) {
    const periodNutritionGoal = performanceGoals.find((g) =>
      g.periodId === activePeriod.id &&
      g.type === "nutrition" &&
      g.period === "daily" &&
      g.status === "active"
    );

    if (periodNutritionGoal) {
      const calories = getCaloriesFromGoal(periodNutritionGoal);
      if (calories) {
        baseCalories = calories;
        source = "period_goal";
        goalId = periodNutritionGoal.id;
        periodId = activePeriod.id;
        goalName = periodNutritionGoal.name;
        foundGoal = true;
      }
    }

    // Check if period has direct nutritionGoal property (TrainingPeriod)
    if (
      !foundGoal && (activePeriod as TrainingPeriod).nutritionGoal?.calories
    ) {
      const calories = (activePeriod as TrainingPeriod).nutritionGoal?.calories;
      if (calories && calories > 0) {
        baseCalories = calories;
        source = "period_direct";
        periodId = activePeriod.id;
        foundGoal = true;
      }
    }
  }

  if (!foundGoal) {
    const anyNutritionGoal = performanceGoals.find((g) =>
      g.type === "nutrition" &&
      g.period === "daily" &&
      g.status === "active" &&
      !g.periodId
    );

    if (anyNutritionGoal) {
      const calories = getCaloriesFromGoal(anyNutritionGoal);
      if (calories) {
        baseCalories = calories;
        source = "period_goal";
        goalId = anyNutritionGoal.id;
        goalName = anyNutritionGoal.name;
        foundGoal = true;
      }
    }
  }

  if (!foundGoal && settingsCalorieGoal && settingsCalorieGoal > 0) {
    baseCalories = settingsCalorieGoal;
    source = "settings";
    foundGoal = true;
  }

  // Apply TrainingCycle goal adjustment if no specific nutrition goal was found
  // (e.g. if we fall back to settings, but we are in a 'deff' cycle)
  if (activePeriod && (activePeriod as TrainingCycle).goal) {
    const cycleGoal = (activePeriod as TrainingCycle).goal;
    if (cycleGoal === "deff") baseCalories -= 500;
    else if (cycleGoal === "bulk") baseCalories += 500;
  }

  // Apply Calorie Mode Logic
  // If 'fixed', we add burned base + burned.
  // If 'tdee', the base is assumed to already include average activity.
  const finalCalories = calorieMode === "fixed"
    ? baseCalories + burnedCalories
    : baseCalories;

  return {
    calories: Math.round(finalCalories),
    source,
    goalId,
    periodId,
    goalName,
  };
}

/**
 * Simple helper that just returns the calorie number.
 * Use this when you only need the value, not the source info.
 */
export function getActiveCalories(
  date: string,
  trainingPeriods: (TrainingPeriod | TrainingCycle)[],
  performanceGoals: PerformanceGoal[],
  settingsCalorieGoal?: number,
  defaultCalories: number = 2000,
  calorieMode: "tdee" | "fixed" = "tdee",
  burnedCalories: number = 0,
): number {
  return getActiveCalorieTarget(
    date,
    trainingPeriods,
    performanceGoals,
    settingsCalorieGoal,
    defaultCalories,
    calorieMode,
    burnedCalories,
  ).calories;
}
