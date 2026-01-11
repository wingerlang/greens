/**
 * Activity Merge Service
 * Handles merging multiple activities into one combined activity and separating them back.
 */

import { UniversalActivity, ActivityPerformanceSection, generateId, getISODate, ExerciseType } from '../../models/types.ts';
import { StrengthWorkout, StrengthWorkoutExercise } from '../../models/strengthTypes.ts';

export interface MergeResult {
    success: boolean;
    mergedActivity?: UniversalActivity;
    error?: string;
}

export interface SeparateResult {
    success: boolean;
    originalActivities?: UniversalActivity[];
    error?: string;
}

/**
 * Calculate merged performance metrics from multiple activities.
 * - Distance: Sum
 * - Duration: Sum  
 * - Calories: Sum
 * - Avg Pace: Total duration / Total distance
 * - Avg HR: Duration-weighted average
 * - Max HR: Maximum across all
 * - Elevation Gain: Sum
 */
export function calculateMergedPerformance(
    activities: UniversalActivity[]
): ActivityPerformanceSection {
    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;
    let totalCalories = 0;
    let totalElevationGain = 0;
    let maxHR = 0;

    // For weighted average HR
    let hrWeightedSum = 0;
    let hrWeightTotal = 0;

    // Determine activity type (use first with performance data)
    let activityType: ExerciseType | undefined;

    for (const activity of activities) {
        const perf = activity.performance;
        if (!perf) continue;

        if (!activityType && perf.activityType) {
            activityType = perf.activityType;
        }

        totalDurationMinutes += perf.durationMinutes || 0;
        totalDistanceKm += perf.distanceKm || 0;
        totalCalories += perf.calories || 0;
        totalElevationGain += perf.elevationGain || 0;

        if (perf.maxHeartRate && perf.maxHeartRate > maxHR) {
            maxHR = perf.maxHeartRate;
        }

        // Duration-weighted HR average
        if (perf.avgHeartRate && perf.durationMinutes) {
            hrWeightedSum += perf.avgHeartRate * perf.durationMinutes;
            hrWeightTotal += perf.durationMinutes;
        }
    }

    const avgHeartRate = hrWeightTotal > 0
        ? Math.round(hrWeightedSum / hrWeightTotal)
        : undefined;

    return {
        activityType,
        durationMinutes: totalDurationMinutes,
        distanceKm: totalDistanceKm > 0 ? totalDistanceKm : undefined,
        calories: totalCalories,
        elevationGain: totalElevationGain > 0 ? totalElevationGain : undefined,
        avgHeartRate,
        maxHeartRate: maxHR > 0 ? maxHR : undefined,
        notes: `Merged from ${activities.length} activities`,
    };
}

/**
 * Create a merged activity from multiple source activities.
 */
export function createMergedActivity(
    activities: UniversalActivity[],
    userId: string
): UniversalActivity {
    if (activities.length < 2) {
        throw new Error('Need at least 2 activities to merge');
    }

    // Sort by date to get earliest
    const sortedByDate = [...activities].sort((a, b) => a.date.localeCompare(b.date));
    const earliestDate = sortedByDate[0].date;

    // Calculate merged performance
    const mergedPerformance = calculateMergedPerformance(activities);

    // Create merged activity
    const now = new Date().toISOString();

    // Determine Name
    const stravaSource = activities.find(a => a.performance?.source?.source === 'strava' || a.plan?.source === 'strava' || (a as any).source === 'strava');
    const baseName = stravaSource
        ? (stravaSource.plan?.title || stravaSource.performance?.notes || 'Strava Activity')
        : getMergedActivityTitle(activities);

    const mergedActivity: UniversalActivity = {
        id: generateId(),
        userId,
        date: earliestDate,
        status: 'COMPLETED',
        performance: mergedPerformance,
        plan: {
            title: baseName,
            activityType: mergedPerformance.activityType || 'other',
            description: `Merged from ${activities.length} activities`,
            distanceKm: 0,
        },
        mergeInfo: {
            isMerged: true,
            originalActivityIds: activities.map(a => a.id),
            mergedAt: now,
        },
        createdAt: now,
        updatedAt: now,
    };

    return mergedActivity;
}

/**
 * Format merged activity title from component activities.
 */
export function getMergedActivityTitle(activities: UniversalActivity[]): string {
    const types = new Set<string>();
    for (const a of activities) {
        const type = a.performance?.activityType || a.plan?.activityType;
        if (type) types.add(type);
    }

    if (types.size === 1) {
        const type = Array.from(types)[0];
        return `Merged ${type} (${activities.length} parts)`;
    }

    return `Merged Activity (${activities.length} parts)`;
}

/**
 * Validate that activities can be merged.
 * Currently: all must be same type (or we allow mixing with warning).
 */
