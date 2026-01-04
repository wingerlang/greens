/**
 * Progressive Overload Assistant v2
 * 
 * Enhanced with:
 * - Configurable progression rates
 * - 1RM tracking and projection
 * - Exercise-type specific rules (compound vs isolation)
 * - Smart deload recommendations
 * - Weekly volume analysis
 * - Trend detection
 */

import type { StrengthWorkout, StrengthWorkoutExercise, StrengthSet } from '../models/strengthTypes.ts';
import { calculate1RM, normalizeExerciseName, isBodyweightExercise, isTimeBasedExercise, isWeightedDistanceExercise, isHyroxExercise, isDistanceBasedExercise } from '../models/strengthTypes.ts';

// ============================================
// Configuration
// ============================================

export interface ProgressionConfig {
    // Weight increment options
    minWeightIncrement: number;      // Minimum weight jump (default: 2.5kg)
    percentageIncrease: number;      // Target % increase (default: 2.5%)

    // Plateau thresholds
    plateauSessionThreshold: number; // Sessions before plateau warning (default: 3)
    deloadThreshold: number;         // Sessions before deload suggestion (default: 4)
    changeExerciseThreshold: number; // Sessions before exercise swap (default: 6)

    // Exercise-type modifiers
    isolationMultiplier: number;     // Slower progression for isolation (default: 0.5)

    // Rep ranges
    targetRepRange: { min: number; max: number }; // When to suggest weight increase
}

export const DEFAULT_CONFIG: ProgressionConfig = {
    minWeightIncrement: 2.5,
    percentageIncrease: 2.5,
    plateauSessionThreshold: 3,
    deloadThreshold: 4,
    changeExerciseThreshold: 6,
    isolationMultiplier: 0.5,
    targetRepRange: { min: 5, max: 12 }
};

// Compound exercises get standard progression, isolation gets slower
const COMPOUND_EXERCISES = new Set([
    'squat', 'knäböj', 'bench press', 'bänkpress', 'deadlift', 'marklyft',
    'overhead press', 'militärpress', 'row', 'rodd', 'pull-up', 'pullups',
    'chin-up', 'dips', 'hip thrust', 'leg press', 'benpress'
]);

// ============================================
// Types
// ============================================

export interface ProgressionSuggestion {
    exerciseName: string;
    lastWeight: number;
    lastReps: number;
    lastDate: string;

    // Primary suggestions
    suggestedWeight: number;
    suggestedReps: number;

    // Advanced metrics
    current1RM: number;
    projected1RM: number;         // After suggested progression
    progressRate: number;         // % improvement per session

    // Volume tracking
    lastVolume: number;           // weight × reps × sets
    suggestedVolume: number;

    // Context
    sessionsSinceProgress: number;
    isPlateaued: boolean;
    isCompound: boolean;
    isDistanceBased?: boolean;
    lastDistance?: number;
    suggestedDistance?: number;
    progressTrend: 'improving' | 'stable' | 'declining';

    // Messages
    primaryMessage: string;
    plateauMessage?: string;
    tips: string[];
}

export interface PlateauWarning {
    exerciseName: string;
    weeksSinceProgress: number;
    lastProgressDate: string;
    recommendation: 'deload' | 'change_exercise' | 'add_volume' | 'reduce_frequency';
    severity: 'low' | 'medium' | 'high';
    message: string;
    actionItems: string[];

    // Trend data
    averageWeight: number;
    peakWeight: number;
    estimated1RM: number;

    // Distance metrics
    isDistanceBased?: boolean;
    averageDistance?: number;
    peakDistance?: number;
}

export interface WeeklyVolumeRecommendation {
    exerciseName: string;
    currentWeeklyVolume: number;
    previousWeeklyVolume: number;
    recommendation: 'maintain' | 'increase' | 'decrease';
    targetVolume: number;
    message: string;
}

// ============================================
// Core Functions
// ============================================

/**
 * Check if exercise is compound (gets standard progression)
 */
export function isCompoundExercise(name: string): boolean {
    const normalized = name.toLowerCase().trim();
    for (const compound of COMPOUND_EXERCISES) {
        if (normalized.includes(compound)) return true;
    }
    return false;
}

/**
 * Get the last workout containing a specific exercise
 */
