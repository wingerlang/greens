
import React, { useEffect, useState } from 'react';
import { statisticsService, CommunityStats } from '../services/statisticsService.ts';
import { ComparisonBar } from '../components/charts/ComparisonBar.tsx';
import { RadarProfile } from '../components/charts/RadarProfile.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Link } from 'react-router-dom';
import { calculate1RM } from '../models/strengthTypes.ts';

export function CommunityStatsPage() {

    function StatCard({ label, value, unit, icon, color }: { label: string, value: string, unit: string, icon: string, color: string }) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center hover:bg-slate-800/50 transition-colors">
                <div className="text-3xl mb-2">{icon}</div>
                <div className={`text-3xl lg:text-4xl font-black ${color} mb-1 tracking-tight`}>
                    {value}<span className="text-lg text-gray-500 ml-1 font-bold">{unit}</span>
                </div>
                <div className="text-gray-400 text-xs font-bold uppercase tracking-wider">{label}</div>
            </div>
        );
    }

    const { user } = useAuth();
    const { strengthSessions, exerciseEntries, unifiedActivities } = useData();
    const [stats, setStats] = useState<CommunityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'strength' | 'cardio'>('overview');
    const [exerciseSearch, setExerciseSearch] = useState('');
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

    // Global Filters
    const [timeFilter, setTimeFilter] = useState<'all' | '12m' | '2026' | '1m'>('all');
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'unknown'>('all'); // Visual placebo for now if backend doesn't support
    const [relativeFilter, setRelativeFilter] = useState<'absolute' | 'weight'>('absolute');
    const [rmMode, setRmMode] = useState<'1rm' | '1erm'>('1erm'); // 1RM (actual) vs 1eRM (estimated)

    const userWeight = user?.weight || 80; // Fallback to 80kg if unknown, should probably prompt user or use absolute

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await statisticsService.getCommunityStats();
        setStats(data);
        setLoading(false);

        // Select first exercise by default
        if (data && data.strength.topExercises.length > 0) {
            setSelectedExercise(data.strength.topExercises[0].toLowerCase());
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!stats) return <div className="p-8 text-center text-red-500">Kunde inte ladda statistik.</div>;

    const formatDuration = (secondsX: number) => {
        const seconds = Math.round(secondsX);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    };

    const formatHoursAsTime = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}t ${m}m`;
    };

    const selectedExerciseData = selectedExercise ? stats.strength.exercises[selectedExercise] : null;

    // --- REAL USER DATA CALCULATIONS ---

    // 1. Workouts this month (Current Calendar Month) using Unified Activities
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const activitiesThisMonth = unifiedActivities.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const userWorkoutsPerMonthTotal = activitiesThisMonth.length;

    // --- FILTERED DATA CALCULATIONS ---

    const getFilteredActivities = () => {
        let activities = unifiedActivities;
        const now = new Date();

        // Time Filter
        if (timeFilter === '12m') {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - 12);
            activities = activities.filter(a => new Date(a.date) >= cutoff);
        } else if (timeFilter === '2026') { // Hardcoded for "this year" logic effectively
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            activities = activities.filter(a => new Date(a.date) >= startOfYear);
        } else if (timeFilter === '1m') {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - 1);
            activities = activities.filter(a => new Date(a.date) >= cutoff);
        }

        return activities;
    };

    const getFilteredStrength = () => {
        let sessions = strengthSessions;
        const now = new Date();

        if (timeFilter === '12m') {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - 12);
            sessions = sessions.filter(s => new Date(s.date) >= cutoff);
        } else if (timeFilter === '2026') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            sessions = sessions.filter(s => new Date(s.date) >= startOfYear);
        } else if (timeFilter === '1m') {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - 1);
            sessions = sessions.filter(s => new Date(s.date) >= cutoff);
        }

        return sessions;
    };

    const filteredActivities = getFilteredActivities();
    const filteredStrength = getFilteredStrength();

    // Workouts this month (Always current calendar month regardless of filter, OR should it respect filter?)
    // User requested "Pass per månad" failure -> let's fix it to be robust but maybe independent of the global time filter?
    // Actually, "Pass per månad" usually implies "Current rate".
    // Let's keep specific month calc separate for the comparison bar, but use filtered data for "Totals".

    // 2. Lifetime (or Filtered) Totals
    const lifetimeSessions = filteredActivities.length;
    const lifetimeDistance = filteredActivities.reduce((acc, e) => acc + (e.distance || 0), 0);
    const lifetimeHours = filteredActivities.reduce((acc, e) => acc + (e.durationMinutes || 0), 0) / 60;

    // Tonnage: Check relative filter
    let rawTonnage = filteredActivities.reduce((acc, e) => acc + (e.tonnage || 0), 0) + filteredStrength.reduce((acc, s) => acc + (s.totalVolume || 0), 0);
    if (relativeFilter === 'weight') rawTonnage = rawTonnage / userWeight;
    const lifetimeTonnage = rawTonnage;

    const lifetimeCalories = filteredActivities.reduce((acc, e) => acc + (e.caloriesBurned || 0), 0);

    // Calculate weeks since first log (for Snittpass/v) - Respects filter!
    const allDates = filteredActivities.map(e => new Date(e.date).getTime()).sort((a, b) => a - b);
    const firstLogDate = allDates.length > 0 ? allDates[0] : Date.now();
    // If filter is 1m, weeks max is ~4.
    const weeksInFilter = Math.max(1, (Date.now() - firstLogDate) / (1000 * 60 * 60 * 24 * 7));
    const avgSessionsPerWeek = lifetimeSessions / weeksInFilter;

    // Monthly tonnage (Current Month specifically for the Comparison Bar)
    let monthlyTonnageRaw = strengthSessions.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, s) => acc + (s.totalVolume || 0), 0);

    if (relativeFilter === 'weight') monthlyTonnageRaw = monthlyTonnageRaw / userWeight;
    const monthlyTonnage = monthlyTonnageRaw;

    // Monthly Trend Data (Last 6 months)
    const getMonthlyTrendData = () => {
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = d.getMonth();
            const y = d.getFullYear();
            const monthActivities = unifiedActivities.filter(e => {
                const ed = new Date(e.date);
                return ed.getMonth() === m && ed.getFullYear() === y;
            });
            result.push({
                label: d.toLocaleString('sv-SE', { month: 'short' }),
                count: monthActivities.length,
                distance: monthActivities.reduce((acc, e) => acc + (e.distance || 0), 0),
                tonnage: strengthSessions.filter(s => {
                    const sd = new Date(s.date);
                    return sd.getMonth() === m && sd.getFullYear() === y;
                }).reduce((acc, s) => acc + (s.totalVolume || 0), 0)
            });
        }
        return result;
    };
    const monthlyTrend = getMonthlyTrendData();

    // 3. Average duration (All time average)
    const userAvgDuration = lifetimeSessions > 0 ? (lifetimeHours * 60) / lifetimeSessions : 0;

    // Type for PB details (for hover cards)
    interface PBDetails {
        value: number;
        date: string;
        workoutId: string;
        workoutName: string;
        reps: number;
        weight: number;
        isActual1RM: boolean;
    }

    // 4. Exercise-specific PB Lookup (Scanning filtered strength sessions)
    // Enhanced to support 1RM vs 1eRM modes and return workout details
    const getUserPBWithDetails = (exerciseName: string): PBDetails | null => {
        let best: PBDetails | null = null;
        let maxValue = 0;

        filteredStrength.forEach(s => {
            s.exercises.forEach(ex => {
                if (ex.exerciseName.toLowerCase() === exerciseName.toLowerCase()) {
                    ex.sets.forEach(set => {
                        let value = 0;
                        const isActual = set.reps === 1;

                        if (rmMode === '1rm') {
                            // Only count actual 1RM (single rep sets)
                            if (set.reps === 1) {
                                value = set.weight;
                            }
                        } else {
                            // Estimated 1RM using Epley formula
                            value = calculate1RM(set.weight, set.reps);
                        }

                        if (relativeFilter === 'weight') {
                            value = value / userWeight;
                        }

                        if (value > maxValue) {
                            maxValue = value;
                            best = {
                                value,
                                date: s.date,
                                workoutId: s.id,
                                workoutName: s.name || 'Styrkepass',
                                reps: set.reps,
                                weight: set.weight,
                                isActual1RM: isActual
                            };
                        }
                    });
                }
            });
        });

        return best;
    };

    // Backwards compatible wrapper
    const getUserPB = (exerciseName: string): number => {
        const details = getUserPBWithDetails(exerciseName);
        return details?.value || 0;
    };

    const getUserAvgTonnage = (exerciseName: string) => {
        const matches = filteredStrength.filter(s =>
            s.exercises.some(ex => ex.exerciseName.toLowerCase() === exerciseName.toLowerCase())
        );
        if (matches.length === 0) return 0;

        const totalTonnage = matches.reduce((acc, s) => {
            const ex = s.exercises.find(e => e.exerciseName.toLowerCase() === exerciseName.toLowerCase());
            let tonnage = ex?.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0) || 0;
            if (relativeFilter === 'weight') tonnage = tonnage / userWeight;
            return acc + tonnage;
        }, 0);

        return Math.round(totalTonnage / matches.length);
    };

    // 5. Cardio PBs for standard distances (Using Filtered Activities)
    // Tolerance: 5k=0.5, 10k=0.1, 21k=0.5
    const getToleranceForDistance = (km: number) => km === 10 ? 0.1 : 0.5;

    // Type for cardio PB details
    interface CardioPBDetails {
        timeSeconds: number;
        activityId: string;
        date: string;
        title: string;
        actualDistance: number;
    }

    // Enhanced to return activity details for linking
    const getUserCardioPBWithDetails = (distanceKm: number): CardioPBDetails | null => {
        const tolerance = getToleranceForDistance(distanceKm);
        const matches = filteredActivities.filter(e =>
            e.distance && Math.abs(e.distance - distanceKm) <= tolerance && e.durationMinutes > 0
        );
        if (matches.length === 0) return null;

        // Find fastest (lowest duration/distance ratio)
        const fastest = matches.reduce((best, curr) => {
            const currPace = (curr.durationMinutes * 60) / curr.distance!;
            const bestPace = (best.durationMinutes * 60) / best.distance!;
            return currPace < bestPace ? curr : best;
        });

        // Normalize time to the exact target distance
        const pace = (fastest.durationMinutes * 60) / fastest.distance!;

        return {
            timeSeconds: Math.round(pace * distanceKm),
            activityId: fastest.id,
            date: fastest.date,
            title: fastest.title || `${distanceKm}k Löpning`,
            actualDistance: fastest.distance!
        };
    };

    // Backwards compatible wrapper
    const getUserCardioPB = (distanceKm: number): number | null => {
        const details = getUserCardioPBWithDetails(distanceKm);
        return details?.timeSeconds || null;
    };

    // Helper to adjust values if relative
    const getDisplayValue = (val: number, isWeight = false) => {
        if (isWeight && relativeFilter === 'weight') return val / userWeight;
        return val;
    };

    // 5. Radar Chart Data (User vs Community)
    // Dimensions: Volume, Strength, Cardio, Frequency, Variety
    const calculateRadarData = () => {
        if (!stats) return [];

        // Simple scoring 0-100 based on averages
        const scoreFrequency = Math.min(100, (userWorkoutsPerMonthTotal / (stats.averages.workoutsPerUserPerMonth || 1)) * 50);

        const userTotalTonnage = strengthSessions.reduce((acc, s) => acc + (s.totalVolume || 0), 0);
        const scoreVolume = Math.min(100, (userTotalTonnage / (stats.averages.tonnagePerUserPerMonth * 10 || 1)) * 50); // Scale by 10 for "all time" vs community monthly avg

        // Strength: Max weight lifted overall relative to community max among top 3
        const top3Names = stats.strength.topExercises.slice(0, 3);
        const userStrengthScore = top3Names.reduce((acc, name) => {
            const pb = getUserPB(name);
            const commMax = stats.strength.exercises[name.toLowerCase()]?.max1RM || 1;
            return acc + (pb / commMax);
        }, 0) / (top3Names.length || 1);
        const scoreStrength = Math.min(100, userStrengthScore * 100);

        // Cardio: Best 5k relative to community fastest
        const user5k = getUserCardioPB(5);
        const comm5k = stats.cardio.distances['5k']?.fastestTimeSeconds || 1200;
        const scoreCardio = user5k ? Math.min(100, (comm5k / user5k) * 100) : 0;

        // Variety: Number of unique exercises logged
        const uniqueExercises = new Set();
        strengthSessions.forEach(s => s.exercises.forEach(e => uniqueExercises.add(e.exerciseName.toLowerCase())));
        exerciseEntries.forEach(e => uniqueExercises.add(e.type));
        const scoreVariety = Math.min(100, (uniqueExercises.size / 20) * 100);

        return [
            { subject: 'Volym', A: Math.round(scoreVolume), B: 50, fullMark: 100 },
            { subject: 'Styrka', A: Math.round(scoreStrength), B: 50, fullMark: 100 },
            { subject: 'Kondition', A: Math.round(scoreCardio), B: 50, fullMark: 100 },
            { subject: 'Frekvens', A: Math.round(scoreFrequency), B: 50, fullMark: 100 },
            { subject: 'Mångsidighet', A: Math.round(scoreVariety), B: 50, fullMark: 100 },
        ];
    };

    const radarData = calculateRadarData();

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-800 pb-8">
                <div>
                    {/* Header / Filter Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <h1 className="text-3xl font-black italic text-white tracking-tight uppercase">Community Stats</h1>

                        <div className="flex flex-wrap gap-2">
                            <div className="flex bg-slate-800 rounded-lg p-1">
                                {['all', '12m', '2026', '1m'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeFilter(t as any)}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeFilter === t ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {t === 'all' ? 'HELA' : t === '12m' ? '12 MÅN' : t === '2026' ? 'I ÅR' : '1 MÅN'}
                                    </button>
                                ))}
                            </div>

                            <div className="flex bg-slate-800 rounded-lg p-1">
                                {['all', 'male', 'female'].map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setGenderFilter(g as any)}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${genderFilter === g ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {g === 'all' ? 'ALLA' : g === 'male' ? 'MÄN' : 'KVINNOR'}
                                    </button>
                                ))}
                            </div>

                            <div className="flex bg-slate-800 rounded-lg p-1">
                                {['absolute', 'weight'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRelativeFilter(r as any)}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${relativeFilter === r ? 'bg-pink-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {r === 'absolute' ? 'ABSOLUT' : 'RELATIV'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-xl w-fit mb-8 border border-slate-700/50">
                        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Statistik</h1>
                        <p className="text-gray-400">
                            Jämför dig mot {stats.global.totalUsers} andra atleter i communityt.
                        </p>
                    </div>

                    {/* Tabs with Icons */}
                    <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
                        {([
                            { key: 'overview', label: 'Översikt', icon: '📊' },
                            { key: 'strength', label: 'Styrka', icon: '💪' },
                            { key: 'cardio', label: 'Kondition', icon: '🏃' }
                        ] as const).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${activeTab === tab.key
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.02]'
                                    : 'text-gray-400 hover:text-white hover:bg-slate-800/80'
                                    }`}
                            >
                                <span className="text-base">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    {/* Big Numbers */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        <StatCard
                            label="Total Distans"
                            value={lifetimeDistance.toLocaleString()}
                            unit="km"
                            icon="🌍"
                            color="text-sky-400"
                        />
                        <StatCard
                            label="Total Tid"
                            value={formatHoursAsTime(lifetimeHours)}
                            unit=""
                            icon="⏱️"
                            color="text-indigo-400"
                        />
                        <StatCard
                            label={relativeFilter === 'weight' ? "Volym / Kroppsvikt" : "Total Volym"}
                            value={lifetimeTonnage.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            unit={relativeFilter === 'weight' ? "x" : "kg"}
                            icon="🏋️‍♂️"
                            color="text-rose-400"
                        />
                        <StatCard
                            label="Antal Pass"
                            value={lifetimeSessions.toLocaleString()}
                            unit="st"
                            icon="🔥"
                            color="text-amber-400"
                        />
                        <StatCard
                            label="Kalorier (Est)"
                            value={lifetimeCalories.toLocaleString()}
                            unit="kcal"
                            icon="⚡"
                            color="text-orange-400"
                        />
                        <StatCard
                            label="Mål Uppnådda"
                            value={stats.global.totalGoalsAchieved.toLocaleString()}
                            unit="st"
                            icon="🏆"
                            color="text-emerald-400"
                        />
                        <StatCard
                            label="Snittpass / v"
                            value={avgSessionsPerWeek.toFixed(1)}
                            unit="st"
                            icon="📅"
                            color="text-pink-400"
                        />
                        <StatCard
                            label="Totala Reps"
                            value={strengthSessions.reduce((acc, s) => acc + s.exercises.reduce((exAcc, ex) => exAcc + ex.sets.reduce((setAcc, set) => setAcc + (set.reps || 0), 0), 0), 0).toLocaleString()}
                            unit="st"
                            icon="🔢"
                            color="text-lime-400"
                        />
                        <StatCard
                            label="Höjdmeter"
                            value={unifiedActivities.reduce((acc, e) => acc + (e.elevationGain || 0), 0).toLocaleString()}
                            unit="m"
                            icon="⛰️"
                            color="text-teal-400"
                        />
                        <StatCard
                            label="Atleter"
                            value={stats.global.totalUsers.toLocaleString()}
                            unit="st"
                            icon="👥"
                            color="text-slate-400"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Radar Chart */}
                        <div className="md:col-span-1 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <span className="bg-emerald-500/20 text-emerald-500 p-2 rounded-lg text-xs">AI Profile</span>
                                Din Atletiska Profil
                            </h3>
                            <div className="h-64">
                                <RadarProfile data={radarData} />
                            </div>
                            <div className="mt-4 space-y-2">
                                {radarData.map(d => (
                                    <div key={d.subject} className="flex justify-between items-center text-xs">
                                        <span className="text-gray-400">{d.subject}</span>
                                        <div className="flex gap-2 items-center">
                                            <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${d.A}%` }}></div>
                                            </div>
                                            <span className="text-white font-bold w-6 text-right">{d.A}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* General Comparisons */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 h-full">
                                <h3 className="text-xl font-bold text-white mb-8">Jämförelse mot Communityt</h3>
                                <div className="space-y-10">
                                    <ComparisonBar
                                        title="Pass per månad"
                                        unit="st"
                                        userValue={userWorkoutsPerMonthTotal}
                                        avgValue={stats.averages.workoutsPerUserPerMonth}
                                        maxValue={Math.max(stats.averages.workoutsPerUserPerMonth * 2, userWorkoutsPerMonthTotal)}
                                        color="#f472b6"
                                        explanation={`Din data denna månad (${new Date().toLocaleString('sv-SE', { month: 'long' })}):\n• Antal pass: ${activitiesThisMonth.length} st\n\nCommunity-snitt:\n• Totalt ${stats.global.totalWorkouts} pass\n• ${stats.global.totalUsers} användare\n• Snitt: ${stats.averages.workoutsPerUserPerMonth.toFixed(1)} pass/mån`}
                                    />
                                    <ComparisonBar
                                        title="Snittlängd pass"
                                        unit="min"
                                        userValue={Math.round(userAvgDuration)}
                                        avgValue={stats.averages.sessionDurationMinutes}
                                        maxValue={Math.max(90, userAvgDuration)}
                                        color="#60a5fa"
                                        explanation={`Din data:\n• Total tid: ${Math.round(lifetimeHours * 60)} min\n• Antal pass: ${lifetimeSessions} st\n• Snitt: ${Math.round(userAvgDuration)} min/pass\n\nCommunity-snitt: ${stats.averages.sessionDurationMinutes} min`}
                                    />
                                    <ComparisonBar
                                        title="Total Volym (Månad)"
                                        unit="kg"
                                        userValue={monthlyTonnage}
                                        avgValue={stats.averages.tonnagePerUserPerMonth}
                                        maxValue={Math.max(stats.averages.tonnagePerUserPerMonth * 1.5, monthlyTonnage, 1000)}
                                        color="#a855f7"
                                        explanation={`Din volym denna månad:\n• Styrkepass: ${strengthSessions.filter(s => { const d = new Date(s.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).length} st\n• Total volym: ${Math.round(monthlyTonnage).toLocaleString()} kg\n\nCommunity-snitt: ${stats.averages.tonnagePerUserPerMonth.toLocaleString()} kg/mån`}
                                    />
                                </div>
                            </div>

                            {/* Recent Data Audit (Helping user verify 10k etc) */}
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                <h3 className="text-xl font-bold text-white mb-4">Underlag (Senaste 5 passen)</h3>
                                <div className="space-y-2">
                                    {unifiedActivities.slice(0, 5).map(act => (
                                        <div key={act.id} className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg text-sm">
                                            <div>
                                                <div className="text-white font-bold">{act.title || act.type}</div>
                                                <div className="text-gray-500 text-xs">{new Date(act.date).toLocaleDateString('sv-SE')} • {act.source}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-emerald-400 font-mono">
                                                    {act.distance ? `${act.distance.toFixed(1)} km` : `${act.tonnage || 0} kg`}
                                                </div>
                                                <div className="text-gray-500 text-xs">{act.durationMinutes} min</div>
                                            </div>
                                        </div>
                                    ))}
                                    <Link to="/activity-log" className="block text-center text-emerald-500 text-xs font-bold pt-2 hover:underline">
                                        Se hela din logg →
                                    </Link>
                                </div>
                            </div>

                            {/* Monthly Trend Chart */}
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                <h3 className="text-xl font-bold text-white mb-4">Aktivitetstrend (6 Mån)</h3>
                                <div className="grid grid-cols-6 gap-2">
                                    {monthlyTrend.map((m, i) => {
                                        const maxCount = Math.max(...monthlyTrend.map(x => x.count), 1);
                                        const heightPercent = (m.count / maxCount) * 100;
                                        return (
                                            <div key={i} className="flex flex-col items-center">
                                                <div className="h-20 w-full flex items-end justify-center">
                                                    <div
                                                        className="w-6 bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-lg transition-all"
                                                        style={{ height: `${heightPercent}%`, minHeight: m.count > 0 ? '8px' : '0px' }}
                                                    />
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1 capitalize">{m.label}</div>
                                                <div className="text-sm font-bold text-white">{m.count}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Strength Tab */}
            {activeTab === 'strength' && (
                <div className="space-y-6">
                    {/* 1RM/1eRM Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="text-lg">🎯</span>
                            <span>Visa styrka som</span>
                        </div>
                        <div className="flex bg-slate-800 rounded-lg p-1">
                            <button
                                onClick={() => setRmMode('1erm')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${rmMode === '1erm' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                1eRM <span className="opacity-70">(Estimerad)</span>
                            </button>
                            <button
                                onClick={() => setRmMode('1rm')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${rmMode === '1rm' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                1RM <span className="opacity-70">(Faktisk)</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Exercise List */}
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[600px] flex flex-col">
                            <h3 className="font-bold text-white mb-4">Övningar</h3>
                            <input
                                type="text"
                                placeholder="Sök övning..."
                                value={exerciseSearch}
                                onChange={(e) => setExerciseSearch(e.target.value)}
                                className="bg-slate-800 border-none rounded-lg px-4 py-2 text-white mb-4 w-full focus:ring-2 focus:ring-emerald-500"
                            />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {Object.values(stats.strength.exercises)
                                    .filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
                                    .sort((a, b) => b.count - a.count)
                                    .map(ex => (
                                        <button
                                            key={ex.name}
                                            onClick={() => setSelectedExercise(ex.name.toLowerCase())}
                                            className={`w-full text-left p-3 rounded-lg flex justify-between items-center transition-all ${selectedExercise === ex.name.toLowerCase()
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-slate-800/50 text-gray-300 hover:bg-slate-800'
                                                }`}
                                        >
                                            <span className="font-bold">{ex.name}</span>
                                            <span className="text-xs opacity-70">{ex.count} loggar</span>
                                        </button>
                                    ))}
                            </div>
                        </div>

                        {/* Detail View */}
                        <div className="lg:col-span-2 space-y-6">
                            {selectedExerciseData ? (() => {
                                const pbDetails = getUserPBWithDetails(selectedExerciseData.name);
                                return (
                                    <>
                                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-8">
                                            <div className="flex justify-between items-start mb-8">
                                                <div>
                                                    <h2 className="text-3xl font-black text-white">{selectedExerciseData.name}</h2>
                                                    <p className="text-emerald-400 font-medium">Community Favorit #{stats.strength.topExercises.indexOf(selectedExerciseData.name) + 1}</p>
                                                </div>
                                                {/* Enhanced PB Card with Hover Info */}
                                                <div className="relative group">
                                                    <div className="text-right cursor-help">
                                                        <div className="text-3xl font-black text-white flex items-center gap-2 justify-end">
                                                            {pbDetails ? Math.round(pbDetails.value) : 0}
                                                            <span className="text-lg text-gray-400">{relativeFilter === 'weight' ? 'x' : 'kg'}</span>
                                                        </div>
                                                        <div className="text-gray-400 text-sm uppercase font-bold tracking-wider flex items-center gap-1 justify-end">
                                                            {rmMode === '1erm' ? 'Estimerad 1RM' : 'Faktisk 1RM'}
                                                            <span className="text-amber-400">✨</span>
                                                        </div>
                                                    </div>
                                                    {/* Hover Card */}
                                                    {pbDetails && (
                                                        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none group-hover:pointer-events-auto">
                                                            <div className="text-xs text-gray-500 uppercase font-bold mb-2">PB Detaljer</div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-400">Datum</span>
                                                                    <span className="text-white font-bold">{new Date(pbDetails.date).toLocaleDateString('sv-SE')}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-400">Set</span>
                                                                    <span className="text-white font-bold">{pbDetails.weight} kg × {pbDetails.reps} reps</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-gray-400">Typ</span>
                                                                    <span className={`font-bold ${pbDetails.isActual1RM ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                                        {pbDetails.isActual1RM ? '✓ Faktisk 1RM' : '≈ Estimerad (Epley)'}
                                                                    </span>
                                                                </div>
                                                                <div className="pt-2 border-t border-slate-700">
                                                                    <Link
                                                                        to={`/strength/${pbDetails.workoutId}`}
                                                                        className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-bold"
                                                                    >
                                                                        🔗 {pbDetails.workoutName}
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-8">
                                                <ComparisonBar
                                                    title={relativeFilter === 'weight' ? "Ditt PB / Vikt" : "Ditt PB / Maxvikt"}
                                                    unit={relativeFilter === 'weight' ? "x" : "kg"}
                                                    userValue={getUserPB(selectedExerciseData.name)}
                                                    avgValue={selectedExerciseData.avg1RM}
                                                    maxValue={selectedExerciseData.max1RM}
                                                    color="#10b981"
                                                />

                                                <ComparisonBar
                                                    title={relativeFilter === 'weight' ? "Volym / Vikt per pass" : "Volym per pass"}
                                                    unit={relativeFilter === 'weight' ? "x" : "kg"}
                                                    userValue={getUserAvgTonnage(selectedExerciseData.name)}
                                                    avgValue={selectedExerciseData.avgTonnage}
                                                    maxValue={Math.max(selectedExerciseData.avgTonnage * 2, getUserAvgTonnage(selectedExerciseData.name))}
                                                    color="#a855f7"
                                                />
                                            </div>

                                            <div className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-700 pt-8">
                                                <div className="text-center">
                                                    <div className="text-gray-400 text-xs uppercase font-bold mb-1">Total Volym</div>
                                                    <div className="text-xl font-black text-white">
                                                        {strengthSessions.reduce((acc, s) => acc + s.exercises.filter(ex => ex.exerciseName.toLowerCase() === selectedExerciseData.name.toLowerCase()).reduce((exAcc, ex) => exAcc + ex.sets.reduce((setAcc, set) => setAcc + (set.weight * set.reps), 0), 0), 0).toLocaleString()} <span className="text-xs text-gray-500">kg</span>
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-gray-400 text-xs uppercase font-bold mb-1">Totala Set</div>
                                                    <div className="text-xl font-black text-white">
                                                        {strengthSessions.reduce((acc, s) => acc + s.exercises.filter(ex => ex.exerciseName.toLowerCase() === selectedExerciseData.name.toLowerCase()).reduce((exAcc, ex) => exAcc + ex.sets.length, 0), 0).toLocaleString()} <span className="text-xs text-gray-500">st</span>
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-gray-400 text-xs uppercase font-bold mb-1">Utfört</div>
                                                    <div className="text-xl font-black text-white">
                                                        {strengthSessions.filter(s => s.exercises.some(ex => ex.exerciseName.toLowerCase() === selectedExerciseData.name.toLowerCase())).length} <span className="text-xs text-gray-500">gånger</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })() : (
                                <div className="h-full flex items-center justify-center text-gray-500">
                                    Välj en övning för att se statistik
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Cardio Tab */}
            {activeTab === 'cardio' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {['5k', '10k', '21k'].map(dist => {
                            const dStats = stats.cardio.distances[dist];
                            const cardioPB = getUserCardioPBWithDetails(parseFloat(dist));
                            if (!dStats) return null;

                            return (
                                <div key={dist} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden group/card hover:border-slate-600 transition-all">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl group-hover/card:scale-110 transition-transform">{dist}</div>
                                    <h3 className="text-2xl font-black text-white mb-6 uppercase italic">{dist}</h3>

                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                            <span className="text-gray-400 text-sm">Snittid</span>
                                            <span className="text-xl font-bold text-white">{formatDuration(dStats.avgTimeSeconds)}</span>
                                        </div>
                                        <div className="flex justify-between items-end border-b border-slate-800 pb-2">
                                            <span className="text-gray-400 text-sm">Snabbast</span>
                                            <span className="text-xl font-bold text-amber-400">{formatDuration(dStats.fastestTimeSeconds)}</span>
                                        </div>
                                        <div className="pt-4">
                                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Din bästa tid</div>
                                            {cardioPB ? (
                                                <div className="relative group/pb">
                                                    <div className="text-lg font-bold text-emerald-400 cursor-help flex items-center gap-2">
                                                        {formatDuration(cardioPB.timeSeconds)}
                                                        <span className="text-emerald-500/50 text-xs">✨</span>
                                                    </div>
                                                    {/* Hover card with activity link */}
                                                    <div className="absolute left-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl opacity-0 group-hover/pb:opacity-100 transition-opacity z-50 pointer-events-none group-hover/pb:pointer-events-auto">
                                                        <div className="text-xs text-gray-500 uppercase font-bold mb-2">PB Detaljer</div>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-400">Datum</span>
                                                                <span className="text-white font-bold">{new Date(cardioPB.date).toLocaleDateString('sv-SE')}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-400">Distans</span>
                                                                <span className="text-white font-bold">{cardioPB.actualDistance.toFixed(2)} km</span>
                                                            </div>
                                                            <div className="pt-2 border-t border-slate-700">
                                                                <Link
                                                                    to={`/activity/${cardioPB.activityId}`}
                                                                    className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-bold"
                                                                >
                                                                    🔗 Visa aktivitet
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {cardioPB.timeSeconds < dStats.avgTimeSeconds && (
                                                        <div className="text-xs text-emerald-500/70 mt-1">
                                                            Snabbare än snittet
                                                        </div>
                                                    )}
                                                    {cardioPB.timeSeconds >= dStats.avgTimeSeconds && (
                                                        <div className="text-xs text-emerald-500/70 mt-1">
                                                            Kämpa på, du närmar dig snittet
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-lg font-bold text-gray-500">Ingen data</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detailed Cardio Comparison - Distansfördelning */}
                    <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Distansfördelning</h3>
                            <select
                                value={genderFilter}
                                onChange={(e) => setGenderFilter(e.target.value as any)}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                            >
                                <option value="all">Alla</option>
                                <option value="male">Man</option>
                                <option value="female">Kvinna</option>
                                <option value="unknown">Vet ej</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                            {[
                                { label: '0-3 km', min: 0, max: 3 },
                                { label: '3-5 km', min: 3, max: 5 },
                                { label: '5-10 km', min: 5, max: 10 },
                                { label: '10-15 km', min: 10, max: 15 },
                                { label: '15-21 km', min: 15, max: 21 },
                                { label: '21+ km', min: 21, max: 999 },
                            ].map(bucket => {
                                const count = filteredActivities.filter(e =>
                                    e.distance && e.distance >= bucket.min && e.distance < bucket.max
                                ).length;
                                const maxCount = Math.max(...[
                                    { min: 0, max: 3 }, { min: 3, max: 5 }, { min: 5, max: 10 },
                                    { min: 10, max: 15 }, { min: 15, max: 21 }, { min: 21, max: 999 }
                                ].map(b => filteredActivities.filter(e => e.distance && e.distance >= b.min && e.distance < b.max).length), 1);
                                const heightPercent = (count / maxCount) * 100;
                                return (
                                    <div key={bucket.label} className="flex flex-col items-center">
                                        <div className="h-32 w-full flex items-end justify-center">
                                            <div
                                                className="w-8 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all"
                                                style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '8px' : '0px' }}
                                            />
                                        </div>
                                        <div className="text-xs text-gray-400 mt-2">{bucket.label}</div>
                                        <div className="text-sm font-bold text-white">{count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

