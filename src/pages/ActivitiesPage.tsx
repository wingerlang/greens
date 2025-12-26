import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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

export function ActivitiesPage() {
    const { universalActivities, exerciseEntries: localEntries } = useData();
    const { token } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Core State
    const [selectedActivity, setSelectedActivity] = useState<(ExerciseEntry & { source: string }) | null>(null);
    const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    // We now support preset filters: 'all', '7d', '30d', '6m', 'year' or specific year '2025'
    const [datePreset, setDatePreset] = useState<string>('all');

    // Advanced numeric ranges
    const [minDist, setMinDist] = useState('');
    const [maxDist, setMaxDist] = useState('');
    const [minTime, setMinTime] = useState('');
    const [maxTime, setMaxTime] = useState('');

    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // 1. Fetch strength data
    const fetchStrength = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch('http://localhost:8000/api/strength/workouts', { headers: { Authorization: `Bearer ${token}` } });
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

    // 2. Prepare Unified List
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
            caloriesBurned: 0,
            distance: undefined,
            tonnage: w.totalVolume,
            notes: w.name,
            source: 'strength',
            createdAt: w.createdAt,
            subType: undefined,
            externalId: undefined
        }));

        // Smart Merge: Combine StrengthLog with Strava data
        const stravaWeightByDate = new Map<string, typeof normalizedServer[0]>();
        normalizedServer.forEach(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength');
            if (isWeightTraining) {
                stravaWeightByDate.set(e.date.split('T')[0], e);
            }
        });

        const mergedStrengthEntries = strengthEntries.map(se => {
            const dateKey = se.date.split('T')[0];
            const stravaMatch = stravaWeightByDate.get(dateKey);

            if (stravaMatch) {
                const universalMatch = universalActivities.find(u => u.id === stravaMatch.id);
                const perf = universalMatch?.performance;
                const strengthWorkout = strengthWorkouts.find(sw => sw.id === se.id);

                return {
                    ...se,
                    source: 'merged' as const,
                    caloriesBurned: stravaMatch.caloriesBurned || se.caloriesBurned,
                    durationMinutes: stravaMatch.durationMinutes || se.durationMinutes,
                    avgHeartRate: perf?.avgHeartRate,
                    maxHeartRate: perf?.maxHeartRate,
                    subType: stravaMatch.subType, // Propagate subtype from Strava
                    _mergeData: {
                        strava: stravaMatch,
                        strength: se,
                        strengthWorkout: strengthWorkout,
                        universalActivity: universalMatch,
                    }
                };
            }
            return se;
        });

        const deduplicatedServer = normalizedServer.filter(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength');
            if (isWeightTraining) {
                const dateKey = e.date.split('T')[0];
                if (strengthEntries.some(se => se.date.split('T')[0] === dateKey)) {
                    return false;
                }
            }
            return true;
        });

        return [...deduplicatedServer, ...normalizedLocal, ...mergedStrengthEntries];
    }, [universalActivities, localEntries, strengthWorkouts]);

    // 3. Deep Linking Logic
    useEffect(() => {
        const linkedId = searchParams.get('activityId');
        if (linkedId && allActivities.length > 0) {
            const match = allActivities.find(a => a.id === linkedId);
            if (match) {
                setSelectedActivity(match);
            }
        }
    }, [searchParams, allActivities]);

    // Update URL when opening/closing modal
    const handleSetSelectedActivity = (activity: (ExerciseEntry & { source: string }) | null) => {
        setSelectedActivity(activity);
        if (activity) {
            setSearchParams({ activityId: activity.id });
        } else {
            setSearchParams({});
        }
    };

    // Derived Years for Dropdown
    const availableYears = useMemo(() => {
        const years = new Set(allActivities.map(a => new Date(a.date).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [allActivities]);


    // 4. FILTER & SORT LOGIC
    const processedActivities = useMemo(() => {
        let result = allActivities.filter(a => {
            // Source Filter
            if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;

            // Date Preset & Year Filter overlap handling
            // Priority: if datePreset is 'year', check current year. if specific year string (e.g. '2023'), check that.
            // If datePreset is '7d', '30d', etc check ranges.
            const date = new Date(a.date);
            const now = new Date();

            if (datePreset === '7d') {
                const limit = new Date();
                limit.setDate(now.getDate() - 7);
                if (date < limit) return false;
            } else if (datePreset === '30d') {
                const limit = new Date();
                limit.setDate(now.getDate() - 30);
                if (date < limit) return false;
            } else if (datePreset === '6m') {
                const limit = new Date();
                limit.setMonth(now.getMonth() - 6);
                if (date < limit) return false;
            } else if (datePreset === 'year') {
                if (date.getFullYear() !== now.getFullYear()) return false;
            } else if (datePreset !== 'all') {
                // Must be a specific year (string)
                if (date.getFullYear() !== parseInt(datePreset)) return false;
            }

            // Search
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchName = a.type.toLowerCase().includes(q);
                const matchNotes = a.notes?.toLowerCase().includes(q) || false;
                if (!matchName && !matchNotes) return false;
            }

            // Advanced Ranges
            if (minDist && (a.distance || 0) < parseFloat(minDist)) return false;
            if (maxDist && (a.distance || 0) > parseFloat(maxDist)) return false;
            if (minTime && a.durationMinutes < parseFloat(minTime)) return false;
            if (maxTime && a.durationMinutes > parseFloat(maxTime)) return false;

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            let valA: any = a[sortConfig.key as keyof ExerciseEntry];
            let valB: any = b[sortConfig.key as keyof ExerciseEntry];

            // Special cases
            if (sortConfig.key === 'tonnage') {
                valA = a.tonnage || 0;
                valB = b.tonnage || 0;
            }

            if (valA === undefined) valA = 0;
            if (valB === undefined) valB = 0;

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [allActivities, sortConfig, searchQuery, sourceFilter, datePreset, minDist, maxDist, minTime, maxTime]);


    // Handlers
    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const SortIcon = ({ colKey }: { colKey: string }) => {
        if (sortConfig.key !== colKey) return <span className="opacity-20 ml-1">⇅</span>;
        return <span className="text-emerald-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const selectedUniversal = selectedActivity
        ? universalActivities.find(u => u.id === selectedActivity.id)
        : undefined;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col gap-6">
                <div className="flex justify-between items-end flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">Aktivitetslogg</h1>
                        <p className="text-slate-400">
                            Visar <span className="text-emerald-400 font-bold">{processedActivities.length}</span> av <span className="text-slate-500">{allActivities.length}</span> aktiviteter.
                        </p>
                    </div>
                </div>

                {/* SEARCH & FILTERS BAR */}
                <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search Input */}
                        <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                            <input
                                type="text"
                                placeholder="Sök på aktivitet, notering..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                            />
                        </div>

                        {/* Source Toggles */}
                        <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 overflow-x-auto">
                            {[
                                { id: 'all', label: 'Alla' },
                                { id: 'strava', label: 'Strava' },
                                { id: 'strength', label: 'Styrka' },
                                { id: 'manual', label: 'Manuell' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setSourceFilter(opt.id)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase whitespace-nowrap transition-all ${sourceFilter === opt.id
                                        ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Filter Toggle Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-bold transition-all ${showFilters
                                ? 'bg-slate-800 border-emerald-500/50 text-white'
                                : 'bg-slate-950 border-white/5 text-slate-400 hover:border-white/20'
                                }`}
                        >
                            <span>⚡</span> Filter {showFilters ? '▲' : '▼'}
                        </button>
                    </div>

                    {/* EXPANDABLE FILTER PANEL */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                            {/* Date Presets */}
                            <div className="space-y-2 col-span-1 md:col-span-4 pb-2 border-b border-white/5">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Snabbval Datum</label>
                                <div className="flex gap-2 overflow-x-auto">
                                    {[
                                        { id: 'all', label: 'Alla tider' },
                                        { id: '7d', label: '7 dagar' },
                                        { id: '30d', label: '30 dagar' },
                                        { id: '6m', label: '6 Månader' },
                                        { id: 'year', label: 'I år' }
                                    ].map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setDatePreset(p.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${datePreset === p.id
                                                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                                : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/30'
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Specific Year Filter */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Specifikt Årtal</label>
                                <select
                                    value={availableYears.includes(parseInt(datePreset)) ? datePreset : 'custom'}
                                    onChange={e => setDatePreset(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none"
                                >
                                    <option value="custom" disabled>Välj år...</option>
                                    {availableYears.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Distance Range */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Distans (km)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" placeholder="Min"
                                        value={minDist} onChange={e => setMinDist(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none"
                                    />
                                    <input
                                        type="number" placeholder="Max"
                                        value={maxDist} onChange={e => setMaxDist(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Duration Range */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Tid (min)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" placeholder="Min"
                                        value={minTime} onChange={e => setMinTime(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none"
                                    />
                                    <input
                                        type="number" placeholder="Max"
                                        value={maxTime} onChange={e => setMaxTime(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Reset Button */}
                            <div className="flex items-end">
                                <button
                                    onClick={() => {
                                        setDatePreset('all');
                                        setMinDist(''); setMaxDist('');
                                        setMinTime(''); setMaxTime('');
                                        setSearchQuery('');
                                        setSourceFilter('all');
                                    }}
                                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold py-2.5 rounded-lg transition-colors"
                                >
                                    Rensa Filter
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <div className="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/80 text-xs uppercase font-bold text-slate-500 border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('date')}>
                                Datum <SortIcon colKey="date" />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('type')}>
                                Typ <SortIcon colKey="type" />
                            </th>
                            <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('source')}>
                                Källa <SortIcon colKey="source" />
                            </th>
                            <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('durationMinutes')}>
                                Tid <SortIcon colKey="durationMinutes" />
                            </th>
                            <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('distance')}>
                                Distans <SortIcon colKey="distance" />
                            </th>
                            <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('caloriesBurned')}>
                                Kalorier <SortIcon colKey="caloriesBurned" />
                            </th>
                            <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('tonnage')}>
                                Ton <SortIcon colKey="tonnage" />
                            </th>
                            <th className="px-6 py-4">Notering</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {processedActivities.map((activity, i) => (
                            <tr
                                key={activity.id || i}
                                className="hover:bg-white/5 transition-colors cursor-pointer group"
                                onClick={() => handleSetSelectedActivity(activity)}
                            >
                                <td className="px-6 py-4 font-mono text-white whitespace-nowrap">
                                    {activity.date.split('T')[0]}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="capitalize text-white font-bold group-hover:text-emerald-400 transition-colors">{activity.type}</span>
                                        {activity.subType === 'race' && (
                                            <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">🏆 Tävling</span>
                                        )}
                                        {activity.subType === 'interval' && (
                                            <span className="text-[10px] uppercase font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">⚡ Intervaller</span>
                                        )}
                                        {activity.subType === 'long-run' && (
                                            <span className="text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">🏃 Långpass</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {activity.source === 'strava' ? (
                                        <span className="inline-flex items-center gap-1 text-[#FC4C02] font-bold text-[10px] uppercase tracking-wider bg-[#FC4C02]/10 px-2 py-1 rounded">
                                            🔥 Strava
                                        </span>
                                    ) : activity.source === 'merged' ? (
                                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[10px] uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded">
                                            ⚡ Merged
                                        </span>
                                    ) : activity.source === 'strength' ? (
                                        <span className="inline-flex items-center gap-1 text-purple-400 font-bold text-[10px] uppercase tracking-wider bg-purple-500/10 px-2 py-1 rounded">
                                            💪 Strength
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
                                    {activity.distance ? `${activity.distance.toFixed(1)} km` : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-rose-400">
                                    {activity.caloriesBurned || '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-indigo-400">
                                    {activity.tonnage ? (activity.tonnage / 1000).toFixed(1) + ' t' : '-'}
                                </td>
                                <td className="px-6 py-4 text-xs italic opacity-50 truncate max-w-[200px]">
                                    {activity.notes}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {processedActivities.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center gap-4">
                        <div className="text-4xl">👻</div>
                        <div className="text-slate-500 italic">Inga aktiviteter matchar dina filter.</div>
                        <button
                            onClick={() => {
                                setDatePreset('all');
                                setMinDist(''); setMaxDist('');
                                setMinTime(''); setMaxTime('');
                                setSearchQuery('');
                                setSourceFilter('all');
                            }}
                            className="text-emerald-400 hover:underline text-sm font-bold"
                        >
                            Rensa alla filter
                        </button>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedActivity && (
                <ActivityDetailModal
                    activity={selectedActivity}
                    universalActivity={selectedUniversal}
                    onClose={() => handleSetSelectedActivity(null)}
                />
            )}
        </div>
    );
}
