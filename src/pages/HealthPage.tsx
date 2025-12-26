
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

type TimeFrame = '7d' | '30d' | '3m' | '6m' | '9m' | 'year' | 'all';

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
                // Remove Strava strength activities if we already have a dedicated strength workout on that day
                // Cast to string to handle raw Strava types like 'WeightTraining' that might not be in our strict type definition yet
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

        // Training Hub
        if (['training', 'träning', 'strength', 'styrka', 'cardio', 'kondition', 'hyrox'].includes(m)) return 'training';

        // Body Hub
        if (['weight', 'vikt', 'sleep', 'sömn'].includes(m)) return 'body';

        if (m === 'recovery' || m === 'rehab') return 'recovery';

        return 'overview';
    }, [metric]);

    // DERIVE SUB-TAB for complex views
    const subTab = useMemo(() => {
        const m = metric?.toLowerCase();
        if (m === 'strength' || m === 'styrka') return 'strength';
        if (m === 'cardio' || m === 'kondition') return 'cardio';
        if (m === 'weight' || m === 'vikt') return 'weight';
        if (m === 'sleep' || m === 'sömn') return 'sleep';
        if (m === 'hyrox') return 'hyrox';
        return undefined; // Default
    }, [metric]);

    const [timeframe, setTimeframe] = useState<TimeFrame>('year');

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
            case 'all': return 3650;
            default: return 30;
        }
    }, [timeframe]);

    const snapshots = useMemo(() => {
        return aggregateHealthData(days, dailyVitals, weightEntries, mealEntries, unifiedExerciseEntries, calculateDailyNutrition);
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
        const isSwedishPath = window.location.pathname.includes('/hälsa') || window.location.pathname.includes('/halsa');
        const basePath = isSwedishPath ? '/hälsa' : '/health';

        // Map abstract tabs to URLs
        let path = tab;
        if (isSwedishPath) {
            if (tab === 'body') path = 'vikt'; // Default to weight for Body tab
            if (tab === 'food') path = 'mat';
            if (tab === 'training') path = 'träning';
            if (tab === 'recovery') path = 'rehab';
        } else {
            if (tab === 'body') path = 'weight';
        }

        navigate(`${basePath}/${path}`);
    };

    return (
        <div className="health-page animate-in fade-in duration-500">
            <header className="health-header">
                <div className="header-content">
                    <span className={`header-badge ${goalTheme.text}`} style={{ backgroundColor: goalTheme.bg }}>{goalTheme.label}</span>
                    <h1>Din Hälsa</h1>

                    {/* SIMPLIFIED NAVIGATION */}
                    <div className="tab-nav">
                        <button className={`tab-link ${activeView === 'overview' ? 'active' : ''}`} onClick={() => handleTabChange('overview')}>Översikt</button>
                        <button className={`tab-link ${activeView === 'food' ? 'active' : ''}`} onClick={() => handleTabChange('food')}>🥗 Mat</button>
                        <button className={`tab-link ${activeView === 'training' ? 'active' : ''}`} onClick={() => handleTabChange('training')}>⚡ Träning</button>
                        <button className={`tab-link ${activeView === 'recovery' ? 'active' : ''}`} onClick={() => handleTabChange('recovery')}>🩹 Recovery</button>
                        <button className={`tab-link ${activeView === 'body' ? 'active' : ''}`} onClick={() => handleTabChange('body')}>🧬 Kropp</button>
                    </div>
                </div>

                {/* Score & Time Selector */}
            </header>

            <main className="health-grid">
                {activeView === 'overview' && (
                    <HealthOverview snapshots={snapshots} stats={stats} timeframe={days} exerciseEntries={unifiedExerciseEntries} />
                )}
                {activeView === 'food' && (
                    <MatView stats={stats} snapshots={snapshots} />
                )}
                {activeView === 'training' && (
                    <TrainingView
                        exerciseEntries={unifiedExerciseEntries}
                        days={days}
                        universalActivities={fetchedUniversalActivities}
                        initialTab={subTab as any}
                    />
                )}
                {activeView === 'body' && (
                    <BodyView
                        snapshots={snapshots}
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
