import {
    type DailyVitals,
    type NutritionSummary,
    type UserSettings,
    type ExerciseEntry
} from '../models/types.ts';

export interface ScoreBreakdown {
    total: number;
    nutrition: number;
    activity: number;
    vitals: number;
    vitality: number;
    messages: string[];
}

import { calculateAdaptiveGoals } from './performanceEngine.ts';

/**
 * Calculates a daily score (0-100) based on how well goals were met.
 */
export function calculateDailyScore(
    nutrition: NutritionSummary,
    vitals: DailyVitals,
    exercises: ExerciseEntry[],
    settings: UserSettings
): ScoreBreakdown {
    const goals = calculateAdaptiveGoals(settings, exercises);
    let nutritionScore = 0;
    let activityScore = 0;
    let vitalsScore = 0;
    let vitalityScore = 0;
    const messages: string[] = [];

    // RDA values for vitality scoring (Iron, B12, Calcium, Zinc)
    const RDAs = {
        iron: 14,
        vitaminB12: 4,
        calcium: 800,
        zinc: 10
    };

    // 1. Nutrition (40 points)
    const kcalGoal = goals.calories;
    const kcalDiff = Math.abs(nutrition.calories - kcalGoal);
    const kcalAccuracy = Math.max(0, 1 - (kcalDiff / (kcalGoal * 0.3)));
    nutritionScore += kcalAccuracy * 20;

    const proteinGoal = goals.protein;
    const proteinAccuracy = Math.min(1, nutrition.protein / proteinGoal);
    nutritionScore += proteinAccuracy * 20;

    if (kcalAccuracy > 0.9 && proteinAccuracy > 0.9) {
        messages.push('Perfekt näringsintag! 🥗');
    } else {
        if (proteinAccuracy < 0.7) messages.push(`Öka proteinintaget (+${Math.round(proteinGoal - nutrition.protein)}g). 🍳`);
        if (kcalAccuracy < 0.8) {
            const diff = Math.round(kcalGoal - nutrition.calories);
            messages.push(diff > 0
                ? `Du ligger under kcal-målet (-${diff} kcal). 🥣`
                : `Du ligger över kcal-målet (+${Math.abs(diff)} kcal). 🍎`);
        }
    }

    // 2. Activity (30 points)
    const totalBurned = exercises.reduce((sum, ex) => sum + ex.caloriesBurned, 0);
    if (exercises.length > 0) {
        activityScore = 30;
        messages.push('Snyggt jobbat med träningen! 🔥');
    } else if (totalBurned > 200) {
        activityScore = 20;
        messages.push('Bra vardagsmotion! 👟');
    } else {
        messages.push('En vilodag behövs ibland, ladda om! 🔌');
    }

    // 3. Vitals (30 points)
    const waterGoal = settings.dailyWaterGoal || 8;
    const waterAccuracy = Math.min(1.2, vitals.water / waterGoal); // Bonus for extra hydration up to a limit
    vitalsScore += Math.min(15, waterAccuracy * 15);

    const sleepGoal = settings.dailySleepGoal || 8;
    const sleepAccuracy = Math.min(1, vitals.sleep / sleepGoal);
    vitalsScore += sleepAccuracy * 15;

    if (vitals.water < waterGoal) messages.push(`Drick 💧 ${waterGoal - vitals.water} glas till för full pott.`);
    if (vitals.sleep < sleepGoal) messages.push(`Sikta på 😴 ${sleepGoal - vitals.sleep}h mer sömn inatt.`);
    if (vitals.water >= waterGoal && vitals.sleep >= sleepGoal) messages.push('Vitals är på topp! 💎');

    // 4. Vitality (Micro-nutrients) (20 points - Bonus/Top-off)
    // We calculate coverage for key vegan nutrients
    const ironCoverage = Math.min(1.5, (nutrition.iron || 0) / RDAs.iron);
    const b12Coverage = Math.min(1.5, (nutrition.vitaminB12 || 0) / RDAs.vitaminB12);
    const calciumCoverage = Math.min(1.5, (nutrition.calcium || 0) / RDAs.calcium);
    const zincCoverage = Math.min(1.5, (nutrition.zinc || 0) / RDAs.zinc);

    const avgVitality = (ironCoverage + b12Coverage + calciumCoverage + zincCoverage) / 4;
    vitalityScore = Math.round(Math.min(20, avgVitality * 20));

    if (avgVitality > 0.9) {
        messages.push('Fantastisk mikronäring idag! 🛡️');
    } else if (avgVitality < 0.4 && nutrition.calories > 500) {
        messages.push('Glöm inte mikronäringen! Sikta på mer färgstark mat. 🥦');
    }

    const total = Math.round((nutritionScore * 0.4) + (activityScore * 1.0) + (vitalsScore * 1.0) + vitalityScore);
    // Adjusting total weight: Nutrition (20+20=40), Activity (30), Vitals (30), Vitality (20) = 120 potential
    // Let's keep it simple: sum them up but cap at 100 for display or just let it be a "Pro" score.
    // For now, let's normalize to 100.
    const normalizedTotal = Math.min(100, Math.round((nutritionScore + activityScore + vitalsScore + vitalityScore) / 1.2));

    return {
        total: normalizedTotal,
        nutrition: Math.round(nutritionScore),
        activity: Math.round(activityScore),
        vitals: Math.round(vitalsScore),
        vitality: vitalityScore,
        messages
    };
}
