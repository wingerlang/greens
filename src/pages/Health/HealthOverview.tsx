import React, { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { DaySnapshot, HealthStats } from '../../utils/healthAggregator.ts';
import { ExerciseEntry, WeightEntry } from '../../models/types.ts';


interface HealthOverviewProps {
    snapshots: DaySnapshot[];
    stats: HealthStats;
    timeframe: number;
    exerciseEntries: ExerciseEntry[];
}

export function HealthOverview({ snapshots, stats, timeframe, exerciseEntries }: HealthOverviewProps) {
    const { settings } = useSettings();
    const { weightEntries } = useData();

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
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`glass border-l-4 p-3 rounded-lg flex flex-col justify-center ${isGoalAchieved('sleep') ? 'border-sky-500' : 'border-slate-700'}`}>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Sömn / natt</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-white">{stats.avgSleep.toFixed(1)}</span>
                        <span className="text-xs text-slate-500">h</span>
                    </div>
                </div>
                <div className={`glass border-l-4 p-3 rounded-lg flex flex-col justify-center ${isGoalAchieved('water') ? 'border-emerald-500' : 'border-slate-700'}`}>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Vatten / dag</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-white">{stats.avgWater.toFixed(1)}</span>
                        <span className="text-xs text-slate-500">L</span>
                    </div>
                </div>

                <div className="glass border-l-4 border-rose-500/50 p-3 rounded-lg flex flex-col justify-center">
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5">Vikttrend</div>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-black ${stats.weightTrend > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {stats.weightTrend > 0 ? '+' : ''}{stats.weightTrend.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500">kg</span>
                    </div>
                </div>
            </section>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Left Column: Energy Balance Chart */}
                <div className="flex-1 space-y-6">
                    <div className="health-card glass min-h-[280px] flex flex-col">
                        <div className="card-header">
                            <h2 className="text-sm">Vikt & Trend</h2>
                            <p className="text-[10px]">Dina senaste viktmätningar</p>
                        </div>

                        {weightEntries.length > 0 ? (() => {
                            // Use actual weightEntries, sorted by date (oldest first for chart)
                            const sortedEntries = [...weightEntries]
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                            // Get the latest entry (most recent date)
                            const latestEntry = [...weightEntries]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                            const weightData = sortedEntries.map(e => ({ date: e.date, weight: e.weight }));

                            if (weightData.length < 2) {
                                return (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
                                        <span className="text-4xl mb-4">📊</span>
                                        <p className="text-sm text-center">Minst 2 viktmätningar behövs för trenden.</p>
                                        <p className="text-xs text-slate-500 mt-2">Loggade: {weightData.length} mätning(ar)</p>
                                        {latestEntry && (
                                            <p className="text-lg font-bold text-white mt-4">{latestEntry.weight} kg</p>
                                        )}
                                    </div>
                                );
                            }

                            const weights = weightData.map(d => d.weight);
                            const minW = Math.min(...weights) - 0.5;
                            const maxW = Math.max(...weights) + 0.5;
                            const range = maxW - minW || 1;

                            const firstWeight = weights[0];
                            const latestWeight = latestEntry.weight; // Use actual latest, not just chart end
                            const weightChange = latestWeight - firstWeight;

                            // Create SVG path
                            const pathPoints = weightData.map((d, i) => {
                                const x = (i / (weightData.length - 1)) * 100;
                                const y = 100 - ((d.weight - minW) / range) * 100;
                                return `${x},${y}`;
                            }).join(' L ');

                            return (
                                <div className="flex-1 p-4 flex flex-col">
                                    {/* Weight Summary */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="text-2xl font-black text-white">{latestWeight.toFixed(1)} <span className="text-sm text-slate-400">kg</span></div>
                                            <div className="text-[10px] text-slate-500">Senaste mätning ({latestEntry.date})</div>
                                        </div>
                                        <div className={`text-right px-3 py-1 rounded-lg ${weightChange > 0 ? 'bg-rose-500/20' : weightChange < 0 ? 'bg-emerald-500/20' : 'bg-slate-500/20'}`}>
                                            <div className={`text-lg font-black ${weightChange > 0 ? 'text-rose-400' : weightChange < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                                            </div>
                                            <div className="text-[10px] text-slate-500">sedan {weightData[0].date}</div>
                                        </div>
                                    </div>

                                    {/* Chart */}
                                    <div className="flex-1 relative min-h-[120px]">
                                        <svg
                                            viewBox="0 0 100 100"
                                            preserveAspectRatio="none"
                                            className="w-full h-full"
                                        >
                                            {/* Grid lines */}
                                            <line x1="0" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="0.5" />
                                            <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" strokeDasharray="2" />
                                            <line x1="0" y1="100" x2="100" y2="100" stroke="#334155" strokeWidth="0.5" />

                                            {/* Gradient fill under line */}
                                            <defs>
                                                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={weightChange <= 0 ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
                                                    <stop offset="100%" stopColor={weightChange <= 0 ? "#10b981" : "#ef4444"} stopOpacity="0" />
                                                </linearGradient>
                                            </defs>

                                            {/* Area fill */}
                                            <path
                                                d={`M 0,100 L ${pathPoints} L 100,100 Z`}
                                                fill="url(#weightGradient)"
                                            />

                                            {/* Weight line */}
                                            <path
                                                d={`M ${pathPoints}`}
                                                fill="none"
                                                stroke={weightChange <= 0 ? "#10b981" : "#ef4444"}
                                                strokeWidth="2"
                                                vectorEffect="non-scaling-stroke"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />

                                            {/* Data points */}
                                            {weightData.map((d, i) => {
                                                const x = (i / (weightData.length - 1)) * 100;
                                                const y = 100 - ((d.weight - minW) / range) * 100;
                                                return (
                                                    <circle
                                                        key={i}
                                                        cx={x}
                                                        cy={y}
                                                        r="1.5"
                                                        fill="white"
                                                        stroke={weightChange <= 0 ? "#10b981" : "#ef4444"}
                                                        strokeWidth="0.5"
                                                        vectorEffect="non-scaling-stroke"
                                                    />
                                                );
                                            })}
                                        </svg>

                                        {/* Y-axis labels */}
                                        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-slate-500 font-mono -ml-8 pointer-events-none">
                                            <span>{maxW.toFixed(1)}</span>
                                            <span>{((maxW + minW) / 2).toFixed(1)}</span>
                                            <span>{minW.toFixed(1)}</span>
                                        </div>
                                    </div>

                                    {/* X-axis labels */}
                                    <div className="flex justify-between text-[9px] text-slate-500 mt-2">
                                        <span>{weightData[0].date}</span>
                                        <span>{weightData[weightData.length - 1].date}</span>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
                                <span className="text-4xl mb-4">⚖️</span>
                                <p className="text-sm text-center">Logga din vikt för att se trenden.</p>
                                <p className="text-xs text-slate-500 mt-2">Använd omniboxen: "82.5kg"</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Activity Status */}
                <div className="md:w-1/3 flex flex-col gap-4">
                    {/* Log Consistency */}
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex items-center justify-between">
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