export function getLastExerciseSession(
    exerciseName: string,
    workouts: StrengthWorkout[],
    excludeDate?: string
): { workout: StrengthWorkout; exercise: StrengthWorkoutExercise } | null {
    const normalizedName = exerciseName.toLowerCase().trim();

    const sorted = [...workouts].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const workout of sorted) {
        if (excludeDate && workout.date === excludeDate) continue;

        const exercise = workout.exercises.find(e =>
            e.exerciseName.toLowerCase().trim() === normalizedName
        );

        if (exercise && exercise.sets.length > 0) {
            return { workout, exercise };
        }
    }

    return null;
}

/**
 * Get the top (heaviest) working set from an exercise
 */
export function getTopSet(exercise: StrengthWorkoutExercise): StrengthSet | null {
    if (!exercise.sets || exercise.sets.length === 0) return null;

    const workingSets = exercise.sets.filter(s => !s.isWarmup);
    const setsToUse = workingSets.length > 0 ? workingSets : exercise.sets;
    const isDistance = isDistanceBasedExercise(exercise.exerciseName);

    return setsToUse.reduce((top, set) => {
        if (isDistance) {
            return (set.distance || 0) > (top.distance || 0) ? set : top;
        }
        if (set.weight > top.weight) return set;
        if (set.weight === top.weight && set.reps > top.reps) return set;
        return top;
    });
}

/**
 * Calculate total volume for an exercise
 */
export function calculateVolume(exercise: StrengthWorkoutExercise): number {
    return exercise.sets
        .filter(s => !s.isWarmup)
        .reduce((sum, set) => sum + (set.weight * set.reps), 0);
}

/**
 * Analyze progress trend from history
 */
function analyzeProgressTrend(
    history: { date: string; weight: number; reps: number; estimated1RM: number }[]
): 'improving' | 'stable' | 'declining' {
    if (history.length < 3) return 'stable';

    // Compare first half to second half
    const mid = Math.floor(history.length / 2);
    const recentAvg = history.slice(0, mid).reduce((sum, h) => sum + h.estimated1RM, 0) / mid;
    const olderAvg = history.slice(mid).reduce((sum, h) => sum + h.estimated1RM, 0) / (history.length - mid);

    const changePct = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePct > 2) return 'improving';
    if (changePct < -2) return 'declining';
    return 'stable';
}

/**
 * Calculate suggested progression for an exercise (ENHANCED)
 */
