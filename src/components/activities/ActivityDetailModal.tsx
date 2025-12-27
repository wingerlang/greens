import React, { useState, useEffect } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { StrengthWorkout } from '../../models/strengthTypes.ts';
import { useData } from '../../context/DataContext.tsx';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { formatDuration, formatPace } from '../../utils/dateUtils.ts';
import { calculatePerformanceScore, calculateGAP } from '../../utils/performanceEngine.ts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

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
    const [activeTab, setActiveTab] = useState<'stats' | 'compare' | 'splits'>('stats');
    const { exerciseEntries, universalActivities } = useData();

    const perf = universalActivity?.performance || activity._mergeData?.universalActivity?.performance;
    const mergeData = activity._mergeData;
    const isMerged = activity.source === 'merged' && mergeData;
    const strengthWorkout = mergeData?.strengthWorkout;

    // Derived splits helper
    const splits = perf?.splits || [];
    const hasSplits = splits.length > 0;

    // Find similar activities for comparison
    const similarActivities = React.useMemo(() => {
        if (!activity.type) return [];

        // Combine manual entries with mapped universal activities
        const stravaEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        const allActivities = [...exerciseEntries, ...stravaEntries];

        return allActivities
            .filter(a =>
                a.id !== activity.id &&
                (a.type?.toLowerCase() === activity.type?.toLowerCase()) &&
                activity.distance && a.distance &&
                Math.abs(a.distance - activity.distance) < (activity.distance * 0.25) // Slightly wider 25% tolerance
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);
    }, [activity, exerciseEntries, universalActivities]);

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

                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'stats' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                    >
                        Statistik
                    </button>
                    {activity.distance && (
                        <button
                            onClick={() => setActiveTab('compare')}
                            className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'compare' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Jämför
                        </button>
                    )}
                    {hasSplits && (
                        <button
                            onClick={() => setActiveTab('splits')}
                            className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'splits' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Splits
                        </button>
                    )}
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
                                        <td className="px-4 py-3 text-center text-slate-300">{formatDuration((mergeData.strength?.durationMinutes || 60) * 60)}</td>
                                        <td className="px-4 py-3 text-center text-slate-300">{formatDuration((mergeData.strava?.durationMinutes || 0) * 60)}</td>
                                        <td className="px-4 py-3 text-right text-emerald-400 font-bold">{formatDuration(activity.durationMinutes * 60)} ✓</td>
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
                {(viewMode === 'combined' || !isMerged) && activeTab === 'stats' && (
                    <>
                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-white">{activity.durationMinutes > 0 ? formatDuration(activity.durationMinutes * 60) : '-'}</p>
                                <p className="text-xs text-slate-500 uppercase">Tid</p>
                            </div>

                            {/* Distance (Only if running/has value) */}
                            {(activity.distance && activity.distance > 0) ? (
                                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-emerald-400">{activity.distance.toFixed(1)}</p>
                                    <p className="text-xs text-slate-500 uppercase">Km</p>
                                </div>
                            ) : null}

                            {/* Tonnage (Only if strength/has value) */}
                            {(activity.tonnage && activity.tonnage > 0) ? (
                                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-purple-400">{(activity.tonnage / 1000).toFixed(1)}</p>
                                    <p className="text-xs text-slate-500 uppercase">Ton</p>
                                </div>
                            ) : null}

                            <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-indigo-400">{calculatePerformanceScore(activity)}</p>
                                <p className="text-xs text-slate-500 uppercase">Greens Score</p>
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

                        {/* Elevation & Performance (GAP) */}
                        <div className="grid grid-cols-2 gap-4">
                            {perf?.elevationGain && perf.elevationGain > 0 && (
                                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4">
                                    <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">⛰️ Höjdmeter</h3>
                                    <span className="text-2xl font-black text-white">{Math.round(perf.elevationGain)}</span>
                                    <span className="text-xs text-slate-400 ml-1">m</span>
                                </div>
                            )}
                            {activity.distance && activity.elevationGain && activity.elevationGain > 0 && (
                                <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4">
                                    <h3 className="text-xs font-bold text-indigo-400 uppercase mb-2">📈 Effektivt Tempo (GAP)</h3>
                                    <span className="text-2xl font-black text-white">
                                        {formatPace(calculateGAP((activity.durationMinutes * 60) / activity.distance, activity.elevationGain, activity.distance))}
                                    </span>
                                    <span className="text-xs text-slate-400 ml-1">/km</span>
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {(activity.notes || perf?.notes) && (
                            <div className="bg-slate-800/50 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">📝 Anteckning</h3>
                                <p className="text-white">{activity.notes || perf?.notes}</p>
                            </div>
                        )}
                    </>
                )}

                {/* COMPARISON TAB */}
                {activeTab === 'compare' && (
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase">⚖️ Jämför med liknande pass</h3>

                        {similarActivities.length > 0 ? (
                            <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950/50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-slate-500">Datum</th>
                                            <th className="px-4 py-2 text-right text-slate-500">Distans</th>
                                            <th className="px-4 py-2 text-right text-slate-500">Tempo</th>
                                            <th className="px-4 py-2 text-right text-slate-500">Puls</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        <tr className="bg-indigo-500/10">
                                            <td className="px-4 py-3 text-white font-bold">Detta pass</td>
                                            <td className="px-4 py-3 text-right text-white font-bold">{activity.distance} km</td>
                                            <td className="px-4 py-3 text-right text-white font-bold">
                                                {activity.distance ? formatPace((activity.durationMinutes * 60) / activity.distance) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-white font-bold">{perf?.avgHeartRate ? Math.round(perf.avgHeartRate) : '-'}</td>
                                        </tr>
                                        {similarActivities.map(a => {
                                            const aPaceSec = a.distance ? (a.durationMinutes * 60 / a.distance) : 0;
                                            return (
                                                <tr key={a.id}>
                                                    <td className="px-4 py-3 text-slate-400">{a.date.split('T')[0]}</td>
                                                    <td className="px-4 py-3 text-right text-slate-300">{a.distance} km</td>
                                                    <td className="px-4 py-3 text-right text-slate-300">
                                                        {aPaceSec ? formatPace(aPaceSec) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-slate-300">{a.heartRateAvg || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-500 italic">Inga liknande pass hittades för jämförelse.</div>
                        )}
                    </div>
                )}

                {/* SPLITS TAB */}
                {activeTab === 'splits' && (
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase">⏱️ Kilometertider</h3>

                        {/* Split Chart */}
                        <div className="h-48 bg-slate-800/30 rounded-xl p-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={splits.map((s: any, i: number) => ({
                                    km: `Km ${i + 1}`,
                                    seconds: s.movingTime,
                                    pace: (s.movingTime / 60).toFixed(2)
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                    <XAxis dataKey="km" stroke="#64748b" fontSize={10} />
                                    <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }}
                                        labelStyle={{ color: '#94a3b8' }}
                                        formatter={(val: number) => [`${Math.floor(val / 60)}:${(val % 60).toString().padStart(2, '0')}`, 'Tempo']}
                                    />
                                    <Bar dataKey="seconds" fill="#6366f1" radius={[4, 4, 0, 0]} minPointSize={2} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Split Table */}
                        <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-950/50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-slate-500">Splitt</th>
                                        <th className="px-4 py-2 text-right text-slate-500">Tid</th>
                                        <th className="px-4 py-2 text-right text-slate-500">Tempo</th>
                                        <th className="px-4 py-2 text-right text-slate-500">Puls</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {splits.map((s: any, i: number) => {
                                        const splitPace = s.movingTime / (s.distance / 1000);
                                        return (
                                            <tr key={i}>
                                                <td className="px-4 py-3 text-white font-bold">{i + 1} km</td>
                                                <td className="px-4 py-3 text-right text-slate-300">
                                                    {Math.floor(s.movingTime / 60)}:{(s.movingTime % 60).toString().padStart(2, '0')}
                                                </td>
                                                <td className="px-4 py-3 text-right text-indigo-400">
                                                    {Math.floor(splitPace / 60)}:{(Math.round(splitPace % 60)).toString().padStart(2, '0')} /km
                                                </td>
                                                <td className="px-4 py-3 text-right text-rose-400">
                                                    {s.averageHeartrate || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
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
                        onClick={() => {
                            window.location.href = `/workouts/builder?fromActivity=${activity.id}`;
                        }}
                        className={`flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20`}
                    >
                        ⚡ Spara som Pass
                    </button>
                    <button
                        onClick={onClose}
                        className={`${isMerged && onSeparate ? 'flex-1' : 'flex-1'} bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors`}
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
