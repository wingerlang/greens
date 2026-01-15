import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { Activity, Zap, TrendingUp, BarChart3, AlertCircle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { formatDuration } from '../../utils/dateUtils.ts';

export function WeeklyStatsAnalysis({
    weekStart,
    weeklyStats
}: {
    weekStart: string,
    weeklyStats: any
}) {
    const { exerciseEntries, plannedActivities, unifiedActivities } = useData();
    const { settings } = useSettings();

    // 1. Calculate Intensity Distribution (HR Zones)
    // Uses explicit intensity if set, otherwise calculates from heart rate
    const intensityStats = useMemo(() => {
        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endStr = end.toISOString().split('T')[0];

        const weekActivities = exerciseEntries.filter(e =>
            e.date >= weekStart && e.date <= endStr &&
            (e.type === 'running' || e.type === 'cycling')
        );

        // Calculate max HR from age (220 - age formula)
        const currentYear = new Date().getFullYear();
        const age = settings.birthYear ? currentYear - settings.birthYear : 30;
        const maxHr = 220 - age;

        let z1_2 = 0;
        let z3 = 0;
        let z4_5 = 0;
        let total = 0;

        weekActivities.forEach(a => {
            const duration = a.durationMinutes || 0;
            total += duration;

            // Priority: Use explicit intensity if set
            if (a.intensity) {
                if (a.intensity === 'low') z1_2 += duration;
                else if (a.intensity === 'moderate') z3 += duration;
                else if (a.intensity === 'high' || a.intensity === 'ultra') z4_5 += duration;
            }
            // Fallback: Calculate from average heart rate
            else if (a.heartRateAvg && maxHr > 0) {
                const hrPct = a.heartRateAvg / maxHr;
                if (hrPct < 0.70) z1_2 += duration;
                else if (hrPct < 0.80) z3 += duration;
                else z4_5 += duration;
            }
            // No data: default to moderate zone
            else {
                z3 += duration;
            }
        });

        return {
            z1_2: total > 0 ? (z1_2 / total) * 100 : 0,
            z3: total > 0 ? (z3 / total) * 100 : 0,
            z4_5: total > 0 ? (z4_5 / total) * 100 : 0,
            totalTime: total
        };
    }, [exerciseEntries, weekStart, settings.birthYear]);

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

    // 3. Automated Weekly Review Insights
    const reviewInsights = useMemo(() => {
        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endStr = end.toISOString().split('T')[0];

        const weekPlan = plannedActivities.filter(p => p.date >= weekStart && p.date <= endStr);
        const weekActual = unifiedActivities.filter(a => a.date >= weekStart && a.date <= endStr);

        const insights: string[] = [];
        const completed = weekPlan.filter(p => p.status === 'COMPLETED');
        const missed = weekPlan.filter(p => p.status === 'PLANNED' && new Date(p.date) < new Date());

        // Adherence score
        const adherencePct = weekPlan.length > 0 ? (completed.length / weekPlan.length) * 100 : 100;

        if (weekPlan.length === 0 && weekActual.length > 0) {
            insights.push("Du tränade bra trots att inget var planerat. Snyggt jobbat!");
        } else if (adherencePct === 100 && weekPlan.length > 0) {
            insights.push("100% följsamhet! Du har genomfört alla planerade pass denna vecka.");
        } else if (adherencePct >= 75) {
            insights.push(`Hög följsamhet (${Math.round(adherencePct)}%). Du missade bara ${weekPlan.length - completed.length} pass.`);
        } else if (adherencePct > 0) {
            insights.push(`Du har genomfört ${completed.length} av ${weekPlan.length} planerade pass.`);
        }

        // Specific discrepancies
        completed.forEach(p => {
            if (p.actualDistance && p.estimatedDistance) {
                const diff = p.actualDistance - p.estimatedDistance;
                if (diff > 2) {
                    insights.push(`Passet "${p.title}" blev ${diff.toFixed(1)}km längre än planerat. Starkt!`);
                } else if (diff < -2) {
                    insights.push(`Passet "${p.title}" blev ${Math.abs(diff).toFixed(1)}km kortare än planerat.`);
                }
            }
        });

        missed.forEach(p => {
            insights.push(`Missat pass: "${p.title}" (${p.date}).`);
        });

        // Extra activities
        const extraActivities = weekActual.filter(a => !weekPlan.some(p => p.externalId === a.id));
        if (extraActivities.length > 0) {
            insights.push(`Du körde ${extraActivities.length} extra pass som inte fanns i planen.`);
        }

        return {
            adherencePct,
            insights,
            completedCount: completed.length,
            totalPlanned: weekPlan.length
        };
    }, [plannedActivities, unifiedActivities, weekStart]);

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
                            className={`h-full rounded-full ${volumeAnalysis.pctDiff > 10 ? 'bg-amber-500' :
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

            {/* 4. Weekly Review (Auto-generated) */}
            <div className="md:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-emerald-500" />
                        <h3 className="text-lg font-black uppercase tracking-wider text-slate-800 dark:text-white">Veckans Review</h3>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {Math.round(reviewInsights.adherencePct)}%
                        </div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Följsamhet</div>
                    </div>
                </div>

                {reviewInsights.insights.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Insikter & Observationer</h4>
                            {reviewInsights.insights.map((insight, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {insight}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="bg-slate-900 rounded-xl p-5 text-white flex flex-col justify-center">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">Statusuppdatering</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Planerade pass</span>
                                    <span className="text-sm font-bold">{reviewInsights.totalPlanned}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Slutförda pass</span>
                                    <span className="text-sm font-bold text-emerald-400">{reviewInsights.completedCount}</span>
                                </div>
                                <div className="pt-4 border-t border-white/10">
                                    <p className="text-xs italic text-slate-400">
                                        "{reviewInsights.adherencePct === 100
                                            ? "Perfekt genomförande! Fortsätt så."
                                            : reviewInsights.adherencePct >= 70
                                                ? "Bra jobbat! Du håller dig till planen."
                                                : "En tuff vecka? Bryt ihop och kom igen!"}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-8 text-slate-400">
                        <AlertCircle size={32} className="mb-2 opacity-20" />
                        <p className="text-sm">Ingen träningsdata tillgänglig för denna vecka.</p>
                    </div>
                )}
            </div>

        </div>
    );
}
