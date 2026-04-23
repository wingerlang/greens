import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
import { useDebounce } from '../hooks/useDebounce.ts';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { ExerciseEntry, UniversalActivity } from '../models/types.ts';
import { StrengthWorkout } from '../models/strengthTypes.ts';
import { Heart, Zap, MessageSquare, Clock, MapPin } from 'lucide-react';

import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { SmartFilter, parseSmartQuery, applySmartFilters } from '../utils/activityFilters.ts';
import { formatDuration } from '../utils/dateUtils.ts';
import { calculatePerformanceScore, calculateGAP } from '../utils/performanceEngine.ts';
import { mergeStrengthWorkouts } from '../api/services/activityMergeService.ts';
import { TrainingTabs } from '../components/training/TrainingTabs.tsx';

interface ActivityRowProps {
    activity: ExerciseEntry & { source: string };
    index: number;
    isSelectedForMerge: boolean;
    showFilters: boolean; // Is this needed? No.
    onToggleMerge: (id: string, index: number, e: React.MouseEvent) => void;
    universalActivities: UniversalActivity[];
    allActivities: any[];
    onSelectActivity: (activity: (ExerciseEntry & { source: string })) => void;
}

const ActivityRow = memo(({
    activity,
    index,
    isSelectedForMerge,
    onToggleMerge,
    universalActivities,
    allActivities,
    onSelectActivity
}: ActivityRowProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const universalMatch = universalActivities.find(u => u.id === activity.id);
    const isMergedActivity = (universalMatch?.mergeInfo?.isMerged === true && (universalMatch?.mergeInfo?.originalActivityIds?.length || 0) > 0) || (activity.source === 'merged' && !!(activity as any)._mergeData);

    // Get title for merged activities
    let displayTitle = activity.title && activity.title !== '-' ? activity.title : '-';
    let mergedSources: { id: string, source: string, title: string, type: string }[] = [];

    if (isMergedActivity) {
        if (universalMatch?.mergeInfo?.originalActivityIds) {
            // 1. collect from server-side merge info
            mergedSources = universalMatch.mergeInfo.originalActivityIds.map(oid => {
                const match = universalActivities.find(u => u.id === oid);
                const matchAny = match as any;
                const activitySource = match?.performance?.source?.source || matchAny?.source || 'unknown';

                return {
                    id: oid,
                    source: activitySource,
                    title: match?.plan?.title || match?.performance?.notes || matchAny?.title || 'Unknown Activity',
                    type: (matchAny?.type as string) || (match?.performance?.activityType as string) || 'unknown'
                };
            });
        } else if ((activity as any)._mergeData) {
            // 2. collect from client-side merge info (DataContext.tsx)
            const md = (activity as any)._mergeData;
            if (md.strava) {
                mergedSources.push({
                    id: md.strava.id,
                    source: 'strava',
                    title: md.strava.title || 'Strava Activity',
                    type: md.strava.type || 'running'
                });
            }
            if (md.strength || md.strengthWorkout) {
                const sw = md.strengthWorkout || md.strength;
                mergedSources.push({
                    id: sw.id,
                    source: 'strength',
                    title: sw.name || sw.title || 'Styrkepass',
                    type: 'strength'
                });
            }
        }

        // Title prioritization logic
        if (displayTitle === '-' || displayTitle === 'Styrkepass' || displayTitle === 'Strava Activity') {
            const stravaSource = mergedSources.find(s => s.source === 'strava');
            const strengthSource = mergedSources.find(s => s.source === 'strength' || s.source === 'strengthlog' || s.source === 'hevy');

            if (stravaSource?.title && !['Morgonlöpning', 'Lunchlöpning', 'Kvällslöpning', 'Eftermiddagslöpning', 'Morgonpass', '-', 'Strava Activity'].includes(stravaSource.title)) {
                displayTitle = stravaSource.title;
            } else if (strengthSource?.title && strengthSource.title !== 'Styrkepass' && strengthSource.title !== '-') {
                displayTitle = strengthSource.title;
            }
        }
    }

    // Calculate pace (proper MM:SS format)
    const pace = useMemo(() => {
        if (!activity.distance || activity.distance <= 0 || !activity.durationMinutes) return null;
        
        const totalSeconds = activity.durationMinutes * 60;
        const secondsPerKm = totalSeconds / activity.distance;
        const mins = Math.floor(secondsPerKm / 60);
        const secs = Math.round(secondsPerKm % 60);
        
        // Handle overflow cases (60s -> 1m)
        if (secs === 60) return `${mins + 1}:00`;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, [activity.distance, activity.durationMinutes]);

    // Score
    const score = calculatePerformanceScore(activity, allActivities);

    return (
        <React.Fragment>
            <tr
                className={`transition-colors cursor-pointer group ${isSelectedForMerge
                    ? 'bg-indigo-500/20 hover:bg-indigo-500/30 ring-1 ring-indigo-500/50'
                    : 'hover:bg-white/5'
                    }`}
                onClick={() => onSelectActivity(activity)}
            >
                {/* Mark for merge button */}
                <td className="w-8 px-1">
                    <button
                        onClick={(e) => onToggleMerge(activity.id, index, e)}
                        className={`opacity-0 group-hover:opacity-100 transition-all w-5 h-5 rounded flex items-center justify-center text-xs ${isSelectedForMerge
                            ? 'opacity-100 bg-indigo-500 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                            }`}
                        title={isSelectedForMerge ? 'Ta bort från merge' : 'Markera för merge (Shift+klick för flera)'}
                    >
                        {isSelectedForMerge ? '✓' : '+'}
                    </button>
                </td>
                <td className="px-3 py-2 font-mono text-white text-xs whitespace-nowrap">
                    {activity.date.split('T')[0]}
                </td>
                <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-xs truncate max-w-[240px]" title={displayTitle}>
                                {displayTitle}
                            </span>
                        </div>
                        {isMergedActivity && (
                            <span className="text-[9px] text-slate-500 italic">
                                {/* Source count hidden as per request */}
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                        <span className="capitalize text-white font-bold text-xs">{activity.type}</span>
                        {/* Score badge inline */}
                        {score > 0 && (
                            <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${score >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                                    score >= 60 ? 'bg-indigo-500/20 text-indigo-400' :
                                        'bg-slate-500/20 text-slate-400'
                                    }`}
                                title={`Poäng: ${score}`}
                            >
                                {score}
                            </span>
                        )}
                        {activity.subType === 'interval' && (
                            <span className="text-[8px] uppercase font-bold bg-red-500/20 text-red-400 px-1 rounded" title="Intervallpass">⚡</span>
                        )}
                        {activity.subType === 'long-run' && (
                            <span className="text-[8px] uppercase font-bold bg-blue-500/20 text-blue-400 px-1 rounded" title="Långpass">🏃</span>
                        )}
                        {activity.subType === 'race' && (
                            <span className="text-[8px] uppercase font-bold bg-amber-500/20 text-amber-400 px-1 rounded" title="Tävling">🏆</span>
                        )}
                        {activity.extractedFromId && (
                            <span className="text-[8px] uppercase font-bold bg-amber-500/20 text-amber-500 px-1 rounded" title="Utdrag från annat pass">✂️</span>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2">
                    {(() => {
                        if (isMergedActivity) {
                            return (
                                <div
                                    className="flex items-center gap-2 cursor-pointer group/source"
                                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                                    title="Visa källor"
                                >
                                    {!isExpanded ? (
                                        <>
                                            <span className="text-[10px] font-black tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 group-hover/source:bg-indigo-500/20 transition-colors uppercase">
                                                Merged {mergedSources.length > 0 ? `(${mergedSources.length})` : ''}
                                            </span>
                                            <div className="flex items-center -space-x-1 opacity-50 group-hover/source:opacity-100 transition-opacity">
                                                {mergedSources.some(s => s.source === 'strava') && <span title="Strava" className="text-xs">🔥</span>}
                                                {mergedSources.some(s => s.source === 'strength' || s.source === 'strengthlog') && <span title="StrengthLog" className="text-xs">💪</span>}
                                                {mergedSources.some(s => s.source === 'hevy') && <span title="Hevy" className="text-xs">🏋️</span>}
                                                {mergedSources.some(s => s.source === 'garmin') && <span title="Garmin" className="text-xs">⌚</span>}
                                            </div>
                                            <span className="text-[10px] text-slate-600 group-hover/source:text-slate-400">▶</span>
                                        </>
                                    ) : (
                                        <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black tracking-wider text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase">
                                                    Sources
                                                </span>
                                                <span className="text-[10px] text-slate-600 group-hover/source:text-slate-400">▼</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        } else if (activity.source === 'strava') {
                            return (
                                <span className="text-[#FC4C02] font-bold text-[9px] uppercase">🔥 Strava</span>
                            );
                        } else if (activity.source === 'strength' || activity.source === 'strengthlog') {
                            return (
                                <span className="text-purple-400 font-bold text-[9px] uppercase">💪 StrengthLog</span>
                            );
                        } else if (activity.source === 'hevy') {
                            return (
                                <span className="text-blue-400 font-bold text-[9px] uppercase">🏋️ Hevy</span>
                            );
                        } else {
                            return (
                                <span className="text-blue-400 font-bold text-[9px] uppercase">✏️ Man</span>
                            );
                        }
                    })()}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono whitespace-nowrap text-slate-400">
                    {formatDuration(activity.durationMinutes * 60)}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono whitespace-nowrap text-emerald-400/90 font-bold">
                    {activity.distance && activity.distance > 0 ? `${activity.distance.toFixed(1)} km` : '-'}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono whitespace-nowrap text-amber-400/90 font-bold">
                    {activity.caloriesBurned ? `${activity.caloriesBurned} kcal` : '-'}
                </td>
                <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px]">
                        {pace && (
                            <span className="text-indigo-400 font-black">{pace}/km</span>
                        )}
                        {universalMatch?.performance?.avgHeartRate && (
                            <div className="flex items-center gap-0.5 text-rose-400 font-bold" title="Medelpuls">
                                <Heart size={10} />
                                <span>{Math.round(universalMatch.performance.avgHeartRate)}</span>
                            </div>
                        )}
                        {universalMatch?.performance?.averageWatts && (
                            <div className="flex items-center gap-0.5 text-amber-500 font-bold" title="Medelwatt">
                                <Zap size={10} />
                                <span>{Math.round(universalMatch.performance.averageWatts)}w</span>
                            </div>
                        )}
                        {activity.tonnage && (
                            <span className="text-purple-400 font-bold">{(activity.tonnage / 1000).toFixed(1)}t</span>
                        )}
                        {!pace && !universalMatch?.performance?.avgHeartRate && !universalMatch?.performance?.averageWatts && !activity.tonnage && (
                            <span className="text-slate-700">-</span>
                        )}
                    </div>
                </td>
                <td className="px-3 py-2 text-center">
                    {activity.notes ? (
                        <div className="group relative flex justify-center">
                            <MessageSquare size={14} className="text-slate-500 hover:text-emerald-400 transition-colors cursor-help" />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-56 p-3 bg-slate-900 border border-white/20 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 pointer-events-none transition-all z-[100] text-[10px] text-slate-200 italic leading-relaxed text-left backdrop-blur-md">
                                {activity.notes}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                            </div>
                        </div>
                    ) : (
                        <span className="text-slate-800">-</span>
                    )}
                </td>
            </tr>

            {/* Expanded Details Row */}
            {isMergedActivity && isExpanded && (
                <tr className="bg-slate-900/50 animate-in fade-in duration-200">
                    <td colSpan={9} className="px-4 py-4 cursor-default">
                        <div className="flex flex-col gap-3 pl-8 border-l-2 border-indigo-500/30">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Källaktiviteter</h4>
                            <div className="space-y-2">
                                {mergedSources.map(source => (
                                    <div key={source.id} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-900 text-xs">
                                                {source.source === 'strava' ? '🔥' : source.source === 'strength' ? '💪' : source.source === 'hevy' ? '🏋️' : '✏️'}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white">{source.title}</p>
                                                <p className="text-[10px] text-slate-500 capitalize">{source.type} • {source.source}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const fullActivity = universalActivities.find(u => u.id === source.id);
                                                if (fullActivity) {
                                                    const perf = fullActivity.performance;
                                                    const plan = fullActivity.plan;

                                                    let mappedType: 'run' | 'strength' | 'other' = 'other';
                                                    const uType = perf?.activityType || plan?.activityType;
                                                    if (uType === 'running' || (uType as any) === 'run') mappedType = 'run';
                                                    else if (uType === 'strength') mappedType = 'strength';

                                                    // note: subType casting to any as temporary fix for potential type mismatch
                                                    const mapped: ExerciseEntry & { source: string } = {
                                                        id: fullActivity.id,
                                                        date: fullActivity.date,
                                                        type: mappedType as any,
                                                        subType: perf?.subType as any,
                                                        durationMinutes: perf?.durationMinutes ?? plan?.durationMinutes ?? 0,
                                                        distance: perf?.distanceKm ?? plan?.distanceKm ?? 0,
                                                        title: plan?.title || (fullActivity as any).name || 'Unknown',
                                                        notes: perf?.notes,
                                                        source: perf?.source?.source || 'unknown',
                                                        // Default required props to satisfy TS
                                                        intensity: 'moderate',
                                                        caloriesBurned: 0,
                                                        createdAt: fullActivity.createdAt
                                                    };
                                                    onSelectActivity(mapped);
                                                }
                                            }}
                                            className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-white transition-colors"
                                        >
                                            Visa
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
});

export function ActivitiesPage() {
    const { unifiedActivities: allActivities, universalActivities, strengthSessions, addStrengthSession, deleteStrengthSession, isLoading } = useData();
    const { token } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Core State
    const [selectedActivity, setSelectedActivity] = useState<(ExerciseEntry & { source: string }) | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Merge Selection State
    const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
    const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
    const [isMerging, setIsMerging] = useState(false);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
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

    // Pagination State
    const ITEMS_PER_PAGE = 100;
    const [page, setPage] = useState(1);

    // URL sync and other logic remains...

    // Optimize: Update preview filters via debounce to avoid typing lag
    useEffect(() => {
        const { filters } = parseSmartQuery(debouncedSearchQuery);
        setPreviewFilters(filters);
    }, [debouncedSearchQuery]);

    // 3. Deep Linking Logic
    useEffect(() => {
        const linkedId = searchParams.get('activityId');
        if (!linkedId) return;

        // 1. Check if already selected (avoid re-fetch)
        if (selectedActivity?.id === linkedId) return;

        // 2. Try to find in local state
        let match = allActivities.find(a => a.id === linkedId);

        // 3. If no direct match, look inside merged/unified activities
        if (!match) {
            match = allActivities.find(a => {
                // Check Strava ID
                if (a.externalId === linkedId) return true;
                // Check _mergeData
                const am = a as any;
                if (am._mergeData) {
                    if (am._mergeData.strava?.id === linkedId) return true;
                    if (am._mergeData.strength?.id === linkedId) return true;
                    if (am._mergeData.universalActivity?.id === linkedId) return true;
                }
                return false;
            });
        }

        if (match) {
            setSelectedActivity(match);
        } else if (token && allActivities.length > 0) {
            // 4. If still not found, try fetching from backend
            console.log(`[ActivitiesPage] Activity ${linkedId} not found locally, attempting fetch...`);
            fetch(`/api/activities/${linkedId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (data && data.id) {
                        console.log(`[ActivitiesPage] Successfully fetched activity ${linkedId} from backend`);
                        // Map universal activity to legacy format for the modal (using our mapper)
                        const mapped = mapUniversalToLegacyEntry(data);
                        if (mapped) {
                            // Ensure source is present to satisfy state type requirement
                            const withSource = {
                                ...mapped,
                                source: mapped.source || data.performance?.source?.source || 'unknown'
                            } as (ExerciseEntry & { source: string });
                            setSelectedActivity(withSource);
                        }
                    }
                })
                .catch(err => console.error('[ActivitiesPage] Failed to fetch deep-linked activity:', err));
        }
    }, [searchParams, allActivities, token]);

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
        // Pre-calculate IDs that should be hidden (components of merges)
        const hiddenIds = new Set<string>();
        universalActivities.forEach(u => {
            if (u.mergedIntoId) hiddenIds.add(u.id);
            if (u.mergeInfo?.isMerged && u.mergeInfo.originalActivityIds) {
                u.mergeInfo.originalActivityIds.forEach(id => hiddenIds.add(id));
            }
        });

        let result = applySmartFilters(allActivities, activeSmartFilters);

        result = result.filter(a => {
            // Hide activities that have been merged into another activity
            if (hiddenIds.has(a.id)) return false;

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
            if (debouncedSearchQuery) {
                const { filters: liveFilters } = parseSmartQuery(debouncedSearchQuery);
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
    }, [allActivities, sortConfig, debouncedSearchQuery, sourceFilter, datePreset, minDist, maxDist, minTime, maxTime]);

    // Reset pagination when filters change
    useEffect(() => {
        setPage(1);
    }, [sortConfig, sourceFilter, datePreset, minDist, maxDist, minTime, maxTime, activeSmartFilters]);


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

    // Merge selection handlers
    const toggleMergeSelection = (activityId: string, index: number, event: React.MouseEvent) => {
        event.stopPropagation();

        setSelectedForMerge(prev => {
            const newSet = new Set(prev);

            // Shift-click: select range
            if (event.shiftKey && lastClickedIndex !== null) {
                const start = Math.min(lastClickedIndex, index);
                const end = Math.max(lastClickedIndex, index);
                for (let i = start; i <= end; i++) {
                    const activity = processedActivities[i];
                    if (activity?.id) newSet.add(activity.id);
                }
            } else {
                // Regular click: toggle single
                if (newSet.has(activityId)) {
                    newSet.delete(activityId);
                } else {
                    newSet.add(activityId);
                }
            }

            return newSet;
        });

        setLastClickedIndex(index);
    };

    const clearMergeSelection = () => {
        setSelectedForMerge(new Set());
        setLastClickedIndex(null);
    };

    const handleMergeActivities = async () => {
        if (selectedForMerge.size < 2 || !token) return;

        setIsMerging(true);
        try {
            // Check if these are strength activities (from strengthSessions)
            const selectedIds = Array.from(selectedForMerge);
            const selectedStrengthWorkouts = (strengthSessions as StrengthWorkout[]).filter(w => selectedForMerge.has(w.id));

            // If all selected are strength workouts, merge them client-side
            if (selectedStrengthWorkouts.length >= 2 && selectedStrengthWorkouts.length === selectedIds.length) {
                // This is a strength-only merge - handle client-side
                const tempUserId = 'local-user'; // Client-side merge doesn't need real userId
                const mergedWorkout = mergeStrengthWorkouts(selectedStrengthWorkouts, tempUserId);

                // Add the merged workout
                addStrengthSession(mergedWorkout);

                // Delete the original workouts
                for (const workout of selectedStrengthWorkouts) {
                    deleteStrengthSession(workout.id);
                }

                clearMergeSelection();
                // No need to reload - state will update automatically
                alert(`Sammanslog ${selectedStrengthWorkouts.length} styrkepass!\n\n` +
                    `Övningar: ${mergedWorkout.uniqueExercises}\n` +
                    `Set: ${mergedWorkout.totalSets}\n` +
                    `Volym: ${(mergedWorkout.totalVolume / 1000).toFixed(1)} ton`);
                return;
            }

            // Get the full universal activities for the selected IDs (non-strength)
            const activitiesToMerge = universalActivities.filter(u => selectedForMerge.has(u.id));

            if (activitiesToMerge.length < 2) {
                // Maybe mixed selection - try strength as fallback
                if (selectedStrengthWorkouts.length > 0) {
                    alert('Blandade aktivitetstyper kan inte slås ihop. Välj bara styrkepass eller bara andra aktiviteter.');
                    setIsMerging(false);
                    return;
                }
                alert('Kunde inte hitta aktiviteterna. Försök igen.');
                setIsMerging(false);
                return;
            }

            const response = await fetch('/api/activities/merge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ activities: activitiesToMerge })
            });

            const result = await response.json();
            if (result.success) {
                clearMergeSelection();
                // Refresh data (ideally via context)
                window.location.reload();
            } else {
                alert(`Merge failed: ${result.error}`);
            }
        } catch (e) {
            console.error('Merge error:', e);
            alert('Merge failed: Network error');
        } finally {
            setIsMerging(false);
        }
    };

    // Get selected activities for preview
    const selectedActivitiesForMerge = processedActivities.filter(a => selectedForMerge.has(a.id));

    const totals = useMemo(() => {
        return processedActivities.reduce((acc, a) => {
            acc.distance += (a.distance || 0);
            acc.duration += (a.durationMinutes || 0);
            acc.calories += (a.caloriesBurned || 0);
            acc.count++;
            return acc;
        }, { distance: 0, duration: 0, calories: 0, count: 0 });
    }, [processedActivities]);

    if (isLoading && allActivities.length === 0) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <div className="text-slate-500 font-bold uppercase tracking-widest text-xs">Laddar aktiviteter...</div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <TrainingTabs currentTab="logg" />
            <header className="flex flex-col gap-6">
                <div className="flex justify-between items-end flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">Aktivitetslogg</h1>
                        <p className="text-slate-400">
                            Visar <span className="text-emerald-400 font-bold">{processedActivities.length}</span> av <span className="text-slate-500">{allActivities.length}</span> aktiviteter.
                        </p>
                    </div>

                    <div className="flex gap-4 items-center">
                        <div className="bg-slate-900 border border-white/5 rounded-2xl px-4 py-2 flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Totalt Distans</span>
                            <span className="text-xl font-black text-white">{totals.distance.toFixed(1)} <span className="text-xs text-slate-500">km</span></span>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl px-4 py-2 flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Totalt Tid</span>
                            <span className="text-xl font-black text-white">{formatDuration(totals.duration * 60)}</span>
                        </div>
                        <div className="bg-slate-900 border border-white/5 rounded-2xl px-4 py-2 flex flex-col">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Totalt Energi</span>
                            <span className="text-xl font-black text-white">{totals.calories.toLocaleString()} <span className="text-xs text-slate-500">kcal</span></span>
                        </div>
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
                                        setSearchQuery(e.target.value);
                                        // Reset pagination on search
                                        setPage(1);
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const { filters, remainingText } = parseSmartQuery(searchQuery);
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

            <div className="bg-slate-900/50 border border-white/5 rounded-3xl shadow-xl">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/80 text-xs uppercase font-bold text-slate-500 border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="w-8 px-1"></th> {/* Merge selection column */}
                            <th className="px-3 py-2 w-24 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('date')}>
                                Datum <SortIcon colKey="date" />
                            </th>
                            <th className="px-3 py-2 w-auto min-w-[180px] cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('title')}>
                                Aktivitet <SortIcon colKey="title" />
                            </th>
                            <th className="px-3 py-2 w-16 cursor-pointer hover:text-white transition-colors select-none text-center" onClick={() => handleSort('type')}>
                                Typ <SortIcon colKey="type" />
                            </th>
                            <th className="px-3 py-2 w-20 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('source')}>
                                Källa <SortIcon colKey="source" />
                            </th>
                            <th className="px-3 py-2 w-20 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('durationMinutes')}>
                                Tid <SortIcon colKey="durationMinutes" />
                            </th>
                            <th className="px-3 py-2 w-20 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('distance')}>
                                Dist. <SortIcon colKey="distance" />
                            </th>
                            <th className="px-3 py-2 w-20 cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('caloriesBurned')}>
                                Kcal <SortIcon colKey="caloriesBurned" />
                            </th>
                            <th className="px-3 py-2 w-auto min-w-[150px] cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('pace')}>
                                Info <SortIcon colKey="pace" />
                            </th>
                            <th className="px-3 py-2 w-12 text-center">Not.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {processedActivities.slice(0, page * ITEMS_PER_PAGE).map((activity, i) => (
                            <ActivityRow
                                key={activity.id || i}
                                activity={activity}
                                index={i}
                                isSelectedForMerge={selectedForMerge.has(activity.id)}
                                onToggleMerge={toggleMergeSelection}
                                universalActivities={universalActivities}
                                allActivities={allActivities}
                                onSelectActivity={handleSetSelectedActivity}
                                showFilters={false} // removed from prop usage but keeping for TS compliance if needed (removed from interface above so removing here)
                            />
                        ))}
                    </tbody>
                </table>

                {processedActivities.length > page * ITEMS_PER_PAGE && (
                    <div className="p-4 border-t border-white/5 flex justify-center bg-slate-900/50">
                        <button
                            onClick={() => setPage(p => p + 1)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-6 rounded-xl transition-colors text-xs uppercase tracking-wider"
                        >
                            Visa fler aktiviteter ({processedActivities.length - page * ITEMS_PER_PAGE} kvar)
                        </button>
                    </div>
                )}

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
            {
                selectedActivity && (
                    <ActivityDetailModal
                        activity={selectedActivity}
                        universalActivity={selectedUniversal}
                        onClose={() => handleSetSelectedActivity(null)}
                    />
                )
            }

            {/* Floating Merge Action Bar */}
            {selectedForMerge.size >= 2 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl shadow-2xl shadow-indigo-500/20 px-6 py-4 flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                                <span className="text-indigo-400 font-black">{selectedForMerge.size}</span>
                            </div>
                            <div>
                                <p className="text-white font-bold">Aktiviteter markerade</p>
                                <p className="text-xs text-slate-400">
                                    Total: {selectedActivitiesForMerge.reduce((s, a) => s + (a.distance || 0), 0).toFixed(1)} km,
                                    {formatDuration(selectedActivitiesForMerge.reduce((s, a) => s + (a.durationMinutes * 60 || 0), 0))}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={clearMergeSelection}
                                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={handleMergeActivities}
                                disabled={isMerging}
                                className="px-6 py-2 rounded-xl text-sm font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isMerging ? '⏳ Slår ihop...' : '⚡ Slå ihop aktiviteter'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

export default ActivitiesPage;
