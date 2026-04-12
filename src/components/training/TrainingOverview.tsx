import React, { useMemo, useState } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { isWarmupOrCooldown } from '../../utils/activityUtils.ts';
import { EXERCISE_TYPES } from './ExerciseModal.tsx';
import { TrainingCalendar } from './TrainingCalendar.tsx';
import { MonthlyTrainingTable } from './MonthlyTrainingTable.tsx';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TrainingOverviewProps {
    exercises: ExerciseEntry[];
    year: number;
    periodLabel?: string;
    isFiltered?: boolean;
    onExerciseClick?: (exercise: ExerciseEntry) => void;
    initialCalendarMonth?: number;
    initialCalendarDay?: number;
}

export function TrainingOverview({ exercises, year, periodLabel, isFiltered, onExerciseClick, initialCalendarMonth, initialCalendarDay }: TrainingOverviewProps) {
    const [statFilter, setStatFilter] = React.useState<'all' | 'run' | 'bike' | 'strength'>('all');
    const [showYearlyStats, setShowYearlyStats] = useState(false);

    const stats = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Base Filter (Period)
        // If filtered, 'yearExercises' represents the entire active period (passed from parent)
        // If NO filter from parent, default to current year
        // ALWAYS exclude extracted sub-performances from session counts (they are measurements, not sessions)
        const baseExercises = (isFiltered ? exercises : exercises.filter(e => new Date(e.date).getFullYear() === currentYear))
            .filter(e => !e.extractedFromId);

        // Apply Local Type Filter
        const yearExercises = baseExercises.filter(e => {
            if (statFilter === 'all') return true;
            const t = e.type.toLowerCase();
            if (statFilter === 'run') return t.includes('run') || t.includes('löp');
            if (statFilter === 'bike') return t.includes('cycl') || t.includes('cyk');
            if (statFilter === 'strength') return t.includes('strength') || t.includes('styrk') || t.includes('gym');
            return true;
        });

        const monthExercises = exercises.filter(e => {
            if (e.extractedFromId) return false; // Exclude extracts
            const d = new Date(e.date);
            // Apply Type Filter to Month too
            const matchesType = statFilter === 'all' ||
                (statFilter === 'run' && (e.type.includes('run') || e.type.includes('löp'))) ||
                (statFilter === 'bike' && (e.type.includes('cycl') || e.type.includes('cyk'))) ||
                (statFilter === 'strength' && (e.type.includes('strength') || e.type.includes('styrk')));

            return matchesType && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const lastMonthExercises = exercises.filter(e => {
            if (e.extractedFromId) return false; // Exclude extracts
            const d = new Date(e.date);
            // Apply Type Filter to Last Month too
            const isHybrid = e.type === 'hybrid';
            const matchesType = statFilter === 'all' ||
                (statFilter === 'run' && (e.type.includes('run') || e.type.includes('löp') || (isHybrid && (e.distance || 0) > 0))) ||
                (statFilter === 'bike' && (e.type.includes('cycl') || e.type.includes('cyk') || (isHybrid && (e.distance || 0) > 0))) ||
                (statFilter === 'strength' && (e.type.includes('strength') || e.type.includes('styrk') || isHybrid));

            return matchesType && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        });

        const sumDistance = (exs: ExerciseEntry[]) => exs.reduce((sum, e) => {
            if (statFilter === 'all') {
                const isRun = e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp');
                return sum + (isRun ? (e.distance || 0) : 0);
            }
            return sum + (e.distance || 0);
        }, 0);
        const sumDuration = (exs: ExerciseEntry[]) => exs.reduce((sum, e) => sum + e.durationMinutes, 0);
        const count = (exs: ExerciseEntry[]) => {
            const sessions = exs.filter(e => !isWarmupOrCooldown(e));
            const warmups = exs.filter(e => isWarmupOrCooldown(e));
            return {
                total: sessions.length,
                warmups: warmups.length,
                warmupList: warmups
            };
        };

        const longestRun = yearExercises.filter(e => ((e.type as string) === 'running' || (e.type as string) === 'löpning' || (e.type as string).includes('cycl')) && !e.excludeFromStats).reduce((max, e) => (e.distance || 0) > (max.distance || 0) ? e : max, { distance: 0 } as ExerciseEntry);

        const heavyLiftVolume = yearExercises.filter(e => (e.type as string) === 'strength' || (e.type as string) === 'gym' || (e.type as string) === 'styrka').reduce((sum, e) => sum + (e.tonnage || 0), 0);
        const maxStrengthSession = yearExercises.filter(e => (e.type as string) === 'strength' || (e.type as string) === 'gym' || (e.type as string) === 'styrka').reduce((max, e) => (max.tonnage || 0) > (e.tonnage || 0) ? max : e, {} as ExerciseEntry);

        const fastestPaceSession = yearExercises
            .filter(e => ((e.type as string) === 'running' || (e.type as string) === 'löpning') && (e.distance || 0) > 3 && !e.excludeFromStats)
            .reduce((best, e) => {
                const pace = (e.durationMinutes) / (e.distance || 1);
                const bestPace = (best.durationMinutes) / (best.distance || 1);
                return pace < (bestPace || 999) ? e : best;
            }, {} as ExerciseEntry);

        const fastestPace = fastestPaceSession.id ? (fastestPaceSession.durationMinutes / (fastestPaceSession.distance || 1)) : 999;

        // For Cycling, maybe we want Max Watts?
        const maxWattSession = yearExercises
            .filter(e => ((e.type as string).includes('cycl') && (e as any).averageWatts && !e.excludeFromStats))
            .reduce((best, e) => (e as any).averageWatts > ((best as any).averageWatts || 0) ? e : best, {} as ExerciseEntry);


        const maxEnergySession = yearExercises.reduce((max, e) => (e.caloriesBurned || 0) > (max.caloriesBurned || 0) ? e : max, {} as ExerciseEntry);
        
        const weeksInCurrentMonth = (new Date()).getDate() / 7;

        return {
            year: {
                distance: sumDistance(yearExercises),
                time: sumDuration(yearExercises),
                count: count(yearExercises),
                calories: yearExercises.reduce((sum, e) => sum + e.caloriesBurned, 0)
            },
            month: {
                distance: sumDistance(monthExercises),
                time: sumDuration(monthExercises),
                count: count(monthExercises),
                weeklyAvg: {
                    distance: weeksInCurrentMonth > 0 ? sumDistance(monthExercises) / weeksInCurrentMonth : 0,
                    time: weeksInCurrentMonth > 0 ? sumDuration(monthExercises) / weeksInCurrentMonth : 0,
                    count: {
                        total: weeksInCurrentMonth > 0 ? count(monthExercises).total / weeksInCurrentMonth : 0,
                        warmups: weeksInCurrentMonth > 0 ? count(monthExercises).warmups / weeksInCurrentMonth : 0
                    }
                }
            },
            lastMonth: {
                distance: sumDistance(lastMonthExercises),
                time: sumDuration(lastMonthExercises),
                count: count(lastMonthExercises)
            },
            byType: Object.entries(yearExercises.filter(e => !isWarmupOrCooldown(e)).reduce((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]),
            insights: {
                longestRun,
                fastestPace: fastestPace === 999 ? null : fastestPace,
                fastestPaceSession,
                heavyLiftVolume,
                maxStrengthSession,
                maxEnergySession,
                maxWattSession // New
            }
        };
    }, [exercises, statFilter, isFiltered]); // Depend on statFilter

    return (
        <>
            {/* Calendar View (Primary) */}
            <div className="mb-6 mt-2">
                <TrainingCalendar 
                    exercises={exercises}
                    year={year}
                    monthIndex={initialCalendarMonth ?? new Date().getMonth()}
                    initialDay={initialCalendarDay}
                    onExerciseClick={onExerciseClick}
                />
            </div>

            <div className="mb-8">
                <MonthlyTrainingTable 
                    exercises={exercises}
                    year={year}
                    onExerciseClick={onExerciseClick}
                    initialCalendarMonth={initialCalendarMonth}
                />
            </div>

            <div className="flex items-center justify-between mt-8 mb-4">
                <button 
                    onClick={() => setShowYearlyStats(!showYearlyStats)}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    {showYearlyStats ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    <h2 className="text-lg font-black uppercase tracking-widest text-white">Årsvolym & Detaljerad Statistik</h2>
                </button>
            </div>

            {showYearlyStats && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                        <button
                            onClick={() => setStatFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${statFilter === 'all' ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
                        >
                            Alla
                        </button>
                        <button
                            onClick={() => setStatFilter('run')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${statFilter === 'run' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
                        >
                            🏃 Löpning
                        </button>
                        <button
                            onClick={() => setStatFilter('bike')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${statFilter === 'bike' ? 'bg-sky-900/30 text-sky-400 border-sky-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
                        >
                            🚴 Cykling
                        </button>
                        <button
                            onClick={() => setStatFilter('strength')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${statFilter === 'strength' ? 'bg-indigo-900/30 text-indigo-400 border-indigo-500/30' : 'text-slate-500 border-transparent hover:bg-slate-800'}`}
                        >
                            🏋️ Styrka
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Year Stats */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-[100px] leading-none select-none group-hover:opacity-[0.06] transition-opacity">📅</div>
                    <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {periodLabel || `Årsvolym ${new Date().getFullYear()}`}
                        </h3>
                        <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 uppercase">
                            {isFiltered ? 'FILTRERAD PERIOD' : 'ALLA ACTIVITETER'}
                        </span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="text-3xl font-black text-white">{(stats.year.distance || 0).toFixed(1).replace('.', ',')} <span className="text-sm font-bold text-slate-500">km</span></div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Distans totalt</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-indigo-400">{(stats.insights.heavyLiftVolume / 1000).toFixed(1).replace('.', ',')} <span className="text-sm font-bold text-indigo-500/50">ton</span></div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Lyft volym</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-emerald-400">
                                {Math.floor(stats.year.time / 60).toString().padStart(2, '0')}:{Math.round(stats.year.time % 60).toString().padStart(2, '0')}
                                <span className="text-sm font-bold text-emerald-500/50 ml-1">h</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Tid totalt</div>
                        </div>
                        <div>
                            <div className="flex items-baseline gap-1.5">
                                <div className="text-3xl font-black text-sky-400">{stats.year.count.total} <span className="text-sm font-bold text-sky-500/50">pass</span></div>
                                {stats.year.count.warmups > 0 && (
                                    <div className="group/wu relative">
                                        <span className="text-sm font-black text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded cursor-help">+{stats.year.count.warmups}</span>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover/wu:opacity-100 transition-opacity pointer-events-none z-50">
                                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Upp/nerjogg (År)</p>
                                            <p className="text-[9px] text-slate-400 mb-2">Dessa har undantagits från antal pass men räknas i totala stats.</p>
                                            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                                {stats.year.count.warmupList.slice(0, 10).map((w : any, i : number) => (
                                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-300 truncate max-w-[100px]">{w.title || w.type}</span>
                                                        <span className="text-slate-500 font-mono">{w.distance?.toFixed(1)}km</span>
                                                    </div>
                                                ))}
                                                {stats.year.count.warmupList.length > 10 && <p className="text-[8px] text-slate-600 text-center">...och {stats.year.count.warmupList.length - 10} till</p>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Antal pass</div>
                        </div>
                    </div>
                </div>

                {/* Monthly Trend */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-sky-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-[100px] leading-none select-none group-hover:opacity-[0.06] transition-opacity">📈</div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                        {isFiltered ? 'Periodens Trend' : 'Månadens Status'}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-2xl font-black text-white">{(stats.month.distance || 0).toFixed(1).replace('.', ',')} <span className="text-xs text-slate-500">km</span></div>
                            <div className="flex items-center gap-1 mt-1">
                                <span className={`text-[10px] font-bold ${stats.month.distance >= stats.lastMonth.distance ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.month.distance >= stats.lastMonth.distance ? '▲' : '▼'} {(Math.abs(stats.month.distance - (stats.lastMonth.distance || 0))).toFixed(1).replace('.', ',')} km
                                </span>
                                <span className="text-[9px] text-slate-600">vs förra</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-white">
                                {Math.floor(stats.month.time / 60).toString().padStart(2, '0')}:{Math.round(stats.month.time % 60).toString().padStart(2, '0')}
                                <span className="text-xs text-slate-500 ml-1">h</span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                                <span className={`text-[10px] font-bold ${stats.month.time >= stats.lastMonth.time ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.month.time >= stats.lastMonth.time ? '▲' : '▼'} {Math.round(Math.abs(stats.month.time - stats.lastMonth.time) / 60)}h
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Snitt per pass</div>
                            <div className="flex gap-4">
                                <div className="text-lg font-bold text-white">{stats.month.count > 0 ? (stats.month.distance / stats.month.count).toFixed(1).replace('.', ',') : 0} km</div>
                                <div className="text-lg font-bold text-white">{stats.month.count > 0 ? Math.round(stats.month.time / stats.month.count) : 0} min</div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-sky-500 uppercase mb-2">Snitt per vecka</div>
                            <div className="flex gap-4">
                                <div className="text-lg font-bold text-sky-400">
                                    {(stats.month.weeklyAvg.distance || 0).toFixed(1).replace('.', ',')} km
                                </div>
                                <div className="text-lg font-bold text-sky-400">
                                    {(stats.month.weeklyAvg.count?.total || 0).toFixed(1).replace('.', ',')}
                                    {(stats.month.weeklyAvg.count?.warmups || 0) > 0 && <span className="text-xs text-rose-400/60 ml-0.5">+{(stats.month.weeklyAvg.count?.warmups || 0).toFixed(1)}</span>}
                                    <span className="ml-1">p</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity Mix */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-rose-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-[100px] leading-none select-none group-hover:opacity-[0.06] transition-opacity">👟</div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Aktivitetsfördelning</h3>
                    <div className="space-y-3">
                        {stats.byType.slice(0, 5).map(([type, countValue]) => {
                            const info = EXERCISE_TYPES.find(t => t.type === type);
                            const percent = Math.round((countValue / stats.year.count.total) * 100);
                            return (
                                <div key={type} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg opacity-80">{info?.icon || '❓'}</span>
                                        <span className="text-sm font-bold text-slate-300">{info?.label || type}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-slate-500">{count}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {stats.byType.length === 0 && (
                            <div className="text-center text-slate-500 text-xs italic py-8">Inga aktiviteter i år</div>
                        )}
                    </div>
                </div>

            </div>

            {/* Deep Dive Insights (The "Complex" part) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <button
                    onClick={() => stats.insights.longestRun.id && onExerciseClick?.(stats.insights.longestRun)}
                    disabled={!stats.insights.longestRun.id}
                    className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center hover:bg-white/5 transition-all group"
                >
                    <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏔️</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                        {isFiltered ? 'Periodens Längsta' : 'Årets Längsta'}
                    </span>
                    <span className="text-xl font-black text-white">{(stats.insights.longestRun.distance || 0).toFixed(1).replace('.', ',')} <span className="text-sm text-slate-500">km</span></span>
                    <span className="text-[9px] text-slate-600 mt-1">
                        {stats.insights.longestRun.date ? new Date(stats.insights.longestRun.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : '-'}
                    </span>
                </button>

                {statFilter === 'bike' && (stats.insights.maxWattSession as any)?.id ? (
                    <button
                        onClick={() => (stats.insights.maxWattSession as any).id && onExerciseClick?.(stats.insights.maxWattSession as any)}
                        className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center hover:bg-white/5 transition-all group"
                    >
                        <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">⚡</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Högsta Effekt</span>
                        <span className="text-xl font-black text-sky-400">
                            {(stats.insights.maxWattSession as any).averageWatts || 0}
                            <span className="text-sm text-slate-500"> W</span>
                        </span>
                        <span className="text-[9px] text-slate-600 mt-1">
                            {(stats.insights.maxWattSession as any).date ? new Date((stats.insights.maxWattSession as any).date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : 'Snittwatt'}
                        </span>
                    </button>
                ) : (
                    <button
                        onClick={() => stats.insights.fastestPaceSession.id && onExerciseClick?.(stats.insights.fastestPaceSession)}
                        disabled={!stats.insights.fastestPaceSession.id}
                        className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center hover:bg-white/5 transition-all group"
                    >
                        <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">⚡</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500">Snabbaste (3k+)</span>
                        <span className="text-xl font-black text-emerald-400">
                            {stats.insights.fastestPace
                                ? `${Math.floor(stats.insights.fastestPace)}:${Math.round((stats.insights.fastestPace % 1) * 60).toString().padStart(2, '0')}`
                                : '-'}
                            <span className="text-sm text-slate-500"> /km</span>
                        </span>
                        <span className="text-[9px] text-slate-600 mt-1">
                            {stats.insights.fastestPaceSession.date ? new Date(stats.insights.fastestPaceSession.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : 'Tempo'}
                        </span>
                    </button>
                )}

                <button
                    onClick={() => stats.insights.maxStrengthSession.id && onExerciseClick?.(stats.insights.maxStrengthSession)}
                    disabled={!stats.insights.maxStrengthSession.id}
                    className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center hover:bg-white/5 transition-all group"
                >
                    <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🏋️</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">{isFiltered ? 'Periodens Volym' : 'Årets Volym'}</span>
                    <span className="text-xl font-black text-indigo-400">{(stats.insights.heavyLiftVolume / 1000).toFixed(1).replace('.', ',')} <span className="text-sm text-slate-500">ton</span></span>
                    <span className="text-[9px] text-slate-600 mt-1">
                        {stats.insights.maxStrengthSession.date ? new Date(stats.insights.maxStrengthSession.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : (isFiltered ? 'Totalt i perioden' : 'Totalt i år')}
                    </span>
                </button>

                <button
                    onClick={() => stats.insights.maxEnergySession.id && onExerciseClick?.(stats.insights.maxEnergySession)}
                    disabled={!stats.insights.maxEnergySession.id}
                    className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center hover:bg-white/5 transition-all group"
                >
                    <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">🔥</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Energi</span>
                    <span className="text-xl font-black text-rose-400">{(stats.year.calories / 1000).toFixed(0)} <span className="text-sm text-slate-500">kkcal</span></span>
                    <span className="text-[9px] text-slate-600 mt-1">
                        {stats.insights.maxEnergySession.date ? new Date(stats.insights.maxEnergySession.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : (isFiltered ? 'Bränt i perioden' : 'Bränt i år')}
                    </span>
                </button>
            </div>
            </div>
            )}
        </>
    );
}
