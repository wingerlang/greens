/**
 * useExerciseStatistics Hook
 * Provides statistics about exercises trained: frequency, volume, recency, and progress.
 */

import { useMemo } from 'react';
import { type StrengthWorkout, normalizeExerciseName } from '../models/strengthTypes.ts';
import { calculateEstimated1RM } from '../utils/strengthCalculators.ts';

export interface ExerciseStats {
    name: string;
    normalizedName: string;
    totalSets: number;
    totalReps: number;
    totalVolume: number;  // kg
    sessionCount: number;
    lastTrainedDate: string;
    daysSinceLastTraining: number;
    best1RM: number;
    bestWeight: number;
    bestReps: number;
}

export interface ExerciseStatistics {
    mostTrainedExercises: ExerciseStats[];
    recentExercises: ExerciseStats[];
    allExercises: ExerciseStats[];
    totalUniqueExercises: number;
    totalVolume: number;
    totalSets: number;
}

/**
 * Calculate exercise statistics from strength workouts.
 * @param workouts - All strength workouts
 * @param daysBack - Number of days to look back (0 = all time)
 */
export function useExerciseStatistics(
    workouts: StrengthWorkout[],
    daysBack: number = 0
): ExerciseStatistics {
    return useMemo(() => {
        const now = new Date();
        const cutoffDate = daysBack > 0
            ? new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
            : null;

        // Filter workouts by date range
        const filteredWorkouts = cutoffDate
            ? workouts.filter(w => new Date(w.date) >= cutoffDate)
            : workouts;

        // Collect stats per exercise
        const exerciseMap = new Map<string, {
            name: string;
            normalizedName: string;
            totalSets: number;
            totalReps: number;
            totalVolume: number;
            sessionCount: number;
            lastTrainedDate: string;
            best1RM: number;
            bestWeight: number;
            bestReps: number;
            sessions: Set<string>;
        }>();

        for (const workout of filteredWorkouts) {
            for (const exercise of workout.exercises) {
                const normalized = normalizeExerciseName(exercise.exerciseName);

                let stats = exerciseMap.get(normalized);
                if (!stats) {
                    stats = {
                        name: exercise.exerciseName,
                        normalizedName: normalized,
                        totalSets: 0,
                        totalReps: 0,
                        totalVolume: 0,
                        sessionCount: 0,
                        lastTrainedDate: workout.date,
                        best1RM: 0,
                        bestWeight: 0,
                        bestReps: 0,
                        sessions: new Set()
                    };
                    exerciseMap.set(normalized, stats);
                }

                // Update stats
                stats.sessions.add(workout.id);

                for (const set of exercise.sets) {
                    if (set.isWarmup) continue;  // Skip warmup sets

                    stats.totalSets++;
                    stats.totalReps += set.reps;
                    stats.totalVolume += set.reps * set.weight;

                    // Track best weight and estimated 1RM
                    if (set.weight > stats.bestWeight) {
                        stats.bestWeight = set.weight;
                    }

                    if (set.reps > 0 && set.weight > 0) {
                        const estimated1RM = calculateEstimated1RM(set.weight, set.reps);
                        if (estimated1RM > stats.best1RM) {
                            stats.best1RM = estimated1RM;
                            stats.bestReps = set.reps;
                        }
                    }
                }

                // Update last trained date
                if (workout.date > stats.lastTrainedDate) {
                    stats.lastTrainedDate = workout.date;
                }
            }
        }

        // Convert to array and calculate final values
        const allExercises: ExerciseStats[] = Array.from(exerciseMap.values()).map(stats => ({
            name: stats.name,
            normalizedName: stats.normalizedName,
            totalSets: stats.totalSets,
            totalReps: stats.totalReps,
            totalVolume: Math.round(stats.totalVolume),
            sessionCount: stats.sessions.size,
            lastTrainedDate: stats.lastTrainedDate,
            daysSinceLastTraining: Math.floor(
                (now.getTime() - new Date(stats.lastTrainedDate).getTime()) / (1000 * 60 * 60 * 24)
            ),
            best1RM: Math.round(stats.best1RM),
            bestWeight: stats.bestWeight,
            bestReps: stats.bestReps
        }));

        // Sort by different criteria
        const mostTrainedExercises = [...allExercises]
            .sort((a, b) => b.totalSets - a.totalSets)
            .slice(0, 10);

        const recentExercises = [...allExercises]
            .sort((a, b) => b.lastTrainedDate.localeCompare(a.lastTrainedDate))
            .slice(0, 10);

        const totalVolume = allExercises.reduce((sum, e) => sum + e.totalVolume, 0);
        const totalSets = allExercises.reduce((sum, e) => sum + e.totalSets, 0);

        return {
            mostTrainedExercises,
            recentExercises,
            allExercises,
            totalUniqueExercises: allExercises.length,
            totalVolume,
            totalSets
        };
    }, [workouts, daysBack]);
}

/**
 * Get recent training summary for display
 */
export function formatExerciseRecency(daysSince: number): { text: string; color: string } {
    if (daysSince === 0) {
        return { text: 'Idag', color: 'text-emerald-400' };
    } else if (daysSince === 1) {
        return { text: 'Igår', color: 'text-emerald-400' };
    } else if (daysSince <= 3) {
        return { text: `${daysSince} dagar sedan`, color: 'text-green-400' };
    } else if (daysSince <= 7) {
        return { text: `${daysSince} dagar sedan`, color: 'text-amber-400' };
    } else if (daysSince <= 14) {
        return { text: `${Math.round(daysSince / 7)} vecka sedan`, color: 'text-orange-400' };
    } else {
        const weeks = Math.round(daysSince / 7);
        return { text: `${weeks} veckor sedan`, color: 'text-rose-400' };
    }
}
