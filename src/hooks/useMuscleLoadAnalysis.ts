import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { useQuery } from '@tanstack/react-query';
import { findExerciseMatch } from '../utils/exerciseMapper.ts';

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

export const useMuscleLoadAnalysis = (muscleId: string | null, targetExerciseId: string | null, intensityThreshold: number = 0.7) => {
    const { user, token } = useAuth();
    const { exercises: allExercises } = useData();

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
        if (!workoutHistory || (!muscleId && !targetExerciseId) || !allExercises.length) return null;

        // 1. Identify relevant exercises
        // We store the full object to access aliases later
        let relevantExercises: { def: any; role: 'primary' | 'secondary' | 'target' }[] = [];

        if (targetExerciseId) {
            const ex = allExercises.find(e => e.id === targetExerciseId);
            if (ex) relevantExercises = [{ def: ex, role: 'target' }];
        } else if (muscleId) {
            relevantExercises = [
                ...allExercises.filter(e => e.primaryMuscles.includes(muscleId)).map(e => ({ def: e, role: 'primary' as const })),
                ...allExercises.filter(e => e.secondaryMuscles.includes(muscleId)).map(e => ({ def: e, role: 'secondary' as const })),
            ];
        }

        // Helper to match a history entry to a relevant exercise using the unified mapper
        const findMatch = (entry: any): { match?: typeof relevantExercises[0]; matchReason?: string } => {
            const entryId = entry.exerciseId;
            const entryName = entry.exerciseName || entryId;

            if (!entryName) return {};

            // Use the unified mapper
            const matchResult = findExerciseMatch(entryName, allExercises);
            if (matchResult) {
                // Check if this matched exercise is in our "relevant" list (the muscle/target filter)
                const relevantMatch = relevantExercises.find(re => re.def.id === matchResult.exercise.id);
                if (relevantMatch) {
                    return { match: relevantMatch, matchReason: matchResult.reason };
                }
            }
            return {};
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

        // Track e1RM progression by date for graphing (with rep info for PB annotation)
        const e1rmByDate: Record<string, { e1rm: number; reps: number; weight: number; exerciseName: string; isActual1RM: boolean }> = {};

        // Track Hard vs Light volume
        const hardVolumeByDate: Record<string, number> = {};
        const lightVolumeByDate: Record<string, number> = {};
        let totalHardTonnage = 0;

        // Track actual 1RM (reps = 1) separately
        const actual1rmByDate: Record<string, { weight: number; exerciseName: string }> = {};

        // Track max weight per date for bar chart
        const maxWeightByDate: Record<string, { weight: number; originalWeight: number; exerciseName: string }> = {};

        // Track matched exercises for debugging
        const matchedExercisesMap: Record<string, { original: string; matchedTo: string; reason: string; firstSeen: string; sets: number }> = {};

        // Track detailed workout data by date for drill-down
        const workoutDetailsByDate: Record<string, Array<{
            exerciseName: string;
            exerciseId: string;
            role: 'primary' | 'secondary' | 'target';
            workoutId?: string;
            sets: Array<{ weight: number; reps: number; volume: number; e1rm: number; setKey: string; isHard: boolean }>;
        }>> = {};

        // Track seen set keys to prevent duplicates
        const seenSetKeys = new Set<string>();

        const historySorted = (workoutHistory as any[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Pre-calculate 1RM history for all relevant exercises to optimize intensity calculation
        const e1rmHistoryAcrossExercises: Record<string, { date: number, e1rm: number }[]> = {};
        historySorted.forEach(workout => {
            const workoutDate = new Date(workout.date).getTime();
            workout.exercises?.forEach((e: any) => {
                const matchResult = findMatch(e);
                if (matchResult.match) {
                    const id = matchResult.match.def.id;
                    if (!e1rmHistoryAcrossExercises[id]) e1rmHistoryAcrossExercises[id] = [];
                    e.sets?.forEach((s: any) => {
                        if (s.weight && s.reps) {
                            const e1rmValue = s.weight * (1 + (s.reps / 30));
                            e1rmHistoryAcrossExercises[id].push({ date: workoutDate, e1rm: e1rmValue });
                        }
                    });
                }
            });
        });

        historySorted.forEach(workout => {
            const dateStr = new Date(workout.date).toISOString().split('T')[0];
            const workoutId = workout.id || workout._id || null;

            workout.exercises?.forEach((exerciseEntry: any) => {
                const matchResult = findMatch(exerciseEntry);
                if (!matchResult.match) return;

                const matched = matchResult.match;
                const multiplier = matched.role === 'secondary' ? 0.5 : 1.0;

                // Track this match for debugging
                const originalName = exerciseEntry.exerciseName || exerciseEntry.exerciseId || 'unknown';
                const matchKey = `${originalName}→${matched.def.id}`;
                if (!matchedExercisesMap[matchKey]) {
                    matchedExercisesMap[matchKey] = {
                        original: originalName,
                        matchedTo: matched.def.name_en,
                        reason: matchResult.matchReason || 'unknown',
                        firstSeen: dateStr,
                        sets: 0
                    };
                }
                matchedExercisesMap[matchKey].sets += exerciseEntry.sets?.length || 0;

                // Collect detailed workout data for drill-down
                if (!workoutDetailsByDate[dateStr]) {
                    workoutDetailsByDate[dateStr] = [];
                }

                // Find or create exercise entry for this date (unique per workout+exercise)
                const exerciseKey = `${workoutId || dateStr}-${matched.def.id}`;
                let exerciseDetail = workoutDetailsByDate[dateStr].find(
                    e => e.exerciseId === matched.def.id && e.workoutId === workoutId
                );
                if (!exerciseDetail) {
                    exerciseDetail = {
                        exerciseName: matched.def.name_en,
                        exerciseId: matched.def.id,
                        role: matched.role,
                        workoutId: workoutId,
                        sets: []
                    };
                    workoutDetailsByDate[dateStr].push(exerciseDetail);
                }

                // Get history for THIS specific exercise
                const exerciseHistory = e1rmHistoryAcrossExercises[matched.def.id] || [];
                const workoutDateMs = new Date(workout.date).getTime();
                const sixMonthsAgoMs = workoutDateMs - (6 * 30 * 24 * 60 * 60 * 1000);

                exerciseEntry.sets.forEach((set: WorkoutSet, setIndex: number) => {
                    const weight = set.weight || 0;
                    const reps = set.reps || 0;
                    if (weight === 0 || reps === 0) return;

                    // Generate unique key for this set to prevent duplicates
                    const setKey = `${workoutId || dateStr}-${matched.def.id}-${setIndex}-${weight}-${reps}`;
                    if (seenSetKeys.has(setKey)) return; // Skip duplicates
                    seenSetKeys.add(setKey);

                    // Load
                    const volume = weight * reps * multiplier;
                    loadByDate[dateStr] = (loadByDate[dateStr] || 0) + volume;

                    // Calculate e1RM
                    const e1rm = weight * (1 + (reps / 30));
                    const isActual1RM = reps === 1;
                    const isPrimaryExercise = matched.role === 'primary' || matched.role === 'target';

                    // Track e1RM for graphing - ONLY for primary exercises!
                    if (isPrimaryExercise) {
                        if (!e1rmByDate[dateStr] || e1rm > e1rmByDate[dateStr].e1rm) {
                            e1rmByDate[dateStr] = {
                                e1rm: Math.round(e1rm),
                                reps,
                                weight,
                                exerciseName: matched.def.name_en,
                                isActual1RM
                            };
                        }

                        if (reps === 1) {
                            if (!actual1rmByDate[dateStr] || weight > actual1rmByDate[dateStr].weight) {
                                actual1rmByDate[dateStr] = { weight, exerciseName: matched.def.name_en };
                            }
                        }
                    }

                    // Track max weight for bar chart (adjusted for role)
                    const weightedMax = weight * multiplier;
                    if (!maxWeightByDate[dateStr] || weightedMax > maxWeightByDate[dateStr].weight) {
                        maxWeightByDate[dateStr] = {
                            weight: weightedMax,
                            originalWeight: weight,
                            exerciseName: matched.def.name_en
                        };
                    }

                    // Intensity - Find max for THIS specific matched exercise in window
                    const max1RM = exerciseHistory
                        .filter(h => h.date <= workoutDateMs && h.date >= sixMonthsAgoMs)
                        .reduce((max, h) => Math.max(max, h.e1rm), 0);

                    let isHard = true;
                    if (max1RM > 0) {
                        const intensity = weight / max1RM;
                        isHard = intensity >= intensityThreshold;

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

                    // Categorize hard vs light volume (for stacked bar chart)
                    if (isHard) {
                        hardVolumeByDate[dateStr] = (hardVolumeByDate[dateStr] || 0) + volume;
                        totalHardTonnage += volume;
                    } else {
                        lightVolumeByDate[dateStr] = (lightVolumeByDate[dateStr] || 0) + volume;
                    }

                    // Update detailed set flag
                    exerciseDetail!.sets.push({
                        weight,
                        reps,
                        volume,
                        e1rm: Math.round(e1rm),
                        setKey,
                        isHard: isHard
                    });
                });
            });
        });

        // Format Load Chart Data with e1RM included
        let runningBestE1RM = 0;
        let runningBestActual1RM = 0;
        let runningBestWeight = 0;

        // Track last known e1rm for decay/carry-forward (Fix: prevent zero-dips)
        let lastKnownE1rm = 0;
        let daysSinceLastE1rm = 0;

        const sortedDataDates = Array.from(new Set([
            ...Object.keys(loadByDate),
            ...Object.keys(e1rmByDate),
            ...Object.keys(maxWeightByDate)
        ])).sort();

        let allDates: string[] = [];
        if (sortedDataDates.length > 0) {
            const first = new Date(sortedDataDates[0]);
            const last = new Date(sortedDataDates[sortedDataDates.length - 1]);
            const curr = new Date(first);
            while (curr <= last) {
                allDates.push(curr.toISOString().split('T')[0]);
                curr.setDate(curr.getDate() + 1);
            }
        }

        const chartData = allDates.map(date => {
            const load = loadByDate[date] || 0;
            const e1rmData = e1rmByDate[date];
            const actual1rmData = actual1rmByDate[date];
            const rawE1rm = e1rmData?.e1rm || 0;
            const pbReps = e1rmData?.reps || 0;
            const pbWeight = e1rmData?.weight || 0;
            const pbExerciseName = e1rmData?.exerciseName || '';
            const isActual1RM = e1rmData?.isActual1RM || false;
            const actual1rm = actual1rmData?.weight || 0;
            const maxWeightData = maxWeightByDate[date];
            const maxWeight = maxWeightData?.weight || 0;
            const maxWeightExercise = maxWeightData?.exerciseName || '';
            const maxWeightOriginal = maxWeightData?.originalWeight || 0;

            // Carry-forward logic: if no e1rm today, use last known with slow decay
            // Decay: ~1% per week = 0.14% per day
            let displayE1rm = rawE1rm;
            if (rawE1rm > 0) {
                lastKnownE1rm = rawE1rm;
                daysSinceLastE1rm = 0;
            } else if (lastKnownE1rm > 0) {
                daysSinceLastE1rm++;
                // Decay factor: lose max 10% even after long inactivity
                const decayFactor = Math.max(0.90, 1 - (daysSinceLastE1rm * 0.0014));
                displayE1rm = Math.round(lastKnownE1rm * decayFactor);
            }

            // Track e1RM PBs (use raw value for accurate PB detection)
            const isE1RMPB = rawE1rm > runningBestE1RM && rawE1rm > 0;
            if (isE1RMPB) runningBestE1RM = rawE1rm;

            // Trend is the running best e1RM (Step-up logic)
            const e1rmTrend = runningBestE1RM;

            // Track actual 1RM PBs
            const isActual1RMPB = actual1rm > runningBestActual1RM && actual1rm > 0;
            if (isActual1RMPB) runningBestActual1RM = actual1rm;

            // Track Weight PBs (highest weight ever lifted for this muscle/exercise)
            const isWeightPB = maxWeight > runningBestWeight && maxWeight > 0;
            if (isWeightPB) runningBestWeight = maxWeight;

            return {
                date,
                load: Math.round(load),
                hardVolume: Math.round(hardVolumeByDate[date] || 0),
                lightVolume: Math.round(lightVolumeByDate[date] || 0),
                e1rm: displayE1rm,
                rawE1rm, // Keep original for tooltip display
                e1rmTrend,
                actual1rm,
                maxWeight,
                isPB: isE1RMPB,
                isActual1RMPB,
                isWeightPB,
                pbReps,
                pbWeight,
                pbExerciseName,
                isActual1RM,
                maxWeightExercise,
                maxWeightOriginal
            };
        });

        // Calculate frequency (sessions per week)
        const sessionsWithData = chartData.filter(d => d.load > 0).length;
        const firstDate = chartData.find(d => d.load > 0)?.date;
        const lastDate = [...chartData].reverse().find(d => d.load > 0)?.date;
        let frequencyPerWeek = 0;
        if (firstDate && lastDate && firstDate !== lastDate) {
            const daySpan = (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24);
            const weeks = Math.max(daySpan / 7, 1);
            frequencyPerWeek = Math.round((sessionsWithData / weeks) * 10) / 10;
        }

        // Format Intensity Data
        const intensityData = Object.values(intensityBuckets);

        return {
            chartData,
            intensityData,
            totalSets: intensityData.reduce((acc, curr) => acc + curr.sets, 0),
            totalTonnage: intensityData.reduce((acc, curr) => acc + curr.tonnage, 0),
            totalHardTonnage: Math.round(totalHardTonnage),
            matchedExercises: Object.values(matchedExercisesMap),
            workoutDetailsByDate,
            bestE1RM: runningBestE1RM,
            bestActual1RM: runningBestActual1RM,
            frequencyPerWeek,
            totalSessions: sessionsWithData
        };

    }, [workoutHistory, muscleId, targetExerciseId, intensityThreshold]);

    return { stats, isLoading };
};
