import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useUniversalActivities } from '../hooks/useUniversalActivities.ts';
import { aggregateHealthData, calculateHealthStats } from '../utils/healthAggregator.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { StrengthWorkout } from '../models/strengthTypes.ts'; // Import StrengthWorkout
import { ExerciseEntry } from '../models/types.ts';
import { HealthOverview } from './Health/HealthOverview.tsx';
import { MetricFocusView } from './Health/MetricFocusView.tsx';
import { StyrkaView } from './Health/StyrkaView.tsx';
import { KonditionView } from './Health/KonditionView.tsx';
import { MatView } from './Health/MatView.tsx';
import { TrainingView } from './Health/TrainingView.tsx';
import './HealthPage.css';

type TimeFrame = '7d' | '30d' | '3m' | '6m' | '9m' | 'year' | 'all';

const API_BASE = 'http://localhost:8000'; // Or use relative path /api

export function HealthPage() {
    const { metric } = useParams<{ metric?: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { dailyVitals, weightEntries, mealEntries, exerciseEntries: manualExerciseEntries, calculateDailyNutrition } = useData();
    const { settings } = useSettings();

    // Fetch Universal Activities (Strava/Garmin)
    const { activities: fetchedUniversalActivities, loading: loadingActivities } = useUniversalActivities(365); // Fetch last year

    // Fetch Strength Workouts
    const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([]);

    useEffect(() => {
        if (!token) return;

        async function fetchStrength() {
            try {
                // Fetch reasonably far back to support "ALL" view somewhat, or rely on date filtering later
                // Fetching 3 years back to cover most recent history
                const start = new Date();
                start.setFullYear(start.getFullYear() - 3);
                const startStr = start.toISOString().split('T')[0];
                const endStr = new Date().toISOString().split('T')[0];

                const res = await fetch(`${API_BASE}/api/strength/workouts?start=${startStr}&end=${endStr}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.workouts) {
                    setStrengthWorkouts(data.workouts);
                }
            } catch (e) {
                console.error("Failed to fetch strength workouts in HealthPage", e);
            }
        }
        fetchStrength();
    }, [token]);

    // Unified Exercise Entries
    const unifiedExerciseEntries = useMemo(() => {
        // 1. Manual Entries
        const manual = manualExerciseEntries;

        // 2. Mapped Universal Activities (Strava)
        const strava = fetchedUniversalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        // 3. Mapped Strength Workouts
        const strength = strengthWorkouts.map((w): ExerciseEntry => ({
            id: w.id,
            date: w.date,
            type: 'strength',
            durationMinutes: w.duration || (w.exercises.length * 4) + (w.totalSets * 1.5) || 45, // Rough estimate if missing
            intensity: 'high',
            caloriesBurned: w.totalVolume ? Math.round(w.totalVolume * 0.05) : 300, // Very rough estimate
            tonnage: w.totalVolume,
            notes: w.name,
            createdAt: w.createdAt
        }));

        // Deduplicate by ID and Date/Type/Time to avoid double counting if manual logs exist for same activity
        const combined = [...manual, ...strava, ...strength];
        const unique = new Map<string, ExerciseEntry>();

        combined.forEach(e => {
            // Prefer external source entries over manual if duplicates might exist?
            // Simple key: date-type
            // Actually, let's keep all for now, assuming users don't double log. 
            // Better to show duplicates than hide real data.
            // But let's use ID as unique key if available.
            unique.set(e.id, e);
        });

        return Array.from(unique.values()).sort((a, b) => b.durationMinutes - a.durationMinutes).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    }, [manualExerciseEntries, fetchedUniversalActivities, strengthWorkouts]);

    // Map metric aliases and defaults
    const activeTab = useMemo(() => {
        const m = metric?.toLowerCase();
        if (!m || m === 'overview' || m === 'översikt') return 'overview';
        if (m === 'food' || m === 'mat') return 'food';
        if (m === 'training' || m === 'träning') return 'training';
        if (m === 'weight' || m === 'vikt') return 'weight';
        if (m === 'sleep' || m === 'sömn') return 'sleep';
        if (m === 'strength' || m === 'styrka') return 'strength';
        if (m === 'cardio' || m === 'kondition') return 'cardio';
        return 'overview';
    }, [metric]);

    const [timeframe, setTimeframe] = useState<TimeFrame>('30d');

    const days = useMemo(() => {
        switch (timeframe) {
            case '7d': return 7;
            case '30d': return 30;
            case '3m': return 90;
            case '6m': return 180;
            case '9m': return 270;
            case 'year': {
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const diff = now.getTime() - startOfYear.getTime();
                return Math.ceil(diff / (1000 * 60 * 60 * 24));
            }
            case 'all': return 3650; // ~10 years
            default: return 30;
        }
    }, [timeframe]);

    const snapshots = useMemo(() => {
        return aggregateHealthData(
            days,
            dailyVitals,
            weightEntries,
            mealEntries,
            unifiedExerciseEntries, // Use unified entries here!
            calculateDailyNutrition
        );
    }, [days, dailyVitals, weightEntries, mealEntries, unifiedExerciseEntries, calculateDailyNutrition]);

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
            if (tab === 'food') path = 'mat';
            if (tab === 'training') path = 'träning';
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
                        <button className={`tab-link ${activeTab === 'food' ? 'active' : ''}`} onClick={() => handleTabChange('food')}>🥗 Mat</button>
                        <button className={`tab-link ${activeTab === 'training' ? 'active' : ''}`} onClick={() => handleTabChange('training')}>⚡ Träning</button>
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
                        {(['7d', '30d', '3m', '6m', '9m', 'year', 'all'] as TimeFrame[]).map(tf => (
                            <button
                                key={tf}
                                className={`tf-btn ${timeframe === tf ? 'active' : ''}`}
                                onClick={() => setTimeframe(tf)}
                            >
                                {tf === '7d' && '7D'}
                                {tf === '30d' && '30D'}
                                {tf === '3m' && '3Mån'}
                                {tf === '6m' && '6Mån'}
                                {tf === '9m' && '9Mån'}
                                {tf === 'year' && 'I År'}
                                {tf === 'all' && 'ALLA'}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="health-grid">
                {activeTab === 'overview' && (
                    <HealthOverview snapshots={snapshots} stats={stats} timeframe={days} exerciseEntries={unifiedExerciseEntries} />
                )}
                {activeTab === 'food' && (
                    <MatView stats={stats} />
                )}
                {activeTab === 'training' && (
                    <TrainingView exerciseEntries={unifiedExerciseEntries} />
                )}
                {activeTab === 'sleep' && (
                    <MetricFocusView type="sleep" snapshots={snapshots} stats={stats} days={days} />
                )}
                {activeTab === 'weight' && (
                    <MetricFocusView type="weight" snapshots={snapshots} stats={stats} days={days} />
                )}
                {activeTab === 'strength' && (
                    <StyrkaView days={days} />
                )}
                {activeTab === 'cardio' && (
                    <KonditionView days={days} exerciseEntries={unifiedExerciseEntries} universalActivities={fetchedUniversalActivities} />
                )}
            </main>
        </div>
    );
}
