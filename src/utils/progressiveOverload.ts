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
import { calculate1RM } from '../models/strengthTypes.ts';

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
    if (workingSets.length === 0) return exercise.sets[0];

    return workingSets.reduce((top, set) => {
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

    // Calculate current 1RM
    const current1RM = calculate1RM(weight, reps);

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

    if (reps >= config.targetRepRange.max) {
        // At top of rep range → increase weight, reset reps
        suggestedWeight = weight + increment;
        suggestedReps = config.targetRepRange.min;
    } else {
        // Option 1: +weight same reps
        // Option 2: same weight +reps
        suggestedWeight = weight + increment;
        suggestedReps = reps + 1;
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
    if (!isCompound) {
        tips.push('🎯 Isolationsövning - fokusera på kontroll, inte maxvikt');
    }

    const projected1RM = calculate1RM(suggestedWeight, suggestedReps);

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
        progressTrend: trend,
        primaryMessage: `${formatRelativeDate(lastSession.workout.date)}: ${weight}kg × ${reps}. Prova ${suggestedWeight}kg × ${suggestedReps} idag!`,
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
): { date: string; weight: number; reps: number; estimated1RM: number; volume: number }[] {
    const normalizedName = exerciseName.toLowerCase().trim();
    const history: { date: string; weight: number; reps: number; estimated1RM: number; volume: number }[] = [];

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
                    volume: calculateVolume(exercise)
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
    history: { date: string; weight: number; reps: number; estimated1RM: number }[]
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
            current.estimated1RM > previous.estimated1RM * 1.01; // 1% 1RM improvement counts

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
                estimated1RM: Math.round(latest1RM)
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
    weeksToAnalyze: number = 4
): WeeklyVolumeRecommendation[] {
    const recommendations: WeeklyVolumeRecommendation[] = [];
    const exerciseVolumes = new Map<string, { thisWeek: number; lastWeek: number }>();

    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    for (const workout of workouts) {
        const workoutDate = new Date(workout.date);
        const isThisWeek = workoutDate >= thisWeekStart;
        const isLastWeek = workoutDate >= lastWeekStart && workoutDate < thisWeekStart;

        if (!isThisWeek && !isLastWeek) continue;

        for (const exercise of workout.exercises) {
            const name = exercise.exerciseName.toLowerCase().trim();
            const volume = calculateVolume(exercise);

            const existing = exerciseVolumes.get(name) || { thisWeek: 0, lastWeek: 0 };
            if (isThisWeek) {
                existing.thisWeek += volume;
            } else {
                existing.lastWeek += volume;
            }
            exerciseVolumes.set(name, existing);
        }
    }

    for (const [name, volumes] of exerciseVolumes) {
        if (volumes.lastWeek === 0) continue; // Skip if no data from last week

        const change = ((volumes.thisWeek - volumes.lastWeek) / volumes.lastWeek) * 100;

        let recommendation: WeeklyVolumeRecommendation['recommendation'] = 'maintain';
        let message = '';
        let targetVolume = volumes.thisWeek;

        if (change < -20) {
            recommendation = 'increase';
            targetVolume = Math.round(volumes.lastWeek);
            message = `Volymen har sjunkit ${Math.abs(Math.round(change))}% - sikta på minst ${targetVolume}kg total`;
        } else if (change > 30) {
            recommendation = 'decrease';
            targetVolume = Math.round(volumes.lastWeek * 1.1);
            message = `Volymen har ökat ${Math.round(change)}% - risk för överträning, håll ${targetVolume}kg`;
        } else {
            message = `Bra volym! ${Math.round(change)}% förändring är hållbart`;
        }

        recommendations.push({
            exerciseName: name.charAt(0).toUpperCase() + name.slice(1),
            currentWeeklyVolume: Math.round(volumes.thisWeek),
            previousWeeklyVolume: Math.round(volumes.lastWeek),
            recommendation,
            targetVolume,
            message
        });
    }

    return recommendations;
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