export function getProgressionSuggestion(
    exerciseName: string,
    workouts: StrengthWorkout[],
    todayDate?: string,
    config: ProgressionConfig = DEFAULT_CONFIG
): ProgressionSuggestion | null {
    const lastSession = getLastExerciseSession(exerciseName, workouts, todayDate);
    if (!lastSession) return null;

    const topSet = getTopSet(lastSession.exercise);
    if (!topSet) return null;

    const weight = topSet.weight;
    const reps = topSet.reps;
    const isCompound = isCompoundExercise(exerciseName);
    const isDistance = isDistanceBasedExercise(exerciseName);

    // Calculate current 1RM
    const current1RM = isDistance ? 0 : calculate1RM(weight, reps);

    // Adjust increment based on exercise type
    const baseIncrement = Math.max(
        config.minWeightIncrement,
        Math.round((weight * config.percentageIncrease / 100) / 2.5) * 2.5
    );
    const increment = isCompound
        ? baseIncrement
        : Math.max(1.25, baseIncrement * config.isolationMultiplier);

    // Calculate suggestions based on rep range
    let suggestedWeight = weight;
    let suggestedReps = reps;

    if (isDistance) {
        // Distance progression logic
        // Simple 2.5% increase in distance
        suggestedWeight = 0;
        suggestedReps = 0; // Not used for distance
    } else if (reps >= config.targetRepRange.max) {
        // At top of rep range → increase weight, reset reps
        suggestedWeight = weight + increment;
        suggestedReps = config.targetRepRange.min;
    } else {
        // Option 1: +weight same reps
        // Option 2: same weight +reps
        suggestedWeight = weight + increment;
        suggestedReps = reps + 1;
    }

    // Distance suggestion specifics
    let lastDistance = 0;
    let suggestedDistance = 0;

    if (isDistance) {
        lastDistance = topSet.distance || 0;
        // Suggest 2.5% increase, rounded to nearest 100m if large, or 10m if small
        const rawDist = lastDistance * 1.025;
        if (rawDist > 1000) {
            suggestedDistance = Math.round(rawDist / 50) * 50;
        } else {
            suggestedDistance = Math.round(rawDist / 10) * 10;
        }
    }

    // Get history with 1RM
    const history = getExerciseHistoryWithRM(exerciseName, workouts, 10);
    const sessionsSinceProgress = countSessionsSinceProgress(history);
    const trend = analyzeProgressTrend(history);

    // Calculate volumes
    const lastVolume = calculateVolume(lastSession.exercise);
    const suggestedVolume = Math.round(suggestedWeight * suggestedReps * lastSession.exercise.sets.length);

    // Calculate progress rate
    const progressRate = history.length >= 2
        ? ((history[0].estimated1RM - history[history.length - 1].estimated1RM) / history[history.length - 1].estimated1RM) * 100 / history.length
        : 0;

    // Build tips
    const tips: string[] = [];
    if (sessionsSinceProgress >= 2) {
        tips.push('💡 Prova att ändra tempo eller göra en paus-rep variant');
    }
    if (reps < config.targetRepRange.min) {
        tips.push('⚠️ Vikten kanske är för tung - minska och bygg reps');
    }
    if (trend === 'declining') {
        tips.push('📉 Trenden sjunker - överväg extra vila eller deload');
    }
    if (!isCompound && !isDistance) {
        tips.push('🎯 Isolationsövning - fokusera på kontroll, inte maxvikt');
    }
    if (isDistance) {
        tips.push('🏃 Cardio - fokusera på att öka distansen eller tempot');
    }

    const projected1RM = calculate1RM(suggestedWeight, suggestedReps);

    const primaryMessage = isDistance
        ? `${formatRelativeDate(lastSession.workout.date)}: ${lastDistance}m. Sikte på ${suggestedDistance}m (+2.5%)`
        : `${formatRelativeDate(lastSession.workout.date)}: ${weight}kg × ${reps}. Prova ${suggestedWeight}kg × ${suggestedReps} idag!`;

    return {
        exerciseName,
        lastWeight: weight,
        lastReps: reps,
        lastDate: lastSession.workout.date,
        suggestedWeight,
        suggestedReps,
        current1RM,
        projected1RM,
        progressRate: Math.round(progressRate * 10) / 10,
        lastVolume,
        suggestedVolume,
        sessionsSinceProgress,
        isPlateaued: sessionsSinceProgress >= config.plateauSessionThreshold,
        isCompound,
        isDistanceBased: isDistance,
        lastDistance,
        suggestedDistance,
        progressTrend: trend,
        primaryMessage,
        plateauMessage: sessionsSinceProgress >= config.plateauSessionThreshold
            ? `Ingen ökning på ${sessionsSinceProgress} pass. ${sessionsSinceProgress >= config.deloadThreshold ? 'Dags för deload!' : 'Prova att ändra något.'}`
            : undefined,
        tips
    };
}

/**
 * Get exercise history with 1RM calculations
 */
export function getExerciseHistoryWithRM(
    exerciseName: string,
    workouts: StrengthWorkout[],
    limit: number = 10
): { date: string; weight: number; reps: number; estimated1RM: number; volume: number; distance: number }[] {
    const normalizedName = exerciseName.toLowerCase().trim();
    const history: { date: string; weight: number; reps: number; estimated1RM: number; volume: number; distance: number }[] = [];

    const sorted = [...workouts].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const workout of sorted) {
        if (history.length >= limit) break;

        const exercise = workout.exercises.find(e =>
            e.exerciseName.toLowerCase().trim() === normalizedName
        );

        if (exercise) {
            const topSet = getTopSet(exercise);
            if (topSet) {
                history.push({
                    date: workout.date,
                    weight: topSet.weight,
                    reps: topSet.reps,
                    estimated1RM: calculate1RM(topSet.weight, topSet.reps),
                    volume: calculateVolume(exercise),
                    distance: topSet.distance || 0
                });
            }
        }
    }

    return history;
}

/**
 * Get exercise history (simplified)
 */
export function getExerciseHistory(
    exerciseName: string,
    workouts: StrengthWorkout[],
    limit: number = 5
): { date: string; weight: number; reps: number }[] {
    return getExerciseHistoryWithRM(exerciseName, workouts, limit).map(h => ({
        date: h.date,
        weight: h.weight,
        reps: h.reps
    }));
}

