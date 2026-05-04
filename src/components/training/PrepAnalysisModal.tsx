import React, { useMemo, useState } from 'react';
import { ExerciseEntry, PlannedActivity } from '../../models/types.ts';
import {
    X, Medal, Zap, Activity, Clock, TrendingUp, TrendingDown,
    Mountain, Coffee, Timer, Sparkles, RefreshCw, Trophy,
    Shield, Target, Heart, ChevronRight, ChevronLeft, MapPin, Star, Trophy as TrophyIcon,
    BarChart3
} from 'lucide-react';
import { formatTime, isCompetition } from '../../utils/activityUtils.ts';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ComposedChart, Line, Scatter, CartesianGrid } from 'recharts';
import { useData } from '../../context/DataContext.tsx';
import { normalizeRaceTitle } from './races/utils.ts';
import { useNavigate } from 'react-router-dom';
import { ActivityDetailModal } from '../activities/ActivityDetailModal.tsx';
import { usePrepAggregation, PrepEvent } from './hooks/usePrepAggregation.ts';

interface PrepAnalysisModalProps {
    event: PrepEvent;
    allActivities: ExerciseEntry[];
    onClose: () => void;
}

export function PrepAnalysisModal({ event, allActivities, onClose }: PrepAnalysisModalProps) {
    const navigate = useNavigate();
    const [timeframeWeeks, setTimeframeWeeks] = useState(12);
    const [comparisonEvent, setComparisonEvent] = useState<PrepEvent | null>(null);
    const [showSelector, setShowSelector] = useState(false);
    const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
    const { weightEntries, calculateDailyNutrition } = useData();

    // Setup the dynamic window leading UP TO the event date
    const analysisWindow = usePrepAggregation(event, allActivities, timeframeWeeks);
    const compWindow = usePrepAggregation(comparisonEvent || event, allActivities, timeframeWeeks);

    const isComparing = !!comparisonEvent;

    const formatPace = (secPerKm: number) => {
        if (!isFinite(secPerKm) || secPerKm <= 0) return '-';
        const m = Math.floor(secPerKm / 60);
        const s = Math.round(secPerKm % 60);
        return `${m}:${s.toString().padStart(2, '0')}/km`;
    };
    const DiffBadge = ({ v1, v2, higherIsBetter = true, type = 'number' }: { v1: number, v2: number, higherIsBetter?: boolean, type?: 'number' | 'pace' | 'percent' | 'time' }) => {
        if (!isComparing) return null;
        if (v1 === v2) return null;

        const isGood = type === 'pace' ? v1 < v2 : (higherIsBetter ? v1 > v2 : v1 < v2);
        const absDiff = Math.abs(v1 - v2);

        let label = '';
        if (type === 'pace') label = `${Math.floor(absDiff / 60)}:${Math.round(absDiff % 60).toString().padStart(2, '0')}`;
        else if (type === 'percent') label = `${absDiff.toFixed(0)}%`;
        else if (type === 'time') label = `${Math.floor(absDiff / 60)}h ${Math.round(absDiff % 60)}m`;
        else label = absDiff.toFixed(1);

        const pct = v2 > 0 ? Math.round((absDiff / v2) * 100) : null;

        return (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 leading-none ${isGood ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                <span>{v1 > v2 ? '+' : v1 < v2 ? '-' : ''}{label}</span>
                {pct !== null && <span className="opacity-40 font-mono">({pct}%)</span>}
            </span>
        );
    };

    const ActivityRow = ({ r, icon }: { r: ExerciseEntry; icon: React.ReactNode }) => {
        const paceSec = r.durationMinutes > 0 ? (r.durationMinutes * 60) / (r.distance || 1) : 0;
        const isCycling = r.type?.toLowerCase().includes('cycle') || r.type?.toLowerCase().includes('cykel') || r.type?.toLowerCase() === 'virtualride';

        return (
            <div
                key={r.id}
                className="flex justify-between items-center bg-white/5 rounded-2xl p-3 hover:bg-white/10 cursor-pointer transition-all border border-white/5 hover:border-white/10 group"
                onClick={() => {
                    setSelectedDetailId(r.id);
                }}
            >
                <div className="overflow-hidden flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-black text-white truncate group-hover:text-amber-400 transition-colors" title={r.title || r.type}>
                            {r.title || r.type}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="font-bold">{r.date.substring(0, 10)}</span>
                            {r.distance && (
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                    isCompetition(r) ? 'bg-red-500/20 text-red-500' :
                                    r.subType === 'interval' || r.title?.toLowerCase().includes('intervall') ? 'bg-amber-500/20 text-amber-500' :
                                    r.subType === 'tempo' || r.title?.toLowerCase().includes('tempo') ? 'bg-yellow-500/20 text-yellow-500' :
                                    (r as any).isQuality ? 'bg-orange-500/20 text-orange-400' :
                                    r.distance >= 40 ? 'bg-purple-500/20 text-purple-400' : 
                                    r.distance >= 20 ? 'bg-emerald-500/20 text-emerald-400' : 
                                    r.distance >= 14 ? 'bg-sky-500/20 text-sky-400' :
                                    r.distance <= 7 ? 'bg-indigo-500/20 text-indigo-400' :
                                    'bg-slate-500/20 text-slate-400'
                                }`}>
                                    {isCompetition(r) ? 'Tävling' :
                                     r.subType === 'interval' || r.title?.toLowerCase().includes('intervall') ? 'Intervall' :
                                     r.subType === 'tempo' || r.title?.toLowerCase().includes('tempo') ? 'Tempo' :
                                     (r as any).isQuality ? 'Kvalitét' :
                                     r.distance >= 40 ? 'Överlångt' : r.distance >= 20 ? 'Långpass' : r.distance >= 14 ? 'Längre Distans' : r.distance <= 7 ? 'Återhämtning' : 'Distans'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end justify-center min-w-[80px]">
                    <div className="flex flex-col items-end">
                        <div className="flex items-baseline gap-1">
                             <span className="text-xs font-black text-white">{r.distance ? r.distance.toFixed(1) : '-'}</span>
                             <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">km</span>
                        </div>
                        <div className="text-[10px] font-black text-indigo-300/80 font-mono leading-none">
                            {r.durationMinutes ? `${Math.floor(r.durationMinutes / 60)}h ${Math.floor(r.durationMinutes % 60)}m` : '-'}
                        </div>
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono font-bold mt-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                        {isCycling ? (r.distance && r.durationMinutes ? (r.distance / (r.durationMinutes / 60)).toFixed(1) + ' km/h' : '-') : formatPace(paceSec)}
                    </div>
                </div>
            </div>
        );
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">{label}</p>
                    <div className="space-y-1.5">
                        <div className="flex justify-between gap-8">
                            <span className="text-xs text-emerald-500">{isComparing ? 'Aktuell:' : 'Volym:'}</span>
                            <span className="text-xs font-black text-white">{data.vol} km</span>
                        </div>
                        {isComparing && (
                            <div className="flex justify-between gap-8">
                                <span className="text-xs text-indigo-400">Jämförelse:</span>
                                <span className="text-xs font-black text-slate-400">{data.compVol} km</span>
                            </div>
                        )}
                        {data.raceList && data.raceList.length > 0 && (
                            <div className="pt-1.5 border-t border-white/5 mt-1.5">
                                {data.raceList.map((race: any, i: number) => (
                                    <div key={i} className="flex justify-between gap-4 mb-0.5 last:mb-0">
                                        <span className="text-[10px] font-black text-amber-500 truncate max-w-[80px]">{race.title}</span>
                                        <span className="text-[10px] font-black text-amber-400">{race.distance} km</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const mergedChartData = useMemo(() => {
        if (!isComparing) return analysisWindow.chartData;
        return analysisWindow.chartData.map((d, i) => ({
            ...d,
            compVol: compWindow.chartData[i]?.vol || 0
        }));
    }, [analysisWindow.chartData, compWindow.chartData, isComparing]);

    const potentialComparisonEvents = useMemo(() => {
        const normTarget = normalizeRaceTitle(event.title);
        
        const races = allActivities.filter(isCompetition).map(act => {
            const actTitle = act.title || act.name || 'Race';
            const isMatch = normalizeRaceTitle(actTitle) === normTarget && normTarget !== '';
            
            return {
                id: act.id,
                date: act.date,
                title: actTitle,
                distance: act.distance || 0,
                durationMinutes: act.durationMinutes,
                placement: act.raceDetails?.placement,
                averageSpeed: act.averageSpeed || (act.distance && act.durationMinutes ? (act.distance / (act.durationMinutes / 60)) : undefined),
                isRace: true,
                isExactSeriesMatch: isMatch,
                activity: act
            };
        });

        return races.sort((a, b) => {
            // Prioritize exact series matches
            if (a.isExactSeriesMatch && !b.isExactSeriesMatch) return -1;
            if (!a.isExactSeriesMatch && b.isExactSeriesMatch) return 1;
            // Then sort by date
            return b.date.localeCompare(a.date);
        }).filter(s => s.id !== event.id);
    }, [allActivities, event.id, event.title]);
    
    // 3. Hall of Fame - Top 10 for this distance
    const leaderboard = useMemo(() => {
        const targetM = event.distance * 1000;
        if (targetM <= 0) return [];

        const candidates = allActivities
            .filter(act => {
                const lowType = (act.type || '').toLowerCase();
                const isInterval = (act.subType === 'interval' || (act.title || '').toLowerCase().includes('intervall'));
                return (lowType.includes('run') || lowType.includes('löpning')) && !isInterval;
            })
            .map(act => {
                const dist = act.distance || 0;
                const time = (act.durationMinutes || 0) * 60;
                
                // Allow a small tolerance for "roughly" matching the target distance
                // e.g. for a 5k, we accept 4.95 - 5.10km if it's a legacy entry
                const tolerance = Math.max(0.05, targetM * 0.01 / 1000); 
                if (Math.abs(dist - event.distance) <= tolerance && time > 0) {
                    return {
                        id: act.id,
                        date: act.date,
                        title: act.title || act.type,
                        distance: dist,
                        movingTime: time,
                        isRace: isCompetition(act),
                        isCurrent: act.id === event.id
                    };
                }
                return null;
            })
            .filter((e): e is any => e !== null)
            .sort((a, b) => a.movingTime - b.movingTime);

        // Deduplicate by date (keep only one entry per day if multiple runs)
        const unique = new Map<string, any>();
        candidates.forEach(c => {
            const day = c.date.substring(0, 10);
            if (!unique.has(day) || unique.get(day).movingTime > c.movingTime) {
                unique.set(day, c);
            }
        });

        return Array.from(unique.values()).sort((a, b) => a.movingTime - b.movingTime).slice(0, 10);
    }, [allActivities, event.distance, event.id]);

    const allTimePB = leaderboard[0];
    const previousPB = useMemo(() => {
        if (!allTimePB) return null;
        // If current is PB, find the next best
        if (allTimePB.isCurrent) return leaderboard[1] || null;
        return allTimePB;
    }, [leaderboard, allTimePB]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-7xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-slate-900 border-b border-white/5 px-6 py-2 flex justify-between items-center sticky top-0 z-10 gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                {event.isRace ? <Medal size={16} /> : <Zap size={16} />}
                            </div>
                            <div className="flex flex-col">
                                <h2 className="text-xs font-black text-white truncate max-w-[150px]">
                                    {event.bucketLabel || event.title}
                                </h2>
                                <span className="text-[10px] text-slate-500 font-mono italic">{event.date.substring(0,10)}</span>
                            </div>
                        </div>

                        {isComparing && (
                            <>
                                <div className="text-slate-700 font-black text-[10px]">VS</div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
                                        <Medal size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="text-xs font-black text-white truncate max-w-[150px]">
                                            {comparisonEvent?.title}
                                        </h2>
                                        <span className="text-[10px] text-slate-500 font-mono italic">{comparisonEvent?.date.substring(0,10)}</span>
                                    </div>
                                    <button onClick={() => setComparisonEvent(null)} className="p-1 text-slate-500 hover:text-rose-500">
                                        <X size={14} />
                                    </button>
                                </div>
                            </>
                        )}

                        {!isComparing && (
                            <button 
                                onClick={() => setShowSelector(!showSelector)}
                                className="ml-4 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all flex items-center gap-1.5"
                            >
                                <RefreshCw size={12} /> Jämför träningsprep
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center bg-slate-950/80 rounded-lg border border-white/5 p-0.5 scale-90">
                            {[4, 8, 12, 16, 26].map(weeks => (
                                <button key={weeks} onClick={() => setTimeframeWeeks(weeks)} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded transition-all ${timeframeWeeks === weeks ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>{weeks === 26 ? '6m' : weeks + 'v'}</button>
                            ))}
                        </div>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg shrink-0">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {showSelector && (
                    <div className="bg-slate-950 border-b border-white/5 p-4 flex flex-col gap-2 animate-in slide-in-from-top duration-300">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Välj lopp eller PB att jämföra med</span>
                            <button onClick={() => setShowSelector(false)} className="text-[10px] font-black text-slate-400 hover:text-white uppercase">Avbryt</button>
                        </div>
                        <div className="flex gap-2 p-2 overflow-x-auto custom-scrollbar">
                            {potentialComparisonEvents.slice(0, 15).map(e => (
                                <button 
                                    key={e.id}
                                    onClick={() => {
                                        setComparisonEvent(e as any);
                                        setShowSelector(false);
                                    }}
                                    className={`flex-shrink-0 border p-2 rounded-xl text-left w-48 transition-all hover:bg-slate-800 ${
                                        e.isExactSeriesMatch 
                                            ? 'bg-amber-500/10 border-amber-500/50 hover:border-amber-400' 
                                            : 'bg-slate-900 border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <div className="text-[10px] font-black text-white truncate">{e.title}</div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {e.placement && <div className="text-[8px] bg-amber-500 text-slate-950 px-1 rounded font-black">#{e.placement}</div>}
                                            {e.isExactSeriesMatch && <Trophy size={10} className="text-amber-400" />}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mb-1">
                                        <span>{e.date.substring(0, 10)}</span>
                                        <span className="font-bold text-slate-400">{e.distance}km</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[8px] text-slate-400 font-bold uppercase tracking-tighter pt-1 border-t border-white/5">
                                        <span>{e.durationMinutes ? `${Math.floor(e.durationMinutes / 60)}h ${Math.floor(e.durationMinutes % 60)}m` : '-'}</span>
                                        <span>{e.averageSpeed ? e.averageSpeed.toFixed(1) + ' km/h' : '-'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {/* Compact Metrics Bar */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl flex flex-col justify-between">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Activity size={12} className="text-blue-500" /> Volym (Löpning)</div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-black text-white">{Math.round(analysisWindow.totalRunVolumeKm)} <span className="text-[10px] font-bold text-slate-500">km</span></span>
                                </div>
                                <DiffBadge v1={analysisWindow.totalRunVolumeKm} v2={compWindow.totalRunVolumeKm} />
                            </div>
                            {analysisWindow.totalCyclingVolumeKm > 0 && (
                                <div className="text-[9px] text-emerald-500 font-bold mt-1 bg-emerald-500/10 px-1.5 py-0.5 rounded inline-block">
                                    + {Math.round(analysisWindow.totalCyclingVolumeKm)} km cykling
                                </div>
                            )}
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                                <span>{analysisWindow.totalRunCount} pass</span>
                                {analysisWindow.warmupCount > 0 && (
                                    <div className="group/wu relative">
                                        <span className="text-rose-400 bg-rose-400/10 px-1 py-0.25 rounded cursor-help font-black">+{analysisWindow.warmupCount}</span>
                                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover/wu:opacity-100 transition-opacity pointer-events-none z-[250]">
                                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Identifierat som upp/nerjogg</p>
                                            <div className="space-y-1">
                                                {analysisWindow.warmups.map((w : any, i : number) => (
                                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-300 truncate max-w-[100px]">{w.title || w.type}</span>
                                                        <span className="text-slate-500 font-mono">{w.distance?.toFixed(1)}km</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="mt-2 pt-1 border-t border-white/5 text-[9px] text-slate-600 italic">Dessa har räknats i volym och snitt-tempo, men undantagits från antal pass.</p>
                                        </div>
                                    </div>
                                )}
                                <span className="text-slate-700">•</span>
                                <span>{Math.round(analysisWindow.avgWeeklyVol)} km/v</span>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl flex flex-col justify-between">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Timer size={12} className="text-amber-500" /> Total Träningstid</div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-xl font-black text-white">{Math.floor(analysisWindow.totalActiveTimeMin / 60)}</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase">timmar</span>
                                    <span className="text-xl font-black text-white">{Math.round(analysisWindow.totalActiveTimeMin % 60)}</span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase">min</span>
                                </div>
                                <DiffBadge v1={analysisWindow.totalActiveTimeMin} v2={compWindow.totalActiveTimeMin} />
                            </div>
                            <div className="text-[9px] text-slate-500 mt-1 flex gap-2">
                                <span>🏃 {Math.floor(analysisWindow.totalRunTimeMin / 60)}h {Math.round(analysisWindow.totalRunTimeMin % 60)}m</span>
                                {analysisWindow.totalCyclingTimeMin > 0 && <span>🚲 {Math.floor(analysisWindow.totalCyclingTimeMin / 60)}h {Math.round(analysisWindow.totalCyclingTimeMin % 60)}m</span>}
                                {analysisWindow.totalOtherTimeMin > 0 && <span>💪 {Math.floor(analysisWindow.totalOtherTimeMin / 60)}h {Math.round(analysisWindow.totalOtherTimeMin % 60)}m</span>}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Zap size={12} className="text-amber-500" /> Snitt-tempo</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-white">{formatPace(analysisWindow.avgPaceSecPerKm)}</span>
                                <DiffBadge v1={analysisWindow.avgPaceSecPerKm} v2={compWindow.avgPaceSecPerKm} higherIsBetter={false} type="pace" />
                            </div>
                            <div className="text-[9px] text-slate-500 mt-1">
                                {isComparing ? (
                                    <span>Jämförelse: {formatPace(compWindow.avgPaceSecPerKm)}</span>
                                ) : (
                                    <span>Snitt-tempo (endast löpning)</span>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Mountain size={12} className="text-rose-500" /> Höjdmeter</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-rose-400">{Math.round(analysisWindow.totalElevationGain)} <span className="text-[10px] font-bold text-slate-500">m+</span></span>
                                <DiffBadge v1={analysisWindow.totalElevationGain} v2={compWindow.totalElevationGain} />
                            </div>
                            {isComparing && (
                                <div className="text-[9px] text-rose-900/30 mt-1">Samma period tidigare: {Math.round(compWindow.totalElevationGain)} m+</div>
                            )}
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><TrendingUp size={12} className="text-emerald-500" /> Kontinuitet</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-emerald-400">{Math.round(analysisWindow.consistencyScore)}%</span>
                                <DiffBadge v1={analysisWindow.consistencyScore} v2={compWindow.consistencyScore} type="percent" />
                            </div>
                            <div className="text-[9px] text-slate-500 mt-1 leading-tight">
                                {isComparing ? (
                                    <span>Jämfört med: {Math.round(compWindow.consistencyScore)}%</span>
                                ) : (
                                    <span>{analysisWindow.activeDaysCount} träningsdagar</span>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 p-3 rounded-2xl">
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><TrophyIcon size={12} className="text-indigo-500" /> Kvalitétpass</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-indigo-400">{analysisWindow.qualityCount} <span className="text-[10px] font-bold text-slate-500">st</span></span>
                                <DiffBadge v1={analysisWindow.qualityCount} v2={compWindow.qualityCount} />
                            </div>
                            {isComparing && (
                                <div className="text-[9px] text-slate-600 mt-1">Tidigare: {compWindow.qualityCount} st</div>
                            )}
                        </div>
                    </div>

                    {/* Performance Leaderboard Section */}
                    {leaderboard.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <Trophy size={14} className="text-amber-500" /> Topp 10 - {event.distance >= 1 ? event.distance.toFixed(1) + 'km' : (event.distance * 1000) + 'm'}
                                    </h3>
                                    {previousPB && (
                                        <div className="text-[9px] font-black text-slate-500 uppercase">
                                            Tidigare PB: <span className="text-indigo-300 font-mono ml-1">{formatTime(previousPB.movingTime)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {leaderboard.map((entry, idx) => (
                                        <div 
                                            key={entry.id} 
                                            onClick={() => setSelectedDetailId(entry.id)}
                                            className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer group ${entry.isCurrent ? 'bg-indigo-500/20 border-indigo-500/40 shadow-lg shadow-indigo-500/10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className={`text-[10px] font-black w-4 text-center ${idx === 0 ? 'text-amber-500' : 'text-slate-600'}`}>
                                                    {idx + 1}
                                                </span>
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`text-[11px] font-bold truncate ${entry.isCurrent ? 'text-indigo-300' : 'text-slate-200'}`}>
                                                        {entry.title}
                                                    </span>
                                                    <span className="text-[9px] text-slate-500 font-mono">
                                                        {entry.date.substring(0, 10)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <div className="text-xs font-black text-white font-mono leading-none">
                                                    {formatTime(entry.movingTime)}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {entry.isRace && (
                                                        <span className="text-[8px] font-black bg-amber-500 text-slate-950 px-1 py-0.25 rounded uppercase tracking-tighter">Race</span>
                                                    )}
                                                    <span className="text-[9px] text-slate-500 font-mono">
                                                        {formatPace(entry.movingTime / entry.distance)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5 flex flex-col justify-center items-center text-center gap-4 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Trophy size={120} className="text-white" />
                                </div>
                                <div className="z-10">
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Ditt Personbästa</h4>
                                    <div className="text-4xl font-black text-white italic tracking-tighter font-mono">
                                        {allTimePB ? formatTime(allTimePB.movingTime) : '-'}
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-400 mt-1 uppercase">
                                        {allTimePB ? (allTimePB.isRace ? 'Satt på tävling 🏆' : 'Satt på träning ⚡') : 'Ingen tid loggad'}
                                    </div>
                                </div>
                                {allTimePB && (
                                    <div className="z-10 w-full pt-4 border-t border-white/10 space-y-2">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500 font-bold uppercase">Datum</span>
                                            <span className="text-slate-300 font-mono">{allTimePB.date.substring(0, 10)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-slate-500 font-bold uppercase">Tempo</span>
                                            <span className="text-slate-300 font-mono">{formatPace(allTimePB.movingTime / allTimePB.distance)}</span>
                                        </div>
                                        {previousPB && allTimePB.isCurrent && (
                                            <div className="mt-4 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 animate-bounce-subtle">
                                                <div className="text-[10px] font-black text-emerald-400 uppercase">Nytt Personbästa! 🚀</div>
                                                <div className="text-[9px] text-emerald-500/60 leading-tight mt-0.5">
                                                    Du är {formatTime(previousPB.movingTime - allTimePB.movingTime)} snabbare än ditt förra PB.
                                                </div>
                                            </div>
                                        )}
                                        {previousPB && !allTimePB.isCurrent && (
                                            <div className="mt-4 p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                                <div className="text-[10px] font-black text-indigo-400 uppercase">Målbild 🎯</div>
                                                <div className="text-[9px] text-indigo-500/60 leading-tight mt-0.5">
                                                    Du är {formatTime(allTimePB.movingTime - event.durationSeconds!)} ifrån ditt all-time PB.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isComparing && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {/* Goals vs Actuals Box */}
                            <div className="bg-indigo-500/5 border border-indigo-500/10 p-4 rounded-2xl flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <Target size={12} /> Mål vs Utfall ({comparisonEvent?.title})
                                    </div>
                                    {comparisonEvent?.placement && (
                                        <div className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-lg shadow-amber-500/10">
                                            <TrophyIcon size={10} /> Position #{comparisonEvent.placement}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 group hover:border-white/10 transition-all cursor-help relative" title="Din faktiska tid på loppet. Om du hade ett uppsatt mål visas det under.">
                                        <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Faktisk Tid</div>
                                        <div className="text-xl font-black text-white">
                                            {comparisonEvent?.durationMinutes ? `${Math.floor(comparisonEvent.durationMinutes / 60)}h ${Math.floor(comparisonEvent.durationMinutes % 60)}m` : '-'}
                                        </div>
                                        {comparisonEvent?.activity?.raceDetails?.goalTime && (
                                            <div className="text-[9px] text-indigo-400 font-bold mt-1 flex items-center gap-1 bg-indigo-500/10 px-1.5 py-0.5 rounded -mx-1">
                                                <Shield size={8} /> Mål: {comparisonEvent.activity.raceDetails.goalTime}
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Sparkles size={10} className="text-amber-500" />
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 group hover:border-white/10 transition-all cursor-help" title="Snitthastighet (inkl. pauser) och motsvarande tempo per km.">
                                        <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Snitthastighet</div>
                                        <div className="text-xl font-black text-white">
                                             {comparisonEvent?.averageSpeed ? comparisonEvent.averageSpeed.toFixed(1) : '-'} <span className="text-xs text-slate-600">km/h</span>
                                        </div>
                                        <div className="text-[9px] text-amber-500/80 font-bold mt-1 flex items-center gap-1 bg-amber-500/5 px-1.5 py-0.5 rounded -mx-1">
                                            <Zap size={8} /> {formatPace((comparisonEvent?.durationMinutes || 0) * 60 / (comparisonEvent?.distance || 1))}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-indigo-500/10 p-2 rounded-xl text-[9px] text-indigo-300 italic border border-indigo-500/10">
                                    <span className="font-black uppercase not-italic mr-1">TIPS:</span> 
                                    Jämför "Actual" nedan mot hur det kändes då för att se om du är starkare nu.
                                </div>
                            </div>

                            {/* Summary Comparison Table */}
                            <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <BarChart3 size={12} className="text-emerald-500" /> Jämförelse av Förberedelser
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px]">
                                        <thead>
                                            <tr className="border-b border-white/5">
                                                <th className="text-left font-bold text-slate-500 pb-2 uppercase tracking-tighter">Metrik</th>
                                                <th className="text-center font-black text-emerald-400 pb-2" title="Data från de senaste veckorna inför ditt kommande lopp.">NU (Aktuell)</th>
                                                <th className="text-center font-black text-indigo-400 pb-2 whitespace-nowrap" title={`Data från samma antal veckor inför ${comparisonEvent?.title}.`}>INFÖR ({comparisonEvent?.title.substring(0,10)}...)</th>
                                                <th className="text-right font-bold text-slate-500 pb-2 uppercase tracking-tighter whitespace-nowrap">Diff</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.02]">
                                            {[
                                                { label: 'Total Träningstid', v1: analysisWindow.totalActiveTimeMin, v2: compWindow.totalActiveTimeMin, unit: 'h', tooltip: 'Total tid spenderad på ALL träning.' },
                                                { label: 'Volym (Löpning)', v1: analysisWindow.totalRunVolumeKm, v2: compWindow.totalRunVolumeKm, unit: 'km', tooltip: 'Total löpvolym under perioden.' },
                                                { label: 'Snitt Volym/vecka', v1: (analysisWindow.totalRunVolumeKm / timeframeWeeks), v2: (compWindow.totalRunVolumeKm / timeframeWeeks), unit: 'km/v', tooltip: 'Genomsnittlig veckovolym (km/v).' },
                                                { label: 'Antal Pass (Löp)', v1: analysisWindow.totalRunCount, v2: compWindow.totalRunCount, unit: 'st', tooltip: 'Antal löppass.' },
                                                { label: 'Kvalitétspass', v1: analysisWindow.qualityCount, v2: compWindow.qualityCount, unit: 'st', tooltip: 'Antal intervall- eller tempopass.' },
                                                { label: 'Långpass (20km+)', v1: analysisWindow.longRunCount, v2: compWindow.longRunCount, unit: 'st', tooltip: 'Antal pass längre än 20km.' },
                                                { label: 'Snitt-tempo (Löp)', v1: analysisWindow.avgPaceSecPerKm, v2: compWindow.avgPaceSecPerKm, unit: 'p', lowerIsBetter: true, tooltip: 'Tempo för all löpning.' },
                                                { label: 'Alt. Träning (Cardio)', v1: analysisWindow.totalAltTimeMin, v2: compWindow.totalAltTimeMin, unit: 'h', tooltip: 'Cykling eller alternativ cardio.', icon: <Zap size={8} className="text-emerald-500" /> },
                                                { label: 'Styrkepass', v1: analysisWindow.strengthCount, v2: compWindow.strengthCount, unit: 'st', tooltip: 'Antal loggade styrkepass.' },
                                            ].map((row, i) => (
                                                <tr key={i} className="group hover:bg-white/[0.02] cursor-help" title={row.tooltip}>
                                                    <td className="py-1 text-slate-400 font-bold group-hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap">
                                                        {row.icon} {row.label}
                                                    </td>
                                                    <td className="py-1 text-center font-black text-white">
                                                        {row.unit === 'h' ? `${Math.floor(row.v1/60)}h ${Math.round(row.v1 % 60)}m` : row.unit === 'p' ? formatPace(row.v1) : Math.round(row.v1)}
                                                        {row.unit === 'km/v' && <span className="text-[8px] text-slate-600 ml-0.5">v</span>}
                                                    </td>
                                                    <td className="py-1 text-center font-black text-slate-400">
                                                        {row.unit === 'h' ? `${Math.floor(row.v2/60)}h ${Math.round(row.v2 % 60)}m` : row.unit === 'p' ? formatPace(row.v2) : Math.round(row.v2)}
                                                        {row.unit === 'km/v' && <span className="text-[8px] text-slate-600 ml-0.5">v</span>}
                                                    </td>
                                                    <td className="py-1 text-right font-mono flex justify-end">
                                                        <DiffBadge v1={row.v1} v2={row.v2} higherIsBetter={!row.lowerIsBetter} type={row.unit === 'h' ? 'time' : row.unit === 'p' ? 'pace' : 'number'} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-amber-500 mb-2 flex items-center gap-1"><Medal size={12} /> Tävlingar ({analysisWindow.races.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.races.length > 0 ? analysisWindow.races.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<TrophyIcon size={12} className="text-amber-500" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga tävlingar loggade</div>}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-emerald-500 mb-2 flex items-center gap-1"><Star size={12} /> Långpass ({analysisWindow.longRunsList.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.longRunsList.length > 0 ? analysisWindow.longRunsList.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<Activity size={12} className="text-emerald-400" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga långpass {">= 20km"}</div>}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-sky-500 mb-2 flex items-center gap-1"><Clock size={12} className="text-sky-500" /> Längre Distans ({analysisWindow.longerDistList.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.longerDistList.length > 0 ? analysisWindow.longerDistList.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<Activity size={12} className="text-sky-400" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga distanser {"14-20km"}</div>}
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex flex-col max-h-[350px]">
                            <div className="text-[10px] font-black uppercase text-blue-500 mb-2 flex items-center gap-1"><Zap size={12} /> Kvalitétspass ({analysisWindow.qualitySessions.length})</div>
                            <div className="overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                                {analysisWindow.qualitySessions.length > 0 ? analysisWindow.qualitySessions.map(r => (
                                    <ActivityRow key={r.id} r={r} icon={<Zap size={12} className="text-blue-400" />} />
                                )) : <div className="text-center py-4 text-xs text-slate-500">Inga kvalitetspass hittades</div>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl h-64 flex flex-col">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2"><TrendingUp size={12} className="text-emerald-500" /> {isComparing ? 'Jämförelse av Träningsvolym' : 'Volym & Tävlingsdistans'}</div>
                            </h3>
                            <div className="flex-1 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={mergedChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="volGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                            {isComparing && (
                                                <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                                </linearGradient>
                                            )}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                        <XAxis dataKey="week" hide />
                                        <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="vol" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#volGradient)" />
                                        {isComparing && (
                                            <Area type="monotone" dataKey="compVol" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={0.2} fill="url(#compGradient)" />
                                        )}
                                        <Scatter dataKey="vol" shape={(props: any) => {
                                            const { cx, cy, payload } = props;
                                            if (payload.raceCount > 0) {
                                                return (
                                                    <g>
                                                        <circle cx={cx} cy={cy} r={6} fill="#f59e0b" fillOpacity={0.3} />
                                                        <circle cx={cx} cy={cy} r={3} fill="#f59e0b" />
                                                        <text x={cx} y={cy - 12} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="black">{payload.maxRaceDistance}KM</text>
                                                    </g>
                                                );
                                            }
                                            return <g />;
                                        }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl h-64 flex flex-col">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Heart size={12} className="text-rose-500" /> Hälsokurva
                            </h3>
                            {analysisWindow.hasHealthData ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={analysisWindow.chartData}>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="kcal" stroke="#f43f5e" fillOpacity={0.1} fill="#f43f5e" />
                                        <Line type="monotone" dataKey="weight" stroke="#fff" strokeWidth={1} dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar">
                                    {analysisWindow.weightDataPoints.length > 0 ? analysisWindow.weightDataPoints.map((w, i) => (
                                        <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded-lg text-xs">
                                            <span className="text-slate-500">{w.date.substring(0, 10)}</span>
                                            <span className="font-black text-white">{(w.weight || 0).toFixed(1)} kg</span>
                                        </div>
                                    )) : <div className="text-xs text-slate-500 italic text-center py-10">Ingen hälsodata hittades.</div>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {selectedDetailId && (
                    <ActivityDetailModal 
                        activity={allActivities.find(e => e.id === selectedDetailId) as any}
                        onClose={() => setSelectedDetailId(null)}
                    />
                )}
            </div>
        </div>
    );
}