export function validateMerge(activities: UniversalActivity[]): {
    valid: boolean;
    warning?: string;
    error?: string;
} {
    if (activities.length < 2) {
        return { valid: false, error: 'Select at least 2 activities to merge' };
    }

    // Check types
    const types = new Set<string>();
    for (const a of activities) {
        const type = a.performance?.activityType || a.plan?.activityType || 'unknown';
        types.add(type);
    }

    if (types.size > 1) {
        return {
            valid: true,
            warning: `Mixed activity types: ${Array.from(types).join(', ')}. Metrics may be less meaningful.`
        };
    }

    return { valid: true };
}

// ============================================
// Strength Workout Merge Functions
// ============================================

/**
 * Merge multiple strength workouts into a single combined workout.
 * - Combines all exercises from all workouts
 * - Merges exercises with same name (combines sets)
 * - Recalculates totals
 */
export function mergeStrengthWorkouts(
    workouts: StrengthWorkout[],
    userId: string
): StrengthWorkout {
    if (workouts.length < 2) {
        throw new Error('Need at least 2 workouts to merge');
    }

    // Sort by date to get earliest
    const sortedWorkouts = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    const earliestDate = sortedWorkouts[0].date;

    // Merge exercises - group by normalized exercise name
    const exerciseMap = new Map<string, StrengthWorkoutExercise>();

    for (const workout of workouts) {
        for (const exercise of workout.exercises || []) {
            const normalizedName = exercise.exerciseName.toLowerCase().trim();

            if (exerciseMap.has(normalizedName)) {
                // Merge sets from same exercise
                const existing = exerciseMap.get(normalizedName)!;
                existing.sets = [...existing.sets, ...exercise.sets];
                existing.totalVolume = (existing.totalVolume || 0) + (exercise.totalVolume || 0);

                // Update top set if this one is heavier
                if (exercise.topSet && (!existing.topSet || exercise.topSet.weight > existing.topSet.weight)) {
                    existing.topSet = exercise.topSet;
                }

                // Combine notes
                if (exercise.notes) {
                    existing.notes = existing.notes
                        ? `${existing.notes} | ${exercise.notes}`
                        : exercise.notes;
                }
            } else {
                // Add new exercise (clone to avoid mutation)
                exerciseMap.set(normalizedName, {
                    ...exercise,
                    sets: [...exercise.sets],
                    totalVolume: exercise.totalVolume || 0,
                });
            }
        }
    }

    const mergedExercises = Array.from(exerciseMap.values());

    // Calculate totals
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;

    for (const ex of mergedExercises) {
        totalVolume += ex.totalVolume || 0;
        totalSets += ex.sets.length;
        totalReps += ex.sets.reduce((sum, s) => sum + (s.reps || 0), 0);
    }

    // Calculate total duration
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);

    // Determine Name: Prioritize Strava Name if available
    const stravaSource = workouts.find(w => w.source === 'strava');
    const baseName = stravaSource
        ? (stravaSource.name || stravaSource.sourceWorkoutName || 'Strava Activity')
        : `Sammanslagen (${workouts.length} pass)`;

    // Create merged workout
    const now = new Date().toISOString();
    const id = `str-merged-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const mergedWorkout: StrengthWorkout = {
        id,
        userId,
        date: earliestDate,
        name: baseName,
        exercises: mergedExercises,
        totalVolume,
        totalSets,
        totalReps,
        uniqueExercises: mergedExercises.length,
        duration: totalDuration,
        notes: `Sammanslagen från ${workouts.length} pass: ${workouts.map(w => w.name || w.sourceWorkoutName || 'Okänt').join(', ')}`,
        source: 'manual', // The merged result is effectively manually created
        createdAt: now,
        updatedAt: now,
    };

    return mergedWorkout;
}

/**
 * Extended interface for merged activity with strength data
 */
export interface MergedStrengthData {
    originalWorkoutIds: string[];
    mergedWorkout: StrengthWorkout;
}

/**
 * Create merged activity for strength workouts.
 * Stores the merged workout data in a way that can be retrieved.
 */
export function createMergedStrengthActivity(
    workouts: StrengthWorkout[],
    userId: string
): { activity: UniversalActivity; strengthData: MergedStrengthData } {
    if (workouts.length < 2) {
        throw new Error('Need at least 2 workouts to merge');
    }

    const mergedWorkout = mergeStrengthWorkouts(workouts, userId);
    const now = new Date().toISOString();

    // Create UniversalActivity for the merged workout
    const activity: UniversalActivity = {
        id: mergedWorkout.id,
        userId,
        date: mergedWorkout.date,
        status: 'COMPLETED',
        performance: {
            activityType: 'strength',
            durationMinutes: mergedWorkout.duration || 60,
            calories: 0, // Would need to recalculate
            notes: mergedWorkout.notes,
        },
        plan: {
            title: mergedWorkout.name,
            description: mergedWorkout.notes,
            activityType: 'strength',
            distanceKm: 0,
        },
        mergeInfo: {
            isMerged: true,
            originalActivityIds: workouts.map(w => w.id),
            mergedAt: now,
        },
        createdAt: now,
        updatedAt: now,
    };

    const strengthData: MergedStrengthData = {
        originalWorkoutIds: workouts.map(w => w.id),
        mergedWorkout,
    };

    return { activity, strengthData };
}

