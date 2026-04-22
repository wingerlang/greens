import { useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { getISODate } from '../models/types.ts';
import { getActiveCalories } from '../utils/calorieTarget.ts';

export interface HealthState {
    bmr: number;
    tdee: number;
    dailyCaloriesConsumed: number;
    dailyCaloriesBurned: number;
    netCalories: number;
    targetCalories: number;
    goalAdjustment: number;
    remainingCalories: number;
    plannedCaloriesBurned: number;
    totalProjectedBurn: number;
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
        performanceGoals, // Add this
        unifiedActivities,
        calculateDailyNutrition,
        weightEntries,
        getLatestWeight,
        plannedActivities,
        calculateExerciseCalories
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

    // 4. Exercise & Burned - Using ALL activity sources (Strava, manual, strength)
    const dailyExercises = useMemo(() =>
        unifiedActivities
            .filter(e => e.date === date)
            .sort((a, b) => {
                const timeA = a.startTime || '00:00';
                const timeB = b.startTime || '00:00';
                return timeA.localeCompare(timeB);
            }),
        [unifiedActivities, date]
    );


    const dailyCaloriesBurned = useMemo(() =>
        dailyExercises.reduce((sum, e) => sum + (e.caloriesBurned || 0), 0),
        [dailyExercises]
    );
    
    const plannedCaloriesBurned = useMemo(() => {
        const plannedForDate = plannedActivities.filter(p => p.date === date && p.status === 'PLANNED');
        return plannedForDate.reduce((sum, p) => {
            const intensity = p.targetHrZone <= 2 ? 'low' : p.targetHrZone >= 4 ? 'high' : 'moderate';
            
            // Map PlannedActivity.type to ExerciseType
            const typeValue = p.type === 'RUN' ? 'running' :
                             p.type === 'BIKE' ? 'cycling' :
                             p.type === 'REST' ? 'recovery' :
                             p.type.toLowerCase();

            return sum + calculateExerciseCalories(
                typeValue as any,
                p.durationMinutes || 0,
                intensity,
                p.description,
                undefined, // averageWatts
                undefined, // avgHr
                p.estimatedDistance
            );
        }, 0);
    }, [plannedActivities, date, calculateExerciseCalories]);

    // 5. Consumed
    const nutrition = calculateDailyNutrition(date);
    const dailyCaloriesConsumed = nutrition.calories;

    // 6. TDEE & Targets
    // Use the centralized source of truth for target calories
    const targetCalories = getActiveCalories(
        date,
        trainingCycles,
        performanceGoals,
        {
            calories: settings.dailyCalorieGoal,
            protein: settings.dailyProteinGoal,
            carbs: settings.dailyCarbsGoal,
            fat: settings.dailyFatGoal
        },
        settings.dailyCalorieGoal || 2000,
        settings.calorieMode || 'tdee',
        dailyCaloriesBurned,
        settings.exerciseCalorieMultiplier ?? 1.0
    );

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

    const metabolicMultiplier = settings.metabolicBaselineMultiplier || 1.2;

    return {
        bmr,
        tdee: (bmr * metabolicMultiplier) + dailyCaloriesBurned, // True Total Daily Energy Expenditure (approx)
        dailyCaloriesConsumed,
        dailyCaloriesBurned,
        plannedCaloriesBurned,
        totalProjectedBurn: dailyCaloriesBurned + plannedCaloriesBurned,
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
