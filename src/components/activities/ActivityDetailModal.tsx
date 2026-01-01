import React, { useState, useEffect } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { StrengthWorkout } from '../../models/strengthTypes.ts';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { formatDuration, formatPace, getRelativeTime, formatSwedishDate } from '../../utils/dateUtils.ts';
import { calculatePerformanceScore, calculateGAP, getPerformanceBreakdown } from '../../utils/performanceEngine.ts';
import { HeartRateZones } from '../training/HeartRateZones.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Expandable Exercise Component - click to show sets
function ExpandableExercise({ exercise }: { exercise: any }) {
    const [expanded, setExpanded] = useState(false);
    const totalReps = exercise.sets.reduce((s: number, set: any) => s + (set.reps || 0), 0);
    const totalDistance = exercise.sets.reduce((s: number, set: any) => s + (set.distance || 0), 0);
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
                    {totalDistance > 0 ? (
                        <span className="text-emerald-400 font-mono">{totalDistance}m</span>
                    ) : (
                        <span className="text-blue-400">{totalReps} reps</span>
                    )}
                    {volume > 0 && (
                        <span className="text-purple-400 font-mono">
                            {volume >= 1000 ? `${(volume / 1000).toFixed(1)}t` : `${Math.round(volume)}kg`}
                        </span>
                    )}
                </div>
            </button>
            {expanded && (
                <div className="px-3 pb-2 space-y-1 border-t border-white/5">
                    {exercise.sets.map((set: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 text-slate-400">
                            <span className="text-slate-500 font-mono">#{i + 1}</span>
                            <div className="flex gap-4">
                                {set.weight > 0 && <span className="text-white font-mono">{set.weight}kg</span>}
                                {set.reps > 0 && <span className="text-blue-400">× {set.reps}</span>}
                                {set.distance > 0 && <span className="text-emerald-400 font-mono">{set.distance}m</span>}
                                {set.time && <span className="text-slate-500 font-mono">{set.time}</span>}
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
    const [viewMode, setViewMode] = useState<'combined' | 'diff' | 'raw'>('combined');
    const [activeTab, setActiveTab] = useState<'stats' | 'compare' | 'splits' | 'merge'>('stats');
    const [showScoreInfo, setShowScoreInfo] = useState(false);
    const [isUnmerging, setIsUnmerging] = useState(false);
    const { exerciseEntries, universalActivities } = useData();
    const { token } = useAuth();

    // Check if this is a manually merged activity (using our new merge system)
    const isMergedActivity = universalActivity?.mergeInfo?.isMerged === true;
    const mergeInfo = universalActivity?.mergeInfo;

    // Get original activities for merged view
    const originalActivities = React.useMemo(() => {
        if (!isMergedActivity || !mergeInfo?.originalActivityIds) return [];
        return universalActivities.filter(u => mergeInfo.originalActivityIds.includes(u.id));
    }, [isMergedActivity, mergeInfo, universalActivities]);

    // Combine manual entries with mapped universal activities
    const allActivities = React.useMemo(() => {
        const stravaEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);
        return [...exerciseEntries, ...stravaEntries];
    }, [exerciseEntries, universalActivities]);

    const perfBreakdown = getPerformanceBreakdown(activity, allActivities);
    const perf = universalActivity?.performance || activity._mergeData?.universalActivity?.performance;
    const mergeData = activity._mergeData;
    const isMerged = activity.source === 'merged' && mergeData;
    const strengthWorkout = mergeData?.strengthWorkout;

    // Derived splits helper
    const splits = perf?.splits || [];
    const hasSplits = splits.length > 0;

    // Unmerge handler
    const handleUnmerge = async () => {
        if (!universalActivity?.id || !token) return;
        setIsUnmerging(true);
        try {
            const response = await fetch(`/api/activities/${universalActivity.id}/separate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await response.json();
            if (result.success) {
                onClose();
                window.location.reload();
            } else {
                alert(`Separering misslyckades: ${result.error}`);
            }
        } catch (e) {
            alert('Separering misslyckades: Nätverksfel');
        } finally {
            setIsUnmerging(false);
        }
    };

    // Find similar activities for comparison
    const similarActivities = React.useMemo(() => {
        if (!activity.type) return [];

        return allActivities
            .filter(a =>
                a.id !== activity.id &&
                (a.type?.toLowerCase() === activity.type?.toLowerCase()) &&
                activity.distance && a.distance &&
                Math.abs(a.distance - activity.distance) < (activity.distance * 0.25)
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);
    }, [activity, allActivities]);

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
                    {isMergedActivity && (
                        <button
                            onClick={() => setActiveTab('merge')}
                            className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'merge' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            <span>⚡</span> Sammanslagen ({originalActivities.length})
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
                    {isMerged ? (
                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                            <span>⚡</span> StrengthLog + Strava
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                            <span>📄</span> {activity.source}
                        </div>
                    )}

                    {/* View Mode Toggle */}
                    <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('combined')}
                            className={`px-3 py-1 text-[10px] font-bold rounded ${viewMode === 'combined' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            📊 Kombinerat
                        </button>
                        {isMerged && (
                            <button
                                onClick={() => setViewMode('diff')}
                                className={`px-3 py-1 text-[10px] font-bold rounded ${viewMode === 'diff' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                ⚖️ Diff
                            </button>
                        )}
                        <button
                            onClick={() => setViewMode('raw')}
                            className={`px-3 py-1 text-[10px] font-bold rounded ${viewMode === 'raw' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            📄 Rådata
                        </button>
                    </div>
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

                            {/* Pace Card (Only if distance exists) */}
                            {(activity.distance && activity.distance > 0) ? (
                                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-emerald-400">
                                        {formatPace((activity.durationMinutes * 60) / activity.distance).replace('/km', '')}
                                    </p>
                                    <p className="text-xs text-slate-500 uppercase">Tempo</p>
                                </div>
                            ) : null}

                            <div
                                className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-4 text-center cursor-pointer hover:bg-indigo-500/30 transition-all active:scale-95 shadow-lg shadow-indigo-500/10"
                                onClick={() => setShowScoreInfo(!showScoreInfo)}
                            >
                                <p className="text-2xl font-black text-indigo-400">{perfBreakdown.totalScore}</p>
                                <p className="text-xs text-slate-500 uppercase flex items-center justify-center gap-1">
                                    Greens Score
                                    <span className="text-[10px] opacity-50">{showScoreInfo ? '▼' : '▲'}</span>
                                </p>
                            </div>
                        </div>

                        {/* Greens Score Visual Breakdown */}
                        {showScoreInfo && (
                            <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-black text-white uppercase text-xs tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                        Resultatanalys
                                    </h4>
                                    <span className="text-[10px] font-mono text-slate-500 uppercase">{perfBreakdown.summary}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Big Score Gauge (CSS Simple) */}
                                    <div className="flex flex-col items-center justify-center py-2">
                                        <div className="relative w-28 h-28 flex items-center justify-center">
                                            {perfBreakdown.isPersonalBest && (
                                                <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-bounce z-10 border-2 border-slate-900">
                                                    🏆
                                                </div>
                                            )}
                                            <svg className="w-full h-full -rotate-90">
                                                <circle cx="56" cy="56" r="50" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                                <circle
                                                    cx="56" cy="56" r="50" fill="transparent"
                                                    stroke="currentColor" strokeWidth="8"
                                                    strokeDasharray={314}
                                                    strokeDashoffset={314 - (314 * perfBreakdown.totalScore) / 100}
                                                    strokeLinecap="round"
                                                    className="text-indigo-500 transition-all duration-1000 ease-out"
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-3xl font-black text-white">{perfBreakdown.totalScore}</span>
                                                <span className="text-[8px] text-slate-500 uppercase font-bold">Poäng</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Component Bars */}
                                    <div className="flex flex-col justify-center space-y-4">
                                        {perfBreakdown.components.map((comp, idx) => (
                                            <div key={idx} className="space-y-1.5">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                                        <span>{comp.icon}</span> {comp.label}
                                                        {comp.isPersonalBest && <span className="text-[8px] bg-yellow-500/10 text-yellow-500 px-1 rounded border border-yellow-500/20">PB</span>}
                                                    </span>
                                                    <span className={`text-xs font-mono font-bold ${comp.color}`}>{comp.value}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-1000 delay-300 ${comp.color.replace('text-', 'bg-')}`}
                                                        style={{ width: `${Math.max(5, (comp.score / comp.max) * 100)}%` }}
                                                    />
                                                </div>
                                                <p className={`text-[9px] italic leading-tight ${comp.isPersonalBest ? 'text-yellow-500/70' : 'text-slate-500'}`}>
                                                    {comp.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-white/5">
                                    <div className="bg-indigo-500/5 rounded-lg p-3 border border-indigo-500/10 text-[10px] text-slate-400 leading-relaxed">
                                        <strong className="text-indigo-400 block mb-1">💡 Tips för detta pass:</strong>
                                        {perfBreakdown.type === 'cardio' ?
                                            "För att höja din Greens Score, försök sänka din ansträngning (puls) vid bibehållen hastighet, eller öka hastigheten vid samma puls genom förbättrad löpekonomi." :
                                            "Din score speglar arbetstakten (kg/min). Kör du färre och längre vilar sänks poängen, medan ett högre tempo med bibehållen vikt höjer den."
                                        }
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Heart Rate Zone Visualization (for cardio with HR data) */}
                        {perf?.avgHeartRate && activity.type?.toLowerCase() !== 'strength' && (
                            <HeartRateZones
                                avgHeartRate={Math.round(perf.avgHeartRate)}
                                maxHeartRate={perf.maxHeartRate ? Math.round(perf.maxHeartRate) : undefined}
                                duration={activity.durationMinutes ? activity.durationMinutes * 60 : undefined}
                            />
                        )}

                        {/* Simple HR display fallback (for strength or merged) */}
                        {(perf?.avgHeartRate || perf?.maxHeartRate) && activity.type?.toLowerCase() === 'strength' && (
                            <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 w-fit">
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
                            {(perf?.elevationGain > 0) && (
                                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4">
                                    <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">⛰️ Höjdmeter</h3>
                                    <span className="text-2xl font-black text-white">{Math.round(perf.elevationGain)}</span>
                                    <span className="text-xs text-slate-400 ml-1">m</span>
                                </div>
                            )}
                            {(activity.distance && activity.distance > 0 && perf?.elevationGain) ? (
                                <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4">
                                    <h3 className="text-xs font-bold text-indigo-400 uppercase mb-2">📈 Effektivt Tempo (GAP)</h3>
                                    <span className="text-2xl font-black text-white">
                                        {formatPace(calculateGAP((activity.durationMinutes * 60) / activity.distance, perf.elevationGain, activity.distance))}
                                    </span>
                                    <span className="text-xs text-slate-400 ml-1">/km</span>
                                </div>
                            ) : null}
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

                {/* RAW DATA VIEW */}
                {viewMode === 'raw' && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase">📄 Rådata för felsökning</h3>
                        <div className="bg-slate-950 border border-white/5 rounded-xl p-4 overflow-auto max-h-[50vh] custom-scrollbar">
                            <pre className="text-[10px] text-slate-500 font-mono leading-relaxed">
                                {JSON.stringify(activity, null, 2)}
                            </pre>
                        </div>
                        <p className="text-[10px] text-slate-600 italic">
                            Denna vy visar den kombinerade JSON-strukturen för aktiviteten, inklusive merge-data och källinfo.
                        </p>
                    </div>
                )}

                {/* COMPARISON TAB */}
                {activeTab === 'compare' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">⚖️ Jämför med liknande pass</h3>
                            <span className="text-[10px] text-slate-500 uppercase font-mono">Baserat på distans (+/- 25%)</span>
                        </div>

                        {similarActivities.length > 0 ? (
                            <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/5">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-950/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-slate-500 font-bold uppercase text-[10px]">Datum</th>
                                            <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">Tempo</th>
                                            {activity.elevationGain !== undefined && <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">Höjd</th>}
                                            <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">Puls</th>
                                            <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">Greens</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 font-mono">
                                        <tr className="bg-indigo-500/15 group relative">
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold">{formatSwedishDate(activity.date)}</span>
                                                    <span className="text-[10px] text-indigo-400 font-bold uppercase">Detta pass</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-white font-bold">{activity.distance ? formatPace((activity.durationMinutes * 60) / activity.distance) : '-'}</span>
                                                    <span className="text-[9px] text-slate-500 uppercase">{activity.distance} km</span>
                                                </div>
                                            </td>
                                            {activity.elevationGain !== undefined && (
                                                <td className="px-4 py-4 text-right text-emerald-400 font-bold">{Math.round(activity.elevationGain)}m</td>
                                            )}
                                            <td className="px-4 py-4 text-right text-rose-400 font-bold">{perf?.avgHeartRate ? Math.round(perf.avgHeartRate) : '-'}</td>
                                            <td className="px-4 py-4 text-right">
                                                <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded">
                                                    {calculatePerformanceScore(activity)}
                                                </span>
                                            </td>
                                        </tr>
                                        {similarActivities.map(a => {
                                            const aPaceSec = a.distance ? (a.durationMinutes * 60 / a.distance) : 0;
                                            const aScore = calculatePerformanceScore(a);
                                            return (
                                                <tr key={a.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-300">{formatSwedishDate(a.date)}</span>
                                                            <span className="text-[10px] text-slate-500 uppercase">{getRelativeTime(a.date)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-slate-300">{aPaceSec ? formatPace(aPaceSec) : '-'}</span>
                                                            <span className="text-[9px] text-slate-500 uppercase">{a.distance} km</span>
                                                        </div>
                                                    </td>
                                                    {activity.elevationGain !== undefined && (
                                                        <td className="px-4 py-4 text-right text-slate-400">{Math.round(a.elevationGain || 0)}m</td>
                                                    )}
                                                    <td className="px-4 py-4 text-right text-slate-400">{a.heartRateAvg || '-'}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className={`text-[10px] font-black px-2 py-1 rounded ${aScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                                                            aScore >= 60 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-500/20 text-slate-400'
                                                            }`}>
                                                            {aScore}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-dashed border-white/5">
                                <span className="text-3xl block mb-2 opacity-50">🔍</span>
                                <div className="text-slate-500 italic text-sm">Inga liknande pass inom +/- 25% distans hittades.</div>
                            </div>
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

                {/* MERGE TAB - Shows original activities for manually merged activities */}
                {activeTab === 'merge' && isMergedActivity && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">⚡ Sammanslagen aktivitet</h3>
                            <span className="text-[10px] text-slate-500 uppercase font-mono">
                                Skapad {mergeInfo?.mergedAt ? formatSwedishDate(mergeInfo.mergedAt.split('T')[0]) : '-'}
                            </span>
                        </div>

                        <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4">
                            <p className="text-sm text-slate-300 mb-4">
                                Denna aktivitet är en sammanslagning av <strong className="text-amber-400">{originalActivities.length}</strong> separata aktiviteter.
                                De kombinerade värdena (distans, tid, kalorier osv.) har räknats ut automatiskt.
                            </p>

                            {/* Original Activities List */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase">Ingående aktiviteter:</h4>
                                {originalActivities.length > 0 ? (
                                    originalActivities.map((orig, idx) => (
                                        <div key={orig.id} className="bg-slate-800/50 border border-white/5 rounded-lg p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-bold capitalize">{orig.performance?.activityType || 'Aktivitet'}</p>
                                                        <p className="text-xs text-slate-500">{formatSwedishDate(orig.date)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 text-sm">
                                                    {orig.performance?.distanceKm && (
                                                        <div className="text-right">
                                                            <p className="text-emerald-400 font-mono font-bold">{orig.performance.distanceKm.toFixed(1)} km</p>
                                                        </div>
                                                    )}
                                                    {orig.performance?.durationMinutes && (
                                                        <div className="text-right">
                                                            <p className="text-slate-300 font-mono">{formatDuration(orig.performance.durationMinutes * 60)}</p>
                                                        </div>
                                                    )}
                                                    {orig.performance?.distanceKm && orig.performance?.durationMinutes && (
                                                        <div className="text-right">
                                                            <p className="text-indigo-400 font-mono">{formatPace((orig.performance.durationMinutes * 60) / orig.performance.distanceKm)}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-500 italic text-sm">
                                        Originalaktiviteterna kunde inte hittas. De kan ha tagits bort.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Unmerge Option */}
                        <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">🔀 Ta isär aktiviteter</h4>
                            <p className="text-sm text-slate-400 mb-4">
                                Om sammanslagningen blev fel kan du separera dem igen. Den sammanslagna aktiviteten försvinner och de ursprungliga aktiviteterna visas på nytt.
                            </p>
                            <button
                                onClick={handleUnmerge}
                                disabled={isUnmerging}
                                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {isUnmerging ? '⏳ Separerar...' : '🔀 Separera aktiviteter'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {isMergedActivity && (
                        <button
                            onClick={handleUnmerge}
                            disabled={isUnmerging}
                            className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            {isUnmerging ? '⏳...' : '🔀 Separera'}
                        </button>
                    )}
                    {isMerged && onSeparate && !isMergedActivity && (
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
                        className={`flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors`}
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