/**
 * Count sessions since last progress
 */
function countSessionsSinceProgress(
    history: { date: string; weight: number; reps: number; estimated1RM: number; distance?: number }[]
): number {
    if (history.length < 2) return 0;

    let count = 0;
    for (let i = 0; i < history.length - 1; i++) {
        const current = history[i];
        const previous = history[i + 1];

        // Consider both weight/reps improvement AND 1RM improvement
        const hasProgress =
            current.weight > previous.weight ||
            (current.weight === previous.weight && current.reps > previous.reps) ||
            current.estimated1RM > previous.estimated1RM * 1.01 || // 1% 1RM improvement counts
            ((current.distance || 0) > 0 && (current.distance || 0) > (previous.distance || 0)); // Distance improvement

        if (hasProgress) break;
        count++;
    }

    return count;
}

/**
 * Get plateau warnings for all exercises (ENHANCED)
 */
export function getPlateauWarnings(
    workouts: StrengthWorkout[],
    minSessions: number = 3,
    config: ProgressionConfig = DEFAULT_CONFIG
): PlateauWarning[] {
    const warnings: PlateauWarning[] = [];
    const exerciseNames = new Set<string>();

    for (const w of workouts) {
        for (const e of w.exercises) {
            exerciseNames.add(e.exerciseName.toLowerCase().trim());
        }
    }

    for (const name of exerciseNames) {
        const history = getExerciseHistoryWithRM(name, workouts, 10);
        if (history.length < minSessions) continue;

        const sessionsSince = countSessionsSinceProgress(history);

        if (sessionsSince >= config.plateauSessionThreshold) {
            const lastProgressIdx = Math.min(sessionsSince, history.length - 1);
            const averageWeight = history.reduce((sum, h) => sum + h.weight, 0) / history.length;
            const peakWeight = Math.max(...history.map(h => h.weight));
            const latest1RM = history[0]?.estimated1RM || 0;

            // Determine severity
            let severity: 'low' | 'medium' | 'high' = 'low';
            if (sessionsSince >= config.changeExerciseThreshold) severity = 'high';
            else if (sessionsSince >= config.deloadThreshold) severity = 'medium';

            // Determine recommendation
            let recommendation: PlateauWarning['recommendation'] = 'add_volume';
            if (sessionsSince >= config.changeExerciseThreshold) recommendation = 'change_exercise';
            else if (sessionsSince >= config.deloadThreshold) recommendation = 'deload';
            else if (sessionsSince >= config.plateauSessionThreshold + 1) recommendation = 'reduce_frequency';

            // Build action items
            const actionItems: string[] = [];
            switch (recommendation) {
                case 'add_volume':
                    actionItems.push('Lägg till 1-2 set');
                    actionItems.push('Prova en back-off set efter toppset');
                    break;
                case 'reduce_frequency':
                    actionItems.push('Kör övningen 1x/vecka istället för 2x');
                    actionItems.push('Fokusera på kvalitet över kvantitet');
                    break;
                case 'deload':
                    actionItems.push('Sänk vikten med 20-30% i en vecka');
                    actionItems.push('Fokusera på teknik och tempo');
                    actionItems.push('Öka reps till 10-15 med lägre vikt');
                    break;
                case 'change_exercise':
                    actionItems.push('Byt till en variant (t.ex. DB istället för BB)');
                    actionItems.push('Prova annan vinkel eller grepp');
                    actionItems.push('Ta bort övningen i 2-3 veckor');
                    break;
            }

            // Format display name
            const displayName = name.charAt(0).toUpperCase() + name.slice(1);

            const messages: Record<PlateauWarning['recommendation'], string> = {
                add_volume: `Öka volymen på ${displayName} (fler set)`,
                reduce_frequency: `Minska frekvensen på ${displayName}`,
                deload: `Dags för en deload-vecka på ${displayName}`,
                change_exercise: `Överväg att byta ${displayName} till en variant`
            };

            const isDistance = isDistanceBasedExercise(name);
            const averageDistance = isDistance ? history.reduce((sum, h) => sum + h.distance, 0) / history.length : 0;
            const peakDistance = isDistance ? Math.max(...history.map(h => h.distance)) : 0;

            warnings.push({
                exerciseName: displayName,
                weeksSinceProgress: sessionsSince,
                lastProgressDate: history[lastProgressIdx]?.date || history[0].date,
                recommendation,
                severity,
                message: messages[recommendation],
                actionItems,
                averageWeight: Math.round(averageWeight * 10) / 10,
                peakWeight,
                estimated1RM: Math.round(latest1RM),
                isDistanceBased: isDistance,
                averageDistance: Math.round(averageDistance),
                peakDistance: Math.round(peakDistance)
            });
        }
    }

    // Sort by severity (high first)
    return warnings.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
}

