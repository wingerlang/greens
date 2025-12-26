import React, { useState, useEffect } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { StrengthWorkout } from '../../models/strengthTypes.ts';

// Expandable Exercise Component - click to show sets
function ExpandableExercise({ exercise }: { exercise: any }) {
    const [expanded, setExpanded] = useState(false);
    const totalReps = exercise.sets.reduce((s: number, set: any) => s + set.reps, 0);
    const volume = exercise.totalVolume || 0;

    return (
        <div className="bg-slate-800/30 rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex justify-between items-center text-sm px-3 py-2 hover:bg-slate-700/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">{expanded ? '▼' : '▶'}</span>
                    <span className="text-white font-bold truncate">{exercise.exerciseName}</span>
                </div>
                <div className="flex gap-3 text-xs text-slate-400">
                    <span>{exercise.sets.length} set</span>
                    <span className="text-blue-400">{totalReps} reps</span>
                    {volume > 0 && <span className="text-emerald-400">{Math.round(volume / 1000)}t kg</span>}
                </div>
            </button>
            {expanded && (
                <div className="px-3 pb-2 space-y-1 border-t border-white/5">
                    {exercise.sets.map((set: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 text-slate-400">
                            <span className="text-slate-500">Set {i + 1}</span>
                            <div className="flex gap-4">
                                <span className="text-white font-mono">{set.weight} kg</span>
                                <span className="text-blue-400">× {set.reps}</span>
                                {set.rpe && <span className="text-amber-400">RPE {set.rpe}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export interface ActivityDetailModalProps {
    activity: ExerciseEntry & { source: string; _mergeData?: any };
    universalActivity?: UniversalActivity;
    onClose: () => void;
    onSeparate?: () => void;
}

// Activity Detail Modal Component
export function ActivityDetailModal({
    activity,
    universalActivity,
    onClose,
    onSeparate
}: ActivityDetailModalProps) {
    const [viewMode, setViewMode] = useState<'combined' | 'diff'>('combined');
    const perf = universalActivity?.performance || activity._mergeData?.universalActivity?.performance;
    const mergeData = activity._mergeData;
    const isMerged = activity.source === 'merged' && mergeData;
    const strengthWorkout = mergeData?.strengthWorkout;

    // ESC to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white capitalize">{activity.type}</h2>
                        <p className="text-slate-400 font-mono">{activity.date}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl">×</button>
                </div>

                {/* Source Badge + View Toggle for Merged */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    {activity.source === 'strava' && (
                        <div className="inline-flex items-center gap-2 bg-[#FC4C02]/20 text-[#FC4C02] px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                            <span>🔥</span> Synkad från Strava
                        </div>
                    )}
                    {activity.source === 'strength' && (
                        <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                            <span>💪</span> StrengthLog
                        </div>
                    )}
                    {isMerged && (
                        <>
                            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                                <span>⚡</span> StrengthLog + Strava
                            </div>
                            {/* View Mode Toggle */}
                            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('combined')}
                                    className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'combined' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    📊 Kombinerat
                                </button>
                                <button
                                    onClick={() => setViewMode('diff')}
                                    className={`px-3 py-1 text-xs font-bold rounded ${viewMode === 'diff' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    ⚖️ Diff
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* DIFF VIEW */}
                {isMerged && viewMode === 'diff' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-amber-400 uppercase">⚖️ Jämförelse mellan källor</h3>
                        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-950/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-slate-500">Fält</th>
                                        <th className="px-4 py-2 text-center text-purple-400">💪 StrengthLog</th>
                                        <th className="px-4 py-2 text-center text-[#FC4C02]">🔥 Strava</th>
                                        <th className="px-4 py-2 text-right text-slate-500">Valt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    <tr>
                                        <td className="px-4 py-3 text-white">⏱️ Tid</td>
                                        <td className="px-4 py-3 text-center text-slate-300">{mergeData.strength?.durationMinutes || 60} min</td>
                                        <td className="px-4 py-3 text-center text-slate-300">{mergeData.strava?.durationMinutes || '-'} min</td>
                                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">{activity.durationMinutes} min ✓</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-white">🔥 Kalorier</td>
                                        <td className="px-4 py-3 text-center text-slate-500">-</td>
                                        <td className="px-4 py-3 text-center text-slate-300">{mergeData.strava?.caloriesBurned || '-'} kcal</td>
                                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">{activity.caloriesBurned || '-'} ✓</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-white">❤️ Snitt puls</td>
                                        <td className="px-4 py-3 text-center text-slate-500">-</td>
                                        <td className="px-4 py-3 text-center text-slate-300">{perf?.avgHeartRate ? Math.round(perf.avgHeartRate) : '-'} bpm</td>
                                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">{perf?.avgHeartRate ? `${Math.round(perf.avgHeartRate)} bpm ✓` : '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-white">💪 Övningar</td>
                                        <td className="px-4 py-3 text-center text-emerald-400 font-bold">{strengthWorkout?.uniqueExercises || 0} st ✓</td>
                                        <td className="px-4 py-3 text-center text-slate-500">-</td>
                                        <td className="px-4 py-3 text-right text-emerald-400">{strengthWorkout?.uniqueExercises || 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 text-white">🎯 Set</td>
                                        <td className="px-4 py-3 text-center text-emerald-400 font-bold">{strengthWorkout?.totalSets || 0} ✓</td>
                                        <td className="px-4 py-3 text-center text-slate-500">-</td>
                                        <td className="px-4 py-3 text-right text-emerald-400">{strengthWorkout?.totalSets || 0}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-slate-500">
                            ✓ = Vald källa för fältet. Strava används för puls/kalorier/tid, StrengthLog för övningar/set.
                        </p>
                    </div>
                )}

                {/* COMBINED VIEW */}
                {(viewMode === 'combined' || !isMerged) && (
                    <>
                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-white">{activity.durationMinutes}</p>
                                <p className="text-xs text-slate-500 uppercase">Minuter</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-emerald-400">{activity.distance || '-'}</p>
                                <p className="text-xs text-slate-500 uppercase">Km</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-rose-400">{activity.caloriesBurned || '-'}</p>
                                <p className="text-xs text-slate-500 uppercase">Kcal</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-indigo-400">{activity.tonnage ? (activity.tonnage / 1000).toFixed(1) : '-'}</p>
                                <p className="text-xs text-slate-500 uppercase">Ton</p>
                            </div>
                        </div>

                        {/* Heart Rate (if available) */}
                        {(perf?.avgHeartRate || perf?.maxHeartRate) && (
                            <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-red-400 uppercase mb-2">❤️ Puls {isMerged && <span className="text-slate-500">(från Strava)</span>}</h3>
                                <div className="flex gap-6">
                                    {perf?.avgHeartRate && (
                                        <div>
                                            <span className="text-2xl font-black text-white">{Math.round(perf.avgHeartRate)}</span>
                                            <span className="text-xs text-slate-400 ml-1">snitt bpm</span>
                                        </div>
                                    )}
                                    {perf?.maxHeartRate && (
                                        <div>
                                            <span className="text-2xl font-black text-red-400">{Math.round(perf.maxHeartRate)}</span>
                                            <span className="text-xs text-slate-400 ml-1">max bpm</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Exercises from StrengthLog (if merged/strength) */}
                        {strengthWorkout?.exercises && strengthWorkout.exercises.length > 0 && (
                            <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-purple-400 uppercase mb-3">💪 Övningar {isMerged && <span className="text-slate-500">(från StrengthLog)</span>}</h3>
                                <div className="space-y-1 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {strengthWorkout.exercises
                                        .filter((ex: any) => ex.totalVolume > 0 || ex.sets.length > 0)
                                        .map((ex: any, i: number) => (
                                            <ExpandableExercise key={i} exercise={ex} />
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Elevation (if available) */}
                        {perf?.elevationGain && perf.elevationGain > 0 && (
                            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">⛰️ Höjdmeter</h3>
                                <span className="text-2xl font-black text-white">{Math.round(perf.elevationGain)}</span>
                                <span className="text-xs text-slate-400 ml-1">m</span>
                            </div>
                        )}

                        {/* Notes */}
                        {(activity.notes || perf?.notes) && (
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">📝 Anteckning</h3>
                                <p className="text-white">{activity.notes || perf?.notes}</p>
                            </div>
                        )}
                    </>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {isMerged && onSeparate && (
                        <button
                            onClick={onSeparate}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            🔀 Separera
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className={`${isMerged && onSeparate ? 'flex-1' : 'w-full'} bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors`}
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
