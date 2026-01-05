/**
 * Centralized Calorie Target Utilities
 * 
 * "One function to rule them all" - This module provides the single source of truth
 * for getting the active calorie target from training periods and performance goals.
 */

import { PerformanceGoal, TrainingPeriod } from '../models/types';

export interface CalorieTargetResult {
    calories: number;
    source: 'period_goal' | 'period_direct' | 'settings' | 'default';
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
 * 3. trainingPeriod.nutritionGoal.calories (if set directly on period)
 * 4. settings.dailyCalorieGoal
 * 5. Default fallback (2000)
 * 
 * @param date - ISO date string (YYYY-MM-DD) to check for active period
 * @param trainingPeriods - All training periods
 * @param performanceGoals - All performance goals
 * @param settingsCalorieGoal - User's dailyCalorieGoal from settings
 * @param defaultCalories - Fallback value (default: 2000)
 */
export function getActiveCalorieTarget(
    date: string,
    trainingPeriods: TrainingPeriod[],
    performanceGoals: PerformanceGoal[],
    settingsCalorieGoal?: number,
    defaultCalories: number = 2000
): CalorieTargetResult {

    // Step 1: Find active training period for the date
    const activePeriod = trainingPeriods.find(
        p => date >= p.startDate && date <= p.endDate
    );

    // Step 2: Find nutrition goals
    // Priority: Goal linked to active period > Any active daily nutrition goal

    // Helper to extract calories from a nutrition goal
    const getCaloriesFromGoal = (goal: PerformanceGoal): number | undefined => {
        // Check nutritionMacros.calories first (set when user edits in GoalTemplateRow)
        if (goal.nutritionMacros?.calories && goal.nutritionMacros.calories > 0) {
            return goal.nutritionMacros.calories;
        }

        // Check targets[0].value (set in templates and goal creation)
        if (goal.targets && goal.targets.length > 0) {
            const target = goal.targets[0];
            // Verify it's a calorie target
            if (target.nutritionType === 'calories' || goal.type === 'nutrition') {
                if (target.value && target.value > 0) {
                    return target.value;
                }
            }
        }

        return undefined;
    };

    // 2a: Find goal linked to active period
    if (activePeriod) {
        const periodNutritionGoal = performanceGoals.find(g =>
            g.periodId === activePeriod.id &&
            g.type === 'nutrition' &&
            g.period === 'daily' &&
            g.status === 'active'
        );

        if (periodNutritionGoal) {
            const calories = getCaloriesFromGoal(periodNutritionGoal);
            if (calories) {
                return {
                    calories,
                    source: 'period_goal',
                    goalId: periodNutritionGoal.id,
                    periodId: activePeriod.id,
                    goalName: periodNutritionGoal.name
                };
            }
        }

        // 2b: Check if period has direct nutritionGoal property
        if (activePeriod.nutritionGoal?.calories && activePeriod.nutritionGoal.calories > 0) {
            return {
                calories: activePeriod.nutritionGoal.calories,
                source: 'period_direct',
                periodId: activePeriod.id
            };
        }
    }

    // 2c: Find any active daily nutrition goal (without period link)
    const anyNutritionGoal = performanceGoals.find(g =>
        g.type === 'nutrition' &&
        g.period === 'daily' &&
        g.status === 'active' &&
        !g.periodId // Not linked to any period
    );

    if (anyNutritionGoal) {
        const calories = getCaloriesFromGoal(anyNutritionGoal);
        if (calories) {
            return {
                calories,
                source: 'period_goal', // Still technically a goal
                goalId: anyNutritionGoal.id,
                goalName: anyNutritionGoal.name
            };
        }
    }

    // Step 3: Fall back to settings
    if (settingsCalorieGoal && settingsCalorieGoal > 0) {
        return {
            calories: settingsCalorieGoal,
            source: 'settings'
        };
    }

    // Step 4: Default fallback
    return {
        calories: defaultCalories,
        source: 'default'
    };
}

/**
 * Simple helper that just returns the calorie number.
 * Use this when you only need the value, not the source info.
 */
export function getActiveCalories(
    date: string,
    trainingPeriods: TrainingPeriod[],
    performanceGoals: PerformanceGoal[],
    settingsCalorieGoal?: number,
    defaultCalories: number = 2000
): number {
    return getActiveCalorieTarget(date, trainingPeriods, performanceGoals, settingsCalorieGoal, defaultCalories).calories;
}
