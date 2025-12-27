import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { ExerciseEntry, UniversalActivity } from '../models/types.ts';
import { StrengthWorkout } from '../models/strengthTypes.ts';

import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { SmartFilter, parseSmartQuery, applySmartFilters } from '../utils/activityFilters.ts';
import { formatDuration } from '../utils/dateUtils.ts';
import { calculatePerformanceScore, calculateGAP } from '../utils/performanceEngine.ts';

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
    const [activeSmartFilters, setActiveSmartFilters] = useState<SmartFilter[]>([]);
    const [previewFilters, setPreviewFilters] = useState<SmartFilter[]>([]);
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
        let result = applySmartFilters(allActivities, activeSmartFilters);

        result = result.filter(a => {
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

            // Search (Combine active smart filters with live search text)
            let currentFilters = activeSmartFilters;
            if (searchQuery) {
                const { filters: liveFilters } = parseSmartQuery(searchQuery);
                currentFilters = [...currentFilters, ...liveFilters];
            }

            const matchesSmart = applySmartFilters([a], currentFilters).length > 0;
            if (!matchesSmart) return false;

            // Advanced Ranges
            if (minDist && (a.distance || 0) < parseFloat(minDist)) return false;
            if (maxDist && (a.distance || 0) > parseFloat(maxDist)) return false;
            if (minTime && a.durationMinutes < parseFloat(minTime)) return false;
            if (maxTime && a.durationMinutes > parseFloat(maxTime)) return false;

            return true;
        });

        // Sorting
        result.sort((a, b) => {
            let valA: any = (a as any)[sortConfig.key];
            let valB: any = (b as any)[sortConfig.key];

            // Special cases
            if (sortConfig.key === 'tonnage') {
                valA = a.tonnage || 0;
                valB = b.tonnage || 0;
            } else if (sortConfig.key === 'score') {
                valA = calculatePerformanceScore(a, allActivities);
                valB = calculatePerformanceScore(b, allActivities);
            } else if (sortConfig.key === 'pace') {
                // Pace = Duration / Distance (seconds per km)
                valA = a.distance ? (a.durationMinutes * 60) / a.distance : 0;
                valB = b.distance ? (b.durationMinutes * 60) / b.distance : 0;

                // If sorting pace ASC, we want fastest first (lowest value)
                // If sorting pace DESC, we want slowest first (highest value)
                // The current comparison logic below handles this if we keep direction logic
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
                        <div className="flex-1 space-y-3">
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Sök på aktivitet, eller prova '>10km', '<4:30/km'..."
                                    value={searchQuery}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setSearchQuery(val);

                                        const { filters, remainingText } = parseSmartQuery(val);
                                        setPreviewFilters(filters);

                                        // Auto-detect triggers for committing
                                        const hasUnitSuffix = val.match(/(km|m|t|min|h)\s*$/i);
                                        const hasSpaceTrigger = val.endsWith(' ');
                                        const hasYearTrigger = val.match(/\d{4}\s+$/);

                                        // Commit if:
                                        // 1. Space entered
                                        // 2. Clear unit suffix entered (and it's not just a prefix like 'k')
                                        if (hasSpaceTrigger || (hasUnitSuffix && hasUnitSuffix[1]?.length > 0 && !val.endsWith(' '))) {
                                            if (filters.length > 0) {
                                                setActiveSmartFilters(prev => {
                                                    const existing = new Set(prev.map(f => f.originalQuery));
                                                    const newFilters = filters.filter(f => !existing.has(f.originalQuery));
                                                    return [...prev, ...newFilters];
                                                });
                                                setSearchQuery(remainingText);
                                                setPreviewFilters([]);
                                            }
                                        }
                                    }}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                                />
                            </div>

                            {/* Smart Filter Tags & Previews */}
                            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                {activeSmartFilters.map(f => (
                                    <div
                                        key={f.id}
                                        className="group flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-default"
                                    >
                                        <span className="opacity-50">{f.type === 'tonnage' ? '🏋️' : f.type === 'pace' ? '⚡' : f.type === 'distance' ? '🏃' : f.type === 'date' ? '📅' : '⏱️'}</span>
                                        {f.label}
                                        <button
                                            onClick={() => setActiveSmartFilters(prev => prev.filter(x => x.id !== f.id))}
                                            className="hover:text-white transition-colors ml-1 p-0.5"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}

                                {previewFilters.map(f => (
                                    <div
                                        key={f.id}
                                        className="flex items-center gap-2 bg-slate-800/50 border border-white/5 border-dashed px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500 italic animate-pulse"
                                    >
                                        <span>Preview:</span>
                                        {f.label}
                                    </div>
                                ))}

                                {activeSmartFilters.length > 0 && (
                                    <button
                                        onClick={() => setActiveSmartFilters([])}
                                        className="text-[9px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest px-2"
                                    >
                                        Rensa alla
                                    </button>
                                )}
                            </div>
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
                                        setActiveSmartFilters([]);
                                        setPreviewFilters([]);
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
                            {processedActivities.some(a => a.distance) && (
                                <>
                                    <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('distance')}>
                                        Dist <SortIcon colKey="distance" />
                                    </th>
                                    <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('pace')}>
                                        Tempo <SortIcon colKey="pace" />
                                    </th>
                                </>
                            )}
                            {processedActivities.some(a => a.tonnage) && (
                                <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('tonnage')}>
                                    Ton <SortIcon colKey="tonnage" />
                                </th>
                            )}
                            <th className="px-6 py-4 text-right cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('score')}>
                                Poäng <SortIcon colKey="score" />
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
                                    {activity.durationMinutes > 0 ? formatDuration(activity.durationMinutes * 60) : '-'}
                                </td>
                                {processedActivities.some(a => a.distance) && (
                                    <>
                                        <td className="px-6 py-4 text-right font-mono text-slate-300">
                                            {activity.distance ? `${activity.distance.toFixed(1)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-300">
                                            {activity.distance ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] opacity-70">{(activity.durationMinutes / activity.distance).toFixed(2).replace('.', ':')} /km</span>
                                                    {activity.elevationGain && activity.elevationGain > 0 && (
                                                        <span className="text-[10px] text-indigo-400 font-bold" title="Grade Adjusted Pace (Lutningsjusterat tempo)">
                                                            GAP: {(calculateGAP((activity.durationMinutes * 60) / activity.distance, activity.elevationGain, activity.distance) / 60).toFixed(2).replace('.', ':')}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : '-'}
                                        </td>
                                    </>
                                )}
                                {processedActivities.some(a => a.tonnage) && (
                                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                                        {activity.tonnage ? `${(activity.tonnage / 1000).toFixed(1)} t` : '-'}
                                    </td>
                                )}
                                <td className="px-6 py-4 text-right">
                                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-[10px] border ${calculatePerformanceScore(activity) >= 80 ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                                        calculatePerformanceScore(activity) >= 60 ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' :
                                            'bg-slate-500/20 border-slate-500/50 text-slate-400'
                                        }`}>
                                        {calculatePerformanceScore(activity)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs italic opacity-50 truncate max-w-[150px]">
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
                                setActiveSmartFilters([]);
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
