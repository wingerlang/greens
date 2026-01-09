/**
 * Goal Calculations Utility
 * Core logic for calculating goal progress, streaks, and projections.
 */

import type {
    PerformanceGoal,
    ExerciseEntry,
    MealEntry,
    FoodItem,
    Recipe,
    GoalTarget
} from '../models/types';

// ============================================
// Types
// ============================================

export interface GoalProgress {
    current: number;
    target: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
    isComplete: boolean;
    isOnTrack: boolean;
    daysRemaining?: number;
    estimatedCompletionDate?: string;
    periodStart: string;
    periodEnd: string;
    linkedActivityId?: string; // ID of the activity that achieved the goal (e.g. for PBs/Speed)
}

export interface StreakInfo {
    current: number;
    best: number;
    lastActiveDate: string | null;
    isActive: boolean;
}

// ============================================
// Period Helpers
// ============================================

/**
 * Get the start and end dates for a goal's current period.
 */
export function getGoalPeriodDates(goal: PerformanceGoal, referenceDate: Date = new Date()): { start: string; end: string } {
    const today = referenceDate;

    switch (goal.period) {
        case 'daily': {
            const dateStr = today.toISOString().split('T')[0];
            return { start: dateStr, end: dateStr };
        }
        case 'weekly': {
            // Weight goals should always be treated as long-term (once) even if set to weekly, 
            // as you don't "reset" weight loss every week.
            if (goal.type === 'weight') {
                return {
                    start: goal.startDate,
                    end: goal.endDate || today.toISOString().split('T')[0]
                };
            }

            // Start of week (Monday)
            const weekStart = new Date(today);
            const day = weekStart.getDay();
            const diff = day === 0 ? -6 : 1 - day; // Adjust for Monday start
            weekStart.setDate(weekStart.getDate() + diff);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            return {
                start: weekStart.toISOString().split('T')[0],
                end: weekEnd.toISOString().split('T')[0]
            };
        }
        case 'monthly': {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return {
                start: monthStart.toISOString().split('T')[0],
                end: monthEnd.toISOString().split('T')[0]
            };
        }
        case 'once': {
            // For "once" goals, period is from goal start to now (or end date)
            return {
                start: goal.startDate,
                end: goal.endDate || today.toISOString().split('T')[0]
            };
        }
        default:
            return {
                start: today.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            };
    }
}

/**
 * Get days remaining until the goal's end date.
 * For recurring goals (daily/weekly) WITH an endDate, shows days until end.
 * For goals WITHOUT an endDate, returns undefined (they run indefinitely).
 */