/**
 * Get weekly volume recommendations
 */
export function getWeeklyVolumeRecommendations(
    workouts: StrengthWorkout[],
    weeksToAnalyze: number = 8
): WeeklyVolumeRecommendation[] {
    const recommendations: WeeklyVolumeRecommendation[] = [];

    const now = new Date();
    const recentPeriodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // Last 2 weeks
    const baselinePeriodStart = new Date(now.getTime() - weeksToAnalyze * 7 * 24 * 60 * 60 * 1000);

    // Track exercise data over time
    const exerciseData = new Map<string, {
        recentVolume: number;
        recentSessions: number;
        baselineVolume: number;
        baselineSessions: number;
        totalOccurrences: number;
        lastDate: string;
    }>();

    for (const workout of workouts) {
        const workoutDate = new Date(workout.date);

        // Only count workouts in the analysis window
        if (workoutDate < baselinePeriodStart) continue;

        const isRecent = workoutDate >= recentPeriodStart;

        for (const exercise of workout.exercises) {
            const name = exercise.exerciseName.toLowerCase().trim();
            const volume = calculateVolume(exercise);

            const existing = exerciseData.get(name) || {
                recentVolume: 0,
                recentSessions: 0,
                baselineVolume: 0,
                baselineSessions: 0,
                totalOccurrences: 0,
                lastDate: workout.date
            };

            existing.totalOccurrences++;
            if (workoutDate > new Date(existing.lastDate)) {
                existing.lastDate = workout.date;
            }

            if (isRecent) {
                existing.recentVolume += volume;
                existing.recentSessions++;
            } else {
                existing.baselineVolume += volume;
                existing.baselineSessions++;
            }

            exerciseData.set(name, existing);
        }
    }

    // Only process exercises that are done regularly (at least 3 times in analysis period)
    for (const [name, data] of exerciseData) {
        // Skip exercises done fewer than 3 times - they're not regular
        if (data.totalOccurrences < 3) continue;

        // Skip if no recent data at all (haven't done this in 2 weeks)
        if (data.recentSessions === 0) continue;

        // Skip if no baseline data (new exercise)
        if (data.baselineSessions === 0) continue;

        // Calculate weekly averages
        const recentWeeklyAvg = data.recentVolume / 2; // 2 weeks
        const baselineWeeklyAvg = data.baselineVolume / (weeksToAnalyze - 2); // baseline period

        // Skip if baseline is too low to be meaningful
        if (baselineWeeklyAvg < 100) continue;

        const change = ((recentWeeklyAvg - baselineWeeklyAvg) / baselineWeeklyAvg) * 100;

        let recommendation: WeeklyVolumeRecommendation['recommendation'] = 'maintain';
        let message = '';
        let targetVolume = Math.round(recentWeeklyAvg);

        if (change < -30) {
            recommendation = 'increase';
            targetVolume = Math.round(baselineWeeklyAvg);
            message = `Volymen har sjunkit ${Math.abs(Math.round(change))}% senaste 2v - sikta på ~${targetVolume}kg/vecka`;
        } else if (change > 40) {
            recommendation = 'decrease';
            targetVolume = Math.round(baselineWeeklyAvg * 1.15);
            message = `Volymen har ökat ${Math.round(change)}% - ev. risk för överträning`;
        } else {
            message = `Stabil volym (${change > 0 ? '+' : ''}${Math.round(change)}% från snittet)`;
        }

        recommendations.push({
            exerciseName: name.charAt(0).toUpperCase() + name.slice(1),
            currentWeeklyVolume: Math.round(recentWeeklyAvg),
            previousWeeklyVolume: Math.round(baselineWeeklyAvg),
            recommendation,
            targetVolume,
            message
        });
    }

    // Sort by most significant changes first (biggest deviations)
    return recommendations.sort((a, b) => {
        if (a.recommendation !== b.recommendation) {
            if (a.recommendation === 'increase') return -1;
            if (b.recommendation === 'increase') return 1;
            if (a.recommendation === 'decrease') return -1;
            return 1;
        }
        return Math.abs(b.currentWeeklyVolume - b.previousWeeklyVolume) -
            Math.abs(a.currentWeeklyVolume - a.previousWeeklyVolume);
    });
}

