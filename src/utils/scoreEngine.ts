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
    messages: string[];
}

/**
 * Calculates a daily score (0-100) based on how well goals were met.
 */
export function calculateDailyScore(
    nutrition: NutritionSummary,
    vitals: DailyVitals,
    exercises: ExerciseEntry[],
    settings: UserSettings
): ScoreBreakdown {
    let nutritionScore = 0;
    let activityScore = 0;
    let vitalsScore = 0;
    const messages: string[] = [];

    // 1. Nutrition (40 points)
    const kcalGoal = settings.dailyCalorieGoal || 2000;
    const kcalDiff = Math.abs(nutrition.calories - kcalGoal);
    const kcalAccuracy = Math.max(0, 1 - (kcalDiff / (kcalGoal * 0.3)));
    nutritionScore += kcalAccuracy * 20;

    const proteinGoal = settings.dailyProteinGoal || 150;
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

    const total = Math.round(nutritionScore + activityScore + vitalsScore);

    return {
        total,
        nutrition: Math.round(nutritionScore),
        activity: Math.round(activityScore),
        vitals: Math.round(vitalsScore),
        messages
    };
}
