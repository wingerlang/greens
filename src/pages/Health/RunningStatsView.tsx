import React, { useMemo, useState } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { isCompetition, formatTime } from '../../utils/activityUtils.ts';
import { ActivityDetailModal } from '../../components/activities/ActivityDetailModal.tsx';
import { Trophy, Clock, Zap, Target, History, CalendarDays, TrendingUp, Medal } from 'lucide-react';

interface RunningStatsViewProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
}

interface DistanceBucket {
    key: string;
    label: string;
    min: number;
    max: number;
    color: string;
}

const RUNNING_BUCKETS: DistanceBucket[] = [
    { key: '5k', label: '5 KM', min: 4.85, max: 5.35, color: 'emerald' },
    { key: '10k', label: '10 KM', min: 9.7, max: 10.7, color: 'blue' },
    { key: 'hm', label: 'Halvmaraton', min: 20.7, max: 21.7, color: 'indigo' },
    { key: 'marathon', label: 'Maraton', min: 41.5, max: 43.5, color: 'purple' },
    { key: 'ultra50k', label: '50 KM', min: 48.0, max: 55.0, color: 'rose' },
    { key: 'ultra50m', label: '50 Miles', min: 78.0, max: 85.0, color: 'orange' },
    { key: 'ultra100k', label: '100 KM', min: 98.0, max: 105.0, color: 'yellow' }
];

const ULTRA_KEYS = ['ultra50k', 'ultra50m', 'ultra100k'];

type FilterType = 'all' | 'training' | 'race';

interface PBEvent {
    id: string;
    date: string;
    distance: number;
    durationSeconds: number;
    durationFormatted: string;
    bucketLabel: string;
    previousDurationSeconds?: number;
    improvementSeconds?: number;
    isRace: boolean;
    activity: ExerciseEntry;
}

