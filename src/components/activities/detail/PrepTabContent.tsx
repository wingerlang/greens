import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart } from 'recharts';
import { Activity, ChevronDown, HeartPulse, Mountain, Repeat, Star, TrendingUp, Zap, Trophy, Dumbbell, Footprints, Bike, History, BarChart3 } from 'lucide-react';
import { usePrepAggregation, PrepEvent } from '../../training/hooks/usePrepAggregation.ts';
import { formatPace, formatSwedishDate } from '../../../utils/dateUtils.ts';
import { ExerciseEntry } from '../../../models/types.ts';
import { SessionGroup } from './SessionGroup.tsx';

export const PrepTabContent = React.memo(({
    activity,
    allActivities,
    timeframeWeeks,
    setTimeframeWeeks,
    onSelectActivity
}: {
    activity: ExerciseEntry;
    allActivities: ExerciseEntry[];
    timeframeWeeks: number;
    setTimeframeWeeks: (weeks: number) => void;
    onSelectActivity?: (id: string | null) => void;
}) => {
    // Treat the current activity as the event for prep aggregation
    const event: PrepEvent = {
        id: activity.id,
        date: activity.date,
        title: activity.title || activity.type,
        distance: activity.distance || 0,
        isRace: true,
        activity: activity
    };

    const analysis = usePrepAggregation(event, allActivities, timeframeWeeks);

    const DiffBadge = ({ v1, v2, higherIsBetter = true, type = 'number' }: { v1: number, v2: number, higherIsBetter?: boolean, type?: 'number' | 'pace' | 'percent' | 'time' }) => {
        // Since we don't have a direct comparison event here yet, we can use it for generic positive/negative color coding if needed
        // but for now let's just use it to show vs avg or similar if we want.
        // In the modal tab, we mostly show the stats leading up to it.
        return null;
    };

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header / Selector */}
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 leading-tight">
                        <span className="text-emerald-400">📈</span> Träningsförberedelser
                    </h3>
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">
                        Analys av de sista {timeframeWeeks} veckorna inför loppet
                    </p>
                </div>

                <div className="flex items-center bg-slate-800 rounded-lg border border-white/5 p-1">
                    {[4, 8, 12, 16, 26].map(weeks => (
                        <button
                            key={weeks}
                            onClick={() => setTimeframeWeeks(weeks)}
                            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${timeframeWeeks === weeks ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                            {weeks === 26 ? '6m' : weeks + 'v'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-10 gap-2">

                {/* Hero Card: Volym, Snitt & Tid */}
                <div className="lg:col-span-2 xl:col-span-4 bg-slate-800/50 border border-white/5 p-2 rounded-lg flex flex-col justify-between shadow-xl shadow-black/20">
                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5"><Activity size={12} className="text-emerald-500" /> Träningsvolym & Tid per vecka</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                        {/* Volym */}
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-1.5 border-l-2 border-emerald-500 pl-3">
                                <span className="text-4xl font-bold text-white">{Math.round(analysis.avgWeeklyVol)}</span>
                                <span className="text-[11px] font-bold text-slate-400 uppercase">km/v</span>
                            </div>
                            <div className="text-[10px] font-bold mt-3 pl-3 flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 uppercase tracking-tighter">Total veckovolym (km)</span>
                                    <span className="text-slate-300 font-mono">{Math.round(analysis.totalRunVolumeKm)}k</span>
                                </div>
                            </div>
                        </div>

                        {/* Tid */}
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-1.5 border-l-2 border-amber-500 pl-3">
                                <span className="text-3xl font-black text-white">{Math.floor((analysis.totalRunTimeMin / timeframeWeeks) / 60)}<span className="text-xl text-slate-500 font-bold">h</span> {Math.round((analysis.totalRunTimeMin / timeframeWeeks) % 60)}<span className="text-xl text-slate-500 font-bold">m</span></span>
                            </div>
                            <div className="text-[10px] font-bold mt-3 pl-3 flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 uppercase tracking-tighter">Total cardio (h)</span>
                                    <span className="text-slate-300 font-mono">{Math.round((analysis.totalRunTimeMin + analysis.totalAltTimeMin) / 60)}h</span>
                                </div>
                                <div className="flex justify-between items-center border-t border-white/5 pt-1">
                                    <span className="text-slate-500 uppercase tracking-tighter">Total träningstid (h)</span>
                                    <span className="text-slate-300 font-mono">{Math.round(analysis.totalActiveTimeMin / 60)}h</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pace and HR horizontal bar */}
                    <div className="border-t border-white/5 pt-2 flex flex-col gap-2 mt-auto">
                        {/* Pace details */}
                        <div className="w-full flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/10 shadow-inner">
                            <div className="flex flex-col w-full">
                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1.5">Snittempo & Puls i perioden</span>
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-baseline gap-0.5">
                                        <span className="text-3xl font-black text-white font-mono tabular-nums tracking-tighter">{formatPace(analysis.avgPaceSecPerKm).replace('/km', '')}</span>
                                        <span className="text-[10px] text-slate-500 font-bold tracking-widest ml-1 uppercase">/km</span>
                                    </div>

                                    {analysis.avgHR && analysis.avgHR > 0 ? (
                                        <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-4">
                                            <HeartPulse size={14} className="text-rose-500" />
                                            <div className="flex items-baseline gap-0.5">
                                                <span className="text-2xl font-black text-rose-400 font-mono tracking-tighter">{analysis.avgHR}</span>
                                                <span className="text-[10px] text-rose-500/40 font-bold ml-1 uppercase">bpm</span>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                {analysis.slowestPaceSecPerKm > 0 && analysis.fastestPaceSecPerKm < 900 && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-white/5 flex-wrap">
                                        <span className="text-slate-400 font-sans text-[9px] uppercase tracking-wider font-bold">Pace Range:</span>
                                        <span
                                            className="cursor-pointer hover:text-emerald-400 transition-colors bg-slate-900/50 px-1.5 rounded"
                                            onClick={() => analysis.fastestRun && onSelectActivity?.(analysis.fastestRun.id)}
                                        >
                                            {formatPace(analysis.fastestPaceSecPerKm).replace('/km', '')}
                                        </span>
                                        <span className="text-slate-700 font-sans">•</span>
                                        <span
                                            className="cursor-pointer hover:text-rose-400 transition-colors bg-slate-900/50 px-1.5 rounded"
                                            onClick={() => analysis.slowestRun && onSelectActivity?.(analysis.slowestRun.id)}
                                        >
                                            {formatPace(analysis.slowestPaceSecPerKm).replace('/km', '')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Volume/Time breakdown */}
                        <div className="flex flex-col gap-2 w-full text-[9px] font-bold text-slate-500 bg-white/5 py-2.5 px-3 rounded-lg mt-1">
                            <div className="flex items-center justify-between shadow-sm">
                                <span className="text-slate-400 uppercase tracking-widest font-bold">Total tid i perioden</span>
                                <span className="font-bold text-slate-300">{Math.floor(analysis.totalActiveTimeMin / 60)}h totalt</span>
                            </div>
                            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-black/40">
                                {analysis.totalRunTimeMin > 0 && <div style={{ width: `${(analysis.totalRunTimeMin / analysis.totalActiveTimeMin) * 100}%` }} className="h-full bg-amber-500"></div>}
                                {analysis.strengthSessions.length > 0 && <div style={{ width: `${((analysis.strengthSessions.reduce((a, b) => a + (b.durationMinutes || 0), 0)) / analysis.totalActiveTimeMin) * 100}%` }} className="h-full bg-indigo-500"></div>}
                                {analysis.totalAltTimeMin > 0 && <div style={{ width: `${(analysis.totalAltTimeMin / analysis.totalActiveTimeMin) * 100}%` }} className="h-full bg-emerald-500"></div>}
                                {(analysis.totalOtherTimeMin - analysis.strengthSessions.reduce((a, b) => a + (b.durationMinutes || 0), 0)) > 0 && <div style={{ width: `${((analysis.totalOtherTimeMin - analysis.strengthSessions.reduce((a, b) => a + (b.durationMinutes || 0), 0)) / analysis.totalActiveTimeMin) * 100}%` }} className="h-full bg-pink-500"></div>}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mt-0.5">
                                {analysis.totalRunTimeMin > 0 && <span className="text-amber-500 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>{Math.floor(analysis.totalRunTimeMin / 60)}h löp</span>}
                                {analysis.strengthSessions.length > 0 && <span className="text-indigo-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>{Math.floor((analysis.strengthSessions.reduce((a, b) => a + (b.durationMinutes || 0), 0)) / 60)}h styrka</span>}
                                {analysis.totalAltTimeMin > 0 && <span className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>{Math.floor(analysis.totalAltTimeMin / 60)}h alt</span>}
                                {(analysis.totalOtherTimeMin - analysis.strengthSessions.reduce((a, b) => a + (b.durationMinutes || 0), 0)) > 0 && <span className="text-pink-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div>{Math.floor((analysis.totalOtherTimeMin - analysis.strengthSessions.reduce((a, b) => a + (b.durationMinutes || 0), 0)) / 60)}h övrigt</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 2: Pass / Vecka & Träffsäkerhet */}
                <div className="lg:col-span-1 xl:col-span-3 bg-slate-800/40 border border-white/5 p-1 rounded-lg flex flex-col justify-between">
                    <div className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-2">
                        <Repeat size={12} className="text-indigo-500" /> Passfördelning
                    </div>

                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-baseline gap-1.5 border-l-2 border-indigo-500 pl-3">
                            <span className="text-4xl font-black text-white">{analysis.avgSessionsPerWeek.toFixed(1)}</span>
                            <span className="text-[11px] font-bold text-slate-400 uppercase">pass/v</span>
                        </div>

                        <div className="flex flex-col items-end text-right gap-1.5 mt-1">
                            <span className="text-[10px] text-slate-300 font-bold bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                                {Math.round(analysis.totalRunCount / timeframeWeeks)} löp • {Math.round(analysis.strengthCount / timeframeWeeks)} styrka
                            </span>

                            {((analysis.longRunCount + analysis.qualityCount) / timeframeWeeks) > 0 && (
                                <div className="text-[10px] text-slate-500 font-bold mt-1 bg-amber-500/10 text-amber-500/90 px-2.5 py-1 rounded-md">
                                    ~{((analysis.longRunCount + analysis.qualityCount) / timeframeWeeks).toFixed(1)} nyckelpass/v
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Consistency Row */}
                    <div className="w-full bg-black/20 p-2 rounded-lg border border-white/5 mb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="bg-emerald-500/10 p-1 rounded-md">
                                    <TrendingUp size={12} className="text-emerald-500" />
                                </div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kontinuitet</span>
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-black text-emerald-400 font-mono">{Math.round(analysis.consistencyScore)}%</span>
                                <span className="text-[8px] text-slate-600 font-bold uppercase">{analysis.activeDaysCount}/{analysis.totalDaysInPeriod} dagar</span>
                            </div>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                            <div style={{ width: `${analysis.consistencyScore}%` }} className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                        {/* Quality & Long Runs */}
                        <div className="col-span-2 bg-black/20 p-2 rounded-lg border border-white/5">
                            <div className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5 mb-3">
                                <Zap size={10} className="text-amber-500" /> Fokusområden
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-black text-blue-400 font-mono tabular-nums leading-none">{Math.round(analysis.qualityRatio)}%</span>
                                    </div>
                                    <span className="text-[9px] text-slate-300 font-black uppercase mt-1">Kvalité</span>
                                    <span className="text-[8px] text-slate-500 font-bold mt-0.5">{analysis.qualitySessions.length} pass • {Math.round(analysis.qualitySessions.reduce((sum: any, s: any) => sum + (s.distance || 0), 0))}k</span>
                                </div>
                                <div className="flex flex-col border-l border-white/5 pl-2">
                                    <div className="flex items-baseline gap-1 text-center">
                                        <span className="text-lg font-black text-slate-400 font-mono tabular-nums leading-none">{Math.max(0, 100 - Math.round(analysis.qualityRatio) - Math.round(analysis.longRunRatio))}%</span>
                                    </div>
                                    <span className="text-[9px] text-slate-300 font-black uppercase mt-1">Distans</span>
                                    <span className="text-[8px] text-slate-500 font-bold mt-0.5">{analysis.easyRunsList.length} pass • {Math.round(analysis.easyRunsList.reduce((sum: any, s: any) => sum + (s.distance || 0), 0))}k</span>
                                </div>
                                <div className="flex flex-col items-end text-right border-l border-white/5">
                                    <div className="flex items-baseline gap-1 text-right justify-end">
                                        <span className="text-lg font-black text-emerald-400 font-mono tabular-nums leading-none">{Math.round(analysis.longRunRatio)}%</span>
                                    </div>
                                    <span className="text-[9px] text-slate-300 font-black uppercase mt-1 text-right">Långpass</span>
                                    <span className="text-[8px] text-slate-500 font-bold mt-0.5 text-right">{analysis.longRunsList.length} pass • {Math.round(analysis.longRunsList.reduce((sum: any, s: any) => sum + (s.distance || 0), 0))}k</span>
                                </div>
                            </div>
                        </div>

                        {/* Recovery Box */}
                        <div className="col-span-2 bg-black/10 p-2.5 rounded-lg border border-white/5 flex items-center justify-between px-4 mt-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Återhämtning</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-black text-indigo-400 font-mono leading-none">{analysis.restDays + analysis.warmupCount}</span>
                                <span className="text-[8px] text-slate-600 font-bold uppercase mt-1">Dagar/Pass</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 3: Belastning & Fokus */}
                <div className="lg:col-span-1 xl:col-span-3 bg-slate-800/40 border border-white/5 p-2 rounded-lg flex flex-col justify-start">
                    <div className="text-[10px] font-black text-slate-500 uppercase flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5"><Mountain size={12} className="text-amber-500" /> Analys av Belastning</div>
                    </div>

                    <div className="space-y-2 mt-1">
                        <details className="group">
                            <summary className="flex justify-between items-center bg-white/5 p-1 rounded-lg cursor-pointer hover:bg-white/10 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                <span className="text-[10px] font-bold text-slate-400">Peak-Vecka</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-white">{analysis.peakVolumeWeek.toFixed(1)}<span className="text-[9px] text-slate-500 ml-0.5">km</span></span>
                                    <ChevronDown size={12} className="text-slate-500 group-open:rotate-180 transition-transform" />
                                </div>
                            </summary>
                            <div className="p-2 pt-1.5 space-y-2">
                                <div className="text-[9px] text-slate-400 font-medium leading-relaxed">
                                    Veckan med högst volym var <span className="text-emerald-400 font-black">{analysis.peakWeekName}</span> där du sprang {analysis.peakVolumeWeek.toFixed(1)} km totalt.
                                </div>
                                <div className="space-y-1 pl-2 border-l border-emerald-500/20">
                                    {analysis.peakWeekWorkouts?.map((act: any) => {
                                        const type = act.type?.toLowerCase() || '';
                                        const isRun = type.includes('run') || type.includes('löpning');
                                        const isStrength = type.includes('strength') || type.includes('styrka') || type.includes('weight');
                                        const isWalk = type.includes('walk') || type.includes('promenad');
                                        const isBike = type.includes('bike') || type.includes('cykling');

                                        let colorClass = 'text-slate-400';
                                        let iconColor = 'text-slate-500';
                                        let IconComponent = Activity;
                                        if (isRun) { colorClass = 'text-emerald-400'; iconColor = 'text-emerald-400'; IconComponent = Activity; }
                                        else if (isStrength) { colorClass = 'text-sky-400/50'; iconColor = 'text-sky-400/40'; IconComponent = Dumbbell; }
                                        else if (isWalk) { colorClass = 'text-orange-400/50'; iconColor = 'text-orange-400/40'; IconComponent = Footprints; }
                                        else if (isBike) { colorClass = 'text-amber-400/50'; iconColor = 'text-amber-400/40'; IconComponent = Bike; }

                                        return (
                                            <div
                                                key={act.id}
                                                className={`flex justify-between items-center text-[9px] hover:bg-white/5 p-1 rounded transition-colors cursor-pointer group/item ${isRun ? '' : 'grayscale-[0.5] opacity-70 hover:grayscale-0 hover:opacity-100'}`}
                                                onClick={() => onSelectActivity?.(act.id)}
                                            >
                                                <div className="flex items-center gap-2 truncate min-w-0">
                                                    <div className={`shrink-0 w-4 flex justify-center ${iconColor}`}>
                                                        <IconComponent size={10} strokeWidth={3} />
                                                    </div>
                                                    <span className="font-mono text-[8px] opacity-70 text-slate-500 grow-0 group-hover/item:text-slate-300">
                                                        {new Date(act.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                    <span className={`truncate font-medium ${colorClass} ${isRun ? 'font-black' : ''}`}>
                                                        {act.title || act.type}
                                                    </span>
                                                </div>
                                                <span className={`font-bold tabular-nums shrink-0 ml-2 ${isRun ? 'text-white' : 'text-slate-500'}`}>
                                                    {act.distance ? `${act.distance.toFixed(1)}k` : `${Math.round(act.durationMinutes)}m`}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </details>

                        <details className="group">
                            <summary className="flex justify-between items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                <span className="text-[10px] font-bold text-slate-400">Längsta Streak</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-emerald-400">{analysis.longestStreak}<span className="text-[9px] text-slate-500 ml-0.5">dagar</span></span>
                                    <ChevronDown size={12} className="text-slate-500 group-open:rotate-180 transition-transform" />
                                </div>
                            </summary>
                            <div className="p-2 pt-1.5 text-[9px] text-slate-400 font-medium leading-relaxed">
                                Din längsta sammanhängande period av träningsdagar utan vila är {analysis.longestStreak} dagar.
                            </div>
                        </details>

                        <details className="group">
                            <summary className="flex justify-between items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                <span className="text-[10px] font-bold text-slate-400">Högsta Höjd i Pass</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-amber-400">{analysis.maxElevationInOneRun}<span className="text-[9px] text-slate-500 ml-0.5">m+</span></span>
                                    <ChevronDown size={12} className="text-slate-500 group-open:rotate-180 transition-transform" />
                                </div>
                            </summary>
                            {analysis.maxElevationRun ? (
                                <div className="p-2 pt-1.5 flex flex-col gap-1 cursor-pointer hover:bg-slate-800 rounded-lg"
                                    onClick={() => onSelectActivity?.(analysis.maxElevationRun!.id)}>
                                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">{formatSwedishDate(analysis.maxElevationRun.date)}</span>
                                    <div className="text-[10px] text-slate-300 font-bold truncate">
                                        {analysis.maxElevationRun.title || analysis.maxElevationRun.notes}
                                    </div>
                                    <div className="text-[9px] text-slate-500">
                                        {(analysis.maxElevationRun.distance || 0).toFixed(1)} km
                                    </div>
                                </div>
                            ) : undefined}
                        </details>

                        {analysis.doubleRunDaysCount > 0 && (
                            <details className="group">
                                <summary className="flex justify-between items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                    <span className="text-[10px] font-bold text-slate-400">Dubbelpass Löpning</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-emerald-400">{analysis.doubleRunDaysCount}<span className="text-[9px] text-slate-500 ml-0.5">st</span></span>
                                        <ChevronDown size={12} className="text-slate-500 group-open:rotate-180 transition-transform" />
                                    </div>
                                </summary>
                                <div className="p-2 pt-1.5 text-[9px] text-slate-400 font-medium leading-relaxed">
                                    Dagar där du genomfört två eller fler löppass. Detta indikerar en hög specifik belastning.
                                </div>
                            </details>
                        )}

                        {analysis.doubleDaysCount > 0 ? (
                            <details className="group">
                                <summary className="flex justify-between items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                    <span className="text-[10px] font-bold text-slate-400">Dubbelpass Totalt</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-indigo-400">{analysis.doubleDaysCount}<span className="text-[9px] text-slate-500 ml-0.5">st</span></span>
                                        <ChevronDown size={12} className="text-slate-500 group-open:rotate-180 transition-transform" />
                                    </div>
                                </summary>
                                <div className="p-2 pt-1.5 text-[9px] text-slate-400 font-medium leading-relaxed">
                                    Antal dagar i perioden där du genomfört mer än ett träningspass (inkl. styrka/alternativt) samma dag.
                                </div>
                            </details>
                        ) : (
                            <details className="group">
                                <summary className="flex justify-between items-center bg-white/5 p-2 rounded-lg cursor-pointer hover:bg-white/10 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                    <span className="text-[10px] font-bold text-slate-400">Uppvärmningar</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-indigo-400">{analysis.warmupCount}<span className="text-[9px] text-slate-500 ml-0.5">st</span></span>
                                        <ChevronDown size={12} className="text-slate-500 group-open:rotate-180 transition-transform" />
                                    </div>
                                </summary>
                                <div className="p-2 pt-1.5 text-[9px] text-slate-400 font-medium leading-relaxed">
                                    Specifika uppvärmnings- och nedvarvningspass loggade som separata aktiviteter.
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart & Key Sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                {/* Volume Chart */}
                <div className="lg:col-span-3 bg-slate-800/30 border border-white/5 p-2 rounded-lg h-80 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <BarChart3 size={12} className="text-emerald-500" /> Veckovolym (KM)
                        </h3>
                    </div>
                    <div className="flex-1 w-full opacity-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={analysis.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="prepVolGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis dataKey="week" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(val) => val.replace('Vecka ', '')} />
                                <YAxis yAxisId="left" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" hide />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-slate-900 border border-white/10 p-2 rounded-lg shadow-xl z-50">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{data.week?.replace('Vecka -', '')}v innan loppet</p>
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                            <span className="text-sm font-black text-white">{data.vol} <span className="text-[9px] text-slate-500 font-normal">km löpning</span></span>
                                                        </div>
                                                        {data.durRun > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                                                <span className="text-xs font-bold text-slate-300">{Math.floor(data.durRun / 60)}h {Math.round(data.durRun % 60)}m <span className="text-[9px] text-slate-500 font-normal">löptid</span></span>
                                                            </div>
                                                        )}
                                                        {data.durTotal > data.durRun && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                                <span className="text-xs font-bold text-slate-300">+{Math.floor((data.durTotal - data.durRun) / 60)}h {Math.round((data.durTotal - data.durRun) % 60)}m <span className="text-[9px] text-slate-500 font-normal">annan träning</span></span>
                                                            </div>
                                                        )}
                                                        {data.raceCount > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                <div className="text-[9px] text-amber-500 font-bold bg-amber-500/10 px-2 py-1 rounded inline-flex items-center gap-1 border border-amber-500/20">
                                                                    <Trophy size={10} /> Innehåller Tävling
                                                                </div>
                                                                <div className="flex flex-col pl-2 border-l border-amber-500/30 gap-1">
                                                                    {data.raceList?.map((r: any, i: number) => (
                                                                        <div key={i} className="text-[9px] text-slate-300 font-bold">
                                                                            • {r.title} ({r.distance.toFixed(1)}k)
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar yAxisId="right" dataKey="durTotal" fill="#334155" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Area yAxisId="left" type="monotone" dataKey="vol" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#prepVolGradient)" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Key Training Info & Detailed Lists */}
                <div className="lg:col-span-2 space-y-2">
                    <div className="bg-slate-800/50 border border-white/5 p-2.5 rounded-lg">
                        <h4 className="text-[10px] font-black text-amber-500 uppercase mb-3 flex items-center gap-1.5"><Star size={12} /> Huvudpass under prep</h4>
                        <div className="space-y-3">
                            <SessionGroup
                                title="Speciella Långpass"
                                count={analysis.longRunCount}
                                icon={<Mountain size={14} className="text-emerald-500" />}
                                items={analysis.longRunsList}
                                formatDetail={(act) => (
                                    <>
                                        <span className="text-emerald-400">{act.distance?.toFixed(1)} km</span>
                                        <span className="text-slate-600">|</span>
                                        <span className="text-slate-300">{formatPace(((act.durationMinutes || 0) * 60) / (act.distance || 1))}</span>
                                        {((act as any).heartRateAvg || (act as any).averageHeartrate || (act as any).avgHeartRate) > 0 && (
                                            <span className="text-rose-400 flex items-center gap-0.5"><HeartPulse size={8} /> {Math.round((act as any).heartRateAvg || (act as any).averageHeartrate || (act as any).avgHeartRate)}</span>
                                        )}
                                    </>
                                )}
                                onActivityClick={(id) => onSelectActivity?.(id)}
                            />

                            <SessionGroup
                                title="Kvalitetspass"
                                count={analysis.qualityCount}
                                icon={<Zap size={14} className="text-amber-500" />}
                                items={analysis.qualitySessions}
                                formatDetail={(act) => (
                                    <>
                                        <span className="text-amber-400">{act.distance?.toFixed(1)} km</span>
                                        <span className="text-slate-600">|</span>
                                        <span className="text-slate-300">{formatPace(((act.durationMinutes || 0) * 60) / (act.distance || 1))}</span>
                                        {((act as any).heartRateAvg || (act as any).averageHeartrate || (act as any).avgHeartRate) > 0 && (
                                            <span className="text-rose-400 flex items-center gap-0.5"><HeartPulse size={8} /> {Math.round((act as any).heartRateAvg || (act as any).averageHeartrate || (act as any).avgHeartRate)}</span>
                                        )}
                                    </>
                                )}
                                onActivityClick={(id) => onSelectActivity?.(id)}
                            />

                            {analysis.strengthSessions.length > 0 && (
                                <SessionGroup
                                    title="Styrketräning"
                                    count={analysis.strengthSessions.length}
                                    icon={<Dumbbell size={14} className="text-indigo-500" />}
                                    items={analysis.strengthSessions}
                                    formatDetail={(act) => <span>{act.durationMinutes} min</span>}
                                    onActivityClick={(id) => onSelectActivity?.(id)}
                                />
                            )}

                            {analysis.races.length > 0 && (
                                <SessionGroup
                                    title="Tävlingar"
                                    count={analysis.races.length}
                                    icon={<Trophy size={14} className="text-sky-500" />}
                                    items={analysis.races}
                                    formatDetail={(act) => <span className="text-sky-400">{act.distance?.toFixed(1)} km</span>}
                                    onActivityClick={(id) => onSelectActivity?.(id)}
                                />
                            )}
                        </div>

                        <div className="pt-3 border-t border-white/5 mt-3">
                            <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Analys: Pros & Cons</span>
                            <div className="space-y-1.5">
                                {analysis.pros.slice(0, 2).map((p, i) => (
                                    <div key={i} className="text-[10px] text-emerald-400 flex items-start gap-1.5">
                                        <span className="mt-0.5 shrink-0">✓</span>
                                        {p}
                                    </div>
                                ))}
                                {analysis.cons.slice(0, 1).map((c, i) => (
                                    <div key={i} className="text-[10px] text-rose-400 flex items-start gap-1.5">
                                        <span className="mt-0.5 shrink-0">!</span>
                                        {c}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg flex flex-col justify-between">
                        <div>
                            <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Summering förberedelse</h4>
                            <p className="text-[10px] text-slate-300 leading-relaxed italic">
                                Baserat på dina {timeframeWeeks} veckor har du tränat i snitt {Math.round(analysis.avgWeeklyVol)} km per vecka.
                                {analysis.longRunCount >= 3 ? ' Din uthållighet ser stark ut inför start.' : ' Du har färre långpass än optimalt.'}
                                Din kontinuitet på {Math.round(analysis.consistencyScore)}% tyder på {analysis.consistencyScore > 70 ? 'en stabil träningsperiod.' : 'en något ryckig förberedelse.'}
                            </p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5">
                            <SessionGroup
                                title="Alla Loggade Pass"
                                count={analysis.windowActivities.length}
                                icon={<History size={14} className="text-slate-500" />}
                                items={analysis.windowActivities} // Show latest first
                                formatDetail={(act) => act.distance ? `${act.distance.toFixed(1)}k` : `${act.durationMinutes}m`}
                                onActivityClick={onSelectActivity}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
