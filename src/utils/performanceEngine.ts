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

/**
 * Calculates Grade Adjusted Pace (GAP).
 * Formula: ActualPace * (1 + 0.09 * (Gain / DistanceInMeters))
 */
export function calculateGAP(paceSecPerKm: number, gainMeters: number, distanceKm: number): number {
    if (!distanceKm || distanceKm === 0) return paceSecPerKm;

    // Grade = Rise / Run
    const grade = gainMeters / (distanceKm * 1000);

    // Heuristic: Each 1% of grade (0.01) adjusts effort by ~6.5% for running.
    // For uphill: pace feels slower (higher paceSec). 
    // GAP should show the "flats equivalent", so GAP < Pace for uphill.
    return paceSecPerKm / (1 + (6.5 * grade));
}

/**
 * Calculates an objective physical performance score (Greens Score).
 * 0-100 where higher is more efficient.
 * For running: Based on GAP vs Heart Rate.
 * For strength: Based on Tonnage vs Duration.
 */
export function calculatePerformanceScore(activity: any): number {
    const type = (activity.type || activity.activityType || '').toLowerCase();
    const isRunning = ['running', 'run', 'walking', 'walk', 'hiking', 'trail'].some(t => type.includes(t));
    const isStrength = ['strength', 'weightlifting', 'gym', 'styrka', 'bodybuilding', 'crossfit'].some(t => type.includes(t));

    // 1. RUNNING / CARDIO
    if (isRunning) {
        const dist = activity.distance || activity.distanceKm || 0;
        const dur = activity.durationMinutes || 0;
        const hr = activity.heartRateAvg || activity.avgHeartRate || 0;
        const gain = activity.elevationGain || 0;

        if (dist === 0 || dur === 0) return 0;

        const paceSec = (dur * 60) / dist;
        const gapSec = calculateGAP(paceSec, gain, dist);

        if (hr === 0) {
            // No HR data - score based on pace alone (less accurate)
            return Math.min(100, Math.max(0, 120 - (gapSec / 5)));
        }

        // Efficiency = Work (Distance/GAP) / Cost (HR)
        const efficiency = 1000000 / (gapSec * hr);

        // Normalize: We want 25 to be ~75 score.
        let score = efficiency * 3.0;

        // Long run bonus: Carrying a pace for a long time is harder (HR drift)
        if (dist > 10) score *= 1.05;
        if (dist > 21) score *= 1.1;
        if (dist > 35) score *= 1.15;

        return Math.min(100, Math.round(score));
    }

    // 2. STRENGTH
    if (isStrength) {
        const tonnage = activity.tonnage || 0;
        const dur = activity.durationMinutes || 0;
        if (tonnage === 0 || dur === 0) return 0;

        // Work rate = kg per minute
        const workRate = tonnage / dur;

        // Normalize: 250 kg/min (e.g. 15 tons in 60 min) is a "good" workout (100 pts).
        return Math.min(100, Math.round(workRate * 0.4));
    }

    return 0;
}
