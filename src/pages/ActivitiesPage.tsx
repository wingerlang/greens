import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { ExerciseEntry, UniversalActivity } from '../models/types.ts';
import { StrengthWorkout } from '../models/strengthTypes.ts';

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

// Activity Detail Modal Component
function ActivityDetailModal({
    activity,
    universalActivity,
    onClose,
    onSeparate
}: {
    activity: ExerciseEntry & { source: string; _mergeData?: any };
    universalActivity?: UniversalActivity;
    onClose: () => void;
    onSeparate?: () => void;
}) {
    const [viewMode, setViewMode] = useState<'combined' | 'diff'>('combined');
    const perf = universalActivity?.performance || activity._mergeData?.universalActivity?.performance;
    const mergeData = activity._mergeData;
    const isMerged = activity.source === 'merged' && mergeData;
    const strengthWorkout = mergeData?.strengthWorkout;

    // ESC to close
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl"
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
                        <div className="grid grid-cols-3 gap-4">
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
                                <div className="space-y-1 max-h-64 overflow-y-auto">
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

export function ActivitiesPage() {
    const { universalActivities, exerciseEntries: localEntries } = useData();
    const { token } = useAuth();
    const [filter, setFilter] = useState('all');
    const [selectedActivity, setSelectedActivity] = useState<(ExerciseEntry & { source: string }) | null>(null);
    const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([]);

    // Fetch strength data
    const fetchStrength = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/strength/workouts', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setStrengthWorkouts(data.workouts || []);
            }
        } catch (e) {
            console.error('Failed to fetch strength workouts:', e);
        }
    }, [token]);

    useEffect(() => {
        fetchStrength();
    }, [fetchStrength]);

    const allActivities = useMemo(() => {
        const serverEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        const normalizedServer = serverEntries.map(e => ({ ...e, source: 'strava' }));
        const normalizedLocal = localEntries.map(e => ({ ...e, source: 'manual' }));

        // Convert strength workouts to ExerciseEntry format
        const strengthEntries = strengthWorkouts.map(w => ({
            id: w.id,
            date: w.date,
            type: 'strength' as const,
            durationMinutes: w.duration || 60,
            intensity: 'moderate' as const,
            caloriesBurned: 0, // Not tracked in StrengthLog
            distance: undefined,
            notes: w.name,
            source: 'strength',
            createdAt: w.createdAt
        }));
        // Smart Merge: Combine StrengthLog with Strava data (pulse, calories, etc.)
        // Create a map of Strava weight training by date for merging
        const stravaWeightByDate = new Map<string, typeof normalizedServer[0]>();
        normalizedServer.forEach(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength');
            if (isWeightTraining) {
                stravaWeightByDate.set(e.date, e);
            }
        });

        // Merge Strava data into strength entries where available
        // KEEP BOTH SOURCES for diffing and undo capability
        const mergedStrengthEntries = strengthEntries.map(se => {
            const stravaMatch = stravaWeightByDate.get(se.date);
            if (stravaMatch) {
                // Find the original universal activity for HR data using the Strava entry's id
                const universalMatch = universalActivities.find(u => u.id === stravaMatch.id);
                const perf = universalMatch?.performance;

                // Find the original strength workout for exercise details
                const strengthWorkout = strengthWorkouts.find(sw => sw.date === se.date);

                return {
                    ...se,
                    source: 'merged' as const,
                    // Combined data - prefer most accurate source for each field
                    caloriesBurned: stravaMatch.caloriesBurned || se.caloriesBurned,
                    durationMinutes: stravaMatch.durationMinutes || se.durationMinutes, // Strava = GPS timing
                    avgHeartRate: perf?.avgHeartRate,
                    maxHeartRate: perf?.maxHeartRate,
                    // STORE ORIGINALS for diffing/undo
                    _mergeData: {
                        strava: stravaMatch,
                        strength: se,
                        strengthWorkout: strengthWorkout,
                        universalActivity: universalMatch,
                        // Quick diff info
                        diffs: {
                            duration: stravaMatch.durationMinutes !== se.durationMinutes
                                ? { strava: stravaMatch.durationMinutes, strength: se.durationMinutes }
                                : null,
                            calories: stravaMatch.caloriesBurned !== se.caloriesBurned
                                ? { strava: stravaMatch.caloriesBurned, strength: se.caloriesBurned }
                                : null,
                        },
                        hasStravaPulse: !!(perf?.avgHeartRate || perf?.maxHeartRate),
                        hasStrengthExercises: !!(strengthWorkout?.exercises?.length),
                    }
                };
            }
            return se;
        });

        // Filter OUT Strava weight training that we merged (to avoid duplicates)
        const deduplicatedServer = normalizedServer.filter(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength');
            if (isWeightTraining && strengthWorkouts.some(sw => sw.date === e.date)) {
                return false; // We merged this into StrengthLog entry
            }
            return true;
        });

        return [...deduplicatedServer, ...normalizedLocal, ...mergedStrengthEntries].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [universalActivities, localEntries, strengthWorkouts]);

    const filteredActivities = allActivities.filter(a => {
        if (filter === 'strava') return a.source === 'strava';
        if (filter === 'manual') return a.source === 'manual';
        if (filter === 'strength') return a.source === 'strength';
        return true;
    });

    // Find corresponding UniversalActivity for the selected item
    const selectedUniversal = selectedActivity
        ? universalActivities.find(u => u.id === selectedActivity.id)
        : undefined;

    const stravaCount = allActivities.filter(a => a.source === 'strava').length;
    const manualCount = allActivities.filter(a => a.source === 'manual').length;
    const strengthCount = allActivities.filter(a => a.source === 'strength').length;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2">Aktivitetslogg</h1>
                    <p className="text-slate-400">Alla dina pass, samlade på ett ställe.</p>
                </div>
                <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                        Alla ({allActivities.length})
                    </button>
                    <button
                        onClick={() => setFilter('strava')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'strava' ? 'bg-[#FC4C02] text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Strava ({stravaCount})
                    </button>
                    <button
                        onClick={() => setFilter('strength')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'strength' ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        💪 Styrka ({strengthCount})
                    </button>
                    <button
                        onClick={() => setFilter('manual')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'manual' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Manuella ({manualCount})
                    </button>
                </div>
            </header>

            <div className="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500 border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Datum</th>
                            <th className="px-6 py-4">Typ</th>
                            <th className="px-6 py-4">Källa</th>
                            <th className="px-6 py-4 text-right">Tid</th>
                            <th className="px-6 py-4 text-right">Distans</th>
                            <th className="px-6 py-4 text-right">Kalorier</th>
                            <th className="px-6 py-4">Notering</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredActivities.map((activity, i) => (
                            <tr
                                key={activity.id || i}
                                className="hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => setSelectedActivity(activity)}
                            >
                                <td className="px-6 py-4 font-mono text-white">
                                    {activity.date}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="capitalize text-white font-bold">{activity.type}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {activity.source === 'strava' ? (
                                        <span className="inline-flex items-center gap-1 text-[#FC4C02] font-bold text-[10px] uppercase tracking-wider bg-[#FC4C02]/10 px-2 py-1 rounded">
                                            🔥 Strava
                                        </span>
                                    ) : activity.source === 'merged' ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px] uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded">
                                            ⚡ SL+Strava
                                        </span>
                                    ) : activity.source === 'strength' ? (
                                        <span className="inline-flex items-center gap-1 text-purple-400 font-bold text-[10px] uppercase tracking-wider bg-purple-500/10 px-2 py-1 rounded">
                                            💪 StrengthLog
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-blue-400 font-bold text-[10px] uppercase tracking-wider bg-blue-500/10 px-2 py-1 rounded">
                                            ✏️ Manuell
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-300">
                                    {activity.durationMinutes} min
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-300">
                                    {activity.distance ? `${activity.distance} km` : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-rose-400">
                                    {activity.caloriesBurned} kcal
                                </td>
                                <td className="px-6 py-4 text-xs italic opacity-50 truncate max-w-[200px]">
                                    {activity.notes}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredActivities.length === 0 && (
                    <div className="p-12 text-center text-slate-500 italic">
                        Inga aktiviteter hittades.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedActivity && (
                <ActivityDetailModal
                    activity={selectedActivity}
                    universalActivity={selectedUniversal}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}

