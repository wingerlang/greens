import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { aggregateHealthData, calculateHealthStats } from '../utils/healthAggregator.ts';
import { HealthOverview } from './Health/HealthOverview.tsx';
import { MetricFocusView } from './Health/MetricFocusView.tsx';
import { StyrkaView } from './Health/StyrkaView.tsx';
import { KonditionView } from './Health/KonditionView.tsx';
import './HealthPage.css';

type TimeFrame = 7 | 30 | 90;

export function HealthPage() {
    const { metric } = useParams<{ metric?: string }>();
    const navigate = useNavigate();
    const { dailyVitals, weightEntries, mealEntries, exerciseEntries, calculateDailyNutrition, universalActivities } = useData();
    const { settings } = useSettings();

    // Map metric aliases and defaults
    const activeTab = useMemo(() => {
        const m = metric?.toLowerCase();
        if (!m || m === 'overview' || m === 'översikt') return 'overview';
        if (m === 'weight' || m === 'vikt') return 'weight';
        if (m === 'sleep' || m === 'sömn') return 'sleep';
        if (m === 'strength' || m === 'styrka') return 'strength';
        if (m === 'cardio' || m === 'kondition') return 'cardio';
        return 'overview';
    }, [metric]);

    const [timeframe, setTimeframe] = useState<TimeFrame>(30);

    const snapshots = useMemo(() => {
        return aggregateHealthData(
            timeframe,
            dailyVitals,
            weightEntries,
            mealEntries,
            exerciseEntries,
            calculateDailyNutrition
        );
    }, [timeframe, dailyVitals, weightEntries, mealEntries, exerciseEntries, calculateDailyNutrition]);

    const stats = useMemo(() => calculateHealthStats(snapshots), [snapshots]);

    const goalTheme = useMemo(() => {
        if (settings.trainingGoal === 'bulk') return { primary: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', text: 'text-amber-400', label: 'Bulk-fokus' };
        if (settings.trainingGoal === 'deff') return { primary: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', text: 'text-sky-400', label: 'Deff-fokus' };
        return { primary: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', text: 'text-emerald-400', label: 'Balans-fokus' };
    }, [settings.trainingGoal]);

    const healthScore = useMemo(() => {
        const baseScore = (stats.proteinQualityScore + Math.min(100, (stats.avgSleep / 8) * 100) + Math.min(100, (stats.avgWater / (settings.dailyWaterGoal || 8)) * 100)) / 3;
        const consistencyPenalty = (100 - stats.loggingConsistency) * 0.2;
        return Math.max(0, Math.min(100, Math.round(baseScore - consistencyPenalty)));
    }, [stats, settings]);

    const handleTabChange = (tab: string) => {
        // Use Swedish alias if the user is currently on a Swedish path
        const isSwedishPath = window.location.pathname.includes('/hälsa') || window.location.pathname.includes('/halsa');
        const basePath = isSwedishPath ? '/hälsa' : '/health';

        let path = tab;
        if (isSwedishPath) {
            if (tab === 'weight') path = 'vikt';
            if (tab === 'sleep') path = 'sömn';
            if (tab === 'strength') path = 'styrka';
            if (tab === 'cardio') path = 'kondition';
        }

        navigate(`${basePath}/${path}`);
    };

    return (
        <div className="health-page animate-in fade-in duration-500">
            <header className="health-header">
                <div className="header-content">
                    <span className={`header-badge ${goalTheme.text}`} style={{ backgroundColor: goalTheme.bg }}>{goalTheme.label}</span>
                    <h1>Din Hälsa</h1>
                    <div className="tab-nav">
                        <button className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => handleTabChange('overview')}>Översikt</button>
                        <button className={`tab-link ${activeTab === 'sleep' ? 'active' : ''}`} onClick={() => handleTabChange('sleep')}>Sömn</button>
                        <button className={`tab-link ${activeTab === 'weight' ? 'active' : ''}`} onClick={() => handleTabChange('weight')}>Vikt</button>
                        <button className={`tab-link ${activeTab === 'strength' ? 'active' : ''}`} onClick={() => handleTabChange('strength')}>💪 Styrka</button>
                        <button className={`tab-link ${activeTab === 'cardio' ? 'active' : ''}`} onClick={() => handleTabChange('cardio')}>🏃 Kondition</button>
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
                        {([7, 30, 90] as TimeFrame[]).map(tf => (
                            <button
                                key={tf}
                                className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                                onClick={() => setTimeframe(tf)}
                            >
                                {tf === 90 ? 'ALL' : `${tf}D`}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="health-grid">
                {activeTab === 'overview' && (
                    <HealthOverview snapshots={snapshots} stats={stats} timeframe={timeframe} />
                )}
                {activeTab === 'sleep' && (
                    <MetricFocusView type="sleep" snapshots={snapshots} stats={stats} days={timeframe} />
                )}
                {activeTab === 'weight' && (
                    <MetricFocusView type="weight" snapshots={snapshots} stats={stats} days={timeframe} />
                )}
                {activeTab === 'strength' && (
                    <StyrkaView days={timeframe} />
                )}
                {activeTab === 'cardio' && (
                    <KonditionView days={timeframe} exerciseEntries={exerciseEntries} universalActivities={universalActivities} />
                )}
            </main>
        </div>
    );
}
