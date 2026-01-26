
import { useState, useMemo, useEffect } from 'react';
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

const API_BASE = '';

export function HealthPage() {
    const { metric } = useParams<{ metric?: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { dailyVitals, weightEntries, mealEntries, exerciseEntries: manualExerciseEntries, calculateDailyNutrition, trainingPeriods } = useData();
    const { settings } = useSettings();

    // Fetch Universal Activities (Strava/Garmin)
    const { activities: fetchedUniversalActivities } = useUniversalActivities(365);

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
    const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

    const selectedPeriod = useMemo(() => {
        if (timeframe !== 'all' || !selectedPeriodId) return null;
        return trainingPeriods.find(p => p.id === selectedPeriodId);
    }, [timeframe, selectedPeriodId, trainingPeriods]);

    const days = useMemo(() => {
        const now = new Date();
        const startOf2026 = new Date('2026-01-01');
        const startOf2025 = new Date('2025-01-01');
        const startOf2024 = new Date('2024-01-01');

        if (selectedPeriod) {
            const start = new Date(selectedPeriod.startDate);
            const end = selectedPeriod.endDate ? new Date(selectedPeriod.endDate) : now;
            const diff = end.getTime() - start.getTime();
            return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
        }

        switch (timeframe) {
            case '7d': return 7;
            case '30d': return 30;
            case '3m': return 90;
            case '6m': return 180;
            case '9m': return 270;
            case 'year': return 365;
            case '2025': {
                // If we are past 2025, return full year, else return YTD
                const endOf2025 = new Date('2025-12-31T23:59:59');
                const endDate = now > endOf2025 ? endOf2025 : now;
                const diff = endDate.getTime() - startOf2025.getTime();
                return Math.ceil(diff / (1000 * 60 * 60 * 24));
            }
            case '2024': {
                return 366; // Leap year
            }
            case 'all': return 3650;
            default: return 30;
        }
    }, [timeframe, selectedPeriod]);

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
        if (selectedPeriod) {
            return weightEntries.filter(e => e.date >= selectedPeriod.startDate && (!selectedPeriod.endDate || e.date <= selectedPeriod.endDate));
        }
        if (timeframe === '2024') return weightEntries.filter(e => e.date.startsWith('2024'));
        if (timeframe === '2025') return weightEntries.filter(e => e.date.startsWith('2025'));

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return weightEntries.filter(e => e.date >= cutoffStr);
    }, [weightEntries, days, timeframe, selectedPeriod]);

    const snapshots = useMemo(() => {
        return aggregateHealthData(days, dailyVitals, weightEntries, mealEntries, unifiedExerciseEntries, calculateDailyNutrition);
    }, [days, dailyVitals, weightEntries, mealEntries, unifiedExerciseEntries, calculateDailyNutrition]);

    // STRICT YEAR FILTERING FOR SNAPSHOTS
    const finalSnapshots = useMemo(() => {
        if (selectedPeriod) {
            return snapshots.filter(s => s.date >= selectedPeriod.startDate && (!selectedPeriod.endDate || s.date <= selectedPeriod.endDate));
        }
        if (timeframe === '2024') return snapshots.filter(s => s.date.startsWith('2024'));
        if (timeframe === '2025') return snapshots.filter(s => s.date.startsWith('2025'));
        return snapshots;
    }, [snapshots, timeframe, selectedPeriod]);

    const stats = useMemo(() => calculateHealthStats(finalSnapshots), [finalSnapshots]);

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
            {/* Ultra-Compact Sticky Header */}
            <header className="sticky top-0 z-50 bg-[#0a0f18]/95 backdrop-blur-md border-b border-white/5 py-2 px-4 flex flex-wrap items-center gap-3">
                {/* Date Filters */}
                <div className="flex bg-slate-900/50 p-0.5 rounded-lg border border-white/5 overflow-x-auto">
                    {(['7d', '30d', '3m', '6m', 'year', '2025', 'all'] as TimeFrame[]).map((tf) => (
                        <button
                            key={tf}
                            onClick={() => { setTimeframe(tf); setSelectedPeriodId(null); }}
                            className={`px-2 py-1 text-[10px] font-bold rounded transition-all whitespace-nowrap ${timeframe === tf && !selectedPeriodId
                                ? 'bg-emerald-500 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {tf === '7d' ? '7D' : tf === '30d' ? '30D' : tf === 'year' ? 'I ÅR' : tf.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Training Periods Dropdown */}
                {trainingPeriods.length > 0 && (
                    <select
                        value={selectedPeriodId || ''}
                        onChange={(e) => {
                            setSelectedPeriodId(e.target.value || null);
                            if (e.target.value) setTimeframe('all');
                        }}
                        className="bg-slate-900/80 border border-white/10 rounded px-2 py-1 text-[10px] font-bold text-slate-300 outline-none"
                    >
                        <option value="">Välj träningsperiod...</option>
                        {trainingPeriods.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.startDate})</option>
                        ))}
                    </select>
                )}

                {/* Divider */}
                <div className="h-4 w-px bg-white/10 hidden md:block" />

                {/* Tab Navigation */}
                <div className="flex gap-1 overflow-x-auto">
                    <button className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded transition-all ${activeView === 'overview' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => handleTabChange('overview')}>Översikt</button>
                    <button className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded transition-all ${activeView === 'food' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => handleTabChange('food')}>🥗 Mat</button>
                    <button className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded transition-all ${activeView === 'training' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => handleTabChange('training')}>⚡ Träning</button>
                    <button className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded transition-all ${activeView === 'recovery' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => handleTabChange('recovery')}>🩹 Recovery</button>
                    <button className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded transition-all ${activeView === 'body' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`} onClick={() => handleTabChange('body')}>🧬 Kropp</button>
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

export default HealthPage;