export function getDaysRemaining(goal: PerformanceGoal): number | undefined {
    // If no endDate, the goal runs indefinitely
    if (!goal.endDate) return undefined;

    const end = new Date(goal.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

// ============================================
// Progress Calculations
// ============================================

/**
 * Calculate progress for a frequency goal.
 */
export function calculateFrequencyProgress(
    goal: PerformanceGoal,
    exerciseEntries: ExerciseEntry[]
): number {
    const { start, end } = getGoalPeriodDates(goal);

    // If multiple targets, calculate total across all
    if (goal.targets.length > 1) {
        let totalCurrent = 0;
        goal.targets.forEach(target => {
            const matchingEntries = exerciseEntries.filter(e => {
                if (e.date < start || e.date > end) return false;
                if (target.exerciseType && e.type !== target.exerciseType) return false;
                return true;
            });
            totalCurrent += matchingEntries.length;
        });
        return totalCurrent;
    }

    const target = goal.targets[0];
    const matchingEntries = exerciseEntries.filter(e => {
        if (e.date < start || e.date > end) return false;
        if (target?.exerciseType && e.type !== target.exerciseType) return false;
        return true;
    });

    return matchingEntries.length;
}

/**
 * Calculate progress for a speed goal (best time for target distance).
 * Returns the BEST time (in seconds) that meets the distance criteria within the period.
 * If no valid activity found, returns Infinity (or a high number).
 */
export type SpeedProgressResult = { value: number; activityId?: string };

export function calculateSpeedProgress(
    goal: PerformanceGoal,
    exerciseEntries: ExerciseEntry[]
): SpeedProgressResult {
    const { start, end } = getGoalPeriodDates(goal);
    // Speed goals: target is X distance. We find the run during the period
    // that has distance >= X and implies the best time.
    // Actually, "5km in 25 min" matches a run of exactly 5km, or a longer run where the pace implies <25min for 5km.
    // For simplicity MVP: we take any run >= target distance, calculate its average pace, and project time for target distance.

    // Filter runs during period with enough distance
    const target = goal.targets[0];
    if (!target?.distanceKm) return { value: 0 };

    const validEntries = exerciseEntries.filter(e => {
        if (e.date < start || e.date > end) return false;
        if (target.exerciseType === 'running' && e.type !== 'running') return false; // Default to running for speed for now
        // Must be at least the target distance to counting "PB" style speed record?
        // Or should we allow 4.9km? Let's be strict: >= target distance.
        return (e.distance || 0) >= target.distanceKm!;
    });

    if (validEntries.length === 0) return { value: 0 };

    // Find the best pace/speed in valid entries
    // We want the run that implies the fastest time for the TARGET distance.
    // If run is 10km in 60min, pace is 6min/km. 5km time is 30min.
    // We minimize the calculated time for the target distance.

    let bestTimeSeconds = Infinity;
    let bestActivityId: string | undefined;

    validEntries.forEach(e => {
        const dist = e.distance || 0;
        const dur = (e.durationMinutes || 0) * 60; // seconds
        if (dist > 0 && dur > 0) {
            const paceSecondsPerKm = dur / dist;
            const projectedTimeFn = paceSecondsPerKm * target.distanceKm!;
            if (projectedTimeFn < bestTimeSeconds) {
                bestTimeSeconds = projectedTimeFn;
                bestActivityId = e.id;
            }
        }
    });

    return bestTimeSeconds === Infinity ? { value: 0 } : { value: bestTimeSeconds, activityId: bestActivityId };
}

/**
 * Calculate progress for a distance goal.
 */
export function calculateDistanceProgress(
    goal: PerformanceGoal,
    exerciseEntries: ExerciseEntry[]
): number {
    const { start, end } = getGoalPeriodDates(goal);
    const target = goal.targets[0];

    const matchingEntries = exerciseEntries.filter(e => {
        if (e.date < start || e.date > end) return false;
        if (target?.exerciseType && e.type !== target.exerciseType) return false;
        return true;
    });

    return matchingEntries.reduce((sum, e) => sum + (e.distance || 0), 0);
}

/**
 * Calculate progress for a tonnage goal.
 */
export function calculateTonnageProgress(
    goal: PerformanceGoal,
    exerciseEntries: ExerciseEntry[]
): number {
    const { start, end } = getGoalPeriodDates(goal);

    const totalKg = exerciseEntries
        .filter(e => e.date >= start && e.date <= end)
        .reduce((sum, e) => sum + (e.tonnage || 0), 0);

    return totalKg / 1000; // Convert to tons
}

/**
 * Calculate progress for a calories goal.
 */
export function calculateCaloriesProgress(
    goal: PerformanceGoal,
    exerciseEntries: ExerciseEntry[]
): number {
    const { start, end } = getGoalPeriodDates(goal);

    return exerciseEntries
        .filter(e => e.date >= start && e.date <= end)
        .reduce((sum, e) => sum + (e.caloriesBurned || 0), 0);
}

/**
 * Calculate streak for a goal.
 */
export function calculateStreak(
    exerciseEntries: ExerciseEntry[],
    period: 'daily' | 'weekly',
    exerciseType?: string
): StreakInfo {
    if (exerciseEntries.length === 0) {
        return { current: 0, best: 0, lastActiveDate: null, isActive: false };
    }

    // Get unique dates with activity
    const activeDates = [...new Set(
        exerciseEntries
            .filter(e => !exerciseType || e.type === exerciseType)
            .map(e => e.date)
    )].sort().reverse();

    if (activeDates.length === 0) {
        return { current: 0, best: 0, lastActiveDate: null, isActive: false };
    }

    const lastActiveDate = activeDates[0];
    const today = new Date().toISOString().split('T')[0];

    if (period === 'daily') {
        // Check if streak is still active (today or yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const isActive = lastActiveDate === today || lastActiveDate === yesterdayStr;

        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 1;

        for (let i = 0; i < activeDates.length - 1; i++) {
            const curr = new Date(activeDates[i]);
            const next = new Date(activeDates[i + 1]);
            const diffDays = (curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
                tempStreak++;
            } else {
                if (i === 0 || currentStreak === 0) {
                    currentStreak = tempStreak;
                }
                bestStreak = Math.max(bestStreak, tempStreak);
                tempStreak = 1;
            }
        }

        // Handle final streak
        if (activeDates.length > 0 && (activeDates[0] === today || activeDates[0] === yesterdayStr)) {
            currentStreak = tempStreak;
        }
        bestStreak = Math.max(bestStreak, tempStreak);

        return { current: currentStreak, best: bestStreak, lastActiveDate, isActive };
    } else {
        // Weekly streak - check ISO week numbers
        const getWeekNumber = (d: Date) => {
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = date.getUTCDay() || 7;
            date.setUTCDate(date.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
            return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        };

        const activeWeeks = [...new Set(activeDates.map(d => {
            const date = new Date(d);
            return `${date.getFullYear()}-W${getWeekNumber(date)}`;
        }))].sort().reverse();

        // Simple weekly streak count
        let currentStreak = 1;
        let bestStreak = 1;

        // Check if current week is active
        const thisWeek = `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const lastWeekStr = `${lastWeek.getFullYear()}-W${getWeekNumber(lastWeek)}`;

        const isActive = activeWeeks[0] === thisWeek || activeWeeks[0] === lastWeekStr;

        for (let i = 0; i < activeWeeks.length - 1; i++) {
            // Simplified: just count consecutive weeks
            const [y1, w1] = activeWeeks[i].split('-W').map(Number);
            const [y2, w2] = activeWeeks[i + 1].split('-W').map(Number);

            if (y1 === y2 && w1 - w2 === 1) {
                currentStreak++;
            } else if (y1 === y2 + 1 && w1 === 1 && w2 >= 51) {
                currentStreak++; // Handle year boundary
            } else {
                bestStreak = Math.max(bestStreak, currentStreak);
                currentStreak = 1;
            }
        }
        bestStreak = Math.max(bestStreak, currentStreak);

        return { current: isActive ? currentStreak : 0, best: bestStreak, lastActiveDate, isActive };
    }
}

/**
 * Calculate nutrition progress for a goal.
 */
export function calculateNutritionProgress(
    goal: PerformanceGoal,
    mealEntries: MealEntry[],
    foodItems: FoodItem[],
    recipes: Recipe[]
): number {
    const { start, end } = getGoalPeriodDates(goal);
    const target = goal.targets[0];
    const nutritionType = target?.nutritionType || 'calories';

    let total = 0;

    mealEntries
        .filter(e => e.date >= start && e.date <= end)
        .forEach(entry => {
            entry.items.forEach(item => {
                if (item.type === 'foodItem') {
                    const food = foodItems.find(f => f.id === item.referenceId);
                    if (food) {
                        const multiplier = item.servings / 100;
                        switch (nutritionType) {
                            case 'calories': total += food.calories * multiplier; break;
                            case 'protein': total += food.protein * multiplier; break;
                            case 'carbs': total += food.carbs * multiplier; break;
                            case 'fat': total += food.fat * multiplier; break;
                        }
                    }
                } else if (item.type === 'recipe') {
                    const recipe = recipes.find(r => r.id === item.referenceId);
                    if (recipe) {
                        // Calculate recipe totals
                        let recipeTotal = 0;
                        recipe.ingredients.forEach(ing => {
                            const f = foodItems.find(fi => fi.id === ing.foodItemId);
                            if (f) {
                                const mult = ing.quantity / 100;
                                switch (nutritionType) {
                                    case 'calories': recipeTotal += f.calories * mult; break;
                                    case 'protein': recipeTotal += f.protein * mult; break;
                                    case 'carbs': recipeTotal += f.carbs * mult; break;
                                    case 'fat': recipeTotal += f.fat * mult; break;
                                }
                            }
                        });
                        const perServing = recipe.servings > 0 ? recipeTotal / recipe.servings : recipeTotal;
                        total += perServing * item.servings;
                    }
                }
            });
        });

    return total;
}

/**
 * Get estimated completion date based on current rate.
 */
export function getEstimatedCompletionDate(
    goal: PerformanceGoal,
    progress: GoalProgress
): string | undefined {
    if (!progress.isOnTrack || progress.isComplete) return undefined;

    const remaining = progress.target - progress.current;
    if (remaining <= 0) return undefined;

    // Simplified projection: usage rate per day
    // This needs real historical rate, but for now using period average

    const { start } = getGoalPeriodDates(goal);
    const startDate = new Date(start);
    const today = new Date();
    const daysPassed = Math.max(1, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const rate = progress.current / daysPassed;
    if (rate <= 0) return undefined;

    const daysNeeded = remaining / rate;

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(daysNeeded));

    return estimatedDate.toISOString().split('T')[0];
}

/**
 * Calculate detailed "Ahead/Behind" status.
 * Returns negative value for behind, positive for ahead.
 * Unit depends on goal type.
 */
export function calculateAheadBehind(
    goal: PerformanceGoal,
    progress: GoalProgress
): { value: number; text: string; unit: string } {
    const { start, end } = getGoalPeriodDates(goal);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();

    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysElapsed = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysElapsed <= 0) return { value: 0, text: 'Har inte startat', unit: '' };
    if (daysElapsed >= totalDays) return { value: 0, text: 'Avslutad', unit: '' };

    // For weekly/monthly goals, progress.target is the per-period value
    // We need to calculate total expected across the entire goal period
    const totalWeeks = totalDays / 7;
    const isWeekly = goal.period === 'weekly';
    const isMonthly = goal.period === 'monthly';

    // Calculate total expected for the entire goal period
    const totalExpected = isWeekly
        ? progress.target * totalWeeks
        : isMonthly
            ? progress.target * (totalDays / 30)
            : progress.target; // 'once' or 'daily'

    // Calculate expected progress by today (linear interpolation)
    const progressRatio = daysElapsed / totalDays;
    const expectedProgress = totalExpected * progressRatio;

    const diff = progress.current - expectedProgress;

    const unit = goal.targets[0]?.unit || '';
    const text = diff >= 0
        ? `+${diff.toFixed(1)} före`
        : `${diff.toFixed(1)} efter`;

    return { value: diff, text, unit };
}

/**
 * Assess goal difficulty based on historical data.
 * Returns a score 1-10 (1=Easy, 10=Impossible) and a label.
 */
export function assessGoalDifficulty(
    goal: PerformanceGoal,
    exerciseEntries: ExerciseEntry[]
): { score: number; label: string; color: string } {
    // Default values
    let score = 5;
    let label = 'Medel';
    let color = 'text-yellow-400';

    // Look at last 90 days of history
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];

    const recentEntries = exerciseEntries.filter(e => e.date >= cutoffDate);

    if (goal.type === 'frequency') {
        // Compare target sessions/week vs historical average
        const target = goal.targets[0];
        const targetPerWeek = target?.count || 1;

        // Count sessions per week in history
        const matchingEntries = recentEntries.filter(e =>
            !target?.exerciseType || e.type === target.exerciseType
        );
        const weeksOfData = Math.max(1, 90 / 7);
        const avgPerWeek = matchingEntries.length / weeksOfData;

        // Ratio of target to average
        const ratio = targetPerWeek / Math.max(0.1, avgPerWeek);

        if (ratio <= 0.5) { score = 1; label = 'Väldigt Lätt'; color = 'text-emerald-400'; }
        else if (ratio <= 0.8) { score = 3; label = 'Lätt'; color = 'text-emerald-400'; }
        else if (ratio <= 1.0) { score = 5; label = 'Lagom'; color = 'text-yellow-400'; }
        else if (ratio <= 1.2) { score = 6; label = 'Utmanande'; color = 'text-orange-400'; }
        else if (ratio <= 1.5) { score = 7.5; label = 'Svårt'; color = 'text-orange-400'; }
        else if (ratio <= 2.0) { score = 8.5; label = 'Mycket Svårt'; color = 'text-red-400'; }
        else { score = 9.5; label = 'Extremt Svårt'; color = 'text-red-400'; }
    } else if (goal.type === 'distance') {
        // Compare target distance/period vs historical average
        const target = goal.targets[0];
        const targetValue = target?.value || 0;

        const totalDistance = recentEntries
            .filter(e => !target?.exerciseType || e.type === target.exerciseType)
            .reduce((sum, e) => sum + (e.distance || 0), 0);
        const avgPerWeek = totalDistance / Math.max(1, 90 / 7);
        const targetPerWeek = goal.period === 'weekly' ? targetValue :
            goal.period === 'monthly' ? targetValue / 4 : targetValue / 12;

        const ratio = targetPerWeek / Math.max(0.1, avgPerWeek);

        if (ratio <= 0.5) { score = 2; label = 'Lätt'; color = 'text-emerald-400'; }
        else if (ratio <= 0.8) { score = 4; label = 'Lagom'; color = 'text-yellow-400'; }
        else if (ratio <= 1.0) { score = 5; label = 'Medel'; color = 'text-yellow-400'; }
        else if (ratio <= 1.3) { score = 7; label = 'Utmanande'; color = 'text-orange-400'; }
        else if (ratio <= 1.6) { score = 8; label = 'Svårt'; color = 'text-red-400'; }
        else { score = 9; label = 'Mycket Svårt'; color = 'text-red-400'; }
    } else if (goal.type === 'speed') {
        // Compare target time vs best historical time
        const target = goal.targets[0];
        if (target?.distanceKm && target?.timeSeconds) {
            const validRuns = recentEntries.filter(e =>
                e.type === 'running' && (e.distance || 0) >= target.distanceKm!
            );

            if (validRuns.length > 0) {
                let bestTime = Infinity;
                validRuns.forEach(e => {
                    const dist = e.distance || 0;
                    const dur = (e.durationMinutes || 0) * 60;
                    if (dist > 0 && dur > 0) {
                        const projectedTime = (dur / dist) * target.distanceKm!;
                        bestTime = Math.min(bestTime, projectedTime);
                    }
                });

                if (bestTime < Infinity) {
                    const improvement = (bestTime - target.timeSeconds) / bestTime * 100;
                    // How much faster than current best?
                    if (improvement <= 0) { score = 1; label = 'Redan Uppnått'; color = 'text-emerald-400'; }
                    else if (improvement <= 2) { score = 3; label = 'Inom Räckhåll'; color = 'text-emerald-400'; }
                    else if (improvement <= 5) { score = 5; label = 'Utmanande'; color = 'text-yellow-400'; }
                    else if (improvement <= 10) { score = 7; label = 'Svårt'; color = 'text-orange-400'; }
                    else if (improvement <= 15) { score = 8.5; label = 'Mycket Svårt'; color = 'text-red-400'; }
                    else { score = 9.5; label = 'Extremt Ambitiöst'; color = 'text-red-400'; }
                }
            } else {
                // No historical data
                score = 6;
                label = 'Okänd (Ingen Data)';
                color = 'text-slate-400';
            }
        }
    } else if (goal.type === 'weight') {
        // Weight loss/gain difficulty based on rate
        const startWeight = goal.milestoneProgress || 85;
        const targetWeight = goal.targetWeight || 80;
        const totalChange = Math.abs(targetWeight - startWeight);

        // Calculate required rate (kg per week)
        const startDate = new Date(goal.startDate);
        const endDate = goal.endDate ? new Date(goal.endDate) : new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);
        const totalWeeks = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const requiredRatePerWeek = totalChange / totalWeeks;

        // Sustainable weight loss is ~0.5-1kg/week, gain ~0.25-0.5kg/week
        const isLoss = targetWeight < startWeight;
        const sustainableRate = isLoss ? 0.75 : 0.375;
        const ratio = requiredRatePerWeek / sustainableRate;

        if (ratio <= 0.5) { score = 2; label = 'Bekväm Takt'; color = 'text-emerald-400'; }
        else if (ratio <= 0.8) { score = 4; label = 'Realistiskt'; color = 'text-emerald-400'; }
        else if (ratio <= 1.0) { score = 5; label = 'Stabil'; color = 'text-yellow-400'; }
        else if (ratio <= 1.3) { score = 6.5; label = 'Utmanande'; color = 'text-orange-400'; }
        else if (ratio <= 1.6) { score = 8; label = 'Aggressiv'; color = 'text-orange-400'; }
        else { score = 9; label = 'Mycket Aggressiv'; color = 'text-red-400'; }
    } else if (goal.type === 'tonnage') {
        // Similar logic for tonnage goals
        const target = goal.targets[0];
        const targetValue = target?.value || 0;

        const totalTonnage = recentEntries.reduce((sum, e) => sum + (e.tonnage || 0), 0) / 1000;
        const avgPerWeek = totalTonnage / Math.max(1, 90 / 7);
        const targetPerWeek = goal.period === 'weekly' ? targetValue :
            goal.period === 'monthly' ? targetValue / 4 : targetValue / 12;

        const ratio = targetPerWeek / Math.max(0.1, avgPerWeek);

        if (ratio <= 0.7) { score = 3; label = 'Lätt'; color = 'text-emerald-400'; }
        else if (ratio <= 1.0) { score = 5; label = 'Lagom'; color = 'text-yellow-400'; }
        else if (ratio <= 1.3) { score = 6.5; label = 'Utmanande'; color = 'text-orange-400'; }
        else { score = 8; label = 'Svårt'; color = 'text-red-400'; }
    } else {
        // Default for other goal types
        score = 5;
        label = 'Medel';
        color = 'text-yellow-400';
    }

    return { score: Math.round(score * 10) / 10, label, color };
}

/**
 * Calculate improved Performance Index (0-100+)
 */
export function calculatePerformanceIndex(
    goals: PerformanceGoal[],
    entries: ExerciseEntry[]
): number {
    if (goals.length === 0) return 0;

    // Sum of (progress / expected_progress) for all active goals
    let totalScore = 0;
    let count = 0;

    // ... logic implementation ...
    return 85; // Mock for now
}

/**
 * Estimate completion date based on current progress rate.
 */
export function estimateCompletionDate(
    goal: PerformanceGoal,
    current: number,
    target: number
): string | undefined {
    if (current >= target) return new Date().toISOString().split('T')[0];
    if (current === 0) return undefined;

    const { start } = getGoalPeriodDates(goal);
    const startDate = new Date(start);
    const today = new Date();
    const daysPassed = Math.max(1, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const rate = current / daysPassed;
    if (rate <= 0) return undefined;

    const remaining = target - current;
    const daysNeeded = remaining / rate;

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(daysNeeded));

    return estimatedDate.toISOString().split('T')[0];
}

/**
 * Check if goal is on track to be completed by end of period.
 */
export function isGoalOnTrack(
    goal: PerformanceGoal,
    current: number,
    target: number
): boolean {
    if (current >= target) return true;
    if ((goal.period === 'once' || goal.type === 'weight') && !goal.endDate) return true; // No deadline

    const { start, end } = getGoalPeriodDates(goal);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();

    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const daysPassed = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (totalDays <= 0) return current >= target;

    const expectedProgress = (daysPassed / totalDays) * target;
    return current >= expectedProgress * 0.9; // 90% of expected is "on track"
}

/**
 * Main function to calculate full goal progress.
 */
export function calculateGoalProgress(
    goal: PerformanceGoal,
    exerciseEntries: ExerciseEntry[],
    mealEntries: MealEntry[] = [],
    foodItems: FoodItem[] = [],
    recipes: Recipe[] = [],
    weightEntries: { date: string; weight: number }[] = []
): GoalProgress {
    const { start, end } = getGoalPeriodDates(goal);
    const target = goal.targets[0];

    let current = 0;
    let targetValue = target?.count || target?.value ||
        goal.milestoneValue ||
        goal.nutritionMacros?.calories ||
        1;

    let linkedActivityId: string | undefined;

    switch (goal.type) {
        case 'frequency':
            current = calculateFrequencyProgress(goal, exerciseEntries);
            targetValue = goal.targets.reduce((sum, t) => sum + (t.count || 0), 0);
            break;
        case 'distance':
            current = calculateDistanceProgress(goal, exerciseEntries);
            targetValue = goal.targets[0]?.value || 0;
            break;
        case 'tonnage':
            current = calculateTonnageProgress(goal, exerciseEntries);
            targetValue = goal.targets[0]?.value || 0;
            break;
        case 'calories':
            current = calculateCaloriesProgress(goal, exerciseEntries);
            targetValue = goal.targets[0]?.value || 0;
            break;
        case 'speed':
            const speedResult = calculateSpeedProgress(goal, exerciseEntries);
            // Handling return object or number for backward compat if needed, but we changed signature
            if (typeof speedResult === 'object') {
                current = speedResult.value;
                linkedActivityId = speedResult.activityId;
            } else {
                current = speedResult;
            }
            targetValue = goal.targets[0]?.timeSeconds || 0; // Target for speed is usually a time to beat
            break;
        case 'streak':
            const streakInfo = calculateStreak(
                exerciseEntries,
                goal.period === 'daily' ? 'daily' : 'weekly',
                target?.exerciseType
            );
            current = streakInfo.current;
            targetValue = goal.milestoneValue || 7;
            break;
        case 'nutrition':
            current = calculateNutritionProgress(goal, mealEntries, foodItems, recipes);
            targetValue = goal.nutritionMacros?.[target?.nutritionType || 'calories'] ||
                target?.value || 1;
            break;
        case 'weight':
            const latestWeight = weightEntries.length > 0
                ? weightEntries.sort((a, b) => b.date.localeCompare(a.date))[0].weight
                : 0;
            const startWeight = goal.milestoneProgress || latestWeight;
            const targetWeight = goal.targetWeight || 0;
            // Progress is how close we are to target
            if (targetWeight < startWeight) {
                // Weight loss goal
                current = startWeight - latestWeight;
                targetValue = startWeight - targetWeight;
            } else {
                // Weight gain goal
                current = latestWeight - startWeight;
                targetValue = targetWeight - startWeight;
            }
            break;
        case 'milestone':
        case 'pb':
            // For milestones, accumulate all-time progress
            if (goal.type === 'milestone' && target?.exerciseType === 'running') {
                current = exerciseEntries
                    .filter(e => e.type === 'running')
                    .reduce((sum, e) => sum + (e.distance || 0), 0);
            } else if (goal.type === 'pb' && target?.exerciseName) {
                // PB tracking would need strength session data
                current = goal.milestoneProgress || 0;
            } else {
                current = goal.milestoneProgress || 0;
            }
            targetValue = goal.milestoneValue || 1;
            break;
        default:
            current = 0;
    }

    const percentage = (targetValue > 0 && !isNaN(targetValue) && !isNaN(current)) ? Math.min(100, (current / targetValue) * 100) : 0;
    const isComplete = percentage >= 100;
    const daysRemaining = getDaysRemaining(goal);

    // Calculate trend from progress history
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (goal.progressHistory && goal.progressHistory.length >= 2) {
        const recent = goal.progressHistory.slice(-3);
        const first = recent[0].value;
        const last = recent[recent.length - 1].value;
        if (last > first * 1.05) trend = 'up';
        else if (last < first * 0.95) trend = 'down';
    }

    return {
        current,
        target: targetValue,
        percentage,
        trend,
        isComplete,
        isOnTrack: percentage >= ((100 / (getDaysRemaining(goal) || 1)) * 1), // rudimentary check
        daysRemaining,
        estimatedCompletionDate: !isComplete ? estimateCompletionDate(goal, current, targetValue) : undefined,
        periodStart: getGoalPeriodDates(goal).start,
        periodEnd: getGoalPeriodDates(goal).end,
        linkedActivityId
    };
}

