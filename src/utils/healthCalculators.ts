/**
 * Health Calculators
 * BMI, BMR, TDEE, Deficit
 */

export function calculateBMI(weightKg: number, heightCm: number): number {
    if (heightCm <= 0) return 0;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return Math.round(bmi * 10) / 10;
}

export function calculateBMR(weightKg: number, heightCm: number, age: number, gender: 'male' | 'female'): number {
    // Mifflin-St Jeor Equation
    // Men: 10W + 6.25H - 5A + 5
    // Women: 10W + 6.25H - 5A - 161
    const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
    return Math.round(gender === 'male' ? base + 5 : base - 161);
}

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'active' | 'very_active' | 'extra_active';

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
    const multipliers: Record<ActivityLevel, number> = {
        'sedentary': 1.2,      // Little or no exercise
        'lightly_active': 1.375, // Light exercise 1-3 days/week
        'active': 1.55,        // Moderate exercise 3-5 days/week
        'very_active': 1.725,  // Hard exercise 6-7 days/week
        'extra_active': 1.9    // Very hard exercise & physical job
    };
    return Math.round(bmr * (multipliers[activityLevel] || 1.2));
}

export function calculateCalorieDeficit(
    currentWeightKg: number,
    targetWeightKg: number,
    days: number,
    tdee: number
): { dailyDeficit: number; targetCalories: number } {
    if (days <= 0) return { dailyDeficit: 0, targetCalories: tdee };

    // 1kg fat approx 7700 kcal
    const weightDiff = currentWeightKg - targetWeightKg;
    const totalDeficitNeeded = weightDiff * 7700;
    const dailyDeficit = Math.round(totalDeficitNeeded / days);

    // Safety check: Don't suggest starving
    // If goal is gaining weight, deficit is negative (surplus)

    return {
        dailyDeficit,
        targetCalories: tdee - dailyDeficit
    };
}

export interface MacroSplit {
    protein: number;
    carbs: number;
    fat: number;
}

export function calculateMacros(calories: number, split: { p: number, c: number, f: number }): MacroSplit {
    if (calories <= 0) return { protein: 0, carbs: 0, fat: 0 };

    // Split is percentages (e.g., 40, 40, 20)
    // Protein & Carbs = 4 kcal/g
    // Fat = 9 kcal/g

    const pCals = calories * (split.p / 100);
    const cCals = calories * (split.c / 100);
    const fCals = calories * (split.f / 100);

    return {
        protein: Math.round(pCals / 4),
        carbs: Math.round(cCals / 4),
        fat: Math.round(fCals / 9)
    };
}
