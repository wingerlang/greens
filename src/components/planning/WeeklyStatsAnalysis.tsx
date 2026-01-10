import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { Activity, Zap, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
import { formatDuration } from '../../utils/dateUtils.ts';

export function WeeklyStatsAnalysis({
    weekStart,
    weeklyStats
}: {
    weekStart: string,
    weeklyStats: any
}) {
    const { exerciseEntries } = useData();

    // 1. Calculate Intensity Distribution (HR Zones)
    const intensityStats = useMemo(() => {
        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endStr = end.toISOString().split('T')[0];

        const weekActivities = exerciseEntries.filter(e =>
            e.date >= weekStart && e.date <= endStr &&
            (e.type === 'running' || e.type === 'cycling')
        );

        let z1_2 = 0;
        let z3 = 0;
        let z4_5 = 0;
        let total = 0;

        weekActivities.forEach(a => {
            const duration = a.durationMinutes || 0;
            total += duration;
            // Assuming simplified zone mapping if explicit zones aren't stored
            // This logic should ideally use actual HR data if available
            if (a.intensity === 'low') z1_2 += duration;
            else if (a.intensity === 'moderate') z3 += duration;
            else if (a.intensity === 'high' || a.intensity === 'ultra') z4_5 += duration;
        });

        return {
            z1_2: total > 0 ? (z1_2 / total) * 100 : 0,
            z3: total > 0 ? (z3 / total) * 100 : 0,
            z4_5: total > 0 ? (z4_5 / total) * 100 : 0,
            totalTime: total
        };
    }, [exerciseEntries, weekStart]);

    // 2. Volume Comparison (vs 4-week Average)
    const volumeAnalysis = useMemo(() => {
        const fourWeeksAgo = new Date(weekStart);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const recentRuns = exerciseEntries.filter(e =>
            e.type === 'running' &&
            new Date(e.date) >= fourWeeksAgo &&
            new Date(e.date) < new Date(weekStart)
        );

        const totalRecentKm = recentRuns.reduce((sum, e) => sum + (e.distance || 0), 0);
        const avgWeeklyKm = totalRecentKm / 4;

        const currentForecast = weeklyStats.forecast.runningKm;
        const diff = currentForecast - avgWeeklyKm;
        const pctDiff = avgWeeklyKm > 0 ? (diff / avgWeeklyKm) * 100 : 0;

        return {
            avg: avgWeeklyKm,
            current: currentForecast,
            diff,
            pctDiff,
            status: pctDiff > 20 ? 'Aggressive' : pctDiff > 10 ? 'Progressive' : pctDiff < -10 ? 'Deload' : 'Maintenance'
        };
    }, [exerciseEntries, weekStart, weeklyStats]);

    return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 1. Intensity Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-rose-500" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Intensitetsfördelning</h3>
                </div>

                <div className="flex items-end gap-2 h-32 mb-4">
                    {/* Low Intensity */}
                    <div className="flex-1 flex flex-col justify-end gap-2 group">
                        <div className="text-[10px] text-center font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {Math.round(intensityStats.z1_2)}%
                        </div>
                        <div
                            className="w-full bg-emerald-400 rounded-t-lg transition-all hover:bg-emerald-300 relative"
                            style={{ height: `${Math.max(10, intensityStats.z1_2)}%` }}
                        />
                        <div className="text-[10px] font-black uppercase text-center text-slate-500">Låg</div>
                    </div>

                    {/* Moderate Intensity */}
                    <div className="flex-1 flex flex-col justify-end gap-2 group">
                        <div className="text-[10px] text-center font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {Math.round(intensityStats.z3)}%
                        </div>
                        <div
                            className="w-full bg-amber-400 rounded-t-lg transition-all hover:bg-amber-300"
                            style={{ height: `${Math.max(10, intensityStats.z3)}%` }}
                        />
                        <div className="text-[10px] font-black uppercase text-center text-slate-500">Medel</div>
                    </div>

                    {/* High Intensity */}
                    <div className="flex-1 flex flex-col justify-end gap-2 group">
                        <div className="text-[10px] text-center font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {Math.round(intensityStats.z4_5)}%
                        </div>
                        <div
                            className="w-full bg-rose-500 rounded-t-lg transition-all hover:bg-rose-400"
                            style={{ height: `${Math.max(10, intensityStats.z4_5)}%` }}
                        />
                        <div className="text-[10px] font-black uppercase text-center text-slate-500">Hög</div>
                    </div>
                </div>

                <div className="text-xs text-slate-500 font-medium text-center">
                    Totalt {formatDuration(intensityStats.totalTime * 60)} konditionsträning
                </div>
            </div>

            {/* 2. Load Analysis */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-blue-500" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Volymanalys</h3>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {volumeAnalysis.current.toFixed(1)} <span className="text-sm font-medium text-slate-400">km</span>
                        </div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Planerad Volym</div>
                    </div>
                    <div className="text-right">
                         <div className="text-lg font-bold text-slate-500">
                            {volumeAnalysis.avg.toFixed(1)} <span className="text-xs">km</span>
                        </div>
                         <div className="text-[10px] font-bold uppercase text-slate-400">4v Snitt</div>
                    </div>
                </div>

                <div className="relative pt-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-1">
                        <span>Trend</span>
                        <span className={volumeAnalysis.pctDiff > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                            {volumeAnalysis.pctDiff > 0 ? '+' : ''}{volumeAnalysis.pctDiff.toFixed(0)}%
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${
                                volumeAnalysis.pctDiff > 10 ? 'bg-amber-500' :
                                volumeAnalysis.pctDiff < -10 ? 'bg-blue-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: '100%' }} // Simplified visual for now
                        />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                         {volumeAnalysis.status === 'Aggressive' ? <AlertCircle size={14} className="text-amber-500" /> : <TrendingUp size={14} className="text-slate-400" />}
                         <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                             Status: <span className="font-bold">{volumeAnalysis.status}</span>
                         </p>
                    </div>
                </div>
            </div>

            {/* 3. Training Focus / Suggestion Summary */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 shadow-sm text-white">
                <div className="flex items-center gap-2 mb-4">
                    <Zap size={18} className="text-yellow-400 fill-yellow-400" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Veckans Fokus</h3>
                </div>

                <div className="space-y-4">
                    <p className="text-sm font-medium leading-relaxed text-slate-300">
                        {volumeAnalysis.status === 'Aggressive'
                            ? 'Du ökar volymen kraftigt denna vecka. Var noga med sömn och återhämtning för att undvika överbelastning.'
                            : volumeAnalysis.status === 'Deload'
                            ? 'En lugnare vecka. Passa på att jobba med rörlighet och styrka för att bygga upp kroppen.'
                            : 'Balanserad träningsvecka. Du ligger bra till för att bibehålla och långsamt bygga fitness.'
                        }
                    </p>

                    {intensityStats.z4_5 > 25 && (
                        <div className="flex items-start gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                             <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                             <div className="text-xs">
                                 <span className="font-bold text-rose-300">Hög intensitet!</span>
                                 <p className="text-slate-400 mt-0.5">Mer än 25% av tiden i zon 4-5. Se till att de lugna passen verkligen är lugna.</p>
                             </div>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
