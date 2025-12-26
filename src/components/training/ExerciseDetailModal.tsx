import React, { useState, useMemo, useEffect } from 'react';
import { StrengthWorkout, PersonalBest, StrengthStats, calculate1RM, normalizeExerciseName } from '../../models/strengthTypes.ts';

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

    const [viewMode, setViewMode] = useState<'history' | 'prs'>('history');

    // Get all instances of this exercise across workouts
    const exerciseHistory = useMemo(() => {
        const history: { date: string; sets: number; reps: number; maxWeight: number; volume: number; est1RM: number; workout: StrengthWorkout }[] = [];

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
                const volume = exerciseEntries.reduce((sum, e) => sum + (e.totalVolume || 0), 0);

                // Find best set for 1RM estimate (bodyweight aware)
                const est1RMs = allSets.map(s => {
                    const isBW = s.isBodyweight || s.weight === 0;
                    const calcWeight = isBW ? (s.extraWeight || 0) : s.weight;
                    return calculate1RM(calcWeight, s.reps);
                });
                const best1RMValue = Math.max(...est1RMs);

                history.push({
                    date: w.date,
                    sets: allSets.length,
                    reps: totalReps,
                    maxWeight,
                    volume,
                    est1RM: Math.round(best1RMValue),
                    workout: w
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
        return exerciseHistory.reduce((prev, curr) => (curr.est1RM > prev.est1RM ? curr : prev), exerciseHistory[0]);
    }, [exerciseHistory]);
    const best1RM = bestRecord?.est1RM || 0;

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
                        <p className="text-lg font-black text-white text-blue-400">{totalVolume > 1000 ? (totalVolume / 1000).toFixed(1) + 't' : totalVolume + 'kg'}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Total Volym</p>
                    </div>
                    <button
                        onClick={() => maxRecord && onSelectWorkout?.(maxRecord.workout)}
                        className="bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-2.5 text-center group/pb transition-all active:scale-[0.98]"
                    >
                        <p className="text-lg font-black text-emerald-400 group-hover/pb:text-emerald-300 transition-colors">{maxEver} kg</p>
                        <p className="text-[9px] text-emerald-500 uppercase font-bold flex items-center justify-center gap-1">
                            Max (1RM)
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
                                    <span>📈 Progression (1eRM)</span>
                                    <span className="text-[10px] text-slate-500 font-normal normal-case italic">(estimerat 1RM)</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-amber-500">🏆 Progression (1RM)</span>
                                    <span className="text-[10px] text-slate-500 font-normal normal-case italic">(faktiska rekordvikter)</span>
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
                        </div>
                    </div>

                    <div className="bg-slate-800/30 rounded-2xl p-6 border border-white/5">
                        {(() => {
                            const isHistory = viewMode === 'history';
                            const activeData = isHistory
                                ? exerciseHistory.slice(-25)
                                : prProgression.slice(-25);

                            if (activeData.length < (isHistory ? 2 : 1)) {
                                return <p className="text-center text-slate-500 py-8">Inte nog med data för att visa progression.</p>;
                            }

                            // Calculate specific bounds for this view
                            const values = activeData.map((h: any) => isHistory ? h.est1RM : h.weight);
                            const minVal = Math.min(...values);
                            const maxVal = Math.max(...values);

                            const cMin = activeData.length === 1 ? minVal * 0.9 : minVal === maxVal ? minVal * 0.9 : minVal * 0.95;
                            const cMax = minVal === maxVal ? maxVal * 1.1 : maxVal * 1.05;
                            const range = (cMax - cMin) || 1;

                            return (
                                <>
                                    <div className="flex items-end gap-1.5 h-40 mb-6">
                                        {activeData.map((h, i) => {
                                            const val = isHistory ? (h as any).est1RM : (h as any).weight;

                                            let heightPercent = ((val - cMin) / range) * 100;
                                            if (isNaN(heightPercent) || heightPercent < 15) heightPercent = 15;

                                            const isBest = isHistory
                                                ? (h as any).est1RM === best1RM
                                                : (h as any).weight === maxEver;

                                            return (
                                                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 group relative h-full">
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md z-20 pointer-events-none border border-white/10 shadow-xl whitespace-nowrap">
                                                        <p className="font-bold">{val} kg {isHistory ? '(1eRM)' : '(Vikt)'}</p>
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
                                                {isHistory ? `Bästa 1eRM: ${best1RM} kg` : `Max-lyft: ${maxEver} kg`}
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
                    {viewMode === 'history' ? (
                        <div>
                            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">📋 All Historik</h3>
                            <div className="bg-slate-800/30 rounded-2xl border border-white/5 overflow-hidden">
                                <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-950/50 text-[10px] text-slate-400 uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold">Datum</th>
                                                <th className="px-4 py-3 text-right font-bold">Set</th>
                                                <th className="px-4 py-3 text-right font-bold">Reps</th>
                                                <th className="px-4 py-3 text-right font-bold">Max</th>
                                                <th className="px-4 py-3 text-right font-bold">Volym</th>
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
                                                    <td className="px-4 py-3 text-right text-blue-400 group-hover:text-blue-300 transition-colors">{h.reps}</td>
                                                    <td className="px-4 py-3 text-right text-white font-bold">{h.maxWeight} kg</td>
                                                    <td className="px-4 py-3 text-right text-emerald-400 group-hover:text-emerald-300 transition-colors">{Math.round(h.volume).toLocaleString()} kg</td>
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
            </div>
        </div>
    );
}
