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

    const DiffBadge = ({ v1, v2, higherIsBetter = true, type = 'number' }: { v1: number, v2: number, higherIsBetter?: boolean, type?: 'number' | 'pace' | 'percent' }) => {
        if (!isComparing) return null;
        if (v1 === v2) return null;

        let diff = v1 - v2;
        if (type === 'pace') {
            // Lower pace is better (faster)
            // If current pace is 300s/km and old is 310s/km, diff is -10. 
            // In our logic, lower is better, so -10 is GOOD.
            diff = v2 - v1; // 310 - 300 = +10 (Good)
        }

        const isGood = higherIsBetter ? diff > 0 : diff < 0;
        const absDiff = Math.abs(v1 - v2);

        let label = '';
        if (type === 'pace') label = `${Math.floor(absDiff / 60)}:${Math.round(absDiff % 60).toString().padStart(2, '0')}`;
        else if (type === 'percent') label = `${absDiff.toFixed(0)}%`;
        else label = absDiff.toFixed(1);

        return (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isGood ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {diff > 0 ? '+' : '-'}{label}
            </span>
        );
    };

    const ActivityRow = ({ r, icon }: { r: ExerciseEntry; icon: React.ReactNode }) => {
        const paceSec = r.durationMinutes > 0 ? (r.durationMinutes * 60) / (r.distance || 1) : 0;

        return (
            <div
                key={r.id}
                className="flex justify-between items-center bg-white/5 rounded-lg p-2 hover:bg-white/10 cursor-pointer transition-colors border border-white/[0.03] hover:border-white/10"
                onClick={() => {
                    setSelectedDetailId(r.id);
                }}
            >
                <div className="overflow-hidden flex items-center gap-2">
                    <div className="p-1 rounded bg-slate-800 text-slate-300">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate" title={r.title || r.type}>
                            {r.title || r.type}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 flex-wrap">
                            <span>{r.date.substring(0, 10)}</span>
                            {r.distance && (
                                <span className={`text-[8px] font-black px-1.5 py-0.25 rounded-sm uppercase tracking-wider ${
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
                <div className="text-right flex flex-col items-end">
                    <div className="text-xs font-black text-white">{r.distance?.toFixed(1)} <span className="text-[9px] opacity-40">km</span></div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <span>{formatPace(paceSec)}</span>
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
        const races = allActivities.filter(isCompetition).map(act => ({
            id: act.id,
            date: act.date,
            title: act.title || act.name || 'Race',
            distance: act.distance || 0,
            isRace: true,
            activity: act
        }));
        return races.sort((a, b) => b.date.localeCompare(a.date)).filter(s => s.id !== event.id);
    }, [allActivities, event.id]);

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
                            {[4, 8, 12, 16].map(weeks => (
                                <button key={weeks} onClick={() => setTimeframeWeeks(weeks)} className={`px-2 py-0.5 text-[8px] font-black uppercase rounded transition-all ${timeframeWeeks === weeks ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>{weeks}v</button>
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
                                    className="flex-shrink-0 bg-slate-900 border border-white/10 hover:border-amber-500/50 p-2 rounded-xl text-left w-48 transition-all hover:bg-slate-800"
                                >
                                    <div className="text-[10px] font-black text-white truncate mb-1">{e.title}</div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                                        <span>{e.date.substring(0, 10)}</span>
                                        <span className="font-bold text-slate-400">{e.distance}km</span>
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
                            <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-1"><Activity size={12} className="text-blue-500" /> Volym (Totalt)</div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-black text-white">{Math.round(analysisWindow.totalRunVolumeKm)} <span className="text-[10px] font-bold text-slate-500">km</span></span>
                                </div>
                                <DiffBadge v1={analysisWindow.totalRunVolumeKm} v2={compWindow.totalRunVolumeKm} />
                            </div>
                            {isComparing && (
                                <div className="text-[9px] text-slate-600 mt-1">Jämförelse: {Math.round(compWindow.totalRunVolumeKm)} km</div>
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
                                    <span>Snitt över hela perioden</span>
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

                    {isComparing && (
                        <div className="bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center md:text-left">
                                <div className="flex items-center gap-2 mb-1"><Star size={12} /> Jämförelse av huvudnycklar</div>
                                <div className="text-slate-600 lowercase font-mono italic">Visar differens i sifferdata för hela perioden</div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center px-4 border-r border-indigo-500/10 last:border-0">
                                    <div className="text-[9px] text-slate-600 font-bold uppercase mb-1 whitespace-nowrap">Långpass (20km+)</div>
                                    <div className="flex items-baseline gap-2 justify-center">
                                        <span className="text-xl font-black text-white">{analysisWindow.longRunCount}</span>
                                        <DiffBadge v1={analysisWindow.longRunCount} v2={compWindow.longRunCount} />
                                    </div>
                                    <div className="text-[8px] text-slate-700 font-mono mt-0.5">vs {compWindow.longRunCount}</div>
                                </div>
                                <div className="text-center px-4 border-r border-indigo-500/10 last:border-0">
                                    <div className="text-[9px] text-slate-600 font-bold uppercase mb-1 whitespace-nowrap">Styrkepass</div>
                                    <div className="flex items-baseline gap-2 justify-center">
                                        <span className="text-xl font-black text-white">{analysisWindow.strengthCount}</span>
                                        <DiffBadge v1={analysisWindow.strengthCount} v2={compWindow.strengthCount} />
                                    </div>
                                    <div className="text-[8px] text-slate-700 font-mono mt-0.5">vs {compWindow.strengthCount}</div>
                                </div>
                                <div className="text-center px-4 last:border-0">
                                    <div className="text-[9px] text-slate-600 font-bold uppercase mb-1 whitespace-nowrap">Snitt Volym/vecka</div>
                                    <div className="flex items-baseline gap-2 justify-center">
                                        <span className="text-xl font-black text-white">{Math.round(analysisWindow.avgWeeklyVol)}</span>
                                        <DiffBadge v1={analysisWindow.avgWeeklyVol} v2={compWindow.avgWeeklyVol} />
                                    </div>
                                    <div className="text-[8px] text-slate-700 font-mono mt-0.5">vs {Math.round(compWindow.avgWeeklyVol)}</div>
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
