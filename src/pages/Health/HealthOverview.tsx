import React, { useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext.tsx';
import { DaySnapshot, HealthStats } from '../../utils/healthAggregator.ts';

interface HealthOverviewProps {
    snapshots: DaySnapshot[];
    stats: HealthStats;
    timeframe: number;
}

export function HealthOverview({ snapshots, stats, timeframe }: HealthOverviewProps) {
    const { settings } = useSettings();

    const isGoalAchieved = (type: 'sleep' | 'water' | 'calories' | 'tonnage') => {
        if (type === 'sleep') return stats.avgSleep >= (settings.dailySleepGoal || 7);
        if (type === 'water') return stats.avgWater >= (settings.dailyWaterGoal || 6);
        if (type === 'calories') {
            const goal = settings.dailyCalorieGoal || 2000;
            const diff = Math.abs((stats.totalCalories / snapshots.length) - goal);
            return diff < goal * 0.1;
        }
        if (type === 'tonnage') return stats.exerciseBreakdown.totalTonnage > 0;
        return false;
    };

    return (
        <div className="health-overview-content flex flex-col gap-6">
            <section className="stats-row">
                <div className={`stat-card glass border-b-2 ${isGoalAchieved('sleep') ? 'border-sky-500' : 'border-amber-500/50'}`}>
                    <div className="stat-label text-sky-400">Sömn (avg)</div>
                    <div className="stat-value">{stats.avgSleep.toFixed(1)}h</div>
                    <div className={`stat-trend ${isGoalAchieved('sleep') ? 'text-emerald-400' : 'text-amber-400 opacity-60'}`}>
                        {isGoalAchieved('sleep') ? 'Mål uppnått ✨' : `Mål: ${settings.dailySleepGoal || 8} h`}
                    </div>
                </div>
                <div className={`stat-card glass border-b-2 ${isGoalAchieved('water') ? 'border-emerald-500' : 'border-amber-500/50'}`}>
                    <div className="stat-label text-emerald-400">Vatten (avg)</div>
                    <div className="stat-value">{stats.avgWater.toFixed(1)}</div>
                    <div className={`stat-trend ${isGoalAchieved('water') ? 'text-emerald-400' : 'text-amber-400 opacity-60'}`}>
                        {isGoalAchieved('water') ? 'Mål uppnått ✨' : `Mål: ${settings.dailyWaterGoal || 8}`}
                    </div>
                </div>
                <div className={`stat-card glass border-b-2 ${isGoalAchieved('calories') ? 'border-indigo-500' : 'border-amber-500/50'}`}>
                    <div className="stat-label text-indigo-400">Genomsnittlig kcal</div>
                    <div className="stat-value">{Math.round(stats.totalCalories / snapshots.length)}</div>
                    <div className={`stat-trend ${isGoalAchieved('calories') ? 'text-emerald-400' : 'text-amber-400 opacity-60'}`}>
                        {isGoalAchieved('calories') ? 'Exakt på mål ✨' : `Mål: ${settings.dailyCalorieGoal || 2000}`}
                    </div>
                </div>
                <div className="stat-card glass border-b-2 border-rose-500/50">
                    <div className="stat-label text-rose-400">Vikttrend</div>
                    <div className="stat-value">{stats.weightTrend > 0 ? '+' : ''}{stats.weightTrend.toFixed(1)} kg</div>
                    <div className="stat-trend italic opacity-60">Trend över {timeframe} dagar</div>
                </div>
            </section>

            <section className="visual-sections">
                <div className="flex flex-col gap-6">
                    <div className="health-card massive-chart glass">
                        <div className="card-header">
                            <h2>Vikt & Energibalans</h2>
                            <p>Korrelation mellan kaloriintag (staplar) och viktförändring (linje).</p>
                        </div>
                        <div className="chart-placeholder flex flex-col p-6 items-center justify-center relative">
                            {/* Calories (Bars) */}
                            <div className="w-full h-64 flex items-end gap-2 px-4 z-10 relative">
                                {snapshots.map((s, i) => (
                                    <div key={i} className="flex-1 h-full flex flex-col justify-end gap-1 group relative">
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
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block glass p-2 rounded text-[10px] whitespace-nowrap z-50">
                                            <div className="font-bold">{s.date}</div>
                                            <div>{s.isUntracked ? 'Ingen mat jämförd' : `${Math.round(s.nutrition.calories)} kcal`}</div>
                                            {s.weight && <div className="text-emerald-400">{s.weight} kg</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Weight Curve (SVG Overlay) */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ padding: '1.5rem 1rem' }} preserveAspectRatio="none">
                                <path
                                    d={(() => {
                                        const validWeights = snapshots.filter(s => s.weight);
                                        if (validWeights.length < 2) return '';

                                        const weights = validWeights.map(s => s.weight!);
                                        const minW = Math.min(...weights) - 0.5;
                                        const maxW = Math.max(...weights) + 0.5;
                                        const range = maxW - minW;

                                        return 'M ' + snapshots.map((s, i) => {
                                            if (!s.weight) return null;
                                            const x = (i / (snapshots.length - 1)) * 100;
                                            const y = 100 - ((s.weight - minW) / range) * 100;
                                            return `${x}% ${y}% `;
                                        }).filter(p => p !== null).join(' L ');
                                    })()}
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="drop-shadow-lg"
                                />
                            </svg>

                            <div className="mt-4 flex gap-6 text-[10px] uppercase tracking-widest font-black">
                                <span className="flex items-center gap-2"><span className="w-2 h-2 bg-indigo-500/50 rounded-sm"></span> Kalorier</span>
                                <span className="flex items-center gap-2"><span className="w-6 h-0.5 bg-emerald-500 rounded-full"></span> Viktkurva</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="health-card glass">
                            <div className="card-header">
                                <h2 className="text-sm">Löpnings-statistik</h2>
                                <p className="text-[10px]">För perioden {timeframe} dagar</p>
                            </div>
                            <div className="space-y-4 mt-2">
                                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Intervaller</span>
                                    <span className="text-xl font-black text-white">{stats.exerciseBreakdown.intervals}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Långpass</span>
                                    <span className="text-xl font-black text-white">{stats.exerciseBreakdown.longRuns}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-emerald-500/30">
                                    <span className="text-[10px] uppercase font-bold text-emerald-400">Tävlingar</span>
                                    <span className="text-xl font-black text-emerald-400">{stats.exerciseBreakdown.races}</span>
                                </div>
                            </div>
                        </div>
                        <div className="health-card glass">
                            <div className="card-header">
                                <h2 className="text-sm">Styrke-statistik</h2>
                                <p className="text-[10px]">Total volymlyft</p>
                            </div>
                            <div className="flex flex-col items-center justify-center p-4">
                                <div className="text-3xl font-black text-white">{(stats.exerciseBreakdown.totalTonnage / 1000).toFixed(1)} <span className="text-sm text-slate-500">ton</span></div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Hela perioden</div>
                                <div className="w-full h-1 bg-slate-800 rounded-full mt-4 overflow-hidden">
                                    <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, (stats.exerciseBreakdown.totalTonnage / 20000) * 100)}%` }} />
                                </div>
                                <p className="text-[8px] text-slate-500 mt-2 uppercase">Mål: 20 ton per vecka</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="side-grid">
                    <div className="health-card glass vitality-card">
                        <div className="vitality-header">
                            <div className="card-header">
                                <h2 className="text-emerald-400">Vegan Vitality</h2>
                                <p className="text-[10px]">Kritiska mikronäringsämnen</p>
                            </div>
                            <div className="vitality-shield">🛡️</div>
                        </div>

                        <div className="nutrient-grid">
                            {Object.entries(stats.vitaminCoverage)
                                .filter(([key]) => ['iron', 'vitaminB12', 'calcium', 'zinc'].includes(key))
                                .map(([key, val]) => {
                                    const labels: Record<string, string> = {
                                        iron: 'Järn',
                                        vitaminB12: 'B12',
                                        calcium: 'Kalcium',
                                        zinc: 'Zink'
                                    };

                                    return (
                                        <div key={key} className="nutrient-item">
                                            <div className="nutrient-meta">
                                                <span className="nutrient-name">{labels[key] || key}</span>
                                                <span className="nutrient-percent">{val}%</span>
                                            </div>
                                            <div className="coverage-track">
                                                <div
                                                    className={`coverage-bar ${val < 50 ? 'low' : val < 90 ? 'mid' : val < 150 ? 'optimal' : 'super'}`}
                                                    style={{ width: `${Math.min(100, (val / 150) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>

                        <div className="vitality-summary">
                            <span className="text-lg">✨</span>
                            <div>
                                Ditt "Greens Shield" är på {
                                    Math.round(
                                        (stats.vitaminCoverage.iron +
                                            stats.vitaminCoverage.vitaminB12 +
                                            stats.vitaminCoverage.calcium +
                                            stats.vitaminCoverage.zinc) / 4
                                    )
                                }%.
                                {(stats.vitaminCoverage.vitaminB12 < 50) && " Kom ihåg B12-tillskott!"}
                            </div>
                        </div>
                    </div>

                    <div className="health-card glass">
                        <div className="card-header">
                            <h2>Loggnings-hälsa</h2>
                            <p>Konsistens i ditt mätande.</p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4">
                            <div className="text-3xl font-black text-white">{stats.loggingConsistency}%</div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Consistency Score</div>
                            <div className="w-full h-1 bg-slate-800 rounded-full mt-4 overflow-hidden">
                                <div className="h-full bg-sky-500" style={{ width: `${stats.loggingConsistency}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
