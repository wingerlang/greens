import { UserSettings, ExerciseEntry } from '../models/types.ts';

export interface AdaptiveGoals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    isAdapted: boolean;
    extraCalories: number;
}

/**
 * Calculates adaptive nutritional targets based on exercise load.
 * On high-intensity days, we increase protein for recovery and 
 * carbohydrates for glycogen replenishment.
 */
export function calculateAdaptiveGoals(
    settings: UserSettings,
    exercises: ExerciseEntry[]
): AdaptiveGoals {
    const baseCalories = settings.dailyCalorieGoal || 2000;
    const baseProtein = settings.dailyProteinGoal || 150;
    const baseCarbs = settings.dailyCarbsGoal || 50; // Often low for keto/deff
    const baseFat = settings.dailyFatGoal || 30;

    const totalBurned = exercises.reduce((sum, ex) => sum + ex.caloriesBurned, 0);

    if (totalBurned <= 50) {
        return {
            calories: baseCalories,
            protein: baseProtein,
            carbs: baseCarbs,
            fat: baseFat,
            isAdapted: false,
            extraCalories: 0
        };
    }

    // Adaptation Ratios:
    // Protein: 15% of extra calories for muscle repair
    // Carbs: 65% of extra calories for glycogen (Athletic focus)
    // Fat: 20% of extra calories for hormonal health

    const extraProtein = (totalBurned * 0.15) / 4;
    const extraCarbs = (totalBurned * 0.65) / 4;
    const extraFat = (totalBurned * 0.20) / 9;

    return {
        calories: Math.round(baseCalories + totalBurned),
        protein: Math.round(baseProtein + extraProtein),
        carbs: Math.round(baseCarbs + extraCarbs),
        fat: Math.round(baseFat + extraFat),
        isAdapted: true,
        extraCalories: Math.round(totalBurned)
    };
}

/**
 * Quantifies training stress (Load) based on duration, intensity and sub-type.
 * Similar to TSS (Training Stress Score) but uses available app metrics.
 */
export function calculateTrainingLoad(exercise: ExerciseEntry): number {
    const intensityFactor = {
        low: 0.5,
        moderate: 1.0,
        high: 1.6,
        ultra: 2.2
    }[exercise.intensity] || 1.0;

    const subTypeFactor = {
        default: 1.0,
        interval: 1.4,
        'long-run': 1.6,
        race: 2.0,
        tonnage: 1.1,
        ultra: 2.5,
        competition: 2.5
    }[exercise.subType || 'default'] || 1.0;

    // Normalize so a 60min moderate workout is ~50-60 load points
    // 60 * 1.0 * 1.0 * 0.83 = ~50
    return Math.round(exercise.durationMinutes * intensityFactor * subTypeFactor * 0.83);
}