/**
 * Format a progression suggestion as a user-friendly string
 */
export function formatSuggestion(suggestion: ProgressionSuggestion): string {
    return suggestion.primaryMessage;
}

/**
 * Format date as relative string
 */
function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    if (diffDays < 14) return 'Förra veckan';
    return `${Math.floor(diffDays / 7)} veckor sedan`;
}

// ============================================
// Underperformers Analysis
// ============================================

export interface Underperformer {
    exerciseName: string;
    totalSets: number;
    totalVolume: number;
    daysSinceLastPB: number | null;
    lastPBDate: string | null;
    lastPBWorkoutId: string | null;
    e1RM: number | null;
    setsSinceLastPB: number;
    stagnationScore: number;
    message: string;
    isBodyweight: boolean;
    isTimeBased: boolean;
    maxTimeFormatted: string | null;
    isWeightedDistance: boolean;
    maxDistance: number | null;
    maxDistanceUnit: string | null;
    isHyrox: boolean;
}

/**
 * Find exercises that are trained frequently but have stagnant progress.
 * "Underperformers" = high volume but flat line on development (many sets without PB)
 */
export function getUnderperformers(
    workouts: StrengthWorkout[],
    personalBests: { exerciseName: string; date: string; value: number; workoutId?: string; type?: string }[],
    minSets: number = 20
): Underperformer[] {
    const exerciseStats = new Map<string, {
        totalSets: number;
        totalVolume: number;
        lastWorkoutDate: string;
        firstWorkoutDate: string;
    }>();

    // Collect all exercise data
    for (const workout of workouts) {
        for (const exercise of workout.exercises) {
            const name = normalizeExerciseName(exercise.exerciseName);
            const existing = exerciseStats.get(name) || {
                totalSets: 0,
                totalVolume: 0,
                lastWorkoutDate: workout.date,
                firstWorkoutDate: workout.date
            };

            existing.totalSets += exercise.sets.length;
            existing.totalVolume += exercise.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

            if (workout.date > existing.lastWorkoutDate) {
                existing.lastWorkoutDate = workout.date;
            }
            if (workout.date < existing.firstWorkoutDate) {
                existing.firstWorkoutDate = workout.date;
            }

            exerciseStats.set(name, existing);
        }
    }

    const underperformers: Underperformer[] = [];
    const now = new Date();

    for (const [name, stats] of exerciseStats) {
        // Skip exercises with too few sets (not trained enough to matter)
        if (stats.totalSets < minSets) continue;

        // Find the most recent PB for this exercise
        // For time-based exercises, look for 'time' type PBs
        // For weight-based exercises, look for '1rm' type PBs
        const isTime = isTimeBasedExercise(name);
        const isBW = isBodyweightExercise(name);
        const exercisePBs = personalBests
            .filter(pb => {
                const pbName = normalizeExerciseName(pb.exerciseName);
                if (pbName !== name) return false;
                // Filter by type if available
                if (isTime) return !pb.type || pb.type === 'time';
                return !pb.type || pb.type === '1rm';
            })
            .sort((a, b) => b.date.localeCompare(a.date));

        const lastPB = exercisePBs[0];
        let lastPBDate = lastPB?.date || null;
        let lastPBWorkoutId = lastPB?.workoutId || null;

        // For bodyweight exercises, the 1RM should be based on extraWeight only
        // Find the PB with the highest extraWeight (best weighted performance)
        let e1RMValue: number | null = null;
        const isWeightedDistance = isWeightedDistanceExercise(name);
        const isHyrox = isHyroxExercise(name);
        let maxDistance: number | null = null;
        let maxDistanceUnit: string | null = null;

        if (isWeightedDistance) {
            // Find the PB with the highest weight (already sorted by value/weight)
            // But we also want the distance from key context
            // Sort by value (weight) descending
            const bestPB = exercisePBs
                .filter(pb => !pb.type || pb.type === '1rm')
                .sort((a, b) => b.value - a.value)[0];

            if (bestPB) {
                e1RMValue = bestPB.value;
                maxDistance = (bestPB as any).distance || null;
                maxDistanceUnit = (bestPB as any).distanceUnit || null;
                lastPBDate = bestPB.date;
                lastPBWorkoutId = bestPB.workoutId || null;
            }
        } else if (isBW && exercisePBs.length > 0) {
            // Find the PB with highest extraWeight
            let maxExtraWeight = 0;
            for (const pb of exercisePBs) {
                const extra = (pb as any).extraWeight || 0;
                if (extra > maxExtraWeight) {
                    maxExtraWeight = extra;
                    lastPBWorkoutId = pb.workoutId || null;
                    lastPBDate = pb.date;
                }
            }
            e1RMValue = maxExtraWeight > 0 ? maxExtraWeight : null;

            // E.g. "Weighted Dip" with +36kg.
        } else if (isTime && lastPB) {
            // For time based, we might have "Static hold" with weight.
            // If we have a PB with extraWeight, prioritize high weight+time?
            // Or just show the max time PB.
            // The bug report says: "Exercise, Static hold (one hand)",Set,1,weight,36,time,00:01:00
            // Currently it shows "0".
            // If type is time, e1RMValue (which implies weight) is likely 0 or null if we just look at 'value'.
            // For display purposes, 'e1RMValue' in this list is often used as the "primary metric".
            // We should store what we want to display.
            e1RMValue = lastPB.value; // timestamp
            if (lastPB && (lastPB as any).extraWeight) {
                e1RMValue = (lastPB as any).extraWeight;
            }
        } else if (!isTime && lastPB) {
            e1RMValue = lastPB.value || null;
        }

        // Format time if it's a time-based exercise
        let maxTimeFormatted: string | null = null;
        if (isTime && lastPB?.value) {
            const secs = lastPB.value;
            const mins = Math.floor(secs / 60);
            const remainingSecs = secs % 60;
            maxTimeFormatted = `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
        }

        let daysSinceLastPB: number | null = null;
        let setsSinceLastPB = 0;

        if (lastPBDate) {
            daysSinceLastPB = Math.floor((now.getTime() - new Date(lastPBDate).getTime()) / (1000 * 60 * 60 * 24));

            // Count sets performed AFTER the last PB
            for (const workout of workouts) {
                if (workout.date <= lastPBDate) continue;
                for (const exercise of workout.exercises) {
                    if (normalizeExerciseName(exercise.exerciseName) === name) {
                        setsSinceLastPB += exercise.sets.length;
                    }
                }
            }
        } else {
            // No PB at all - all sets are "since last PB"
            setsSinceLastPB = stats.totalSets;
            const firstDate = new Date(stats.firstWorkoutDate);
            daysSinceLastPB = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        // Stagnation score: sets since PB weighted by time
        // Higher = trained more without progressing
        const stagnationScore = setsSinceLastPB * Math.sqrt(daysSinceLastPB || 1);

        // Only include if there's meaningful stagnation (at least 15 sets without PB)
        if (setsSinceLastPB < 15) continue;

        let message = '';
        if (setsSinceLastPB >= 50) {
            message = `${setsSinceLastPB} set sedan senaste rekord – överväg ny teknik eller variation`;
        } else if (daysSinceLastPB && daysSinceLastPB >= 180) {
            message = `6+ månader sedan senaste rekord trots ${setsSinceLastPB} set`;
        } else {
            message = `${setsSinceLastPB} set utan nytt rekord (${Math.round(daysSinceLastPB || 0)} dagar)`;
        }

        underperformers.push({
            exerciseName: name.charAt(0).toUpperCase() + name.slice(1),
            totalSets: stats.totalSets,
            totalVolume: Math.round(stats.totalVolume),
            daysSinceLastPB,
            lastPBDate,
            lastPBWorkoutId,
            e1RM: e1RMValue,
            setsSinceLastPB,
            stagnationScore,
            message,
            isBodyweight: isBodyweightExercise(name),
            isTimeBased: isTime,
            maxTimeFormatted,
            isWeightedDistance,
            maxDistance,
            maxDistanceUnit,
            isHyrox
        });
    }

    // Sort by days since last PB (longest stagnation first)
    return underperformers.sort((a, b) => (b.daysSinceLastPB || 0) - (a.daysSinceLastPB || 0));
}

