
import { useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { getISODate } from '../models/types.ts';

export interface HealthState {
    bmr: number;
    tdee: number;
    dailyCaloriesConsumed: number;
    dailyCaloriesBurned: number;
    netCalories: number;
    targetCalories: number;
    goalAdjustment: number;
    remainingCalories: number;
    currentGoal: 'neutral' | 'deff' | 'bulk';
    activeCycle: any | null; // Typed loosely for now, or import TrainingCycle
    cycleProgress: {
        daysIn: number;
        daysLeft?: number;
        percent?: number;
    } | null;
}

export function useHealth(date: string = getISODate()) {
    const {
        calculateBMR,
        trainingCycles,
        exerciseEntries,
        calculateDailyNutrition,
        weightEntries,
        getLatestWeight
    } = useData();

    const { settings } = useSettings();

    // 1. Calculate BMR (Base Metabolic Rate)
    // Note: calculateBMR from context might logically likely use settings internally or just weight?
    // Let's assume calculateBMR in DataContext handles the weight part, but we might pass age/gender if it requires it?
    // Checking TrainingPage usage: `const bmr = calculateBMR();` - it takes no args, so it uses current state.
    const bmr = calculateBMR();

    // 2. Active Cycle
    const activeCycle = useMemo(() => {
        const d = new Date(date);
        return trainingCycles.find(c => {
            const start = new Date(c.startDate);
            const end = c.endDate ? new Date(c.endDate) : new Date('9999-12-31');
            return d >= start && d <= end;
        });
    }, [trainingCycles, date]);

    // 3. Current Goal
    const currentGoal = activeCycle ? activeCycle.goal : settings.trainingGoal || 'neutral';
    const goalAdjustment = currentGoal === 'deff' ? -500 : currentGoal === 'bulk' ? 500 : 0;

    // 4. Exercise & Burned
    const dailyExercises = useMemo(() =>
        exerciseEntries.filter(e => e.date === date),
        [exerciseEntries, date]
    );

    const dailyCaloriesBurned = useMemo(() =>
        dailyExercises.reduce((sum, e) => sum + e.caloriesBurned, 0),
        [dailyExercises]
    );

    // 5. Consumed
    const nutrition = calculateDailyNutrition(date);
    const dailyCaloriesConsumed = nutrition.calories;

    // 6. TDEE & Targets
    // TDEE = BMR + Exercise + Goal
    // Wait, typically TDEE = BMR * ActivityMultiplier + Exercise.
    // Simplifying to: Target = BMR + Exercise + GoalAdjustment
    const targetCalories = Math.round(bmr + dailyCaloriesBurned + goalAdjustment);

    const netCalories = dailyCaloriesConsumed - dailyCaloriesBurned;
    const remainingCalories = targetCalories - dailyCaloriesConsumed;

    // 7. Cycle Progress
    const cycleProgress = useMemo(() => {
        if (!activeCycle) return null;
        const start = new Date(activeCycle.startDate);
        const now = new Date(date);
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const daysIn = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let daysLeft = undefined;
        let percent = undefined;

        if (activeCycle.endDate) {
            const end = new Date(activeCycle.endDate);
            const totalTime = end.getTime() - start.getTime();
            const timeLeft = end.getTime() - now.getTime();
            daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
            percent = Math.min(100, Math.max(0, (diffTime / totalTime) * 100));
        }

        return { daysIn, daysLeft, percent };
    }, [activeCycle, date]);

    return {
        bmr,
        tdee: bmr + dailyCaloriesBurned, // True Total Daily Energy Expenditure (approx)
        dailyCaloriesConsumed,
        dailyCaloriesBurned,
        netCalories,
        targetCalories,
        goalAdjustment,
        remainingCalories,
        currentGoal,
        activeCycle,
        cycleProgress,
        dailyExercises // Added
    };
}
