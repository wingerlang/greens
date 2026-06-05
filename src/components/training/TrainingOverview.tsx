import React, { useMemo, useState } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { isWarmupOrCooldown, isCompetition, isLongRun, isUltra, isQualitySession, isRecovery } from '../../utils/activityUtils.ts';
import { EXERCISE_TYPES } from './ExerciseModal.tsx';
import { TrainingCalendar } from './TrainingCalendar.tsx';
import { MonthlyTrainingTable } from './MonthlyTrainingTable.tsx';
import { ChevronDown, ChevronRight, Filter, Ruler, Trophy } from 'lucide-react';

interface TrainingOverviewProps {
    exercises: ExerciseEntry[];
    plannedActivities?: any[];
    year: number;
    periodLabel?: string;
    isFiltered?: boolean;
    onExerciseClick?: (exercise: ExerciseEntry) => void;
    onPlanActivity?: (date: string, editingActivity?: any) => void;
    initialCalendarMonth?: number;
    initialCalendarDay?: number;
    hideStats?: boolean;
}

export function TrainingOverview({ exercises, plannedActivities, year, periodLabel, isFiltered, onExerciseClick, onPlanActivity, initialCalendarMonth, initialCalendarDay, hideStats = false }: TrainingOverviewProps) {
    const [activeFilters, setActiveFilters] = useState<string[]>(['all']);
    const [distRange, setDistRange] = useState<[number, number]>([0, 999]);
    const [showYearlyStats, setShowYearlyStats] = useState(false);

    const toggleFilter = (filter: string) => {
        setActiveFilters(prev => {
            if (filter === 'all') return ['all'];
            const next = prev.filter(f => f !== 'all');
            if (next.includes(filter)) {
                const filtered = next.filter(f => f !== filter);
                return filtered.length === 0 ? ['all'] : filtered;
            }
            return [...next, filter];
        });
    };

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

        // Apply Local Type & Distance Filters
        const matchesFilters = (e: ExerciseEntry) => {
            const dist = e.distance || 0;
            if (dist < distRange[0] || dist > distRange[1]) return false;

            if (activeFilters.includes('all')) return true;
            
            return activeFilters.some(filter => {
                const t = e.type.toLowerCase();
                if (filter === 'run') return t.includes('run') || t.includes('löp');
                if (filter === 'bike') return t.includes('cycl') || t.includes('cyk');
                if (filter === 'strength') return t.includes('strength') || t.includes('styrk') || t.includes('gym');
                if (filter === 'race') return isCompetition(e);
                if (filter === 'long') return isLongRun(e);
                if (filter === 'ultra') return isUltra(e);
                if (filter === 'tempo') return isQualitySession(e);
                if (filter === 'recovery') return isRecovery(e);
                return false;
            });
        };

        const yearExercises = baseExercises.filter(matchesFilters);

        const monthExercises = exercises.filter(e => {
            if (e.extractedFromId) return false; // Exclude extracts
            const d = new Date(e.date);
            return matchesFilters(e) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const lastMonthExercises = exercises.filter(e => {
            if (e.extractedFromId) return false; // Exclude extracts
            const d = new Date(e.date);
            return matchesFilters(e) && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        });

        const sumDistance = (exs: ExerciseEntry[]) => exs.reduce((sum, e) => {
            if (activeFilters.includes('all')) {
                const isRun = e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp');
                return sum + (isRun ? (e.distance || 0) : 0);
            }
            return sum + (e.distance || 0);
        }, 0);
        const sumDuration = (exs: ExerciseEntry[]) => exs.reduce((sum, e) => sum + e.durationMinutes, 0);
        const sumTotalDuration = (exs: ExerciseEntry[]) => exs.reduce((sum, e) => {
            const perf = (e as any)._mergeData?.universalActivity?.performance || e;
            return sum + (perf.elapsedTimeSeconds ? perf.elapsedTimeSeconds / 60 : e.durationMinutes);
        }, 0);
        const countSessions = (exs: ExerciseEntry[], plannedExs: any[] = []) => {
            const sessions = exs.filter(e => !isWarmupOrCooldown(e));
            const warmups = exs.filter(e => isWarmupOrCooldown(e));
            return {
                total: sessions.length,
                warmups: warmups.length,
                planned: plannedExs.length,
                warmupList: warmups
            };
        };

        const yearPlanned = (plannedActivities || []).filter(a => {
            const d = new Date(a.date);
            return a.category === 'RACE' && (a.status === 'PLANNED' || a.status === 'DRAFT') && d.getFullYear() === currentYear;
        });

        const monthPlanned = yearPlanned.filter(a => new Date(a.date).getMonth() === currentMonth);
        const lastMonthPlanned = (plannedActivities || []).filter(a => {
            const d = new Date(a.date);
            return a.category === 'RACE' && (a.status === 'PLANNED' || a.status === 'DRAFT') && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        });

        const sumPlannedDuration = (exs: any[]) => exs.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

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
                plannedTime: sumPlannedDuration(yearPlanned),
                totalTime: sumTotalDuration(yearExercises),
                count: countSessions(yearExercises, yearPlanned),
                calories: yearExercises.reduce((sum, e) => sum + e.caloriesBurned, 0)
            },
            month: {
                distance: sumDistance(monthExercises),
                time: sumDuration(monthExercises),
                plannedTime: sumPlannedDuration(monthPlanned),
                count: countSessions(monthExercises, monthPlanned).total,
                weeklyAvg: {
                    distance: weeksInCurrentMonth > 0 ? sumDistance(monthExercises) / weeksInCurrentMonth : 0,
                    time: weeksInCurrentMonth > 0 ? sumDuration(monthExercises) / weeksInCurrentMonth : 0,
                    plannedTime: weeksInCurrentMonth > 0 ? sumPlannedDuration(monthPlanned) / weeksInCurrentMonth : 0,
                    count: {
                        total: weeksInCurrentMonth > 0 ? countSessions(monthExercises, monthPlanned).total / weeksInCurrentMonth : 0,
                        warmups: weeksInCurrentMonth > 0 ? countSessions(monthExercises, monthPlanned).warmups / weeksInCurrentMonth : 0,
                        planned: weeksInCurrentMonth > 0 ? monthPlanned.length / weeksInCurrentMonth : 0
                    }
                }
            },
            lastMonth: {
                distance: sumDistance(lastMonthExercises),
                time: sumDuration(lastMonthExercises),
                plannedTime: sumPlannedDuration(lastMonthPlanned),
                count: countSessions(lastMonthExercises, lastMonthPlanned)
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
                maxWattSession 
            }
        };
    }, [exercises, plannedActivities, activeFilters, distRange, isFiltered]); 

    return (
        <>
            <div className="mb-4 mt-2">
                <TrainingCalendar 
                    exercises={exercises}
                    plannedActivities={plannedActivities}
                    year={year}
                    monthIndex={initialCalendarMonth ?? new Date().getMonth()}
                    initialDay={initialCalendarDay}
                    onExerciseClick={onExerciseClick}
                    onPlanActivity={onPlanActivity}
                />
            </div>

            <div className="mb-4">
                <MonthlyTrainingTable 
                    exercises={exercises}
                    plannedActivities={plannedActivities}
                    year={year}
                    onExerciseClick={onExerciseClick}
                    initialCalendarMonth={initialCalendarMonth}
                />
            </div>

            {!hideStats && (
                <>
                    <div className="flex items-center justify-between mt-8 mb-4">
                        <button 
                            onClick={() => setShowYearlyStats(!showYearlyStats)}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                        >
                            {showYearlyStats ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            <h2 className="text-lg font-black uppercase tracking-widest text-white">Årsvolym & Detaljerad Statistik</h2>
                        </button>
                    </div>
                </>
            )}

            {showYearlyStats && !hideStats && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="space-y-4 mb-8">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => toggleFilter('all')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('all') ? 'bg-slate-700 text-white border-slate-600 shadow-lg' : 'text-slate-500 border-white/5 hover:bg-slate-800'}`}
                            >
                                Alla
                            </button>
                            <button
                                onClick={() => toggleFilter('run')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('run') ? 'bg-emerald-500 text-slate-900 border-emerald-400 font-black' : 'text-emerald-500/60 border-emerald-500/10 hover:bg-emerald-500/5'}`}
                            >
                                🏃 Löpning
                            </button>
                            <button
                                onClick={() => toggleFilter('bike')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('bike') ? 'bg-sky-500 text-slate-900 border-sky-400 font-black' : 'text-sky-500/60 border-sky-500/10 hover:bg-sky-500/5'}`}
                            >
                                🚴 Cykling
                            </button>
                            <button
                                onClick={() => toggleFilter('strength')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('strength') ? 'bg-indigo-500 text-slate-900 border-indigo-400 font-black' : 'text-indigo-500/60 border-indigo-500/10 hover:bg-indigo-500/5'}`}
                            >
                                🏋️ Styrka
                            </button>
                            
                            <div className="w-px h-6 bg-white/10 mx-1" />

                            <button
                                onClick={() => toggleFilter('race')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${activeFilters.includes('race') ? 'bg-amber-500 text-slate-900 border-amber-400 font-black' : 'text-amber-500/60 border-amber-500/10 hover:bg-amber-500/5'}`}
                            >
                                <Trophy size={12} /> Tävling
                            </button>
                            <button
                                onClick={() => toggleFilter('long')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('long') ? 'bg-orange-500 text-slate-900 border-orange-400 font-black' : 'text-orange-500/60 border-orange-500/10 hover:bg-orange-500/5'}`}
                            >
                                Långpass
                            </button>
                            <button
                                onClick={() => toggleFilter('ultra')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('ultra') ? 'bg-pink-500 text-slate-900 border-pink-400 font-black' : 'text-pink-500/60 border-pink-500/10 hover:bg-pink-500/5'}`}
                            >
                                Ultra
                            </button>
                            <button
                                onClick={() => toggleFilter('tempo')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('tempo') ? 'bg-rose-500 text-slate-900 border-rose-400 font-black' : 'text-rose-500/60 border-rose-500/10 hover:bg-rose-500/5'}`}
                            >
                                ⚡ Intervall
                            </button>
                            <button
                                onClick={() => toggleFilter('recovery')}
                                className={`px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider border transition-all ${activeFilters.includes('recovery') ? 'bg-cyan-500 text-slate-900 border-cyan-400 font-black' : 'text-cyan-500/60 border-cyan-500/10 hover:bg-cyan-500/5'}`}
                            >
                                🧘 Återhämtning
                            </button>
                        </div>

                        <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Ruler size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Distans (km)</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                                <input 
                                    type="number" 
                                    value={distRange[0]} 
                                    onChange={e => setDistRange([Math.max(0, parseInt(e.target.value) || 0), distRange[1]])}
                                    className="w-16 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white"
                                />
                                <span className="text-slate-600">—</span>
                                <input 
                                    type="number" 
                                    value={distRange[1] === 999 ? '' : distRange[1]} 
                                    placeholder="∞"
                                    onChange={e => setDistRange([distRange[0], parseInt(e.target.value) || 999])}
                                    className="w-16 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white"
                                />
                            </div>
                            <div className="flex gap-1">
                                {[
                                    { label: 'Alla', range: [0, 999] },
                                    { label: '5k+', range: [4.8, 999] },
                                    { label: '10k+', range: [9.7, 999] },
                                    { label: '21k+', range: [20.8, 999] },
                                    { label: '42k+', range: [41.5, 999] },
                                    { label: '5-15k', range: [5, 15] },
                                    { label: '21-42k', range: [21, 42.2] }
                                ].map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => setDistRange(p.range as [number, number])}
                                        className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${distRange[0] === p.range[0] && distRange[1] === p.range[1] ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-slate-500 border border-transparent hover:text-slate-300'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                            <div className="text-3xl font-black text-white">
                                {(() => {
                                    const actual = stats.year.time;
                                    const format = (mins: number) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
                                    return actual > 0 ? format(actual) : (stats.year.plannedTime > 0 ? `(${format(stats.year.plannedTime)})` : '0h 0m');
                                })()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center justify-between">
                                <span>Tid totalt</span>
                            </div>
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
                                {stats.year.count.planned > 0 && (
                                    <div className="group/planned relative">
                                        <span className="text-sm font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded cursor-help ml-1">+{stats.year.count.planned}</span>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover/planned:opacity-100 transition-opacity pointer-events-none z-50">
                                            <p className="text-[10px] font-black text-amber-500 uppercase mb-2">Planerade Tävlingar</p>
                                            <p className="text-[9px] text-slate-400">Dessa räknas separat från genomförda pass.</p>
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
                                {(() => {
                                    const actual = stats.month.time;
                                    const format = (mins: number) => {
                                        const h = Math.floor(mins / 60).toString().padStart(2, '0');
                                        const m = Math.round(mins % 60).toString().padStart(2, '0');
                                        return `${h}:${m}`;
                                    };
                                    return actual > 0 ? format(actual) : (stats.month.plannedTime > 0 ? `(${format(stats.month.plannedTime)})` : '00:00');
                                })()}
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
                                    {(stats.month.weeklyAvg.count?.planned || 0) > 0 && <span className="text-xs text-amber-400/60 ml-0.5">+{(stats.month.weeklyAvg.count?.planned || 0).toFixed(1)}</span>}
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
                                        <span className="text-xs font-mono font-bold text-slate-500">{countValue}</span>
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

                {activeFilters.includes('bike') && (stats.insights.maxWattSession as any)?.id ? (
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
                    <span className="text-xl font-black text-rose-400">{((stats.year.calories || 0) / 1000).toFixed(0)} <span className="text-sm text-slate-500">kkcal</span></span>
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
