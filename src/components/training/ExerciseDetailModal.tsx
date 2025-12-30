import React, { useState, useMemo, useEffect } from 'react';
import { StrengthWorkout, PersonalBest, StrengthStats, calculate1RM, normalizeExerciseName, isWeightedDistanceExercise, isDistanceBasedExercise } from '../../models/strengthTypes.ts';

interface ExerciseDetailModalProps {
    exerciseName: string;
    workouts: StrengthWorkout[];
    onClose: () => void;
    onSelectWorkout?: (workout: StrengthWorkout) => void;
    isWorkoutModalOpen?: boolean;
}

export function ExerciseDetailModal({
    exerciseName,
    workouts,
    onClose,
    onSelectWorkout,
    isWorkoutModalOpen
}: ExerciseDetailModalProps) {
    // ESC key to close - only if workout modal is NOT open
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isWorkoutModalOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc, true); // Capture phase
        return () => window.removeEventListener('keydown', handleEsc, true);
    }, [onClose, isWorkoutModalOpen]);

    const [viewMode, setViewMode] = useState<'history' | 'prs' | 'annual'>('history');
    const [metricMode, setMetricMode] = useState<'absolute' | 'relative'>('absolute');

    // Get all instances of this exercise across workouts
    const exerciseHistory = useMemo(() => {
        const history: {
            date: string;
            sets: number;
            reps: number;
            maxWeight: number;
            volume: number;
            est1RM: number;
            workout: StrengthWorkout;
            maxDistance?: number;
            totalDistance?: number;
            maxTime?: number;
            maxTimeFormatted?: string;
            bestTempo?: string;
        }[] = [];

        workouts.forEach(w => {
            // Robust matching: Check both exact and normalized
            const exerciseEntries = w.exercises.filter(e =>
                e.exerciseName === exerciseName ||
                normalizeExerciseName(e.exerciseName) === normalizeExerciseName(exerciseName)
            );

            if (exerciseEntries.length > 0) {
                const allSets = exerciseEntries.flatMap(e => e.sets);
                const maxWeight = Math.max(...allSets.map(s => s.weight));
                const totalReps = allSets.reduce((sum, s) => sum + s.reps, 0);
                // Calculate Volume & Max Weight
                let volume = 0;

                if (isWeightedDistanceExercise(exerciseName)) {
                    volume = allSets.reduce((sum, s) => sum + (s.weight * (s.distance || 0)), 0);
                } else if (isDistanceBasedExercise(exerciseName)) {
                    volume = allSets.reduce((sum, s) => sum + (s.distance || 0), 0);
                } else {
                    volume = allSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
                }

                const est1RMs = allSets.map(s => {
                    // For weighted distance, est1RM is just the weight (since reps are 0)
                    if (isWeightedDistanceExercise(exerciseName)) return s.weight;
                    if (isDistanceBasedExercise(exerciseName)) return 0;
                    const isBW = s.isBodyweight || s.weight === 0;
                    const calcWeight = isBW ? (s.extraWeight || 0) : s.weight;
                    return calculate1RM(calcWeight, s.reps);
                });
                const best1RMValue = Math.max(...est1RMs);

                // Cardio/Distance metrics
                const distances = allSets.map(s => s.distance || 0);
                const maxDistance = Math.max(...distances);
                const totalDistance = distances.reduce((sum, d) => sum + d, 0);

                const times = allSets.map(s => s.timeSeconds || 0);
                const maxTime = Math.max(...times);
                // Prefer formatted time from the longest duration set
                const maxTimeFormatted = allSets.find(s => s.timeSeconds === maxTime)?.time || '';

                // Tempo from best set (longest distance or time)
                const bestTempo = allSets.find(s => (s.distance === maxDistance && maxDistance > 0) || (s.timeSeconds === maxTime && maxTime > 0))?.tempo;

                history.push({
                    date: w.date,
                    sets: allSets.length,
                    reps: totalReps,
                    maxWeight,
                    volume,
                    est1RM: Math.round(best1RMValue),
                    workout: w,
                    maxDistance,
                    totalDistance,
                    maxTime,
                    maxTimeFormatted,
                    bestTempo
                });
            }
        });

        return history.sort((a, b) => a.date.localeCompare(b.date));
    }, [workouts, exerciseName]);

    // Calculate PR progression (Weight-PRs) - check every single set
    const prProgression = useMemo(() => {
        const prs: (PersonalBest & { workout: StrengthWorkout; daysSinceLast?: number; percentIncrease?: number })[] = [];
        let currentMax = 0;
        let lastPrDate: Date | null = null;

        exerciseHistory.forEach(h => {
            // Robust matching: Check both exact and normalized
            const exerciseEntries = h.workout.exercises.filter(e =>
                e.exerciseName === exerciseName ||
                normalizeExerciseName(e.exerciseName) === normalizeExerciseName(exerciseName)
            );

            if (exerciseEntries.length === 0) return;

            // Flatten all sets from all entries in correct order
            const allSets = exerciseEntries.flatMap(e => e.sets);

            allSets.forEach(set => {
                if (set.weight > currentMax) {
                    const currentDate = new Date(h.date);
                    let daysSinceLast: number | undefined;
                    let percentIncrease: number | undefined;

                    if (lastPrDate) {
                        daysSinceLast = Math.round((currentDate.getTime() - lastPrDate.getTime()) / (1000 * 60 * 60 * 24));
                    }

                    if (currentMax > 0) {
                        percentIncrease = ((set.weight - currentMax) / currentMax) * 100;
                    }

                    prs.push({
                        date: h.date,
                        weight: set.weight,
                        reps: set.reps,
                        volume: set.weight * set.reps,
                        workout: h.workout,
                        daysSinceLast,
                        percentIncrease,
                        isBodyweight: set.isBodyweight,
                        extraWeight: set.extraWeight
                    } as any);
                    currentMax = set.weight;
                    lastPrDate = currentDate;
                }
            });
        });

        return prs;
    }, [exerciseHistory, exerciseName]);

    // Calculate Annual Bests
    const annualBestData = useMemo(() => {
        const byYear: Record<string, {
            year: string;
            maxEst1RM: number;
            maxWeight: number;
            maxDistance: number;
            maxEst1RMWorkout?: StrengthWorkout;
            maxWeightWorkout?: StrengthWorkout;
            monthlyMaxes: { value: number; date: string; workout: StrengthWorkout }[];
        }> = {};

        exerciseHistory.forEach(h => {
            const year = h.date.substring(0, 4);
            if (!byYear[year]) {
                byYear[year] = { year, maxEst1RM: 0, maxWeight: 0, maxDistance: 0, monthlyMaxes: [] };
            }

            // Update Annual Maxes
            if (h.est1RM > byYear[year].maxEst1RM) {
                byYear[year].maxEst1RM = h.est1RM;
                byYear[year].maxEst1RMWorkout = h.workout;
            }
            if (h.maxWeight > byYear[year].maxWeight) {
                byYear[year].maxWeight = h.maxWeight;
                byYear[year].maxWeightWorkout = h.workout;
            }
            if ((h.maxDistance || 0) > byYear[year].maxDistance) byYear[year].maxDistance = h.maxDistance || 0;

            // Track Monthly Maxes (for "swarm" visualization)
            // For now, simpler: just push every single session's "best" value to monthlyMaxes
            // We can filter for unique months or just keep all sessions to show density
            // User asked for "månadsbästa" specifically, so let's try to keep 1 per month per year?
            // Actually, showing density of ALL sessions as faint dots is cool too.
            // But let's stick to "Monthly Best" to keep it cleaner.

            const monthKey = h.date.substring(0, 7); // YYYY-MM
            const val = isWeightedDistanceExercise(exerciseName) ? h.maxWeight :
                isDistanceBasedExercise(exerciseName) ? (h.maxDistance || 0) : h.maxWeight;

            const existingMonth = byYear[year].monthlyMaxes.find(m => m.date.startsWith(monthKey));
            if (!existingMonth) {
                byYear[year].monthlyMaxes.push({ value: val, date: h.date, workout: h.workout });
            } else if (val > existingMonth.value) {
                existingMonth.value = val;
                existingMonth.date = h.date;
                existingMonth.workout = h.workout;
            }
        });

        return Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year));
    }, [exerciseHistory]);

    const totalSets = useMemo(() => exerciseHistory.reduce((sum, h) => sum + h.sets, 0), [exerciseHistory]);
    const totalVolume = exerciseHistory.reduce((sum: number, h) => sum + h.volume, 0);

    // Find workout for Max 1RM
    const maxRecord = useMemo(() => {
        if (exerciseHistory.length === 0) return null;
        return exerciseHistory.reduce((prev, curr) => (curr.maxWeight > prev.maxWeight ? curr : prev), exerciseHistory[0]);
    }, [exerciseHistory]);
    const maxEver = maxRecord?.maxWeight || 0;

    const bestRecord = useMemo(() => {
        if (exerciseHistory.length === 0) return null;
        if (isDistanceBasedExercise(exerciseName)) {
            return exerciseHistory.reduce((prev, curr) => ((curr.maxDistance || 0) > (prev.maxDistance || 0) ? curr : prev), exerciseHistory[0]);
        }
        return exerciseHistory.reduce((prev, curr) => (curr.est1RM > prev.est1RM ? curr : prev), exerciseHistory[0]);
    }, [exerciseHistory, exerciseName]);

    // Best value for the summary card (1RM, Distance, or Weight+Dist)
    const bestValueDisplay = useMemo(() => {
        if (!maxRecord && !bestRecord) return '0';

        if (isWeightedDistanceExercise(exerciseName)) {
            // Show Max Weight (and distance)
            const rec = maxRecord || bestRecord;
            return `${rec?.maxWeight}kg (${rec?.maxDistance}m)`;
        }

        if (isDistanceBasedExercise(exerciseName)) {
            // Show Max Distance
            return `${Math.round(bestRecord?.maxDistance || 0)}m`;
        }

        // Default Strength
        return `${bestRecord?.est1RM || 0} kg`;
    }, [maxRecord, bestRecord, exerciseName]);

    // Contextual Calculations (Motivation Mode)
    const contextStats = useMemo(() => {
        if (exerciseHistory.length === 0) return null;

        const currentYear = new Date().getFullYear().toString();
        const lastSession = exerciseHistory[exerciseHistory.length - 1];

        // Overall Best for All Time
        const overallBestEst = exerciseHistory.reduce((max, h) => Math.max(max, h.est1RM), 0);

        // Annual Best for Current Year
        const currentYearHistory = exerciseHistory.filter(h => h.date.startsWith(currentYear));
        const annualBestEst = currentYearHistory.reduce((max, h) => Math.max(max, h.est1RM), 0);
        const annualBestAct = currentYearHistory.reduce((max, h) => Math.max(max, h.maxWeight), 0);

        // Find the specific session for the Annual Best (Est 1RM)
        const bestSession = currentYearHistory.find(h => h.est1RM === annualBestEst);
        const bestSessionWorkout = bestSession?.workout;
        const bestDate = bestSession ? bestSession.date : '';

        // Calculate "Time Ago"
        let timeAgo = '';
        if (bestDate) {
            const diffTime = Math.abs(new Date().getTime() - new Date(bestDate).getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 30) timeAgo = `${diffDays} dagar sedan`;
            else if (diffDays < 365) timeAgo = `${Math.floor(diffDays / 30)} mån sedan`;
            else timeAgo = '> 1 år sedan';
        }

        // Is Current Session the Annual Best?
        const isAnnualBest = lastSession.est1RM >= annualBestEst && annualBestEst > 0;

        // Is Annual Best also an All-Time PR?
        const isAllTimeBest = annualBestEst >= overallBestEst && overallBestEst > 0;

        // 3-Month Trend
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const recentHistory = exerciseHistory.filter(h => new Date(h.date) >= threeMonthsAgo);

        let trend: 'up' | 'down' | 'neutral' = 'neutral';
        let trendKgDiff = 0;
        let trendPercent = 0;
        let trendSessionCount = recentHistory.length;

        if (recentHistory.length >= 2) {
            const firstOfRecent = recentHistory[0];
            const lastOfRecent = recentHistory[recentHistory.length - 1];

            trendKgDiff = lastOfRecent.est1RM - firstOfRecent.est1RM;
            if (firstOfRecent.est1RM > 0) {
                trendPercent = (trendKgDiff / firstOfRecent.est1RM) * 100;
            }

            if (trendKgDiff > 1) trend = 'up';
            else if (trendKgDiff < -1) trend = 'down';
        }

        return {
            annualBestEst,
            annualBestAct,
            bestDate,
            timeAgo,
            bestSessionWorkout,
            isAnnualBest,
            isAllTimeBest,
            trend,
            trendKgDiff,
            trendPercent,
            trendSessionCount
        };
    }, [exerciseHistory]);

    // Helper for Relative Strength Display
    const formatValue = (val: number, workout?: StrengthWorkout, suffix = 'kg') => {
        if (metricMode === 'relative' && workout?.bodyWeight) {
            return (val / workout.bodyWeight).toFixed(2) + 'x';
        }
        return Math.round(val) + suffix;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl custom-scrollbar"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white">{exerciseName}</h2>
                        <p className="text-slate-400 text-sm">{exerciseHistory.length} pass med denna övning</p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onClose();
                        }}
                        className="text-slate-500 hover:text-white text-3xl p-1 -mt-2 transition-colors"
                        type="button"
                    >
                        ×
                    </button>
                </div>

                {/* Contextual Hero Section (Motivation Mode) */}
                {!isDistanceBasedExercise(exerciseName) && contextStats && (
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between relative overflow-hidden group">
                        {/* Background Glow for Annual Best / PR */}
                        {(contextStats.isAnnualBest || contextStats.isAllTimeBest) && (
                            <div className={`absolute inset-0 ${contextStats.isAllTimeBest ? 'bg-amber-500/10' : 'bg-yellow-500/5'} blur-xl group-hover:opacity-80 transition-all duration-1000`}></div>
                        )}

                        <div className="relative z-10 flex gap-6 items-center flex-1">
                            {/* Annual Best Status */}
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Årsbästa {new Date().getFullYear()}</p>
                                    {contextStats.isAllTimeBest && (
                                        <span className="text-[8px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black tracking-tighter animate-pulse">ALL-TIME PR</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-2xl font-black ${contextStats.isAnnualBest ? 'text-yellow-400' : 'text-white'} leading-none`}>
                                                {metricMode === 'relative' && contextStats.bestSessionWorkout?.bodyWeight
                                                    ? (contextStats.annualBestEst / contextStats.bestSessionWorkout.bodyWeight).toFixed(2) + 'x'
                                                    : contextStats.annualBestEst + ' kg'}
                                            </span>
                                            {contextStats.isAnnualBest && (
                                                <span className="text-xl animate-bounce" title="Nytt Årsbästa!">🏆</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2 text-[10px] text-slate-400 font-medium mt-1">
                                            <span>Est. 1RM</span>
                                            <span className="text-slate-600">|</span>
                                            <span>Lyft: {contextStats.annualBestAct}kg</span>
                                        </div>
                                    </div>
                                    {contextStats.bestSessionWorkout && onSelectWorkout && (
                                        <button
                                            onClick={() => onSelectWorkout(contextStats.bestSessionWorkout!)}
                                            className="ml-2 text-[9px] bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-2 py-1 rounded border border-white/5 transition-all self-center"
                                        >
                                            Visa pass →
                                        </button>
                                    )}
                                </div>
                                {contextStats.bestDate && (
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        {contextStats.bestDate} ({contextStats.timeAgo})
                                    </p>
                                )}
                            </div>

                            {/* Trend Indicator */}
                            <div className="pl-4 border-l border-white/5">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Trend (3 mån)</p>
                                <div className={`text-sm font-bold flex flex-col ${contextStats.trend === 'up' ? 'text-emerald-400' : contextStats.trend === 'down' ? 'text-rose-400' : 'text-slate-400'}`}>
                                    <div className="flex items-center gap-1">
                                        <span>{contextStats.trend === 'up' ? '↗' : contextStats.trend === 'down' ? '↘' : '→'} {Math.abs(contextStats.trendKgDiff).toFixed(1)} kg</span>
                                        <span className="text-[10px] opacity-70">({contextStats.trendPercent > 0 ? '+' : ''}{contextStats.trendPercent.toFixed(1)}%)</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-medium mt-0.5">{contextStats.trendSessionCount} pass under perioden</p>
                                </div>
                            </div>
                        </div>

                        {/* Relative Strength Toggle */}
                        <div className="relative z-10">
                            <button
                                onClick={() => setMetricMode(m => m === 'absolute' ? 'relative' : 'absolute')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${metricMode === 'relative'
                                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                            >
                                <span>⚖️ Viktjusterat</span>
                                {metricMode === 'relative' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-white">{exerciseHistory.length}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Pass</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-white">{totalSets}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Set</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-2.5 text-center">
                        {/* Intelligent Volume Display */}
                        <p className="text-lg font-black text-white text-blue-400">
                            {isDistanceBasedExercise(exerciseName)
                                ? (totalVolume > 1000 ? (totalVolume / 1000).toFixed(1) + 'km' : Math.round(totalVolume) + 'm')
                                : (totalVolume > 1000 ? (totalVolume / 1000).toFixed(1) + 't' : Math.round(totalVolume) + 'kg')
                            }
                        </p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Total Volym</p>
                    </div>
                    <button
                        onClick={() => maxRecord && onSelectWorkout?.(maxRecord.workout)}
                        className="bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-2.5 text-center group/pb transition-all active:scale-[0.98]"
                    >
                        <p className="text-lg font-black text-emerald-400 group-hover/pb:text-emerald-300 transition-colors text-nowrap truncate px-1">
                            {bestValueDisplay}
                        </p>
                        <p className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1">
                            {isDistanceBasedExercise(exerciseName) ? 'Längsta Distans' : 'All-Time PB'}
                            <span className="opacity-0 group-hover/pb:opacity-100 transition-opacity">→</span>
                        </p>
                    </button>
                </div>

                {/* Progression Chart */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-tight flex items-center gap-2">
                            {viewMode === 'history' ? (
                                <>
                                    <span>
                                        {isDistanceBasedExercise(exerciseName) ? '📈 Progression (Distans)' :
                                            isWeightedDistanceExercise(exerciseName) ? '📈 Progression (Vikt)' : '📈 Progression (1eRM)'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-normal normal-case italic">
                                        {isDistanceBasedExercise(exerciseName) ? '(meter per pass)' :
                                            isWeightedDistanceExercise(exerciseName) ? '(tyngsta vikt)' : '(estimerat 1RM)'}
                                    </span>
                                </>
                            ) : viewMode === 'prs' ? (
                                <>
                                    <span className="text-amber-500">🏆 Progression (PB)</span>
                                    <span className="text-[10px] text-slate-500 font-normal normal-case italic">(faktiska rekord)</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-purple-500">🏆 Årsbästa</span>
                                    <span className="text-[10px] text-slate-500 font-normal normal-case italic">(EST 1RM vs Faktiskt)</span>
                                </>
                            )}
                        </h3>
                        <div className="flex bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('history')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Historik
                            </button>
                            <button
                                onClick={() => setViewMode('prs')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'prs' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Tyngsta lyft
                            </button>
                            <button
                                onClick={() => setViewMode('annual')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'annual' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Årsbästa
                            </button>
                        </div>
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-white/5">
                        {(() => {
                            if (viewMode === 'annual') {
                                if (annualBestData.length < 2) {
                                    return <p className="text-center text-slate-500 py-8">Inte nog med data för att visa årsbästa.</p>;
                                }

                                const isDist = isDistanceBasedExercise(exerciseName);
                                const maxValRaw = Math.max(...annualBestData.map(d => isDist ? d.maxDistance : d.maxEst1RM));

                                // Relative Mode Calculation
                                // If relative, we divide value by bodyweight (if available)
                                // We need to be careful with aggregations. 
                                // For Annual View, we should ideally re-calculate "Max Relative Strength" for the year.
                                const getRelativeVal = (val: number, workout?: StrengthWorkout) => {
                                    if (metricMode !== 'relative' || !workout?.bodyWeight) return val;
                                    return val / workout.bodyWeight;
                                };

                                // Re-map data for view
                                const chartData = annualBestData.map(d => {
                                    const estVal = isDist ? d.maxDistance : d.maxEst1RM;
                                    const actVal = d.maxWeight;

                                    // For simplicity in Annual View, we use the workout that set the record
                                    // This might be slightly inaccurate if the "Est 1RM" record was set at a different bodyweight 
                                    // than the "Max Weight" record, but usually they correlate.
                                    // Let's use the specific workout for each record.

                                    return {
                                        ...d,
                                        displayEst: getRelativeVal(estVal, d.maxEst1RMWorkout),
                                        displayAct: getRelativeVal(actVal, d.maxWeightWorkout),
                                        monthlyMaxes: d.monthlyMaxes.map(m => ({
                                            ...m,
                                            displayVal: getRelativeVal(m.value, m.workout)
                                        }))
                                    };
                                });

                                const maxVal = Math.max(...chartData.map(d => Math.max(d.displayEst, d.displayAct)));
                                const height = 200;
                                const width = 500;

                                const getX = (i: number) => (i / (annualBestData.length - 1)) * width;
                                const getY = (val: number) => height - (val / (maxVal * 1.1)) * height;

                                const lineEst = annualBestData.map((d, i) => `${getX(i)},${getY(isDist ? d.maxDistance : d.maxEst1RM)}`).join(' ');
                                const lineAct = annualBestData.map((d, i) => `${getX(i)},${getY(d.maxWeight)}`).join(' ');

                                return (
                                    <div className="w-full h-[250px] relative">
                                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                                            {/* Grid Lines & Y-Labels */}
                                            {[0, 0.25, 0.5, 0.75, 1].map(p => (
                                                <g key={p}>
                                                    <line
                                                        x1="0"
                                                        y1={height * p}
                                                        x2={width}
                                                        y2={height * p}
                                                        stroke="rgba(255,255,255,0.05)"
                                                        strokeWidth="1"
                                                    />
                                                    <text
                                                        x="-10"
                                                        y={height * p + 3}
                                                        fill="#64748b" // slate-500
                                                        fontSize="9"
                                                        textAnchor="end"
                                                        className="font-mono"
                                                    >
                                                        {metricMode === 'relative'
                                                            ? (maxVal * (1 - p)).toFixed(2) + 'x'
                                                            : Math.round(maxVal * (1 - p)) + (isDist ? 'm' : 'kg')
                                                        }
                                                    </text>
                                                </g>
                                            ))}

                                            {/* "Subtle Monthly Bests" (Background Dots) */}
                                            {chartData.map((d, i) => (
                                                <g key={`monthlies-${i}`}>
                                                    {d.monthlyMaxes.map((m, mIdx) => (
                                                        <circle
                                                            key={mIdx}
                                                            cx={getX(i)}
                                                            cy={getY(m.displayVal)}
                                                            r="2"
                                                            fill={isDist ? "#3b82f6" : "#10b981"}
                                                            fillOpacity="0.2"
                                                            className="hover:fill-opacity-80 transition-all cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelectWorkout?.(m.workout);
                                                            }}
                                                        >
                                                            <title>{m.date}: {metricMode === 'relative' ? m.displayVal.toFixed(2) + 'x' : m.value + (isDist ? 'm' : 'kg')}</title>
                                                        </circle>
                                                    ))}
                                                </g>
                                            ))}

                                            {/* Actual 1RM Line (Secondary) - Only if not distance based */}
                                            {!isDist && (
                                                <>
                                                    <polyline
                                                        points={chartData.map((d, i) => `${getX(i)},${getY(d.displayAct)}`).join(' ')}
                                                        fill="none"
                                                        stroke="#10b981" // emerald-500
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    // Solid line for Actual (Real)
                                                    />
                                                    {chartData.map((d, i) => (
                                                        <circle
                                                            onClick={() => d.maxWeightWorkout && onSelectWorkout?.(d.maxWeightWorkout)}
                                                            key={`act-${i}`}
                                                            cx={getX(i)}
                                                            cy={getY(d.displayAct)}
                                                            r="3"
                                                            fill="#10b981"
                                                            className="group hover:r-5 transition-all cursor-pointer stroke-slate-900 stroke-1"
                                                        />
                                                    ))}
                                                </>
                                            )}

                                            {/* Est 1RM / Max Dist Line (Primary) */}
                                            <polyline
                                                points={chartData.map((d, i) => `${getX(i)},${getY(d.displayEst)}`).join(' ')}
                                                fill="none"
                                                stroke={isDist ? "#3b82f6" : "#f59e0b"} // blue-500 or amber-500
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                // Dashed line for Estimated (Theoretical)
                                                strokeDasharray={!isDist ? "6 4" : ""}
                                            />

                                            {/* Data Points & Tooltips */}
                                            {chartData.map((d, i) => (
                                                <g
                                                    key={i}
                                                    className="group"
                                                    onClick={() => d.maxEst1RMWorkout && onSelectWorkout?.(d.maxEst1RMWorkout)}
                                                >
                                                    <circle
                                                        cx={getX(i)}
                                                        cy={getY(d.displayEst)}
                                                        r="4"
                                                        fill={isDist ? "#3b82f6" : "#f59e0b"} // blue or amber
                                                        className="stroke-slate-900 stroke-2 cursor-pointer transition-all hover:r-5"
                                                    />
                                                    {/* Tooltip */}
                                                    <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                        <rect
                                                            x={getX(i) - 30}
                                                            y={getY(d.displayEst) - 40}
                                                            width="60"
                                                            height="30"
                                                            rx="4"
                                                            fill="#0f172a"
                                                            stroke="rgba(255,255,255,0.1)"
                                                        />
                                                        <text
                                                            x={getX(i)}
                                                            y={getY(d.displayEst) - 22}
                                                            textAnchor="middle"
                                                            fill="white"
                                                            fontSize="10"
                                                            fontWeight="bold"
                                                        >
                                                            {metricMode === 'relative'
                                                                ? d.displayEst.toFixed(2) + 'x'
                                                                : (isDist ? Math.round(d.maxDistance) + 'm' : Math.round(d.maxEst1RM) + 'kg')
                                                            }
                                                        </text>
                                                    </g>
                                                </g>
                                            ))}
                                        </svg>

                                        {/* X-Axis Labels */}
                                        <div className="flex justify-between mt-2 px-2">
                                            {annualBestData.map(d => (
                                                <div key={d.year} className="text-center">
                                                    <p className="text-xs text-slate-400 font-bold">{d.year}</p>
                                                    {!isDist && (
                                                        <p className="text-[9px] text-emerald-500/80">{d.maxWeight}kg (Act)</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Legend */}
                                        <div className="absolute top-0 right-0 flex gap-4 text-[10px]">
                                            <div className="flex items-center gap-1">
                                                <span className={`w-3 h-1 rounded-full ${isDist ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                                                <span className="text-slate-400">{isDist ? 'Max Distans' : 'Estimerat 1RM'}</span>
                                            </div>
                                            {!isDist && (
                                                <div className="flex items-center gap-1">
                                                    <span className="w-3 h-1 rounded-full bg-emerald-500/50 border-b border-emerald-500 border-dashed"></span>
                                                    <span className="text-slate-400">Faktiskt 1RM</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            const isHistory = viewMode === 'history';
                            const activeData = isHistory
                                ? exerciseHistory.slice(-25)
                                : prProgression.slice(-25);

                            if (activeData.length < (isHistory ? 2 : 1)) {
                                return <p className="text-center text-slate-500 py-8">Inte nog med data för att visa progression.</p>;
                            }

                            // Determine Metric
                            const getMetric = (h: any) => {
                                if (isDistanceBasedExercise(exerciseName)) return h.maxDistance || 0;
                                if (isWeightedDistanceExercise(exerciseName)) return h.maxWeight || 0; // Use maxWeight for sled push
                                return isHistory ? h.est1RM : h.weight;
                            };

                            const getUnit = () => {
                                if (isDistanceBasedExercise(exerciseName)) return 'm';
                                return 'kg';
                            };

                            // Calculate specific bounds for this view
                            const values = activeData.map((h: any) => getMetric(h));
                            const minVal = Math.min(...values);
                            const maxVal = Math.max(...values);

                            const cMin = activeData.length === 1 ? minVal * 0.9 : minVal === maxVal ? minVal * 0.9 : minVal * 0.95;
                            const cMax = minVal === maxVal ? maxVal * 1.1 : maxVal * 1.05;
                            const range = (cMax - cMin) || 1;

                            return (
                                <>
                                    <div className="flex items-end gap-1.5 h-40 mb-6">
                                        {activeData.map((h, i) => {
                                            const val = getMetric(h);

                                            let heightPercent = ((val - cMin) / range) * 100;
                                            if (isNaN(heightPercent) || heightPercent < 15) heightPercent = 15;

                                            // Is this the "best" bar?
                                            // Note: using simple comparison logic
                                            const isBest = val === maxVal;

                                            return (
                                                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group relative h-full">
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md z-20 pointer-events-none border border-white/10 shadow-xl whitespace-nowrap">
                                                        <p className="font-bold">{val} {getUnit()}</p>
                                                        <p className="text-[9px] text-slate-400">{h.date}</p>
                                                    </div>
                                                    <div
                                                        className={`w-full relative transition-all duration-300 group-hover:brightness-110 ${isBest ? (isHistory ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.3)]' : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]') : (isHistory ? 'bg-amber-500/60' : 'bg-emerald-500/60')} border-t border-white/5`}
                                                        style={{
                                                            height: `${heightPercent}%`,
                                                            minWidth: '4px',
                                                            borderRadius: '2px 2px 0 0'
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-500 mt-4 font-mono font-medium">
                                        <span>{activeData[0]?.date}</span>
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${isHistory ? 'bg-amber-500/10 border-amber-500/10 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400'}`}>
                                            <span className={`w-2 h-2 rounded-full animate-pulse ${isHistory ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                                            <span className="font-bold uppercase tracking-wider">
                                                {maxVal} {getUnit()} (Max)
                                            </span>
                                        </div>
                                        <span>{activeData[activeData.length - 1]?.date}</span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-4">
                    {viewMode === 'annual' ? (
                        <div className="text-center p-4 bg-slate-800/30 rounded-xl border border-white/5">
                            <p className="text-xs text-slate-400">
                                Grafern visar ditt starkaste estimerade 1RM (orange) och ditt tyngsta faktiska lyft (grön) för respektive år.
                            </p>
                        </div>
                    ) : viewMode === 'history' ? (
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">📋 All Historik</h3>
                            <div className="bg-slate-800/30 rounded-2xl border border-white/5 overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-950/50 text-[10px] text-slate-400 uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold">Datum</th>
                                                <th className="px-4 py-3 text-right font-bold">Set</th>
                                                {isDistanceBasedExercise(exerciseName) ? (
                                                    <>
                                                        <th className="px-4 py-3 text-right font-bold">Tempo</th>
                                                        <th className="px-4 py-3 text-right font-bold">Distans</th>
                                                        <th className="px-4 py-3 text-right font-bold">Tid</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="px-4 py-3 text-right font-bold">Reps</th>
                                                        <th className="px-4 py-3 text-right font-bold">Max</th>
                                                        <th className="px-4 py-3 text-right font-bold">Volym</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {exerciseHistory.slice().reverse().map(h => (
                                                <tr key={h.date} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => onSelectWorkout?.(h.workout)}
                                                            className="text-white font-mono text-xs hover:text-blue-400 hover:underline transition-colors"
                                                        >
                                                            {h.date}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-400 group-hover:text-white transition-colors">{h.sets}</td>

                                                    {isDistanceBasedExercise(exerciseName) ? (
                                                        <>
                                                            <td className="px-4 py-3 text-right text-blue-400 group-hover:text-blue-300 transition-colors font-mono">
                                                                {h.bestTempo || '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-white font-bold">
                                                                {h.totalDistance ? Math.round(h.totalDistance) + 'm' : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-emerald-400 group-hover:text-emerald-300 transition-colors">
                                                                {h.maxTimeFormatted || '-'}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="px-4 py-3 text-right text-blue-400 group-hover:text-blue-300 transition-colors">{h.reps}</td>
                                                            <td className="px-4 py-3 text-right text-white font-bold">
                                                                {isWeightedDistanceExercise(exerciseName)
                                                                    ? <span>{formatValue(h.maxWeight, h.workout)} <span className="text-slate-500 text-xs font-normal">({h.maxDistance}m)</span></span>
                                                                    : formatValue(h.maxWeight, h.workout)
                                                                }
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-emerald-400 group-hover:text-emerald-300 transition-colors">
                                                                {Math.round(h.volume).toLocaleString()} {isWeightedDistanceExercise(exerciseName) ? 'kg' : 'kg'}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-sm font-bold text-amber-500 uppercase mb-3 px-1 flex items-center gap-2">
                                <span>🏆 Tyngsta lyft (Vikt-PR)</span>
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">{prProgression.length} st</span>
                            </h3>
                            <div className="space-y-3">
                                {(() => {
                                    // Group PRs by date/workout
                                    const groupedPRs = prProgression.reduce((acc, pr) => {
                                        const key = pr.workout.id || pr.date;
                                        if (!acc[key]) acc[key] = [];
                                        acc[key].push(pr);
                                        return acc;
                                    }, {} as Record<string, typeof prProgression>);

                                    const groups = Object.values(groupedPRs);

                                    return (
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                {groups.reverse().map((prs, groupIdx) => {
                                                    const sortedPrs = [...prs].sort((a, b) => (b.weight || 0) - (a.weight || 0));
                                                    const isMulti = prs.length > 1;

                                                    // Calculate days since the PREVIOUS GROUP
                                                    const prevGroup = groups[groups.length - groupIdx - 2];
                                                    let sessionDaysSince = 0;
                                                    if (prevGroup) {
                                                        const d1 = new Date(sortedPrs[0].date);
                                                        const d2 = new Date(prevGroup[0].date);
                                                        sessionDaysSince = Math.round(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
                                                    }

                                                    const sessionHeader = (
                                                        <div className="px-3 py-1.5 flex justify-between items-center bg-slate-900/40">
                                                            <button
                                                                onClick={() => onSelectWorkout?.(sortedPrs[0].workout)}
                                                                className="text-[10px] text-slate-500 font-mono hover:text-blue-400 transition-colors flex items-center gap-1.5"
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                {sortedPrs[0].date}
                                                            </button>
                                                            {sessionDaysSince > 0 && (
                                                                <span className="text-[9px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-white/5">
                                                                    +{sessionDaysSince}d
                                                                </span>
                                                            )}
                                                        </div>
                                                    );

                                                    return (
                                                        <div
                                                            key={groupIdx}
                                                            className={`${isMulti ? 'bg-slate-800/30 border border-white/5 rounded-2xl overflow-hidden' : 'bg-slate-800/20 border-l-2 border-emerald-500 rounded-r-xl overflow-hidden'}`}
                                                        >
                                                            {isMulti && sessionHeader}
                                                            <div className={`${isMulti ? 'p-1 space-y-1' : 'flex items-center justify-between p-2 pl-3'}`}>
                                                                {!isMulti && (
                                                                    <div className="flex items-center gap-3 flex-1">
                                                                        <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-[9px] border border-emerald-500/10">
                                                                            #{prProgression.indexOf(prs[0]) + 1}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] text-slate-500 font-mono leading-none mb-1">{prs[0].date}</p>
                                                                            <div className="flex items-baseline gap-2">
                                                                                <p className="text-sm font-black text-white">{prs[0].weight} kg</p>
                                                                                <p className="text-[9px] text-slate-500 font-bold">{prs[0].reps} reps</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {isMulti && (() => {
                                                                    const mappedSets = sortedPrs.map((s: any) => {
                                                                        const isBW = s.isBodyweight || s.weight === 0;
                                                                        const calcWeight = isBW ? (s.extraWeight || 0) : s.weight;
                                                                        const est1RM = calculate1RM(calcWeight, s.reps);
                                                                        return { ...s, est1RM };
                                                                    });
                                                                    const maxEst1RM = Math.max(...mappedSets.map(s => s.est1RM));

                                                                    return mappedSets.map((pr: any, idx) => {
                                                                        const isBest1eRM = maxEst1RM > 0 && pr.est1RM === maxEst1RM;
                                                                        return (
                                                                            <div key={`${pr.date}-${pr.weight}-${idx}`} className="bg-slate-800/50 hover:bg-slate-800 rounded-xl px-3 py-2 flex items-center justify-between group transition-all">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-[10px] border border-emerald-500/10 flex-shrink-0">
                                                                                        #{prProgression.indexOf(pr) + 1}
                                                                                    </div>
                                                                                    <div>
                                                                                        <div className="flex items-baseline gap-2">
                                                                                            <p className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors leading-none">{pr.weight} kg</p>
                                                                                            <p className="text-[10px] text-slate-500 font-bold">{pr.reps} reps</p>
                                                                                            {isBest1eRM && (
                                                                                                <span className="text-cyan-400 text-[10px]" title="Högsta 1eRM för passet!">⚡</span>
                                                                                            )}
                                                                                        </div>
                                                                                        {((pr.percentIncrease !== undefined && pr.percentIncrease > 0) || pr.daysSinceLast !== undefined) && (
                                                                                            <p className="text-[9px] text-slate-500 font-bold mt-0.5 flex items-center gap-1.5">
                                                                                                {pr.percentIncrease !== undefined && pr.percentIncrease > 0 && (
                                                                                                    <span className="text-emerald-400">+{pr.percentIncrease.toFixed(1)}%</span>
                                                                                                )}
                                                                                                {pr.percentIncrease !== undefined && pr.percentIncrease > 0 && pr.daysSinceLast !== undefined && (
                                                                                                    <span className="opacity-20">•</span>
                                                                                                )}
                                                                                                {pr.daysSinceLast !== undefined && (
                                                                                                    <span>{pr.daysSinceLast}d sedan</span>
                                                                                                )}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className="text-xs font-bold text-emerald-400">{(pr.weight * pr.reps).toLocaleString()} kg</p>
                                                                                    <p className="text-[8px] text-slate-600 font-mono">1eRM: {pr.est1RM} kg</p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    });
                                                                })()}

                                                                {!isMulti && (
                                                                    <div className="text-right flex items-center gap-4">
                                                                        <div className="text-right">
                                                                            <p className="text-xs font-bold text-white leading-none">{((prs[0].weight || 0) * (prs[0].reps || 0)).toLocaleString()}kg</p>
                                                                            <div className="flex flex-col items-end mt-1">
                                                                                <p className="text-[8px] text-slate-500 font-mono">
                                                                                    1eRM: {(() => {
                                                                                        const isBW = prs[0].isBodyweight || prs[0].weight === 0;
                                                                                        const calcWeight = isBW ? (prs[0].extraWeight || 0) : (prs[0].weight || 0);
                                                                                        return calculate1RM(calcWeight, prs[0].reps || 0);
                                                                                    })()}kg
                                                                                </p>
                                                                                {((prs[0].percentIncrease !== undefined && prs[0].percentIncrease > 0) || prs[0].daysSinceLast !== undefined) && (
                                                                                    <p className="text-[8px] text-slate-600 font-bold flex items-center gap-1">
                                                                                        {prs[0].percentIncrease !== undefined && prs[0].percentIncrease > 0 && (
                                                                                            <span className="text-emerald-500/70">+{prs[0].percentIncrease.toFixed(1)}%</span>
                                                                                        )}
                                                                                        {prs[0].daysSinceLast !== undefined && (
                                                                                            <span>{prs[0].daysSinceLast}d</span>
                                                                                        )}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => onSelectWorkout?.(prs[0].workout)}
                                                                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-white transition-all transform hover:scale-110"
                                                                        >
                                                                            →
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                                {prProgression.length === 0 && (
                                    <p className="text-center text-slate-500 py-12 bg-slate-800/30 rounded-2xl border border-dashed border-white/10">Inga PR-data hittades.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
}
