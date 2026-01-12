
import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useQuery } from '@tanstack/react-query';
import exercisesData from '../../data/exercises.json';

// Type definitions
interface WorkoutSet {
    weight: number;
    reps: number;
}

interface WorkoutEntry {
    date: string; // ISO date
    exerciseId?: string; // If mapped
    exerciseName?: string; // Raw name from history
    sets: WorkoutSet[];
}

interface LoadPoint {
    date: string;
    load: number; // Volume
}

interface IntensityBucket {
    range: string; // "<50%", "50-60%", etc.
    count: number;
    sets: number;
    tonnage: number;
}

export const useMuscleLoadAnalysis = (muscleId: string | null, targetExerciseId: string | null) => {
    const { user, token } = useAuth();

    const { data: workoutHistory, isLoading } = useQuery({
        queryKey: ['training-history-full', user?.username],
        queryFn: async () => {
            // Fetch strength workouts
            // Using the endpoint found in strength.ts
            const res = await fetch(`/api/strength/workouts?limit=10000`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error('Failed to fetch history');
            const data = await res.json();
            return data.workouts;
        },
        enabled: !!user && !!token,
        staleTime: 5 * 60 * 1000
    });


    // Main Logic
    const stats = useMemo(() => {
        if (!workoutHistory || (!muscleId && !targetExerciseId)) return null;

        const allExercises = exercisesData.exercises;

        // 1. Identify relevant exercises
        // We store the full object to access aliases later
        let relevantExercises: { def: typeof allExercises[0]; role: 'primary' | 'secondary' | 'target' }[] = [];

        if (targetExerciseId) {
            const ex = allExercises.find(e => e.id === targetExerciseId);
            if (ex) relevantExercises = [{ def: ex, role: 'target' }];
        } else if (muscleId) {
            relevantExercises = [
                ...allExercises.filter(e => e.primaryMuscles.includes(muscleId)).map(e => ({ def: e, role: 'primary' as const })),
                ...allExercises.filter(e => e.secondaryMuscles.includes(muscleId)).map(e => ({ def: e, role: 'secondary' as const })),
            ];
        }

        // Helper to match a history entry to a relevant exercise
        const findMatch = (entry: any) => {
            // 1. Direct ID Match
            if (entry.exerciseId) {
                return relevantExercises.find(re => re.def.id === entry.exerciseId);
            }
            // 2. Name/Alias Match (if no ID or ID mismatch but name matches?)
            // Usually if ID is present, it's canonical. But if historical data lacks ID:
            if (entry.exerciseName) {
                const normalizedName = entry.exerciseName.toLowerCase().trim();
                return relevantExercises.find(re => {
                    if (re.def.name_sv.toLowerCase() === normalizedName) return true;
                    if (re.def.name_en.toLowerCase() === normalizedName) return true;
                    if (re.def.aliases?.some(a => a.toLowerCase() === normalizedName)) return true;
                    return false;
                });
            }
            return undefined;
        };

        // 2. Aggregate Load
        const loadByDate: Record<string, number> = {};
        const intensityBuckets: Record<string, IntensityBucket> = {
            '<50%': { range: '<50%', count: 0, sets: 0, tonnage: 0 },
            '50-60%': { range: '50-60%', count: 0, sets: 0, tonnage: 0 },
            '60-70%': { range: '60-70%', count: 0, sets: 0, tonnage: 0 },
            '70-80%': { range: '70-80%', count: 0, sets: 0, tonnage: 0 },
            '80-90%': { range: '80-90%', count: 0, sets: 0, tonnage: 0 },
            '90-95%': { range: '90-95%', count: 0, sets: 0, tonnage: 0 },
            '95-100%': { range: '95-100%', count: 0, sets: 0, tonnage: 0 },
            '>100%': { range: '>100%', count: 0, sets: 0, tonnage: 0 },
        };

        const historySorted = (workoutHistory as any[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        historySorted.forEach(workout => {
            const dateStr = new Date(workout.date).toISOString().split('T')[0];

            workout.exercises?.forEach((exerciseEntry: any) => {
                const matched = findMatch(exerciseEntry);
                if (!matched) return;

                const multiplier = matched.role === 'secondary' ? 0.5 : 1.0;

                exerciseEntry.sets.forEach((set: WorkoutSet) => {
                    const weight = set.weight || 0;
                    const reps = set.reps || 0;
                    if (weight === 0 || reps === 0) return;

                    // Load
                    const volume = weight * reps * multiplier;
                    loadByDate[dateStr] = (loadByDate[dateStr] || 0) + volume;

                    // Intensity
                    // Find max for THIS specific matched exercise in window
                    const workoutDate = new Date(workout.date);
                    const sixMonthsAgo = new Date(workoutDate);
                    sixMonthsAgo.setMonth(workoutDate.getMonth() - 6);

                    let max1RM = 0;

                    // Look through history for this specific exercise (by ID or Alias match)
                    // Optimization: We could pre-compute 1RM history for every exercise.
                    // But filtering here is safer for Alias logic.

                    const relevantHistory = historySorted.filter(w =>
                        new Date(w.date) >= sixMonthsAgo &&
                        new Date(w.date) <= workoutDate
                    );

                    relevantHistory.forEach(w => {
                        w.exercises?.forEach((e: any) => {
                            // Check if 'e' is the SAME exercise as 'matched.def'
                            // We use the same findMatch logic, but we only care if it matches matched.def

                            // Simple check:
                            let isSame = false;
                            if (e.exerciseId === matched.def.id) isSame = true;
                            else if (e.exerciseName) {
                                const norm = e.exerciseName.toLowerCase().trim();
                                isSame = matched.def.name_sv.toLowerCase() === norm ||
                                    matched.def.name_en.toLowerCase() === norm ||
                                    matched.def.aliases?.some(a => a.toLowerCase() === norm);
                            }

                            if (isSame) {
                                e.sets.forEach((s: WorkoutSet) => {
                                    if (s.weight && s.reps) {
                                        const e1rm = s.weight * (1 + (s.reps / 30));
                                        if (e1rm > max1RM) max1RM = e1rm;
                                    }
                                });
                            }
                        });
                    });

                    if (max1RM > 0) {
                        const intensity = weight / max1RM;
                        let bucket = '';
                        if (intensity < 0.5) bucket = '<50%';
                        else if (intensity < 0.6) bucket = '50-60%';
                        else if (intensity < 0.7) bucket = '60-70%';
                        else if (intensity < 0.8) bucket = '70-80%';
                        else if (intensity < 0.9) bucket = '80-90%';
                        else if (intensity < 0.95) bucket = '90-95%';
                        else if (intensity <= 1.0) bucket = '95-100%';
                        else bucket = '>100%';

                        if (bucket) {
                            intensityBuckets[bucket].count++;
                            intensityBuckets[bucket].sets++;
                            intensityBuckets[bucket].tonnage += volume;
                        }
                    }
                });
            });
        });

        // Format Load Chart Data
        const chartData = Object.entries(loadByDate).map(([date, load]) => ({
            date,
            load: Math.round(load)
        })).sort((a, b) => a.date.localeCompare(b.date));

        // Format Intensity Data
        const intensityData = Object.values(intensityBuckets);

        return {
            chartData,
            intensityData,
            totalSets: intensityData.reduce((acc, curr) => acc + curr.sets, 0),
            totalTonnage: intensityData.reduce((acc, curr) => acc + curr.tonnage, 0)
        };

    }, [workoutHistory, muscleId, targetExerciseId]);

    return { stats, isLoading };
};
