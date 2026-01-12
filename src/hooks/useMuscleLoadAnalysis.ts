
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

        // Helper to normalize names for matching
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-zåäö0-9]/g, '');

        // Helper to match a history entry to a relevant exercise with fuzzy matching
        const findMatch = (entry: any): { match?: typeof relevantExercises[0]; matchReason?: string } => {
            const entryId = entry.exerciseId?.toLowerCase().trim();
            const entryName = entry.exerciseName?.toLowerCase().trim();
            const normalizedEntryName = entryName ? normalize(entryName) : '';
            const normalizedEntryId = entryId ? normalize(entryId) : '';

            for (const re of relevantExercises) {
                const exId = re.def.id.toLowerCase();
                const exNameSv = re.def.name_sv.toLowerCase();
                const exNameEn = re.def.name_en.toLowerCase();
                const normalizedExId = normalize(exId);
                const normalizedExNameSv = normalize(exNameSv);
                const normalizedExNameEn = normalize(exNameEn);

                // 1. Direct ID Match
                if (entryId && (exId === entryId || normalizedExId === normalizedEntryId)) {
                    return { match: re, matchReason: `ID: ${entryId} = ${exId}` };
                }

                // 2. Exact Name Match
                if (entryName) {
                    if (exNameSv === entryName || exNameEn === entryName) {
                        return { match: re, matchReason: `ExactName: ${entryName}` };
                    }
                }

                // 3. Fuzzy: entry name is contained in exercise name (or vice versa)
                if (normalizedEntryName && normalizedEntryName.length >= 3) {
                    // "deadlift" contained in "deadliftbarbell"
                    if (normalizedExId.includes(normalizedEntryName) || normalizedExNameEn.includes(normalizedEntryName)) {
                        return { match: re, matchReason: `Fuzzy: "${entryName}" ⊂ "${exNameEn}"` };
                    }
                    // "deadliftbarbell" contains "deadlift"
                    if (normalizedEntryName.includes(normalizedExId) || normalizedEntryName.includes(normalizedExNameEn)) {
                        return { match: re, matchReason: `FuzzyReverse: "${exNameEn}" ⊂ "${entryName}"` };
                    }
                }

                // 4. ID-based fuzzy: "deadlift" matches "deadlift_barbell"
                if (normalizedEntryId && normalizedEntryId.length >= 3) {
                    if (normalizedExId.includes(normalizedEntryId) || normalizedEntryId.includes(normalizedExId)) {
                        return { match: re, matchReason: `FuzzyID: ${entryId} ~ ${exId}` };
                    }
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
            sets: Array<{ weight: number; reps: number; volume: number; e1rm: number; setKey: string }>;
        }>> = {};

        // Track seen set keys to prevent duplicates
        const seenSetKeys = new Set<string>();

        const historySorted = (workoutHistory as any[]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
                    const exerciseName = matched.def.name_en;
                    const isPrimaryExercise = matched.role === 'primary' || matched.role === 'target';

                    // Track e1RM for graphing - ONLY for primary exercises!
                    // Secondary exercises (like biceps in pull-ups) shouldn't count for e1RM PBs
                    if (isPrimaryExercise) {
                        if (!e1rmByDate[dateStr] || e1rm > e1rmByDate[dateStr].e1rm) {
                            e1rmByDate[dateStr] = {
                                e1rm: Math.round(e1rm),
                                reps,
                                weight,
                                exerciseName,
                                isActual1RM
                            };
                        }

                        // Track actual 1RM separately (only if reps = 1 and primary)
                        if (reps === 1) {
                            if (!actual1rmByDate[dateStr] || weight > actual1rmByDate[dateStr].weight) {
                                actual1rmByDate[dateStr] = { weight, exerciseName };
                            }
                        }
                    }

                    // Track max weight for bar chart (adjusted for rolestat)
                    const weightedMax = weight * multiplier;
                    if (!maxWeightByDate[dateStr] || weightedMax > maxWeightByDate[dateStr].weight) {
                        maxWeightByDate[dateStr] = {
                            weight: weightedMax,
                            originalWeight: weight,
                            exerciseName
                        };
                    }

                    // Add to detailed sets
                    exerciseDetail!.sets.push({ weight, reps, volume, e1rm: Math.round(e1rm), setKey });

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
                            // Use fuzzy matching
                            const eNorm = normalize(e.exerciseName || '');
                            const matchedNorm = normalize(matched.def.name_en);
                            const matchedIdNorm = normalize(matched.def.id);

                            let isSame = false;
                            if (e.exerciseId === matched.def.id) isSame = true;
                            else if (eNorm && (eNorm.includes(matchedIdNorm) || matchedIdNorm.includes(eNorm) ||
                                eNorm.includes(matchedNorm) || matchedNorm.includes(eNorm))) {
                                isSame = true;
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

        // Format Load Chart Data with e1RM included
        let runningBestE1RM = 0;
        let runningBestActual1RM = 0;
        let runningBestWeight = 0;
        const allDates = Array.from(new Set([
            ...Object.keys(loadByDate),
            ...Object.keys(e1rmByDate),
            ...Object.keys(maxWeightByDate)
        ])).sort();

        const chartData = allDates.map(date => {
            const load = loadByDate[date] || 0;
            const e1rmData = e1rmByDate[date];
            const actual1rmData = actual1rmByDate[date];
            const e1rm = e1rmData?.e1rm || 0;
            const pbReps = e1rmData?.reps || 0;
            const pbWeight = e1rmData?.weight || 0;
            const pbExerciseName = e1rmData?.exerciseName || '';
            const isActual1RM = e1rmData?.isActual1RM || false;
            const actual1rm = actual1rmData?.weight || 0;
            const maxWeightData = maxWeightByDate[date];
            const maxWeight = maxWeightData?.weight || 0;
            const maxWeightExercise = maxWeightData?.exerciseName || '';
            const maxWeightOriginal = maxWeightData?.originalWeight || 0;

            // Track e1RM PBs
            const isE1RMPB = e1rm > runningBestE1RM && e1rm > 0;
            if (isE1RMPB) runningBestE1RM = e1rm;

            // Track actual 1RM PBs
            const isActual1RMPB = actual1rm > runningBestActual1RM && actual1rm > 0;
            if (isActual1RMPB) runningBestActual1RM = actual1rm;

            // Track Weight PBs (highest weight ever lifted for this muscle/exercise)
            const isWeightPB = maxWeight > runningBestWeight && maxWeight > 0;
            if (isWeightPB) runningBestWeight = maxWeight;

            return {
                date,
                load: Math.round(load),
                e1rm,
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
            matchedExercises: Object.values(matchedExercisesMap),
            workoutDetailsByDate,
            bestE1RM: runningBestE1RM,
            bestActual1RM: runningBestActual1RM,
            frequencyPerWeek,
            totalSessions: sessionsWithData
        };

    }, [workoutHistory, muscleId, targetExerciseId]);

    return { stats, isLoading };
};