export function RunningStatsView({ exerciseEntries, universalActivities }: RunningStatsViewProps) {
    const [filter, setFilter] = useState<FilterType>('all');
    const [selectedActivity, setSelectedActivity] = useState<ExerciseEntry | null>(null);
    const [selectedBuckets, setSelectedBuckets] = useState<string[]>(RUNNING_BUCKETS.map(b => b.key));
    const [activeUltraTab, setActiveUltraTab] = useState<string>('ultra50k');

    const getDaysAgoText = (dateStr: string) => {
        const days = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24));
        if (days === 0) return 'Idag';
        if (days === 1) return 'Igår';
        if (days < 30) return `${days} dagar sedan`;
        if (days < 365) return `${Math.floor(days / 30)} mån sedan`;
        return `${Math.floor(days / 365)} år sedan`;
    };

    const isCurrentYear = (dateStr: string) => {
        return new Date(dateStr).getFullYear() === new Date().getFullYear();
    };

    // 1. Prepare and filter all running activities
    const runningActivities = useMemo(() => {
        const stravaEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        // Combine and dedupe
        const combined = [...exerciseEntries, ...stravaEntries];
        const seen = new Set<string>();

        const deduplicated = combined.filter(e => {
            // Looser distance check for deduplication (rounding to nearest km) to avoid removing valid re-runs of the same course
            const key = `${e.date.substring(0, 10)}-${e.type}-${Math.round(e.distance || 0)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const runningTypes = ['running', 'run', 'löpning'];

        return deduplicated
            .filter(e => !e.excludeFromStats && runningTypes.some(t => e.type.toLowerCase().includes(t)) && e.distance && e.distance > 0 && e.durationMinutes > 0)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Chronological order
    }, [exerciseEntries, universalActivities]);

    // Apply Filter (All, Training, Race)
    const filteredActivities = useMemo(() => {
        return runningActivities.filter(a => {
            if (filter === 'all') return true;
            const isComp = isCompetition(a);
            if (filter === 'race') return isComp;
            if (filter === 'training') return !isComp;
            return true;
        });
    }, [runningActivities, filter]);

    // 2. Compute Chronological PBs and Top 10s
    const { pbTimeline, topLists, smartStats } = useMemo(() => {
        const timeline: PBEvent[] = [];
        const currentPBs: Record<string, number> = {
            '5k': Infinity,
            '10k': Infinity,
            'hm': Infinity,
            'marathon': Infinity,
            'ultra50k': Infinity,
            'ultra50m': Infinity,
            'ultra100k': Infinity
        };

        const lists: Record<string, ExerciseEntry[]> = {
            '5k': [],
            '10k': [],
            'hm': [],
            'marathon': [],
            'ultra50k': [],
            'ultra50m': [],
            'ultra100k': []
        };

        let maxDistance = 0;
        let longestRun: ExerciseEntry | null = null;
        let totalPaceSum = 0;
        let paceCount = 0;
        let fastestPaceSecPerKm = Infinity;
        let fastestPaceRun: ExerciseEntry | null = null;

        // Process in chronological order to find PB breakers
        filteredActivities.forEach(run => {
            const dist = run.distance || 0;
            const durationSec = run.durationMinutes * 60;
            const paceSec = durationSec / dist;

            // Smart Stats Calculations
            if (dist > maxDistance) {
                maxDistance = dist;
                longestRun = run;
            }

            if (run.durationMinutes > 5) { // Exclude extreme outliers / short sprints
                totalPaceSum += paceSec;
                paceCount++;
                if (paceSec < fastestPaceSecPerKm) {
                    fastestPaceSecPerKm = paceSec;
                    fastestPaceRun = run;
                }
            }

            // Bucket Processing
            RUNNING_BUCKETS.forEach(bucket => {
                if (dist >= bucket.min && dist <= bucket.max) {
                    lists[bucket.key].push(run);

                    if (durationSec < currentPBs[bucket.key]) {
                        // Found a new PB!
                        const pbEvent: PBEvent = {
                            id: run.id,
                            date: run.date,
                            distance: dist,
                            durationSeconds: durationSec,
                            durationFormatted: formatTime(durationSec),
                            bucketLabel: bucket.label,
                            isRace: isCompetition(run),
                            activity: run
                        };

                        if (currentPBs[bucket.key] !== Infinity) {
                            pbEvent.previousDurationSeconds = currentPBs[bucket.key];
                            pbEvent.improvementSeconds = currentPBs[bucket.key] - durationSec;
                        }

                        timeline.push(pbEvent);
                        currentPBs[bucket.key] = durationSec;
                    }
                }
            });
        });

        // Compute Top 10s (Sort lists by duration Ascending)
        Object.keys(lists).forEach(key => {
            lists[key].sort((a, b) => (a.durationMinutes * 60) - (b.durationMinutes * 60));
            // De-duplicate same runs if they somehow slipped through, or very close runs? 
            // Stick to simple top 10 mapping
            lists[key] = lists[key].slice(0, 10);
        });

        // Reverse Timeline to show newest first
        timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            pbTimeline: timeline,
            topLists: lists,
            smartStats: {
                longestRun: longestRun as ExerciseEntry | null,
                fastestPaceRun: fastestPaceRun as ExerciseEntry | null,
                fastestPaceSecPerKm,
                avgPaceSecPerKm: paceCount > 0 ? totalPaceSum / paceCount : 0
            }
        };
    }, [filteredActivities]);

    const formatPace = (secPerKm: number) => {
        if (!isFinite(secPerKm) || secPerKm <= 0) return '-';
        const m = Math.floor(secPerKm / 60);
        const s = Math.round(secPerKm % 60);
        return `${m}:${s.toString().padStart(2, '0')}/km`;
    };

    const selectedUniversal = selectedActivity
        ? universalActivities.find(u => u.id === selectedActivity.id)
        : undefined;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header / Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <TrendingUp className="text-amber-500" size={32} />
                        Löpstatistik & Rekord
                    </h2>
                    <p className="text-slate-400 mt-1">Djupgående analys, top 10-listor och din utvecklingsresa.</p>
                </div>

                <div className="flex bg-slate-900/80 rounded-xl border border-white/5 p-1">
                    {[
                        { id: 'all', label: 'Alla Pass' },
                        { id: 'training', label: 'Endast Träning' },
                        { id: 'race', label: 'Endast Tävling' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as FilterType)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === f.id
                                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Smart Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Zap size={64} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Snabbaste Tempo</div>
                    <div className="text-4xl font-black text-white mb-1">
                        {smartStats.fastestPaceSecPerKm !== Infinity ? formatPace(smartStats.fastestPaceSecPerKm) : '-'}
                    </div>
                    {smartStats.fastestPaceRun && (
                        <button
                            onClick={() => setSelectedActivity(smartStats.fastestPaceRun)}
                            className="text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors text-left"
                        >
                            Satt den {smartStats.fastestPaceRun.date.substring(0, 10)} ({smartStats.fastestPaceRun.distance?.toFixed(1)} km)
                        </button>
                    )}
                </div>

                <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Target size={64} />
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Längsta Distans</div>
                    <div className="text-4xl font-black text-white mb-1">
                        {smartStats.longestRun ? `${smartStats.longestRun.distance?.toFixed(1)}` : '-'}
                        <span className="text-lg text-slate-400 ml-1">km</span>
                    </div>
                    {smartStats.longestRun && (
                        <button
                            onClick={() => setSelectedActivity(smartStats.longestRun)}
                            className="text-xs font-bold text-slate-500 hover:text-emerald-400 transition-colors"
                        >
                            Sprangs den {smartStats.longestRun.date.substring(0, 10)}
                        </button>
                    )}
                </div>

                <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Snitt-tempo (Alla Pass)</div>
                    <div className="text-4xl font-black text-slate-300 mb-1">
                        {smartStats.avgPaceSecPerKm > 0 ? formatPace(smartStats.avgPaceSecPerKm) : '-'}
                    </div>
                    <div className="text-xs font-bold text-slate-600">
                        Baserat på {filteredActivities.length} pass
                    </div>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="space-y-12">
                {/* Top 10 Lists */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Trophy className="text-amber-500" size={24} />
                        Topp 10 Tider
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {RUNNING_BUCKETS.filter(b => !ULTRA_KEYS.includes(b.key)).map(bucket => {
                            const list = topLists[bucket.key];
                            if (list.length === 0) return null;

                            return (
                                <div key={bucket.key} className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                                    <div className="bg-slate-900 px-5 py-4 border-b border-white/5 flex justify-between items-center">
                                        <h4 className="font-black text-white italic text-lg">{bucket.label}</h4>
                                        <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                            {list.length} {list.length === 10 ? 'pass' : 'pass'}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <table className="w-full text-sm">
                                            <tbody className="divide-y divide-white/5">
                                                {list.map((run, index) => {
                                                    const paceSec = (run.durationMinutes * 60) / (run.distance || 1);
                                                    const paceFormatted = formatPace(paceSec);
                                                    const daysAgo = getDaysAgoText(run.date);
                                                    const isThisYear = isCurrentYear(run.date);

                                                    return (
                                                        <tr
                                                            key={run.id}
                                                            onClick={() => setSelectedActivity(run)}
                                                            className={`hover:bg-white/5 transition-colors cursor-pointer group ${isThisYear ? 'border-l-2 border-l-amber-500 bg-amber-500/5' : ''}`}
                                                        >
                                                            <td className="px-3 py-3 w-8 text-center">
                                                                <span className={`font-black text-xs ${index === 0 ? 'text-amber-500 text-lg' :
                                                                    index === 1 ? 'text-slate-300' :
                                                                        index === 2 ? 'text-amber-700' : 'text-slate-600'
                                                                    }`}>
                                                                    {index + 1}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <div className="font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[150px]">
                                                                    {run.title && run.title !== '-' ? run.title : run.notes || 'Löprunda'}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                                        {run.date.substring(0, 10)}
                                                                    </span>
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isThisYear ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-slate-400'}`}>
                                                                        {daysAgo}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-right">
                                                                <div className="font-black text-white font-mono flex items-center justify-end gap-2">
                                                                    <span className="text-xs text-slate-500 font-medium">{paceFormatted}</span>
                                                                    <span className="text-lg">{formatTime(run.durationMinutes * 60)}</span>
                                                                </div>
                                                                {isCompetition(run) ? (
                                                                    <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center justify-end gap-1 mt-0.5">
                                                                        <Medal size={10} /> Tävling
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 block">
                                                                        Träning
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}

                        {/* ULTRA COMBINED TAB PANEL */}
                        {ULTRA_KEYS.some(k => topLists[k]?.length > 0) && (
                            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden flex flex-col lg:col-span-2">
                                <div className="bg-slate-900 px-5 pt-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <h4 className="font-black text-white italic text-lg flex items-center gap-2">
                                        Ultra <Zap size={16} className="text-rose-500" />
                                    </h4>
                                    <div className="flex bg-slate-800 rounded-t-lg overflow-hidden border-x border-t border-white/5">
                                        {RUNNING_BUCKETS.filter(b => ULTRA_KEYS.includes(b.key)).map(bucket => {
                                            if (topLists[bucket.key]?.length === 0) return null;
                                            const isActive = activeUltraTab === bucket.key;
                                            return (
                                                <button
                                                    key={bucket.key}
                                                    onClick={() => setActiveUltraTab(bucket.key)}
                                                    className={`px-4 py-2 text-xs font-bold transition-colors ${isActive ? `bg-slate-700 text-${bucket.color}-400` : 'text-slate-500 hover:bg-slate-700/50 hover:text-white'}`}
                                                >
                                                    {bucket.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-white/5">
                                            {topLists[activeUltraTab]?.map((run, index) => {
                                                const paceSec = (run.durationMinutes * 60) / (run.distance || 1);
                                                const paceFormatted = formatPace(paceSec);
                                                const daysAgo = getDaysAgoText(run.date);
                                                const isThisYear = isCurrentYear(run.date);

                                                return (
                                                    <tr
                                                        key={run.id}
                                                        onClick={() => setSelectedActivity(run)}
                                                        className={`hover:bg-white/5 transition-colors cursor-pointer group ${isThisYear ? 'border-l-2 border-l-amber-500 bg-amber-500/5' : ''}`}
                                                    >
                                                        <td className="px-3 py-3 w-8 text-center">
                                                            <span className={`font-black text-xs ${index === 0 ? 'text-amber-500 text-lg' :
                                                                index === 1 ? 'text-slate-300' :
                                                                    index === 2 ? 'text-amber-700' : 'text-slate-600'
                                                                }`}>
                                                                {index + 1}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="font-bold text-white group-hover:text-amber-400 transition-colors truncate max-w-[200px] sm:max-w-xs">
                                                                {run.title && run.title !== '-' ? run.title : run.notes || 'Löprunda'}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-slate-500 font-mono">
                                                                    {run.date.substring(0, 10)}
                                                                </span>
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isThisYear ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-slate-400'}`}>
                                                                    {daysAgo}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-right">
                                                            <div className="font-black text-white font-mono flex items-center justify-end gap-2">
                                                                <span className="text-xs text-slate-500 font-medium">{paceFormatted}</span>
                                                                <span className="text-lg">{formatTime(run.durationMinutes * 60)}</span>
                                                            </div>
                                                            {isCompetition(run) ? (
                                                                <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center justify-end gap-1 mt-0.5">
                                                                    <Medal size={10} /> Tävling
                                                                </span>
                                                            ) : (
                                                                <span className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 block">
                                                                    Träning
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Chronological PB Timeline */}
                <div>
                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <History className="text-indigo-400" size={24} />
                                Utvecklingsresa
                            </h3>
                        </div>

                        {/* Timeline Filters */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {RUNNING_BUCKETS.map(bucket => {
                                const isSelected = selectedBuckets.includes(bucket.key);
                                return (
                                    <button
                                        key={bucket.key}
                                        onClick={(e) => {
                                            if (e.ctrlKey || e.metaKey) {
                                                // Isolate this explicitly
                                                setSelectedBuckets([bucket.key]);
                                            } else {
                                                setSelectedBuckets(prev =>
                                                    prev.includes(bucket.key)
                                                        ? prev.filter(k => k !== bucket.key)
                                                        : [...prev, bucket.key]
                                                );
                                            }
                                        }}
                                        title="Ctrl+klick för att visa endast denna"
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isSelected
                                            ? `bg-${bucket.color}-500/20 text-${bucket.color}-400 border-${bucket.color}-500/30`
                                            : 'bg-slate-800 text-slate-500 border-white/5 hover:bg-slate-700'
                                            }`}
                                    >
                                        {bucket.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex gap-6 overflow-x-auto pb-6 relative pt-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent snap-x snap-mandatory">
                            {pbTimeline.filter(pb => {
                                const bucket = RUNNING_BUCKETS.find(b => b.label === pb.bucketLabel);
                                return bucket && selectedBuckets.includes(bucket.key);
                            }).length === 0 ? (
                                <div className="text-center text-slate-500 text-sm italic py-10">
                                    Inga personbästan registrerade för valda distanser och filter.
                                </div>
                            ) : (
                                pbTimeline
                                    .filter(pb => {
                                        const bucket = RUNNING_BUCKETS.find(b => b.label === pb.bucketLabel);
                                        return bucket && selectedBuckets.includes(bucket.key);
                                    })
                                    .map((pb, idx) => {
                                        const bucketDef = RUNNING_BUCKETS.find(b => b.label === pb.bucketLabel);
                                        return (
                                            <div
                                                key={`${pb.id}-${idx}`}
                                                className={`relative w-64 flex-none group cursor-pointer`}
                                                onClick={() => setSelectedActivity(pb.activity)}
                                            >
                                                {/* Connecting line */}
                                                {idx < pbTimeline.filter(pb => {
                                                    const bucket = RUNNING_BUCKETS.find(b => b.label === pb.bucketLabel);
                                                    return bucket && selectedBuckets.includes(bucket.key);
                                                }).length - 1 && (
                                                        <div className="absolute top-10 left-32 flex w-full h-[2px] bg-slate-800">
                                                            <div className={`h-full bg-${bucketDef?.color}-500/20 w-full rounded-full transition-all`} />
                                                        </div>
                                                    )}

                                                <div className="flex flex-col items-center">
                                                    {/* Node dot */}
                                                    <div className={`w-5 h-5 rounded-full border-4 border-slate-900 bg-${bucketDef?.color}-500 relative z-10 shadow-lg shadow-${bucketDef?.color}-500/50 mb-3 transition-transform group-hover:scale-125`} />

                                                    {/* Content card */}
                                                    <div className={`bg-slate-900/80 border border-white/5 hover:border-${bucketDef?.color}-500/50 rounded-2xl p-4 text-center transition-all w-full relative`}>
                                                        <div className={`text-[10px] font-black uppercase text-${bucketDef?.color}-400 mb-1 tracking-wider`}>
                                                            {pb.bucketLabel} {pb.isRace && <span className="inline-flex"><Medal size={10} className="ml-0.5" /></span>}
                                                        </div>

                                                        {pb.previousDurationSeconds ? (
                                                            <div className="flex flex-col items-center gap-0.5 mb-1.5">
                                                                <span className="text-xs text-slate-500 line-through font-mono opacity-80">{formatTime(pb.previousDurationSeconds)}</span>
                                                                <div className="flex items-center gap-1">
                                                                    <div className={`text-xl font-black text-white font-mono leading-none`}>
                                                                        {pb.durationFormatted}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded flex items-center gap-0.5" title="Förbättring från föregående PB">
                                                                        <TrendingUp size={10} /> -{pb.improvementSeconds ? formatTime(pb.improvementSeconds) : ''}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className={`text-xl font-black text-white mb-2 font-mono`}>
                                                                {pb.durationFormatted}
                                                            </div>
                                                        )}

                                                        <p className="text-xs text-slate-400 font-medium truncate" title={pb.activity.title || pb.activity.notes}>
                                                            {pb.activity.title && pb.activity.title !== '-' ? pb.activity.title : pb.activity.notes || 'Löprunda'}
                                                        </p>
                                                        <div className="flex items-center justify-center gap-3 mt-2.5">
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">
                                                                {getDaysAgoText(pb.date)}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-medium">
                                                                {formatPace(pb.durationSeconds / pb.distance)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedActivity && (
                <ActivityDetailModal
                    activity={{ ...selectedActivity, source: 'strava' }} // Assumes they might be strava or manual. DetailModal handles it well.
                    universalActivity={selectedUniversal}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}
