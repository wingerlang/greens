import { ExerciseEntry, ExerciseType, PerformanceGoalType } from "../models/types";

// Helper to calculate BMR and TDEE based targets
export const calculateCalorieTarget = (
    bmr: number,
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' = 'moderate',
    goal: 'cut' | 'maintain' | 'bulk' = 'cut'
) => {
    const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9
    };

    const adjustments = {
        cut: -500, // ~0.5kg loss/week
        maintain: 0,
        bulk: 300
    };

    const tdee = Math.round(bmr * multipliers[activityLevel]);
    const target = Math.round(tdee + adjustments[goal]);

    return {
        tdee,
        target,
        explanation: `Baserat på BMR (${bmr}) × aktivitetsnivå (${multipliers[activityLevel]}) ${adjustments[goal] >= 0 ? '+' : ''}${adjustments[goal]} kcal`
    };
};

// Helper to calculate volume stats
export const calculateVolumeStats = (
    history: ExerciseEntry[],
    type: ExerciseType,
    unit: 'km' | 'ton'
) => {
    // Filter history by type
    const relevant = history.filter(e => e.type === type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (relevant.length === 0) return null;

    const now = new Date();

    const getAvg = (days: number) => {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const inRange = relevant.filter(e => new Date(e.date) >= cutoff);
        if (inRange.length === 0) return 0;

        // Group by week to get weekly average
        // Or if days < 7, just sum? User asked for "Average 7d/30d" usually implies "Daily average over that period" OR "Weekly average extrapolated".
        // Context: "Weekly Volume". So we want average WEEKLY volume during the last X days.

        const totalVolume = inRange.reduce((sum, e) => {
            if (unit === 'km') return sum + (e.distance || 0);
            if (unit === 'ton') return sum + (e.tonnage ? e.tonnage / 1000 : 0); // Convert kg to ton if needed, assuming tonnage stored in kg
            return sum;
        }, 0);

        // Normalize to weekly
        const weeks = Math.max(1, days / 7);
        return totalVolume / weeks;
    };

    return {
        avg7d: getAvg(7),
        avg30d: getAvg(30),
        avg3m: getAvg(90),
        avg6m: getAvg(180),
        unit
    };
};
