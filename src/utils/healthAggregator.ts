import { DailyVitals, WeightEntry, MealEntry, ExerciseEntry, NutritionSummary, ExerciseSubType } from '../models/types.ts';

export interface HealthStats {
    avgSleep: number;
    avgWater: number;
    avgCaffeine: number;
    weightTrend: number; // kg change over period
    totalCalories: number;
    avgCalories: number;
    avgProtein: number;
    proteinQualityScore: number; // 0-100
    vitaminCoverage: Record<string, number>; // nutrient -> % of RDA
    loggingConsistency: number; // 0-100 % of days with at least one log
    sleepConsistency: number;
    waterConsistency: number;
    activeDays: number;
    untrackedDays: number;
    exerciseBreakdown: {
        intervals: number;
        longRuns: number;
        races: number;
        totalTonnage: number;
        strengthSessions: number;
        totalDistance: number;
        totalCardioDuration: number;
    };
}

export const RDA = {
    iron: 14,      // mg
    calcium: 800,  // mg
    zinc: 10,      // mg
    vitaminB12: 4, // µg
    vitaminC: 75,  // mg
    vitaminA: 800, // µg
};

export interface DaySnapshot {
    date: string;
    vitals: DailyVitals;
    nutrition: NutritionSummary;
    exercise: number; // total burned
    weight?: number;
    hasLogs: boolean;
    isVitalsOnly: boolean;
    isUntracked: boolean;
    exerciseDeatils: {
        intervals: number;
        longRuns: number;
        races: number;
        tonnage: number;
        isStrength: number; // 0 or 1
        distance: number;
        duration: number;
    };
}

/**
 * Aggregates all health data for a specific period
 */
export function aggregateHealthData(
    days: number,
    vitals: Record<string, DailyVitals>,
    weights: WeightEntry[],
    meals: MealEntry[],
    exercises: ExerciseEntry[],
    calculateNutrition: (date: string) => NutritionSummary
): DaySnapshot[] {
    const snapshots: DaySnapshot[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const dayVitals = vitals[dateStr] || { water: 0, sleep: 0, caffeine: 0 };
        const dayWeight = weights.find(w => w.date === dateStr)?.weight;
        const dayExercises = exercises.filter(e => e.date === dateStr);
        const totalExercise = dayExercises.reduce((sum, e) => sum + e.caloriesBurned, 0);
        const dayNutrition = calculateNutrition(dateStr);

        const hasMealLogs = dayNutrition.calories > 0;
        const hasVitalLogs = dayVitals.water > 0 || dayVitals.sleep > 0 || (dayVitals.caffeine || 0) > 0;
        const hasExerciseLogs = dayExercises.length > 0;
        const hasWeightLog = dayWeight !== undefined;

        const hasLogs = hasMealLogs || hasVitalLogs || hasExerciseLogs || hasWeightLog;

        const exerciseDeatils = dayExercises.reduce((acc, e) => ({
            intervals: acc.intervals + (e.subType === 'interval' ? 1 : 0),
            longRuns: acc.longRuns + (e.subType === 'long-run' ? 1 : 0),
            races: acc.races + (e.subType === 'race' ? 1 : 0),
            tonnage: acc.tonnage + (e.tonnage || 0),
            isStrength: acc.isStrength + (e.type === 'strength' ? 1 : 0),
            distance: acc.distance + (e.distance || 0),
            duration: acc.duration + (e.durationMinutes || 0)
        }), { intervals: 0, longRuns: 0, races: 0, tonnage: 0, isStrength: 0, distance: 0, duration: 0 });

        snapshots.unshift({
            date: dateStr,
            vitals: dayVitals,
            nutrition: dayNutrition,
            exercise: totalExercise,
            weight: dayWeight,
            hasLogs,
            isVitalsOnly: !hasMealLogs && hasVitalLogs,
            isUntracked: !hasLogs,
            exerciseDeatils
        });
    }

    return snapshots;
}

/**
 * Calculates summary stats from snapshots
 */
export function calculateHealthStats(snapshots: DaySnapshot[]): HealthStats {
    const count = snapshots.length || 1;

    const totals = snapshots.reduce((acc, s) => ({
        sleep: acc.sleep + s.vitals.sleep,
        water: acc.water + s.vitals.water,
        caffeine: acc.caffeine + (s.vitals.caffeine || 0),
        protein: acc.protein + s.nutrition.protein,
        calories: acc.calories + s.nutrition.calories
    }), { sleep: 0, water: 0, caffeine: 0, protein: 0, calories: 0 });

    // Weight trend
    const weights = snapshots.filter(s => s.weight !== undefined).map(s => s.weight!);
    const weightTrend = weights.length > 1 ? weights[weights.length - 1] - weights[0] : 0;

    // Average nutrient coverage
    const vitaminCoverage: Record<string, number> = {};
    Object.keys(RDA).forEach(key => {
        const total = snapshots.reduce((sum, s) => sum + ((s.nutrition as any)[key] || 0), 0);
        vitaminCoverage[key] = Math.round((total / (snapshots.length * (RDA as any)[key])) * 100);
    });

    // Protein Quality Score (0-100)
    const completeDays = snapshots.filter(s => {
        const cats = s.nutrition.proteinCategories || [];
        return cats.includes('soy_quinoa') || (cats.includes('legume') && cats.includes('grain'));
    }).length;
    const proteinQualityScore = Math.round((completeDays / count) * 100);

    // Logging Consistency
    const activeDays = snapshots.filter(s => s.hasLogs).length;
    const untrackedDays = snapshots.filter(s => s.isUntracked).length;
    const loggingConsistency = Math.round((activeDays / count) * 100);

    // Sleep & Water Consistency (Non-zero days)
    const sleepDays = snapshots.filter(s => s.vitals.sleep > 0).length || 1;
    const waterDays = snapshots.filter(s => s.vitals.water > 0).length || 1;

    const avgSleep = totals.sleep / sleepDays;
    const avgWater = totals.water / waterDays;

    // Consistency percentages for UI
    const sleepConsistency = Math.round((snapshots.filter(s => s.vitals.sleep > 0).length / count) * 100);
    const waterConsistency = Math.round((snapshots.filter(s => s.vitals.water > 0).length / count) * 100);

    // Exercise Breakdown
    const exerciseBreakdown = snapshots.reduce((acc, s) => {
        acc.intervals += s.exerciseDeatils.intervals;
        acc.longRuns += s.exerciseDeatils.longRuns;
        acc.races += s.exerciseDeatils.races;
        acc.totalTonnage += s.exerciseDeatils.tonnage;
        acc.strengthSessions += s.exerciseDeatils.isStrength;
        acc.totalDistance += s.exerciseDeatils.distance;
        acc.totalCardioDuration += s.exerciseDeatils.duration;
        return acc;
    }, { intervals: 0, longRuns: 0, races: 0, totalTonnage: 0, strengthSessions: 0, totalDistance: 0, totalCardioDuration: 0 });

    return {
        avgSleep,
        avgWater,
        avgCaffeine: totals.caffeine / count,
        weightTrend,
        totalCalories: totals.calories,
        avgCalories: totals.calories / count,
        avgProtein: totals.protein / count,
        proteinQualityScore,
        vitaminCoverage,
        loggingConsistency,
        sleepConsistency,
        waterConsistency,
        activeDays,
        untrackedDays,
        exerciseBreakdown
    };
}
