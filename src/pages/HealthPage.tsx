
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useUniversalActivities } from '../hooks/useUniversalActivities.ts';
import { aggregateHealthData, calculateHealthStats } from '../utils/healthAggregator.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { StrengthWorkout } from '../models/strengthTypes.ts';
import { ExerciseEntry } from '../models/types.ts';
import { HealthOverview } from './Health/HealthOverview.tsx';
import { MatView } from './Health/MatView.tsx';
import { TrainingView } from './Health/TrainingView.tsx';
import { RecoveryPage } from './Health/RecoveryPage.tsx';
import { BodyView } from './Health/BodyView.tsx';
import './HealthPage.css';

type TimeFrame = '7d' | '30d' | '3m' | '6m' | '9m' | 'year' | 'all' | '2024' | '2025';

const API_BASE = 'http://localhost:8000';

export function HealthPage() {
    const { metric } = useParams<{ metric?: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { dailyVitals, weightEntries, mealEntries, exerciseEntries: manualExerciseEntries, calculateDailyNutrition } = useData();
    const { settings } = useSettings();

    // Fetch Universal Activities (Strava/Garmin)
    const { activities: fetchedUniversalActivities, loading: loadingActivities } = useUniversalActivities(365);

    // Fetch Strength Workouts
    const [strengthWorkouts, setStrengthWorkouts] = useState<StrengthWorkout[]>([]);

    useEffect(() => {
        if (!token) return;
        async function fetchStrength() {
            try {
                const start = new Date();
                start.setFullYear(start.getFullYear() - 3);
                const startStr = start.toISOString().split('T')[0];
                const endStr = new Date().toISOString().split('T')[0];

                const res = await fetch(`${API_BASE}/api/strength/workouts?start=${startStr}&end=${endStr}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.workouts) setStrengthWorkouts(data.workouts);
            } catch (e) {
                console.error("Failed to fetch strength workouts in HealthPage", e);
            }
        }
        fetchStrength();
    }, [token]);

    // Unified Exercise Entries
    const unifiedExerciseEntries = useMemo(() => {
        const manual = manualExerciseEntries;

        // 1. Prepare Strength Workouts
        const strength = strengthWorkouts.map((w): ExerciseEntry => ({
            id: w.id,
            date: w.date,
            type: 'strength',
            durationMinutes: w.duration || (w.exercises.length * 4) + (w.totalSets * 1.5) || 45,
            intensity: 'high',
            caloriesBurned: w.totalVolume ? Math.round(w.totalVolume * 0.05) : 300,
            tonnage: w.totalVolume,
            notes: w.name,
            createdAt: w.createdAt
        }));

        // 2. Prepare Strava Activities (filtered)
        const strava = fetchedUniversalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null)
            .filter(e => {
                const t = e.type as string;
                if (t === 'strength' || t === 'WeightTraining') {
                    const hasDedicatedWorkout = strength.some(s => s.date.split('T')[0] === e.date.split('T')[0]);
                    return !hasDedicatedWorkout;
                }
                return true;
            });

        const combined = [...manual, ...strava, ...strength];
        const unique = new Map<string, ExerciseEntry>();
        combined.forEach(e => unique.set(e.id, e));

        return Array.from(unique.values()).sort((a, b) => b.durationMinutes - a.durationMinutes).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [manualExerciseEntries, fetchedUniversalActivities, strengthWorkouts]);

    // MAP URL PARAM TO NEW TABS
    const activeView = useMemo(() => {
        const m = metric?.toLowerCase();
        if (!m || m === 'overview' || m === 'översikt') return 'overview';
        if (m === 'food' || m === 'mat') return 'food';
        if (['training', 'träning', 'strength', 'styrka', 'cardio', 'kondition', 'hyrox'].includes(m)) return 'training';
        if (['weight', 'vikt', 'sleep', 'sömn', 'measurements', 'matt', 'mått'].includes(m)) return 'body';
        if (m === 'recovery' || m === 'rehab') return 'recovery';
        return 'overview';
    }, [metric]);

    // DERIVE SUB-TAB for complex views
    const subTab = useMemo(() => {
        const m = metric?.toLowerCase();
        if (!m) return undefined;
        if (m === 'strength' || m === 'styrka') return 'strength';
        if (m === 'cardio' || m === 'kondition') return 'cardio';
        if (m === 'weight' || m === 'vikt') return 'weight';
        if (m === 'sleep' || m === 'sömn') return 'sleep';
        if (['measurements', 'matt', 'mått'].includes(m)) return 'measurements';
        if (m === 'hyrox') return 'hyrox';
        return undefined;
    }, [metric]);

    const [timeframe, setTimeframe] = useState<TimeFrame>('year');

    const days = useMemo(() => {
        const now = new Date();
        const startOf2025 = new Date('2025-01-01');
        const startOf2024 = new Date('2024-01-01');

        switch (timeframe) {
            case '7d': return 7;
            case '30d': return 30;
            case '3m': return 90;
            case '6m': return 180;
            case '9m': return 270;
            case 'year': return 365;
            case '2025': {
                const diff = now.getTime() - startOf2025.getTime();
                return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
            }
            case '2024': {
                const diff = now.getTime() - startOf2024.getTime();
                return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
            }
            case 'all': return 3650;
            default: return 30;
        }
    }, [timeframe]);

    // FILTERED ENTRIES
    const filteredExerciseEntries = useMemo(() => {
        if (timeframe === '2024') return unifiedExerciseEntries.filter(e => e.date.startsWith('2024'));
        if (timeframe === '2025') return unifiedExerciseEntries.filter(e => e.date.startsWith('2025'));

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return unifiedExerciseEntries.filter(e => e.date >= cutoffStr);
    }, [unifiedExerciseEntries, days, timeframe]);

    const filteredWeightEntries = useMemo(() => {
        if (timeframe === '2024') return weightEntries.filter(e => e.date.startsWith('2024'));
        if (timeframe === '2025') return weightEntries.filter(e => e.date.startsWith('2025'));

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return weightEntries.filter(e => e.date >= cutoffStr);
    }, [weightEntries, days, timeframe]);

    const snapshots = useMemo(() => {
        return aggregateHealthData(days, dailyVitals, weightEntries, mealEntries, unifiedExerciseEntries, calculateDailyNutrition);
    }, [days, dailyVitals, weightEntries, mealEntries, unifiedExerciseEntries, calculateDailyNutrition]);

    // STRICT YEAR FILTERING FOR SNAPSHOTS
    const finalSnapshots = useMemo(() => {
        if (timeframe === '2024') {
            return snapshots.filter(s => s.date.startsWith('2024'));
        }
        if (timeframe === '2025') {
            return snapshots.filter(s => s.date.startsWith('2025'));
        }
        return snapshots;
    }, [snapshots, timeframe]);

    const stats = useMemo(() => calculateHealthStats(finalSnapshots), [finalSnapshots]);

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
        const isSwedishPath = window.location.pathname.includes('/hälsa') || window.location.pathname.includes('/halsa');
        const basePath = isSwedishPath ? '/hälsa' : '/health';

        let path = tab;
        if (isSwedishPath) {
            if (tab === 'body') path = 'vikt';
            if (tab === 'food') path = 'mat';
            if (tab === 'training') path = 'träning';
            if (tab === 'recovery') path = 'rehab';
        } else {
            if (tab === 'body') path = 'measurements';
        }

        navigate(`${basePath}/${path}`);
    };

    return (
        <div className="health-page animate-in fade-in duration-500">
            <header className="health-header">
                <div className="header-content">
                    <div>
                        <span className={`header-badge ${goalTheme.text}`} style={{ backgroundColor: goalTheme.bg }}>{goalTheme.label}</span>
                        <h1 className="mt-2">Din Hälsa</h1>
                    </div>

                    {/* Global Time Filter */}
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 backdrop-blur-sm overflow-x-auto">
                        {(['7d', '30d', '3m', '6m', '2025', '2024', 'all'] as TimeFrame[]).map((tf) => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${timeframe === tf
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {tf === '7d' ? '7D' : tf === '30d' ? '30D' : tf === 'year' ? '1ÅR' : tf.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* SIMPLIFIED NAVIGATION */}
                <div className="tab-nav mt-6">
                    <button className={`tab-link ${activeView === 'overview' ? 'active' : ''}`} onClick={() => handleTabChange('overview')}>Översikt</button>
                    <button className={`tab-link ${activeView === 'food' ? 'active' : ''}`} onClick={() => handleTabChange('food')}>🥗 Mat</button>
                    <button className={`tab-link ${activeView === 'training' ? 'active' : ''}`} onClick={() => handleTabChange('training')}>⚡ Träning</button>
                    <button className={`tab-link ${activeView === 'recovery' ? 'active' : ''}`} onClick={() => handleTabChange('recovery')}>🩹 Recovery</button>
                    <button className={`tab-link ${activeView === 'body' ? 'active' : ''}`} onClick={() => handleTabChange('body')}>🧬 Kropp</button>
                </div>
            </header>

            <main className="health-grid">
                {activeView === 'overview' && (
                    <HealthOverview
                        snapshots={finalSnapshots}
                        stats={stats}
                        timeframe={days}
                        exerciseEntries={filteredExerciseEntries}
                        weightEntries={filteredWeightEntries}
                    />
                )}
                {activeView === 'food' && (
                    <MatView stats={stats} snapshots={finalSnapshots} />
                )}
                {activeView === 'training' && (
                    <TrainingView
                        exerciseEntries={filteredExerciseEntries}
                        days={days}
                        universalActivities={fetchedUniversalActivities}
                        initialTab={subTab as any}
                    />
                )}
                {activeView === 'body' && (
                    <BodyView
                        snapshots={finalSnapshots}
                        stats={stats}
                        days={days}
                        initialTab={subTab as any}
                    />
                )}
                {activeView === 'recovery' && (
                    <RecoveryPage />
                )}
            </main>
        </div>
    );
}
