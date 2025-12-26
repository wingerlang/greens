import React, { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { DaySnapshot, HealthStats } from '../../utils/healthAggregator.ts';
import { ExerciseEntry } from '../../models/types.ts';


interface HealthOverviewProps {
    snapshots: DaySnapshot[];
    stats: HealthStats;
    timeframe: number;
    exerciseEntries: ExerciseEntry[];
}

export function HealthOverview({ snapshots, stats, timeframe, exerciseEntries }: HealthOverviewProps) {
    const { settings } = useSettings();

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
                    <div className="health-card massive-chart glass min-h-[300px]">
                        <div className="card-header">
                            <h2 className="text-sm">Vikt & Energibalans</h2>
                            <p className="text-[10px]">Energi in vs Viktkurva</p>
                        </div>

                        {(hasWeightData || hasCalorieData) ? (
                            <div className="chart-placeholder flex flex-col p-4 md:p-6 items-center justify-center relative flex-1">
                                {/* Chart Rendering Logic */}
                                <div className={`w-full h-48 md:h-64 flex items-end px-2 md:px-4 z-10 relative ${snapshots.length > 60 ? 'justify-between gap-0' : 'gap-1 md:gap-2'}`}>
                                    {snapshots.filter((_, i) => {
                                        if (snapshots.length <= 200) return true;
                                        const step = Math.ceil(snapshots.length / 150);
                                        return i % step === 0;
                                    }).map((s, i) => (
                                        <div key={i} className={`h-full flex flex-col justify-end gap-1 group relative ${snapshots.length > 60 ? 'w-1' : 'flex-1'}`}>
                                            {s.isUntracked && (
                                                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none opacity-20">
                                                    <div className="w-px h-full bg-slate-500 transform rotate-45" />
                                                </div>
                                            )}
                                            <div
                                                className={`w-full rounded-t-sm transition-all ${s.isUntracked ? 'opacity-5' : 'bg-indigo-500/30 hover:bg-indigo-500/50'}`}
                                                style={{ height: `${Math.min(100, (s.nutrition.calories / 3500) * 100)}%` }}
                                            />
                                            {/* Hover Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block glass p-2 rounded text-[10px] whitespace-nowrap z-50 pointer-events-none">
                                                <div className="font-bold">{s.date}</div>
                                                <div>{Math.round(s.nutrition.calories)} kcal</div>
                                                {s.weight && <div className="text-emerald-400">{s.weight} kg</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Weight Curve SVG */}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ padding: '1.5rem 0.5rem' }} preserveAspectRatio="none">
                                    <path
                                        d={(() => {
                                            const validWeights = snapshots.filter(s => s.weight);
                                            if (validWeights.length < 2) return '';

                                            const weights = validWeights.map(s => s.weight!);
                                            const minW = Math.min(...weights) - 0.5;
                                            const maxW = Math.max(...weights) + 0.5;
                                            const range = maxW - minW;

                                            // Need to map to the filtered visual indices if sampling is active above?
                                            // Actually, SVG maps 0-100% of width, so mapped to time.
                                            // Snapshot array is reverse chronologically? Or check healthAggregator.
                                            // healthAggregator pushes unshift (newest first).
                                            // Wait, visual order is usually left-to-right (old -> new).
                                            // snapshots[0] is newest (today). snapshots[length-1] is oldest.
                                            // The map above renders snapshots[0] (today) at left? No usually map renders index 0 first.
                                            // So if snapshots is [Today, Yesterday...], index 0 is Today.
                                            // If we want chronological Left->Right, we should reverse for display.
                                            // Let's assume standard map order for now, but usually charts are Old->New.
                                            // Let's reverse the data for chart logic to be Time ->

                                            // FIX: Reverse data for charts
                                            return 'M 0 0'; // Handled in reversed loop below
                                        })() === 'M 0 0' ? (() => {
                                            // Re-logic for chronological
                                            // Create chronological copy
                                            const chrono = [...snapshots].reverse();

                                            const validWeights = chrono.filter(s => s.weight);
                                            if (validWeights.length < 2) return '';
                                            const weights = validWeights.map(s => s.weight!);
                                            const minW = Math.min(...weights) - 0.5;
                                            const maxW = Math.max(...weights) + 0.5;
                                            const range = maxW - minW;

                                            return 'M ' + chrono.map((s, i) => {
                                                if (!s.weight) return null;
                                                const x = (i / (chrono.length - 1)) * 100;
                                                const y = 100 - ((s.weight - minW) / range) * 100;
                                                return `${x}% ${y}% `;
                                            }).filter(p => p !== null).join(' L ');
                                        })() : ''}
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="2"
                                        vectorEffect="non-scaling-stroke"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="drop-shadow-lg"
                                    />
                                </svg>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
                                <span className="text-4xl mb-4">⚖️</span>
                                <p className="text-sm text-center">Logga vikt eller mat för att se din energibalans.</p>
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
