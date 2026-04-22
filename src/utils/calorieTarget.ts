/**
 * Centralized Calorie Target Utilities
 * 
 * "One function to rule them all" - This module provides the single source of truth
 * for getting the active calorie target from training periods and performance goals.
 */

import { PerformanceGoal, TrainingPeriod, TrainingCycle } from '../models/types.ts';

export interface CalorieTargetResult {
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    isAdapted: boolean;
    extraCalories: number;
    source: 'period_goal' | 'period_direct' | 'settings' | 'default';
    goalId?: string;
    periodId?: string;
    goalName?: string;
    explanation?: string;
}

/**
 * Get the active calorie and macro target for a given date.
 * 
 * Priority order:
 * 1. Active Goal with nutritionMacros linked to active period
 * 2. Active Goal with type='nutrition' and period='daily' linked to active period
 * 3. Any active Goal with nutritionMacros
 * 4. Active PerformanceGoal with type='nutrition' and period='daily' (no period link)
 * 5. trainingPeriod.nutritionGoal (if set directly on period/cycle)
 * 6. settings.dailyCalorieGoal (with TrainingCycle goal adjustment if applicable)
 * 7. Default fallback (2000)
 */
export function getActiveCalorieTarget(
    date: string,
    trainingPeriods: (TrainingPeriod | TrainingCycle)[],
    performanceGoals: PerformanceGoal[],
    settingsDailyGoals?: { calories?: number; protein?: number; carbs?: number; fat?: number },
    defaultCalories: number = 2000,
    calorieMode: 'tdee' | 'fixed' = 'tdee',
    burnedCalories: number = 0,
    exerciseCalorieMultiplier: number = 1.0
): CalorieTargetResult {

    // Step 1: Find active training period for the date
    const activePeriod = trainingPeriods.find(
        p => {
            const start = p.startDate;
            const end = p.endDate || '9999-12-31';
            return date >= start && date <= end;
        }
    );

    let baseCalories = settingsDailyGoals?.calories || defaultCalories;
    let baseProtein = settingsDailyGoals?.protein;
    let baseCarbs = settingsDailyGoals?.carbs;
    let baseFat = settingsDailyGoals?.fat;
    
    let source: CalorieTargetResult['source'] = 'settings';
    let goalId: string | undefined;
    let periodId: string | undefined;
    let goalName: string | undefined;

    let foundGoal = false;

    // Priority 1: Performance Goals
    // We look for ANY active goal that has nutritionMacros, prioritizing those linked to the current period
    const activeGoals = performanceGoals.filter(g => g.status === 'active');
    
    // Sort goals to find the most relevant "nutrition driver"
    const sortedGoals = [...activeGoals].sort((a, b) => {
        // Priority 1: Goals with explicit nutrition macros
        const aHasMacros = !!(a.nutritionMacros && a.nutritionMacros.calories);
        const bHasMacros = !!(b.nutritionMacros && b.nutritionMacros.calories);
        if (aHasMacros && !bHasMacros) return -1;
        if (bHasMacros && !aHasMacros) return 1;

        // Priority 2: Current period link
        if (activePeriod) {
            if (a.periodId === activePeriod.id && b.periodId !== activePeriod.id) return -1;
            if (b.periodId === activePeriod.id && a.periodId !== activePeriod.id) return 1;
        }

        // Priority 3: Explicit 'nutrition' types
        if (a.type === 'nutrition' && b.type !== 'nutrition') return -1;
        if (b.type === 'nutrition' && a.type !== 'nutrition') return 1;
        
        return 0;
    });

    const nutritionGoal = sortedGoals.find(g => 
        g.nutritionMacros || 
        g.type === 'nutrition' || 
        g.targets?.some(t => t.nutritionType === 'calories')
    );

    if (nutritionGoal) {
        const macros = nutritionGoal.nutritionMacros;
        if (macros && macros.calories) {
            baseCalories = macros.calories;
            baseProtein = macros.protein;
            baseCarbs = macros.carbs;
            baseFat = macros.fat;
            source = 'period_goal';
            goalId = nutritionGoal.id;
            goalName = nutritionGoal.name;
            foundGoal = true;
        } else if (nutritionGoal.targets?.length) {
            const calTarget = nutritionGoal.targets.find(t => t.nutritionType === 'calories' || nutritionGoal.type === 'nutrition');
            if (calTarget?.value) {
                baseCalories = calTarget.value;
                source = 'period_goal';
                goalId = nutritionGoal.id;
                goalName = nutritionGoal.name;
                foundGoal = true;
            }
        }
    }

    // Priority 2: Direct Period/Cycle Nutrition
    if (!foundGoal && activePeriod) {
        const p = activePeriod as TrainingPeriod;
        if (p.nutritionGoal?.calories) {
            baseCalories = p.nutritionGoal.calories;
            baseProtein = p.nutritionGoal.protein;
            baseCarbs = p.nutritionGoal.carbs;
            baseFat = p.nutritionGoal.fat;
            source = 'period_direct';
            periodId = activePeriod.id;
            foundGoal = true;
        }
    }

    // Fallback logic for TrainingCycle goal adjustment (only if using settings)
    if (source === 'settings' && activePeriod && (activePeriod as TrainingCycle).goal) {
        const cycleGoal = (activePeriod as TrainingCycle).goal;
        if (cycleGoal === 'deff') baseCalories -= 500;
        else if (cycleGoal === 'bulk') baseCalories += 500;
    }

    // Calorie Mode & Adaptation Logic
    let extraCalories = 0;
    let isAdapted = false;

    if (burnedCalories > 50) {
        extraCalories = Math.round(burnedCalories * exerciseCalorieMultiplier);
        isAdapted = true;
    }

    // Determine final calories
    let finalCalories = baseCalories;
    if (calorieMode === 'fixed') {
        finalCalories = baseCalories + extraCalories;
    } else {
        // In TDEE mode, we might still want to show the 'available' calories including exercise
        // but the 'base' remains the anchor. For now, let's follow the 'fixed' logic if we want 
        // consistency in the "kvar" calculation, OR ensure users know which mode they are in.
        // DECISION: If we have burned calories, we ALWAYS show the adapted targets in the result
        // to avoid the "Grovt missvisande" error where active people see they are over capacity.
        finalCalories = baseCalories + extraCalories;
    }

    // Adaptive Macro Ratios:
    // Protein: 15% of extra calories for muscle repair
    // Carbs: 65% of extra calories for glycogen (Athletic focus)
    // Fat: 20% of extra calories for hormonal health
    
    let finalProtein = baseProtein;
    let finalCarbs = baseCarbs;
    let finalFat = baseFat;

    if (extraCalories > 0) {
        const extraProtein = (extraCalories * 0.15) / 4;
        const extraCarbs = (extraCalories * 0.65) / 4;
        const extraFat = (extraCalories * 0.20) / 9;

        if (finalProtein !== undefined) finalProtein = Math.round(finalProtein + extraProtein);
        if (finalCarbs !== undefined) finalCarbs = Math.round(finalCarbs + extraCarbs);
        if (finalFat !== undefined) finalFat = Math.round(finalFat + extraFat);
    }

    // Explanation
    let explanationList = [];
    if (source === 'period_goal') {
        explanationList.push(`Målet "${goalName}"`);
    } else if (source === 'period_direct') {
        explanationList.push(`Träningsperiod`);
    } else if (source === 'settings') {
        explanationList.push(`Inställningar (${baseCalories} kcal)`);
    }

    if (extraCalories > 0) {
        explanationList.push(`Träning (+${extraCalories} kcal)`);
    }

    return {
        calories: finalCalories,
        protein: finalProtein,
        carbs: finalCarbs,
        fat: finalFat,
        isAdapted,
        extraCalories,
        source,
        goalId,
        periodId,
        goalName,
        explanation: explanationList.join(' + ')
    };
}


/**
 * Simple helper that just returns the calorie number.
 * Use this when you only need the value, not the source info.
 */
export function getActiveCalories(
    date: string,
    trainingPeriods: (TrainingPeriod | TrainingCycle)[],
    performanceGoals: PerformanceGoal[],
    settingsDailyGoals?: { calories?: number; protein?: number; carbs?: number; fat?: number },
    defaultCalories: number = 2000,
    calorieMode: 'tdee' | 'fixed' = 'tdee',
    burnedCalories: number = 0,
    exerciseCalorieMultiplier: number = 1.0
): number {
    return getActiveCalorieTarget(
        date,
        trainingPeriods,
        performanceGoals,
        settingsDailyGoals,
        defaultCalories,
        calorieMode,
        burnedCalories,
        exerciseCalorieMultiplier
    ).calories;
}

