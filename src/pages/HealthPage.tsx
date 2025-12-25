import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { aggregateHealthData, calculateHealthStats } from '../utils/healthAggregator.ts';
import './HealthPage.css';

type TimeFrame = '7d' | '30d' | 'all';

export function HealthPage() {
    const { dailyVitals, weightEntries, mealEntries, exerciseEntries, calculateDailyNutrition, coachConfig } = useData();
    const { settings } = useSettings();
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d');
    const [activeTab, setActiveTab] = useState<'overview' | 'sleep' | 'weight'>('overview');

    const days = timeFrame === '7d' ? 7 : timeFrame === '30d' ? 30 : 365;

    const snapshots = useMemo(() => {
        return aggregateHealthData(
            days,
            dailyVitals,
            weightEntries,
            mealEntries,
            exerciseEntries,
            calculateDailyNutrition
        );
    }, [days, dailyVitals, weightEntries, mealEntries, exerciseEntries, calculateDailyNutrition]);

    const stats = useMemo(() => calculateHealthStats(snapshots), [snapshots]);

    const goalTheme = useMemo(() => {
        if (settings.trainingGoal === 'bulk') return { primary: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', text: 'text-amber-400', label: 'Bulk-fokus' };
        if (settings.trainingGoal === 'deff') return { primary: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', text: 'text-sky-400', label: 'Deff-fokus' };
        return { primary: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', text: 'text-emerald-400', label: 'Balans-fokus' };
    }, [settings.trainingGoal]);

    const insights = useMemo(() => {
        const list: { type: 'tip' | 'warning' | 'positive' | 'goal'; text: string; icon: string }[] = [];

        // Don't show any insights if there's almost no data
        if (stats.loggingConsistency < 10 || snapshots.filter(s => !s.isUntracked).length < 2) {
            return list;
        }

        if (stats.loggingConsistency < 50) {
            list.push({ type: 'warning', text: `Din loggningsfrekvens är låg (${stats.loggingConsistency}%). För mer precis analys behövs mer data.`, icon: '📊' });
        }

        if (stats.untrackedDays > 2 && timeFrame === '7d') {
            list.push({ type: 'tip', text: 'Du har missat att logga kalorier under några dagar. Kom ihåg att "Vitals Only"-loggning fortfarande hjälper din score!', icon: '📝' });
        }

        if (settings.trainingGoal === 'deff') {
            if (stats.weightTrend < -0.1) {
                list.push({ type: 'goal', text: 'Stark deff! Du håller en jämn viktnedgång.', icon: '⚡' });
            } else if (stats.weightTrend > 0) {
                list.push({ type: 'warning', text: 'Vikten trendar uppåt trots deff-mål. Se över ditt kaloriintag.', icon: '⚖️' });
            }
        } else if (settings.trainingGoal === 'bulk') {
            if (stats.weightTrend > 0.1 && stats.weightTrend < 0.5) {
                list.push({ type: 'goal', text: 'Perfekt bulk-tempo! Musklerna tackar dig.', icon: '💪' });
            } else if (stats.weightTrend < 0) {
                list.push({ type: 'warning', text: 'Du tappar vikt under bulk. Du behöver förmodligen äta mer protein och kalorier.', icon: '🥩' });
            }
        }

        if (stats.avgSleep < 7) {
            list.push({ type: 'warning', text: 'Din genomsnittliga sömn är under 7h. Sikta på mer vila för bättre återhämtning.', icon: '😴' });
        }

        if (stats.proteinQualityScore < 70) {
            list.push({ type: 'tip', text: 'Kombinera oftare baljväxter med spannmål för att nå en komplett aminosyra-profil.', icon: '🥗' });
        }

        if (stats.avgCaffeine > 3) {
            list.push({ type: 'warning', text: 'Högt koffeinintag kan påverka sömnkvaliteten.', icon: '☕' });
        }

        // Running insights
        if (stats.exerciseBreakdown.intervals > 0) {
            list.push({ type: 'positive', text: `Bra jobb med intervallerna! Du har kört ${stats.exerciseBreakdown.intervals} pass.`, icon: '🏃‍♂️' });
        }

        return list;
    }, [stats, settings, timeFrame]);

    const healthScore = useMemo(() => {
        const baseScore = (stats.proteinQualityScore + Math.min(100, (stats.avgSleep / 8) * 100) + Math.min(100, (stats.avgWater / (settings.dailyWaterGoal || 8)) * 100)) / 3;
        const consistencyPenalty = (100 - stats.loggingConsistency) * 0.2;
        return Math.max(0, Math.min(100, Math.round(baseScore - consistencyPenalty)));
    }, [stats, settings]);

    const isGoalAchieved = (type: 'sleep' | 'water' | 'calories' | 'tonnage') => {
        if (type === 'sleep') return stats.avgSleep >= (settings.dailySleepGoal || 7);
        if (type === 'water') return stats.avgWater >= (settings.dailyWaterGoal || 6);
        if (type === 'calories') {
            const goal = settings.dailyCalorieGoal || 2000;
            const diff = Math.abs(stats.totalCalories / snapshots.length - goal);
            return diff < goal * 0.1;
        }
        if (type === 'tonnage') return stats.exerciseBreakdown.totalTonnage > 0;
        return false;
    };

    return (
        <div className="health-page animate-in fade-in duration-500">
            <header className="health-header">
                <div className="header-content">
                    <span className={`header-badge ${goalTheme.text}`} style={{ backgroundColor: goalTheme.bg }}>{goalTheme.label}</span>
                    <h1>Din Hälsa</h1>
                    <div className="tab-nav">
                        <button className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Översikt</button>
                        <button className={`tab-link ${activeTab === 'sleep' ? 'active' : ''}`} onClick={() => setActiveTab('sleep')}>Sömn</button>
                        <button className={`tab-link ${activeTab === 'weight' ? 'active' : ''}`} onClick={() => setActiveTab('weight')}>Vikt</button>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="score-circle">
                        <svg viewBox="0 0 36 36" className="circular-chart">
                            <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path
                                className="circle"
                                stroke={goalTheme.primary}
                                strokeDasharray={`${healthScore}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <text x="18" y="20.35" className="percentage">{healthScore}</text>
                        </svg>
                        <div className="score-label">Health Score</div>
                    </div>
                    <div className="tf-selector">
                        {(['7d', '30d', 'all'] as TimeFrame[]).map(tf => (
                            <button
                                key={tf}
                                className={`tf-btn ${timeFrame === tf ? 'active' : ''}`}
                                onClick={() => setTimeFrame(tf)}
                            >
                                {tf.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="health-grid">
                {activeTab === 'overview' && (
                    <>
                        <section className="stats-row">
                            <div className={`stat-card glass border-b-2 ${isGoalAchieved('sleep') ? 'border-sky-500' : 'border-amber-500/50'}`}>
                                <div className="stat-label text-sky-400">Sömn (avg)</div>
                                <div className="stat-value">{stats.avgSleep.toFixed(1)}h</div>
                                <div className={`stat-trend ${isGoalAchieved('sleep') ? 'text-emerald-400' : 'text-amber-400 opacity-60'}`}>
                                    {isGoalAchieved('sleep') ? 'Mål uppnått ✨' : `Mål: ${settings.dailySleepGoal || 8}h`}
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
                                <div className="stat-trend italic opacity-60">Trend över {timeFrame}</div>
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
                                                        style={{ height: `${Math.min(100, (s.nutrition.calories / 3500) * 100)}%` }} // Scaled to max 3500
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

                                                    // Find min/max for scaling
                                                    const weights = validWeights.map(s => s.weight!);
                                                    const minW = Math.min(...weights) - 0.5;
                                                    const maxW = Math.max(...weights) + 0.5;
                                                    const range = maxW - minW;

                                                    // Generate path points
                                                    return 'M ' + snapshots.map((s, i) => {
                                                        if (!s.weight) return null;
                                                        const x = (i / (snapshots.length - 1)) * 100;
                                                        const y = 100 - ((s.weight - minW) / range) * 100;
                                                        return `${x}% ${y}%`;
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
                                            <p className="text-[10px]">För perioden {timeFrame}</p>
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
                                                const getColorClass = (v: number) => {
                                                    if (v < 50) return 'low';
                                                    if (v < 90) return 'mid';
                                                    if (v < 150) return 'optimal';
                                                    return 'super';
                                                };

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
                                                                className={`coverage-bar ${getColorClass(val)}`}
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
                                        <h2>Övriga värden</h2>
                                        <p>Täckningsgrad av RDA.</p>
                                    </div>
                                    <div className="space-y-3">
                                        {Object.entries(stats.vitaminCoverage)
                                            .filter(([key]) => !['iron', 'vitaminB12', 'calcium', 'zinc'].includes(key))
                                            .map(([key, val]) => (
                                                <div key={key} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                                                        <span>{key === 'vitaminC' ? 'Vitamin C' : key === 'vitaminA' ? 'Vitamin A' : key}</span>
                                                        <span>{val}%</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, val)}%` }} />
                                                    </div>
                                                </div>
                                            ))}
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

                        <section className="insights-row overflow-x-auto pb-4">
                            <div className="flex gap-4 min-w-max">
                                {insights.map((insight, i) => (
                                    <div key={i} className={`insight-card glass ${insight.type}`}>
                                        <span className="insight-icon">{insight.icon}</span>
                                        <p className="insight-text">{insight.text}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 'sleep' && (
                    <div className="sleep-focus-view animate-in zoom-in-95 duration-300">
                        <div className="health-card glass overflow-hidden">
                            <div className="card-header p-8 pb-0">
                                <h2 className="text-2xl text-sky-400">Sömnanalys</h2>
                                <p className="text-sm">Din återhämtning de senaste {days} dagarna.</p>
                            </div>
                            <div className="p-8">
                                <div className="h-80 w-full relative flex items-end gap-1.5 px-4 mb-4">
                                    {/* Sleep Target Line (8h) */}
                                    <div className="absolute left-0 w-full border-t border-sky-500/30 border-dashed z-0 pointer-events-none" style={{ bottom: `${(8 / 12) * 100}%` }}>
                                        <span className="absolute -top-3 left-0 text-[9px] font-black text-sky-500/60 uppercase tracking-widest">Target 8h</span>
                                    </div>

                                    {snapshots.map((s, i) => {
                                        const sleepVal = s.vitals.sleep || 0;
                                        const hPercent = (sleepVal / 12) * 100; // Scaled to max 12h
                                        const isGood = sleepVal >= 8;
                                        const isCritical = sleepVal < 6;

                                        return (
                                            <div key={i} className="flex-1 h-full flex flex-col justify-end group relative z-10">
                                                <div
                                                    className={`w-full rounded-t-lg transition-all duration-500 cursor-help ${isGood ? 'bg-sky-500' : isCritical ? 'bg-rose-500/60' : 'bg-sky-500/40'}`}
                                                    style={{ height: `${Math.max(2, hPercent)}%` }}
                                                />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 scale-0 group-hover:scale-100 transition-transform glass p-3 rounded-2xl border border-sky-500/20 shadow-2xl z-50 pointer-events-none">
                                                    <div className="text-[10px] font-black text-slate-500 uppercase mb-1">{s.date}</div>
                                                    <div className="text-xl font-black text-white">{sleepVal}h</div>
                                                    <div className={`text-[9px] font-bold uppercase ${isGood ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                        {isGood ? 'Full återhämtning' : sleepVal === 0 ? 'Ej loggat' : 'Sömndeprivring'}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 mt-6">
                                    <span>Start ({snapshots[0].date})</span>
                                    <span>Slut ({snapshots[snapshots.length - 1].date})</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 border-t border-white/5 bg-white/5">
                                <div className="p-8 text-center border-r border-white/5">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Genomsnitt</div>
                                    <div className="text-3xl font-black text-sky-400">{stats.avgSleep.toFixed(1)}h</div>
                                </div>
                                <div className="p-8 text-center border-r border-white/5">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Target Match</div>
                                    <div className="text-3xl font-black text-emerald-400">
                                        {Math.round((snapshots.filter(s => s.vitals.sleep >= 8).length / snapshots.length) * 100)}%
                                    </div>
                                </div>
                                <div className="p-8 text-center">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Koffein vs Sömn</div>
                                    <div className="text-3xl font-black text-amber-400">{(stats.avgCaffeine || 0).toFixed(1)} <span className="text-xs">koppar</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'weight' && (
                    <div className="weight-focus-view animate-in zoom-in-95 duration-300">
                        <div className="health-card glass overflow-hidden">
                            <div className="card-header p-8 pb-0 flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl text-rose-400">Viktanalys</h2>
                                    <p className="text-sm">Din resa mot målvikten.</p>
                                </div>
                                {coachConfig?.preferences.weightGoal && (
                                    <div className="text-right">
                                        <div className="text-[10px] font-black text-slate-500 uppercase">Målvikt</div>
                                        <div className="text-2xl font-black text-white">{coachConfig.preferences.weightGoal} kg</div>
                                    </div>
                                )}
                            </div>
                            <div className="p-8 h-96 relative">
                                <div className="h-full w-full relative">
                                    {/* Weight Curve (SVG) */}
                                    <svg className="w-full h-full z-10 relative" style={{ padding: '1rem 0' }} preserveAspectRatio="none">
                                        {/* Grid Lines */}
                                        <line x1="0" y1="20%" x2="100%" y2="20%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                                        <line x1="0" y1="80%" x2="100%" y2="80%" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                                        <path
                                            d={(() => {
                                                const validSnapshots = snapshots.filter(s => s.weight);
                                                if (validSnapshots.length < 2) return '';

                                                const weights = snapshots.map(s => s.weight).filter(w => w !== undefined) as number[];
                                                const target = coachConfig?.preferences.weightGoal;
                                                if (target) weights.push(target);

                                                const minW = Math.min(...weights) - 1;
                                                const maxW = Math.max(...weights) + 1;
                                                const range = maxW - minW;

                                                const points = snapshots.map((s, i) => {
                                                    if (!s.weight) return null;
                                                    const x = (i / (snapshots.length - 1)) * 100;
                                                    const y = 100 - ((s.weight - minW) / range) * 100;
                                                    return `${x}% ${y}%`;
                                                }).filter(p => p !== null);

                                                return `M ${points.join(' L ')}`;
                                            })()}
                                            fill="none"
                                            stroke="#f43f5e"
                                            strokeWidth="4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="drop-shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                                        />
                                    </svg>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 border-t border-white/5 bg-slate-950/40">
                                <div className="p-6 border-r border-white/5">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Startvikt</div>
                                    <div className="text-xl font-black text-white">
                                        {(snapshots.find(s => s.weight)?.weight || weightEntries[weightEntries.length - 1]?.weight || 0).toFixed(1)} kg
                                    </div>
                                </div>
                                <div className="p-6 border-r border-white/5">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Nuvarande</div>
                                    <div className="text-xl font-black text-rose-400">
                                        {(weightEntries[0]?.weight || 0).toFixed(1)} kg
                                    </div>
                                </div>
                                <div className="p-6 border-r border-white/5">
                                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Förändring</div>
                                    <div className={`text-xl font-black ${stats.weightTrend <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {stats.weightTrend > 0 ? '+' : ''}{stats.weightTrend.toFixed(1)} kg
                                    </div>
                                </div>
                                <div className="p-6 bg-gradient-to-br from-rose-500/10 to-transparent">
                                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Målprognos</div>
                                    <div className="text-sm font-black text-white leading-tight">
                                        {(() => {
                                            const target = coachConfig?.preferences.weightGoal;
                                            if (!target) return 'Mål ej satt';
                                            const current = weightEntries[0]?.weight;
                                            if (!current) return 'Inga data';
                                            const diff = target - current;
                                            if (Math.abs(diff) < 0.2) return 'Håll vikten! ✨';

                                            const weeklyRate = stats.weightTrend / (days / 7);
                                            // If trend is moving away from goal or stagnation
                                            if ((diff < 0 && weeklyRate >= 0) || (diff > 0 && weeklyRate <= 0)) {
                                                return 'Trenden når ej mål';
                                            }

                                            const weeksLeft = Math.abs(diff / weeklyRate);
                                            const estDate = new Date();
                                            estDate.setDate(estDate.getDate() + (weeksLeft * 7));
                                            return `Beräknat: ${estDate.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })}`;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
