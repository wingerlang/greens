import {
    type MealEntry,
    type ExerciseEntry,
    type WeightEntry,
    type DailyVitals,
    type AppSettings,
    type User,
    type ExerciseType,
    type ExerciseIntensity,
    type NutritionSummary,
    getISODate,
    UniversalActivity
} from '../models/types.ts';
import { parseWattsFromText } from './cyclingCalculations.ts';

// ============================================
// Streak Calculations
// ============================================

export function calculateStreak(
    mealEntries: MealEntry[],
    exerciseEntries: ExerciseEntry[],
    dailyVitals: Record<string, DailyVitals>,
    weightEntries: WeightEntry[],
    referenceDate?: string
): number {
    const anchor = referenceDate ? new Date(referenceDate) : new Date();
    const anchorISO = getISODate(anchor);

    // Yesterday relative to anchor
    const prevDay = new Date(anchor);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayISO = getISODate(prevDay);

    const isDayActive = (date: string) => {
        const meals = mealEntries.filter(e => e.date === date);
        const exercises = exerciseEntries.filter(e => e.date.startsWith(date));
        const vitals = dailyVitals[date];
        const weightEntry = weightEntries.some(w => w.date === date);

        // Active if logged meals, exercises, weights, or significant vitals
        return meals.length > 0 ||
            exercises.length > 0 ||
            weightEntry ||
            (vitals && (vitals.water > 0 || (vitals.caffeine ?? 0) > 0 || (vitals.alcohol ?? 0) > 0 || (vitals.sleep ?? 0) > 0));
    };

    let streak = 0;
    let checkDate = new Date(anchor);

    const anchorActive = isDayActive(anchorISO);
    const prevActive = isDayActive(prevDayISO);

    if (!anchorActive && !prevActive) return 0;

    // If anchor is not active, but prev is, we count from prev (streak maintained but not incremented for today yet)
    if (!anchorActive) checkDate = prevDay;

    while (true) {
        const dateStr = getISODate(checkDate);
        if (isDayActive(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
        if (streak > 3650) break;
    }
    return streak;
}

export function calculateTrainingStreak(
    exerciseEntries: ExerciseEntry[],
    referenceDate?: string,
    type?: string
): number {
    const anchor = referenceDate ? new Date(referenceDate) : new Date();
    const anchorISO = getISODate(anchor);

    const prevDay = new Date(anchor);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayISO = getISODate(prevDay);

    const isTrainingDay = (date: string) => {
        const exercises = exerciseEntries.filter(e => e.date.startsWith(date));
        if (!type) {
            // Any training
            return exercises.length > 0;
        } else if (type === 'strength') {
            return exercises.some(e => e.type === 'strength');
        } else if (type === 'running') {
            // Cardio mode: running, cycling, walking, swimming
            return exercises.some(e => ['running', 'cycling', 'walking', 'swimming'].includes(e.type));
        }
        return false;
    };

    let streak = 0;
    let checkDate = new Date(anchor);

    if (!isTrainingDay(anchorISO) && !isTrainingDay(prevDayISO)) return 0;
    if (!isTrainingDay(anchorISO)) checkDate = prevDay;

    while (true) {
        if (isTrainingDay(getISODate(checkDate))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
        if (streak > 1000) break;
    }
    return streak;
}

export function calculateWeeklyTrainingStreak(
    exerciseEntries: ExerciseEntry[],
    referenceDate?: string
): number {
    // Count weeks where there was at least one training session
    let streak = 0;
    let checkDate = referenceDate ? new Date(referenceDate) : new Date();

    // Move to the beginning of current week (Monday) of the checkDate
    const day = checkDate.getDay();
    const diff = checkDate.getDate() - day + (day === 0 ? -6 : 1);
    checkDate.setDate(diff);

    // Helper to check if a specific calendar week has any training
    const hasTrainingInWeek = (startDate: Date) => {
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = getISODate(d);
            if (exerciseEntries.some(e => e.date.startsWith(dateStr))) return true;
        }
        return false;
    };

    // If current week has no training yet, check last week.
    if (!hasTrainingInWeek(new Date(checkDate))) {
        const lastWeek = new Date(checkDate);
        lastWeek.setDate(lastWeek.getDate() - 7);
        if (!hasTrainingInWeek(lastWeek)) return 0;
        checkDate = lastWeek;
    }

    while (true) {
        if (hasTrainingInWeek(new Date(checkDate))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 7);
        } else {
            break;
        }
        if (streak > 520) break;
    }
    return streak;
}

export function calculateCalorieGoalStreak(
    getDailyNutrition: (date: string) => NutritionSummary,
    userSettings: AppSettings,
    referenceDate?: string
): number {
    const anchor = referenceDate ? new Date(referenceDate) : new Date();
    const anchorISO = getISODate(anchor);

    const prevDay = new Date(anchor);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayISO = getISODate(prevDay);

    const isGoalMet = (date: string) => {
        const data = getDailyNutrition(date);
        const target = userSettings?.dailyCalorieGoal || 2500;
        return data.calories > 0 && data.calories <= target;
    };

    let streak = 0;
    let checkDate = new Date(anchor);

    if (!isGoalMet(anchorISO) && !isGoalMet(prevDayISO)) return 0;
    if (!isGoalMet(anchorISO)) checkDate = prevDay;

    while (true) {
        if (isGoalMet(getISODate(checkDate))) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
        if (streak > 1000) break;
    }
    return streak;
}

// ============================================
// Calculators
// ============================================

export function calculateBMR(
    weight: number,
    settings?: AppSettings
): number {
    if (!settings) return 2000;
    const height = settings.height || 175;
    const currentYear = new Date().getFullYear();
    const age = settings.birthYear ? (currentYear - settings.birthYear) : 30;
    const gender = settings.gender || 'other';

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    if (gender === 'male') bmr += 5;
    else if (gender === 'female') bmr -= 161;
    else bmr -= 78; // Average/other

    return Math.round(bmr);
}

export function calculateExerciseCalories(
    type: ExerciseType,
    duration: number,
    intensity: ExerciseIntensity,
    weight: number,
    notes?: string
): number {
    // 1. Try to parse power from notes if available (cycling/cardio)
    if (notes) {
        const powerCalories = parsePowerCalories(notes);
        if (powerCalories > 0) return Math.round(powerCalories);
    }

    // 2. MET values
    const METS: any = {
        running: { low: 6, moderate: 8, high: 11, ultra: 14 },
        cycling: { low: 4, moderate: 6, high: 10, ultra: 12 },
        strength: { low: 2.5, moderate: 3.5, high: 5.0, ultra: 7.0 }, // Adjusted downwards to align better with Strava
        walking: { low: 2.5, moderate: 3.5, high: 4.5, ultra: 5.5 },
        swimming: { low: 5, moderate: 7, high: 10, ultra: 12 },
        yoga: { low: 2, moderate: 2.5, high: 3.5, ultra: 4 },
        hyrox: { low: 6, moderate: 8, high: 10, ultra: 12 },
        hybrid: { low: 4, moderate: 6, high: 8, ultra: 10 },
        recovery: { low: 2, moderate: 3, high: 4, ultra: 5 },
        cardio: { low: 5, moderate: 7, high: 9, ultra: 11 },
        climbing: { low: 5, moderate: 7.5, high: 10, ultra: 12 },
        football: { low: 6, moderate: 8, high: 10, ultra: 12 },
        other: { low: 3, moderate: 4.5, high: 6, ultra: 8 }
    };

    const met = METS[type]?.[intensity] || METS.other[intensity];
    return Math.round(met * weight * (duration / 60));
}

/**
 * Parses power logs from Strava descriptions.
 * Format: "45min @ 215w" or "5m @ 170 watt" or "10 min: 200w"
 * Returns total calories (approx 1 kJ = 1 kcal)
 */
export function parsePowerCalories(notes: string): number {
    if (!notes) return 0;
    
    // Regex matches complex interval structures or simple summaries
    // 1. Explicit intervals: "45min @ 215w", "10 min: 200w"
    const intervalRegex = /(?:(\d+)\s*(?:min|m)?\s*[@:]\s*)?(\d+)(?:\s*-\s*(\d+))?\s*(?:w|watt)/gi;
    let totalKcal = 0;
    let match;

    const notesLower = notes.toLowerCase();

    // If it's a simple summary like "Avg 210w" without a stated duration in that specific line, 
    // we return the watts but we can't calculate kcal without knowing total duration from context.
    // parsePowerCalories is designed to SUM UP explicitly timed segments.
    
    while ((match = intervalRegex.exec(notesLower)) !== null) {
        const durationMin = match[1] ? parseInt(match[1]) : 0;
        const wattsMin = parseInt(match[2]);
        const wattsMax = match[3] ? parseInt(match[3]) : wattsMin;
        const avgWatts = (wattsMin + wattsMax) / 2;
        
        if (durationMin > 0) {
            // kcal ≈ kJ = Watts * seconds / 1000
            const kcal = (avgWatts * durationMin * 60) / 1000;
            totalKcal += kcal;
        } else {
            // If no duration is explicitly attached to the watt pattern, check if the WHOLE string 
            // is just a watt value (e.g. "200w"). In that case, we might need external duration.
            // But parsePowerCalories traditionally returns TOTAL kcal.
        }
    }

    return Math.round(totalKcal);
}

export function calculateHeartRateCalories(
    heartRate: number,
    weight: number,
    age: number,
    gender: 'male' | 'female' | 'other'
): { kcalPerMin: number; formula: string } {
    let kjPerMin = 0;
    let formula = "";
    
    if (gender === 'male') {
        kjPerMin = -55.0969 + (0.6309 * heartRate) + (0.1988 * weight) + (0.2017 * age);
        formula = "Keytel et al. (Male): -55.0969 + (0.6309 * HR) + (0.1988 * W) + (0.2017 * A)";
    } else {
        kjPerMin = -20.4022 + (0.4472 * heartRate) - (0.1263 * weight) + (0.0740 * age);
        formula = "Keytel et al. (Female): -20.4022 + (0.4472 * HR) - (0.1263 * W) + (0.0740 * A)";
    }

    return { 
        kcalPerMin: Math.max(0, kjPerMin / 4.184), 
        formula 
    };
}

export function calculateStrengthCaloriesMET(
    heartRate: number,
    weight: number
): { kcalPerMin: number; met: number } {
    let met = 3.5;
    if (heartRate > 140) met = 5.0;
    else if (heartRate > 120) met = 4.5;
    else if (heartRate > 100) met = 4.0;

    return { 
        kcalPerMin: (met * weight) / 60, 
        met 
    };
}
 
 /**
  * Suggests the most frequent activity type for a given weekday based on history.
  */
 export function suggestActivityForWeekday(
     activities: { type: ExerciseType; date: string }[],
     targetDate: string
 ): ExerciseType | null {
     if (!activities.length) return null;
     
     const targetDay = new Date(targetDate).getDay(); // 0-6 (Sun-Sat)
     
     // Filter activities from the last 90 days to keep suggestions fresh
     const ninetyDaysAgo = new Date();
     ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
     const ninetyDaysAgoISO = getISODate(ninetyDaysAgo);
 
     const historicalOnSameDay = activities.filter(a => {
         const activityDate = a.date.split('T')[0];
         return new Date(activityDate).getDay() === targetDay && activityDate >= ninetyDaysAgoISO;
     });
     
     if (historicalOnSameDay.length === 0) {
         // Fallback to all time if no recent activity on that day
         const allTimeOnSameDay = activities.filter(a => new Date(a.date.split('T')[0]).getDay() === targetDay);
         if (allTimeOnSameDay.length === 0) return null;
         historicalOnSameDay.push(...allTimeOnSameDay);
     }
     
     // Count frequencies
     const counts: Record<string, number> = {};
     historicalOnSameDay.forEach(a => {
         const type = a.type as string;
         counts[type] = (counts[type] || 0) + 1;
     });
     
     // Find max
     let bestType: ExerciseType | null = null;
     let maxCount = 0;
     
     for (const [type, count] of Object.entries(counts)) {
         if (count > maxCount) {
             maxCount = count;
             bestType = type as ExerciseType;
         }
     }
     
     return bestType;
 }
