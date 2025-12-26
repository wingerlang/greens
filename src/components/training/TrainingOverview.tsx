import React, { useMemo } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { EXERCISE_TYPES } from './ExerciseModal.tsx';
import { MonthlyTrainingTable } from './MonthlyTrainingTable.tsx';

interface TrainingOverviewProps {
    exercises: ExerciseEntry[];
}

export function TrainingOverview({ exercises }: TrainingOverviewProps) {
    const stats = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const yearExercises = exercises.filter(e => new Date(e.date).getFullYear() === currentYear);
        const monthExercises = exercises.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const lastMonthExercises = exercises.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        });

        const sumDistance = (exs: ExerciseEntry[]) => Math.round(exs.reduce((sum, e) => sum + (e.distance || 0), 0));
        const sumDuration = (exs: ExerciseEntry[]) => Math.round(exs.reduce((sum, e) => sum + e.durationMinutes, 0) / 60);
        const count = (exs: ExerciseEntry[]) => exs.length;

        // "Complex" insights
        const longestRun = yearExercises.filter(e => e.type === 'running').reduce((max, e) => (e.distance || 0) > (max.distance || 0) ? e : max, { distance: 0 } as ExerciseEntry);
        const fastestPace = yearExercises
            .filter(e => (e.type === 'running') && (e.distance || 0) > 3) // Only runs > 3km
            .reduce((best, e) => {
                const pace = (e.durationMinutes) / (e.distance || 1);
                return pace < best ? pace : best;
            }, 999);

        const heavyLiftVolume = yearExercises.filter(e => e.type === 'strength').reduce((sum, e) => sum + (e.tonnage || 0), 0);

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
                count: count(monthExercises)
            },
            lastMonth: {
                distance: sumDistance(lastMonthExercises),
                time: sumDuration(lastMonthExercises),
                count: count(lastMonthExercises)
            },
            byType: Object.entries(yearExercises.reduce((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]),
            insights: {
                longestRun,
                fastestPace: fastestPace === 999 ? null : fastestPace,
                heavyLiftVolume
            }
        };
    }, [exercises]);

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Year Stats */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-[100px] leading-none select-none group-hover:opacity-[0.06] transition-opacity">📅</div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Årsvolym {new Date().getFullYear()}</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="text-3xl font-black text-white">{stats.year.distance} <span className="text-sm font-bold text-slate-500">km</span></div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Distans totalt</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-emerald-400">{stats.year.time} <span className="text-sm font-bold text-emerald-500/50">h</span></div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Timmar totalt</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-sky-400">{stats.year.count} <span className="text-sm font-bold text-sky-500/50">st</span></div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Antal pass</div>
                        </div>
                    </div>
                </div>

                {/* Monthly Trend */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-sky-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-[100px] leading-none select-none group-hover:opacity-[0.06] transition-opacity">📈</div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Månadens Status</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-2xl font-black text-white">{stats.month.distance} <span className="text-xs text-slate-500">km</span></div>
                            <div className="flex items-center gap-1 mt-1">
                                <span className={`text-[10px] font-bold ${stats.month.distance >= stats.lastMonth.distance ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.month.distance >= stats.lastMonth.distance ? '▲' : '▼'} {Math.abs(stats.month.distance - stats.lastMonth.distance)} km
                                </span>
                                <span className="text-[9px] text-slate-600">vs förra</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-2xl font-black text-white">{stats.month.time} <span className="text-xs text-slate-500">h</span></div>
                            <div className="flex items-center gap-1 mt-1">
                                <span className={`text-[10px] font-bold ${stats.month.time >= stats.lastMonth.time ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.month.time >= stats.lastMonth.time ? '▲' : '▼'} {Math.abs(stats.month.time - stats.lastMonth.time)} h
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/5">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Snitt per pass denna månad</div>
                        <div className="flex gap-4">
                            <div>
                                <div className="text-lg font-bold text-white">{stats.month.count > 0 ? Math.round(stats.month.distance / stats.month.count * 10) / 10 : 0} km</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-white">{stats.month.count > 0 ? Math.round(stats.month.time * 60 / stats.month.count) : 0} min</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity Mix */}
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 relative overflow-hidden group hover:border-rose-500/20 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-[100px] leading-none select-none group-hover:opacity-[0.06] transition-opacity">👟</div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Aktivitetsfördelning</h3>
                    <div className="space-y-3">
                        {stats.byType.slice(0, 5).map(([type, count]) => {
                            const info = EXERCISE_TYPES.find(t => t.type === type);
                            const percent = Math.round((count / stats.year.count) * 100);
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
                <div className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                    <span className="text-2xl mb-2">🏔️</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Årets Längsta</span>
                    <span className="text-xl font-black text-white">{stats.insights.longestRun.distance || 0} <span className="text-sm text-slate-500">km</span></span>
                    <span className="text-[9px] text-slate-600 mt-1">{stats.insights.longestRun.date || '-'}</span>
                </div>
                <div className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                    <span className="text-2xl mb-2">⚡</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Snabbaste (3k+)</span>
                    <span className="text-xl font-black text-emerald-400">
                        {stats.insights.fastestPace
                            ? `${Math.floor(stats.insights.fastestPace)}:${Math.round((stats.insights.fastestPace % 1) * 60).toString().padStart(2, '0')}`
                            : '-'}
                        <span className="text-sm text-slate-500"> /km</span>
                    </span>
                    <span className="text-[9px] text-slate-600 mt-1">Tempo</span>
                </div>
                <div className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                    <span className="text-2xl mb-2">🏋️</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Lyft Volym</span>
                    <span className="text-xl font-black text-indigo-400">{(stats.insights.heavyLiftVolume / 1000).toFixed(1)} <span className="text-sm text-slate-500">ton</span></span>
                    <span className="text-[9px] text-slate-600 mt-1">Totalt i år</span>
                </div>
                <div className="bg-slate-900/30 border border-white/5 p-4 rounded-xl flex flex-col justify-center items-center text-center">
                    <span className="text-2xl mb-2">🔥</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Energi</span>
                    <span className="text-xl font-black text-rose-400">{(stats.year.calories / 1000).toFixed(0)} <span className="text-sm text-slate-500">kkcal</span></span>
                    <span className="text-[9px] text-slate-600 mt-1">Bränt i år</span>
                </div>
            </div>

            {/* Monthly Training Table (Detailed Breakdown) */}
            <div className="mb-0">
                <MonthlyTrainingTable exercises={exercises} />
            </div>
        </>
    );
}
