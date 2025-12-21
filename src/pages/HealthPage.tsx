import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { aggregateHealthData, calculateHealthStats } from '../utils/healthAggregator.ts';
import './HealthPage.css';

type TimeFrame = '7d' | '30d' | 'all';

export function HealthPage() {
    const { dailyVitals, weightEntries, mealEntries, exerciseEntries, calculateDailyNutrition } = useData();
    const { settings } = useSettings();
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d');

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

        // Data Consistency
        if (stats.loggingConsistency < 50) {
            list.push({ type: 'warning', text: `Din loggningsfrekvens är låg (${stats.loggingConsistency}%). För mer precis analys behövs mer data.`, icon: '📊' });
        }

        // Untracked days rule
        if (stats.untrackedDays > 2 && timeframe === '7d') {
            list.push({ type: 'tip', text: 'Du har missat att logga kalorier under några dagar. Kom ihåg att "Vitals Only"-loggning fortfarande hjälper din score!', icon: '📝' });
        }

        // Goal specific insights
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

        return list;
    }, [stats, settings, timeFrame]);

    const healthScore = useMemo(() => {
        const baseScore = (stats.proteinQualityScore + Math.min(100, (stats.avgSleep / 8) * 100) + Math.min(100, (stats.avgWater / (settings.dailyWaterGoal || 8)) * 100)) / 3;
        const consistencyPenalty = (100 - stats.loggingConsistency) * 0.2; // Max 20 points penalty for 0 consistency
        return Math.max(0, Math.min(100, Math.round(baseScore - consistencyPenalty)));
    }, [stats, settings]);

    return (
        <div className="health-page animate-in fade-in duration-500">
            <header className="health-header">
                <div className="header-content">
                    <span className={`header-badge ${goalTheme.text}`} style={{ backgroundColor: goalTheme.bg }}>{goalTheme.label}</span>
                    <h1>Din Hälsa</h1>
                    <p>En sammanställning av dina biometriska data och trender.</p>
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
                <section className="stats-row">
                    <div className="stat-card glass border-b-2" style={{ borderBottomColor: goalTheme.primary }}>
                        <div className="stat-label">Genomsnittlig Sömn</div>
                        <div className="stat-value">{stats.avgSleep.toFixed(1)}h</div>
                        <div className="stat-trend neutral">Sikta på {settings.dailySleepGoal || 8}h</div>
                    </div>
                    <div className="stat-card glass">
                        <div className="stat-label">Vattenintag (avg)</div>
                        <div className="stat-value">{stats.avgWater.toFixed(1)}</div>
                        <div className="stat-trend neutral">{stats.avgWater >= (settings.dailyWaterGoal || 8) ? 'Mål uppnått ✨' : 'Öka intaget 💧'}</div>
                    </div>
                    <div className="stat-card glass">
                        <div className="stat-label">Protein Score</div>
                        <div className="stat-value">{stats.proteinQualityScore}</div>
                        <div className="stat-trend positive">Aminosyra-balans</div>
                    </div>
                    <div className="stat-card glass">
                        <div className="stat-label">Vikttrend</div>
                        <div className="stat-value">{stats.weightTrend > 0 ? '+' : ''}{stats.weightTrend.toFixed(1)} kg</div>
                        <div className="stat-trend italic">Trend över {timeFrame}</div>
                    </div>
                </section>

                <section className="visual-sections">
                    <div className="health-card massive-chart glass">
                        <div className="card-header">
                            <h2>Vikt & Energibalans</h2>
                            <p>Korrelation mellan kaloriintag och viktförändring.</p>
                        </div>
                        <div className="chart-placeholder flex flex-col p-6 items-center justify-center">
                            <div className="w-full h-full flex items-end gap-2 px-4 opacity-30 hover:opacity-100 transition-opacity">
                                {snapshots.map((s, i) => (
                                    <div key={i} className="flex-1 h-full flex flex-col justify-end gap-1 group relative">
                                        {s.isUntracked && (
                                            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none opacity-20">
                                                <div className="w-px h-full bg-slate-500 transform rotate-45" />
                                            </div>
                                        )}
                                        <div
                                            className={`w-full bg-emerald-500/20 rounded-t-sm transition-all ${s.isUntracked ? 'opacity-5' : ''}`}
                                            style={{ height: `${Math.min(100, (s.nutrition.calories / (settings.dailyCalorieGoal || 2000)) * 100)}%` }}
                                        />
                                        <div
                                            className={`w-full bg-sky-400/20 rounded-t-sm transition-all ${s.isUntracked ? 'opacity-5' : ''}`}
                                            style={{ height: `${Math.min(100, (s.vitals.water / (settings.dailyWaterGoal || 8)) * 100)}%` }}
                                        />
                                        {/* Hover Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block glass p-2 rounded text-[10px] whitespace-nowrap z-50">
                                            {s.date}<br />
                                            {s.isUntracked ? 'Ingen data' : `${s.nutrition.calories} kcal / ${s.vitals.water}L`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 text-[10px] text-slate-500 uppercase tracking-widest font-black">Historisk Data ({timeFrame})</div>
                        </div>
                    </div>

                    <div className="side-grid">
                        <div className="health-card glass">
                            <div className="card-header">
                                <h2>Mikronäring</h2>
                                <p>Täckningsgrad av RDA.</p>
                            </div>
                            <div className="space-y-3">
                                {Object.entries(stats.vitaminCoverage).map(([key, val]) => (
                                    <div key={key} className="space-y-1">
                                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                                            <span>{key}</span>
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
            </main>
        </div>
    );
}
