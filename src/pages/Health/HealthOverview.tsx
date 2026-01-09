import React, { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { DaySnapshot, HealthStats } from '../../utils/healthAggregator.ts';
import { ExerciseEntry, WeightEntry } from '../../models/types.ts';
import { WeightTrendChart } from '../../components/charts/WeightTrendChart.tsx';


interface HealthOverviewProps {
    snapshots: DaySnapshot[];
    stats: HealthStats;
    timeframe: number;
    exerciseEntries: ExerciseEntry[];
    weightEntries: WeightEntry[];
}

export function HealthOverview({ snapshots, stats, timeframe, exerciseEntries, weightEntries }: HealthOverviewProps) {
    const { settings } = useSettings();
    const { bodyMeasurements } = useData();

    // Merge bodyMeasurements into weightEntries for the chart
    const enrichedWeightEntries = useMemo(() => {
        // Create a map of date -> measurements
        const measurementsByDate: Record<string, { waist?: number, chest?: number }> = {};

        bodyMeasurements.forEach(m => {
            if (!measurementsByDate[m.date]) {
                measurementsByDate[m.date] = {};
            }
            if (m.type === 'waist') {
                measurementsByDate[m.date].waist = m.value;
            } else if (m.type === 'chest') {
                measurementsByDate[m.date].chest = m.value;
            }
        });

        // Merge into weight entries
        return weightEntries.map(entry => ({
            ...entry,
            waist: entry.waist || measurementsByDate[entry.date]?.waist,
            chest: entry.chest || measurementsByDate[entry.date]?.chest,
        }));
    }, [weightEntries, bodyMeasurements]);

    const isGoalAchieved = (type: 'sleep' | 'water' | 'calories' | 'tonnage') => {
        if (type === 'sleep') return stats.avgSleep >= (settings.dailySleepGoal || 7);
        if (type === 'water') return stats.avgWater >= (settings.dailyWaterGoal || 6);
        if (type === 'calories') {
            const goal = settings.dailyCalorieGoal || 2000;
            const diff = Math.abs((stats.totalCalories / (snapshots.length || 1)) - goal);
            // Allow 15% margin
            return diff < goal * 0.15;
        }
        if (type === 'tonnage') return stats.exerciseBreakdown.totalTonnage > 0;
        return false;
    };

    // Calculate cardio count precisely
    const cardioCount = useMemo(() => {
        return stats.exerciseBreakdown.intervals + stats.exerciseBreakdown.longRuns + stats.exerciseBreakdown.races +
            // Approximate others
            snapshots.reduce((acc, s) => acc + (s.exerciseDeatils.distance > 0 ? 1 : 0), 0);
        // This logic is fuzzy, let's rely on total sessions logic if possible, 
        // but for now relying on aggregator extension
    }, [stats]);


    const hasWeightData = snapshots.some(s => s.weight);
    const hasCalorieData = snapshots.some(s => s.nutrition.calories > 0);
    const hasAnyActivity = stats.exerciseBreakdown.totalDistance > 0 || stats.exerciseBreakdown.totalTonnage > 0 || stats.exerciseBreakdown.strengthSessions > 0;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Quick Stats Row - Compact Version */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className={`glass border-l-4 p-3 rounded-lg flex flex-col justify-center relative overflow-hidden ${isGoalAchieved('sleep') ? 'border-sky-500' : 'border-slate-700'}`}>
                    <div className="absolute -right-2 -bottom-2 text-6xl opacity-5 pointer-events-none">
                        😴
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 relative z-10">Sömn / natt</div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-xl font-black text-white">{stats.avgSleep.toFixed(1)}</span>
                        <span className="text-xs text-slate-500">h</span>
                    </div>
                </div>
                <div className={`glass border-l-4 p-3 rounded-lg flex flex-col justify-center relative overflow-hidden ${isGoalAchieved('water') ? 'border-emerald-500' : 'border-slate-700'}`}>
                    <div className="absolute -right-2 -bottom-2 text-6xl opacity-5 pointer-events-none">
                        💧
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 relative z-10">Vatten / dag</div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-xl font-black text-white">{stats.avgWater.toFixed(1)}</span>
                        <span className="text-xs text-slate-500">L</span>
                    </div>
                </div>

                <div className="glass border-l-4 border-rose-500/50 p-3 rounded-lg flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute -right-2 -bottom-2 text-6xl opacity-5 pointer-events-none">
                        ⚖️
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 relative z-10">Vikttrend</div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className={`text-xl font-black ${stats.weightTrend > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {stats.weightTrend > 0 ? '+' : ''}{stats.weightTrend.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500">kg</span>
                    </div>
                </div>

                {/* Caffeine Card */}
                <div className="glass border-l-4 border-amber-500/50 p-3 rounded-lg flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute -right-2 -bottom-2 text-6xl opacity-5 pointer-events-none">
                        ☕
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 relative z-10">Koffein / dag</div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-xl font-black text-amber-400">{Math.round(stats.avgCaffeine)}</span>
                        <span className="text-xs text-slate-500">mg</span>
                    </div>
                </div>

                {/* Calories Card */}
                <div className={`glass border-l-4 p-3 rounded-lg flex flex-col justify-center relative overflow-hidden ${isGoalAchieved('calories') ? 'border-rose-500' : 'border-slate-700'}`}>
                    <div className="absolute -right-2 -bottom-2 text-6xl opacity-5 pointer-events-none">
                        🔥
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 relative z-10">Kalorier / dag</div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-xl font-black text-rose-400">{Math.round(stats.avgCalories)}</span>
                        <span className="text-xs text-slate-500">kcal</span>
                    </div>
                </div>

                {/* Protein Card */}
                <div className="glass border-l-4 border-emerald-500/50 p-3 rounded-lg flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute -right-2 -bottom-2 text-6xl opacity-5 pointer-events-none">
                        🌱
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 relative z-10">Protein / dag</div>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-xl font-black text-emerald-400">{Math.round(stats.avgProtein)}</span>
                        <span className="text-xs text-slate-500">g</span>
                    </div>
                </div>
            </section>

            <div className="flex flex-col md:flex-row items-start gap-6">
                {/* Left Column: Energy Balance Chart */}
                <div className="flex-1 w-full space-y-6">
                    <div className="health-card glass flex flex-col overflow-hidden">
                        <div className="card-header border-b border-white/5 pb-4 mb-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500">Vikt & Trend</h2>
                                <span className="text-lg opacity-40">⚖️</span>
                            </div>
                        </div>

                        <div className="w-full h-[400px] px-2" style={{ minHeight: '320px' }}>
                            {enrichedWeightEntries && enrichedWeightEntries.length > 0 ? (
                                <WeightTrendChart
                                    entries={enrichedWeightEntries}
                                    currentWeight={enrichedWeightEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.weight || 0}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-40">
                                    <span className="text-3xl mb-3">⚖️</span>
                                    <p className="text-xs text-center font-bold">Logga vikt för trendanalys</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Activity Status */}
                <div className="md:w-1/3 flex flex-col gap-4">
                    {/* Log Consistency */}
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex items-center justify-between group relative cursor-help">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-slate-500">Loggnings-score</p>
                            <p className="text-2xl font-black text-white">{stats.loggingConsistency}%</p>
                        </div>
                        <div className="h-10 w-10 relative flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="50%" cy="50%" r="18" fill="none" stroke="#334155" strokeWidth="4" />
                                <circle cx="50%" cy="50%" r="18" fill="none" stroke="#0ea5e9" strokeWidth="4" strokeDasharray={`${stats.loggingConsistency}, 100`} />
                            </svg>
                        </div>

                        {/* Tooltip */}
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 border border-white/10 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <p className="text-[10px] text-slate-300 leading-tight">
                                Andel dagar du har loggat någon data (mat, träning, vikt eller välmående).
                            </p>
                        </div>
                    </div>

                    {/* Cardio Overview Card */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                🏃 Löpning & Cardio
                            </h3>
                            {stats.exerciseBreakdown.totalDistance > 0 && (
                                <span className="text-[10px] font-mono text-emerald-400">{timeframe} dagar</span>
                            )}
                        </div>

                        {stats.exerciseBreakdown.totalDistance > 0 ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                                    <span className="text-sm text-slate-400">Distans</span>
                                    <span className="text-xl font-bold text-white">{stats.exerciseBreakdown.totalDistance.toFixed(1)} <span className="text-xs text-slate-500">km</span></span>
                                </div>
                                <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                                    <span className="text-sm text-slate-400">Tid</span>
                                    <span className="text-xl font-bold text-white">{Math.round(stats.exerciseBreakdown.totalCardioDuration / 60)}h <span className="text-xs text-slate-500">{Math.round(stats.exerciseBreakdown.totalCardioDuration % 60)}m</span></span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <span className="text-2xl block mb-2 opacity-30">👟</span>
                                <p className="text-xs text-slate-500">Inga cardiosessioner registrerade.</p>
                            </div>
                        )}
                    </div>

                    {/* Strength Overview Card */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                💪 Styrka
                            </h3>
                        </div>

                        {stats.exerciseBreakdown.strengthSessions > 0 ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                                    <span className="text-sm text-slate-400">Pass</span>
                                    <span className="text-xl font-bold text-white">{stats.exerciseBreakdown.strengthSessions} <span className="text-xs text-slate-500">st</span></span>
                                </div>
                                <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                                    <span className="text-sm text-slate-400">Volym</span>
                                    <span className="text-xl font-bold text-indigo-400">{(stats.exerciseBreakdown.totalTonnage / 1000).toFixed(1)} <span className="text-xs text-slate-500">ton</span></span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <span className="text-2xl block mb-2 opacity-30">🏋️</span>
                                <p className="text-xs text-slate-500">Inga styrkepass registrerade.</p>
                            </div>
                        )}
                    </div>

                    {!hasAnyActivity && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                            <p className="text-sm text-emerald-300 font-bold mb-2">Dags att sätta igång?</p>
                            <p className="text-xs text-emerald-200/70">Logga ditt första pass för att se statistiken växa!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
