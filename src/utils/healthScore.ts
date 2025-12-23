import { ExerciseEntry, MealEntry, UserSettings } from '../models/types.ts';

export interface HealthComponents {
    training: {
        score: number; // 0-100
        status: 'Optimal' | 'Recovery Needed' | 'Detraining' | 'Overreaching';
        details: string;
        tsb: number;
    };
    nutrition: {
        score: number; // 0-100
        caloriesDiff: number;
        proteinMet: boolean;
        status: 'Balanced' | 'Surplus' | 'Deficit' | 'Poor Quality';
    };
    consistency: {
        score: number; // 0-100
        streak: number;
        status: 'Consistent' | 'Spotty' | 'Inactive';
    };
    totalScore: number; // 0-100
}

/**
 * Calculates a comprehensive Health Score based on highly intelligent interpretation of data.
 * @param exercises - List of exercise entries
 * @param meals - List of meal entries for the day/period
 * @param settings - User settings (for calorie goals, etc)
 * @param date - The date to calculate for (default today)
 */
export function calculateHealthScore(
    exercises: ExerciseEntry[],
    meals: MealEntry[],
    settings: UserSettings, // Assuming we have this or similar for targets
    date: Date = new Date()
): HealthComponents {

    // --- 1. TRAINING COMPONENT (TSB Based) ---
    // Simplified TSB calculation for this standalone function. 
    // In a real scenario, we'd pass pre-calculated TSB or use the full history.
    // For now, we'll estimate "Acute Load" (7 days) vs "Chronic Load" (42 days).

    // Filter exercises up to 'date'
    const validExercises = exercises.filter(e => new Date(e.date) <= date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate simple Load (duration * intensity scalar) as proxy for TSS if TSS missing
    const getLoad = (ex: ExerciseEntry) => {
        // If we had TSS, use it. Else estimate:
        // Low=1, Mod=2, High=3, Ultra=5. times duration.
        const intensityMap: Record<string, number> = { 'low': 1, 'moderate': 2, 'high': 3, 'ultra': 5 };
        const factor = intensityMap[ex.intensity] || 1.5;
        return ex.durationMinutes * factor;
    };

    const calculateAvgLoad = (days: number) => {
        const msPerDay = 86400000;
        const cutoff = date.getTime() - (days * msPerDay);
        const relevantEx = validExercises.filter(e => new Date(e.date).getTime() > cutoff);
        const totalLoad = relevantEx.reduce((sum, e) => sum + getLoad(e), 0);
        return totalLoad / days; // Daily avg load
    };

    const atl = calculateAvgLoad(7);
    const ctl = calculateAvgLoad(42) || 1; // Avoid div by zero
    const tsb = ctl - atl; // Positive = Fresh (Detraining?), Negative = Fatigue (Building).

    // Intelligent Scoring for Training:
    // TSB +5 to -10 is the "Sweet Spot" for productive training (Score 90-100)
    // TSB < -30 is "Overreaching/Risk" (Score drops)
    // TSB > +25 is "Detraining" (Score drops)

    let trainScore = 80; // Baseline
    let trainStatus: HealthComponents['training']['status'] = 'Optimal';
    let trainDetails = "Training is balanced.";

    if (tsb >= -10 && tsb <= 10) {
        trainScore = 100;
        trainStatus = 'Optimal';
        trainDetails = "Perfect balance of stress & recovery.";
    } else if (tsb < -10 && tsb > -30) {
        trainScore = 90;
        trainStatus = 'Overreaching'; // Productive overreaching
        trainDetails = "Building fitness aggressively.";
    } else if (tsb <= -30) {
        trainScore = 40;
        trainStatus = 'Recovery Needed';
        trainDetails = "High fatigue risk. Rest recommended.";
    } else if (tsb > 25) {
        trainScore = 60;
        trainStatus = 'Detraining';
        trainDetails = "Fitness is decaying. Time to train!";
    } else {
        // 10 to 25
        trainScore = 80;
        trainStatus = 'Recovery Needed'; // Or "Very Fresh"
        trainDetails = "Very fresh, ready for hard work.";
    }

    // --- 2. NUTRITION COMPONENT ---
    // Check calories vs Target (BMR + Activity Burn)
    // We assume 'settings.dailyCalorieTarget' exists or use a default
    // We also need today's exercise burn.

    const today = date.toISOString().split('T')[0];
    const todaysMeals = meals.filter(m => m.date === today);
    const caloriesIn = todaysMeals.reduce((sum, m) => sum + m.calories, 0);

    const todaysExercise = exercises.filter(e => e.date === today);
    const activeBurn = todaysExercise.reduce((sum, e) => sum + e.caloriesBurned, 0);
    const target = (settings?.bmr || 2000) + activeBurn; // Dynamic target
    // Or users usually have a static goal + active burn? Let's assume Target is NET.
    // Simplifying: Target is 'settings.dailyCalorieTarget' (e.g. 2500).

    // Let's assume a "Goal" of ~2500 per day if not set.
    const dailyGoal = 2500;
    const diff = caloriesIn - dailyGoal;
    const diffPercent = Math.abs(diff / dailyGoal);

    let nutScore = 100;
    let nutStatus: HealthComponents['nutrition']['status'] = 'Balanced';

    if (diffPercent < 0.10) {
        nutScore = 100;
        nutStatus = 'Balanced';
    } else if (diff > 0) {
        // Surplus
        nutScore = Math.max(0, 100 - (diffPercent * 50)); // Penalize surplus
        nutStatus = 'Surplus';
    } else {
        // Deficit
        nutScore = Math.max(0, 100 - (diffPercent * 80)); // Penalize deficit harder (starving)
        nutStatus = 'Deficit';
        if (diffPercent > 0.4) nutStatus = 'Poor Quality'; // Severe undereating
    }

    // Protein check (Placeholder logic)
    const proteinEstimated = caloriesIn * 0.2 / 4; // Estimate 20% protein
    const proteinTarget = 150; // g
    const proteinMet = proteinEstimated >= (proteinTarget * 0.8);
    if (!proteinMet) nutScore -= 10;

    // --- 3. CONSISTENCY COMPONENT ---
    // Streak: How many days in the last 7 have at least 1 activity or logged meal?
    let streakDays = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(date.getTime() - (i * 86400000)).toISOString().split('T')[0];
        const hasEx = exercises.find(e => e.date === d);
        const hasMeal = meals.find(m => m.date === d);
        if (hasEx || hasMeal) streakDays++;
    }

    let consScore = (streakDays / 7) * 100;
    let consStatus: HealthComponents['consistency']['status'] = 'Consistent';
    if (streakDays < 4) consStatus = 'Spotty';
    if (streakDays === 0) consStatus = 'Inactive';

    // --- TOTAL SCORE ---
    // Weighted Average: Training 40%, Nutrition 40%, Consistency 20%
    const total = Math.round((trainScore * 0.4) + (nutScore * 0.4) + (consScore * 0.2));

    return {
        training: {
            score: trainScore,
            status: trainStatus,
            details: trainDetails,
            tsb: Math.round(tsb)
        },
        nutrition: {
            score: Math.round(nutScore),
            caloriesDiff: diff,
            proteinMet,
            status: nutStatus
        },
        consistency: {
            score: Math.round(consScore),
            streak: streakDays,
            status: consStatus
        },
        totalScore: total
    };
}
