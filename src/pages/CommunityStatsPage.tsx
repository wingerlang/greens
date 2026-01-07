
import { useEffect, useState } from 'react';
import { statisticsService, CommunityStats } from '../services/statisticsService.ts';
import { ComparisonBar } from '../components/charts/ComparisonBar.tsx';
import { RadarProfile } from '../components/charts/RadarProfile.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PersonalBest } from '../models/strengthTypes.ts';
import { calculateEstimated1RM } from '../utils/strengthCalculators.ts';
import { PBHoverCard } from '../components/charts/PBHoverCard.tsx';

export function CommunityStatsPage() {
    const navigate = useNavigate();
    const { tab } = useParams<{ tab: string }>();

    function StatCard({ label, value, unit, icon, color }: { label: string, value: string, unit: string, icon: string, color: string }) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center hover:bg-slate-800/50 transition-colors shrink-0 min-w-[160px]">
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

    // Derived tab state from URL
    const activeTab = (tab as 'overview' | 'strength' | 'cardio') || 'overview';
    const setActiveTab = (newTab: string) => {
        navigate(`/statistik/${newTab}`);
    };

    const [exerciseSearch, setExerciseSearch] = useState('');
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

    // Global Filters
    const [timeFilter, setTimeFilter] = useState<'all' | '12m' | '2026' | '1m'>('all');
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'unknown'>('all'); // Visual placebo for now if backend doesn't support
    const [relativeFilter, setRelativeFilter] = useState<'absolute' | 'weight'>('absolute');
    const [rmMode, setRmMode] = useState<'1rm' | '1erm'>('1erm'); // 1RM (actual) vs 1eRM (estimated)
    const [exerciseSortMode, setExerciseSortMode] = useState<'popular' | 'strongest' | 'weakest'>('popular');

    const userWeight = user?.settings?.weight || 80; // Fallback to 80kg if unknown

    useEffect(() => {
        loadData();
    }, [timeFilter]);

    const loadData = async () => {
        setLoading(true);
        const data = await statisticsService.getCommunityStats(timeFilter);
        setStats(data);
        setLoading(false);

        // Select first exercise by default if none selected or if refreshing
        if (data && data.strength.topExercises.length > 0 && !selectedExercise) {
            setSelectedExercise(data.strength.topExercises[0].toLowerCase());
        }
    };

    // --- FORMATTING UTILS ---
    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toLocaleString();
    };

    const formatTons = (kg: number) => {
        const tons = kg / 1000;
        if (tons >= 1000000) return (tons / 1000000).toFixed(1) + 'm ton';
        if (tons >= 1000) return (tons / 1000).toFixed(1) + 'k ton';
        if (tons >= 1) return tons.toFixed(1) + ' ton';
        return kg.toLocaleString() + ' kg';
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

    // 1. Workouts this month (Current Calendar Month - for reference in explanations)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const activitiesThisMonth = unifiedActivities.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    // This is only for explanation - the actual comparison uses filtered data
    const currentMonthWorkouts = activitiesThisMonth.length;

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

    // Calculate time span in filter for proper per-month averages
    const allDates = filteredActivities.map(e => new Date(e.date).getTime()).sort((a, b) => a - b);
    const firstLogDate = allDates.length > 0 ? allDates[0] : Date.now();
    const lastLogDate = allDates.length > 0 ? allDates[allDates.length - 1] : Date.now();

    // Weeks in filter for weekly average
    const weeksInFilter = Math.max(1, (Date.now() - firstLogDate) / (1000 * 60 * 60 * 24 * 7));
    const avgSessionsPerWeek = lifetimeSessions / weeksInFilter;

    // Months in filter for monthly averages - RESPECTS SELECTED TIME FILTER
    const monthsInFilter = Math.max(1, (lastLogDate - firstLogDate) / (1000 * 60 * 60 * 24 * 30.44)); // ~30.44 days per month

    // User's average workouts per month (based on filtered data)
    const userWorkoutsPerMonthTotal = filteredActivities.length / monthsInFilter;

    // User's average tonnage per month (based on filtered data)
    let totalFilteredTonnage = filteredStrength.reduce((acc, s) => acc + (s.totalVolume || 0), 0);
    if (relativeFilter === 'weight') totalFilteredTonnage = totalFilteredTonnage / userWeight;
    const monthlyTonnage = totalFilteredTonnage / monthsInFilter;

    // Current month specific - for explanation text only
    let currentMonthTonnage = strengthSessions.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, s) => acc + (s.totalVolume || 0), 0);
    if (relativeFilter === 'weight') currentMonthTonnage = currentMonthTonnage / userWeight;

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


    // Enhanced to support 1RM vs 1eRM modes and return workout details
    const getUserPBWithDetails = (exerciseName: string): PersonalBest | null => {
        let best: PersonalBest | null = null;
        let maxValue = 0;

        filteredStrength.forEach(s => {
            s.exercises.forEach(ex => {
                if (ex.exerciseName.toLowerCase() === exerciseName.toLowerCase()) {
                    ex.sets.forEach(set => {
                        let value = 0;
                        const isActual = set.reps <= 3; // Consider 1-3 reps as "actual" lifts

                        if (rmMode === '1rm') {
                            // 1RM = highest weight lifted (regardless of reps - true strength measure)
                            value = set.weight;
                        } else {
                            // 1eRM = estimated 1RM using Epley formula
                            value = calculateEstimated1RM(set.weight, set.reps);
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

    const getUserSessionsCount = (exerciseName: string) => {
        return filteredStrength.filter(s =>
            s.exercises.some(ex => ex.exerciseName.toLowerCase() === exerciseName.toLowerCase())
        ).length;
    };

    const getUserAvgSets = (exerciseName: string) => {
        const matches = filteredStrength.filter(s =>
            s.exercises.some(ex => ex.exerciseName.toLowerCase() === exerciseName.toLowerCase())
        );
        if (matches.length === 0) return 0;

        const totalSets = matches.reduce((acc, s) => {
            const ex = s.exercises.find(e => e.exerciseName.toLowerCase() === exerciseName.toLowerCase());
            return acc + (ex?.sets.length || 0);
        }, 0);

        return parseFloat((totalSets / matches.length).toFixed(1));
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

    // --- TAB COMPONENTS ---
    const OverviewTabContents = () => {
        if (!stats) return null;
        return (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <StatCard label="Total Distans" value={lifetimeDistance.toLocaleString()} unit="km" icon="🌍" color="text-sky-400" />
                    <StatCard label="Total Tid" value={formatHoursAsTime(lifetimeHours)} unit="" icon="⏱️" color="text-indigo-400" />
                    <StatCard label={relativeFilter === 'weight' ? "Volym / Kroppsvikt" : "Total Volym"} value={formatTons(lifetimeTonnage)} unit="" icon="🏋️‍♂️" color="text-rose-400" />
                    <StatCard label="Antal Pass" value={lifetimeSessions.toLocaleString()} unit="st" icon="🔥" color="text-amber-400" />
                    <StatCard label="Kalorier (Est)" value={lifetimeCalories.toLocaleString()} unit="kcal" icon="⚡" color="text-orange-400" />
                    <StatCard label="Mål Uppnådda" value={stats.global.totalGoalsAchieved.toLocaleString()} unit="st" icon="🏆" color="text-emerald-400" />
                    <StatCard label="Snittpass / v" value={avgSessionsPerWeek.toFixed(1)} unit="st" icon="📅" color="text-pink-400" />
                    <StatCard label="Totala Reps" value={strengthSessions.reduce((acc: number, s) => acc + s.exercises.reduce((exAcc: number, ex) => exAcc + ex.sets.reduce((setAcc: number, set) => setAcc + (set.reps || 0), 0), 0), 0).toLocaleString()} unit="st" icon="🔢" color="text-lime-400" />
                    <StatCard label="Höjdmeter" value={unifiedActivities.reduce((acc, e) => acc + (e.elevationGain || 0), 0).toLocaleString()} unit="m" icon="⛰️" color="text-teal-400" />
                    <StatCard label="Atleter" value={stats.global.totalUsers.toLocaleString()} unit="st" icon="👥" color="text-slate-400" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                                    explanation={`Din data (${timeFilter === 'all' ? 'hela perioden' : timeFilter === '12m' ? '12 mån' : timeFilter === '1m' ? '1 mån' : '2026'}):\n• Antal pass: ${filteredActivities.length} st\n• Period: ${Math.round(monthsInFilter)} mån\n• Snitt: ${userWorkoutsPerMonthTotal.toFixed(1)} pass/mån\n\nCommunity-snitt: ${stats.averages.workoutsPerUserPerMonth.toFixed(1)} pass/mån`}
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
                                    unit="t"
                                    userValue={monthlyTonnage / 1000}
                                    avgValue={stats.averages.tonnagePerUserPerMonth / 1000}
                                    maxValue={Math.max(stats.averages.tonnagePerUserPerMonth * 1.5, monthlyTonnage, 1000) / 1000}
                                    color="#a855f7"
                                    explanation={`Din volym denna månad:\n• Styrkepass: ${strengthSessions.filter(s => { const d = new Date(s.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).length} st\n• Total volym: ${formatTons(monthlyTonnage)}\n\nCommunity-snitt: ${formatTons(stats.averages.tonnagePerUserPerMonth)}/mån`}
                                />
                            </div>
                        </div>

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

                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                            <h3 className="text-xl font-bold text-white mb-4">Aktivitetstrend (6 Mån)</h3>
                            <div className="grid grid-cols-6 gap-2">
                                {monthlyTrend.map((m, i) => {
                                    const maxCount = Math.max(...monthlyTrend.map(x => x.count), 1);
                                    const heightPercent = (m.count / maxCount) * 100;
                                    return (
                                        <div key={i} className="flex flex-col items-center">
                                            <div className="h-20 w-full flex items-end justify-center">
                                                <div className="w-6 bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-lg transition-all" style={{ height: `${heightPercent}%`, minHeight: m.count > 0 ? '8px' : '0px' }} />
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
        );
    };

    const StrengthTabContents = () => {
        if (!stats) return null;

        const filteredExerciseStats = Object.values(stats.strength.exercises)
            .filter(ex => ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()))
            .map(ex => {
                const pb = getUserPB(ex.name);
                const userSessions = getUserSessionsCount(ex.name);

                // Sort Score calculation:
                // Base score from selected mode
                let baseScore = 0;
                if (exerciseSortMode === 'popular') {
                    // "Vanligaste först" - combine user sessions and total athlete count
                    // Give high weight to user's own frequency to make it "My most common"
                    baseScore = (userSessions * 20) + ex.athleteCount;
                } else if (exerciseSortMode === 'strongest') {
                    baseScore = ex.avg1RM > 0 ? (pb / ex.avg1RM) : 0;
                } else {
                    baseScore = pb > 0 ? (ex.avg1RM / pb) : 0;
                }

                // Penalty for no data/no sessions to keep them at the bottom
                // If they have nether user data nor community data, they go to the absolute bottom
                if (userSessions === 0 && ex.athleteCount === 0) baseScore -= 5000;
                // If they have no user data, they go below anything the user HAS done
                else if (userSessions === 0) baseScore -= 1000;

                return {
                    ...ex,
                    userPB: pb,
                    userSessions,
                    sortScore: baseScore
                };
            })
            .sort((a, b) => b.sortScore - a.sortScore);

        const selectedExerciseData = (selectedExercise && stats.strength.exercises[selectedExercise.toLowerCase()]) || null;

        return (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="text-lg">🎯</span>
                        <span>Visa styrka som</span>
                    </div>
                    <div className="flex bg-slate-800 rounded-lg p-1">
                        {(['1erm', '1rm'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setRmMode(m)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${rmMode === m ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {m === '1erm' ? '1eRM (Estimerad)' : '1RM (Faktisk)'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[600px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white uppercase tracking-widest text-xs">Övningar</h3>
                            <div className="flex text-xs gap-1">
                                {([{ key: 'popular', label: '🔥' }, { key: 'strongest', label: '💪' }, { key: 'weakest', label: '📈' }] as const).map(mode => (
                                    <button
                                        key={mode.key}
                                        onClick={() => setExerciseSortMode(mode.key)}
                                        className={`px-2 py-1 rounded transition-all ${exerciseSortMode === mode.key ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                        title={mode.key === 'popular' ? 'Mest populär' : mode.key === 'strongest' ? 'Starkast vs snitt' : 'Svagast vs snitt'}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="Sök övning..."
                                value={exerciseSearch}
                                onChange={(e) => setExerciseSearch(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-2">
                                {filteredExerciseStats.map(ex => {
                                    const pb = ex.userPB;
                                    const diff = ex.avg1RM > 0 ? (((pb - ex.avg1RM) / ex.avg1RM) * 100) : 0;
                                    // Slugify for navigation
                                    const slugifiedName = ex.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                                    return (
                                        <div key={ex.name} className="relative group">
                                            <button
                                                onClick={() => setSelectedExercise(ex.name)}
                                                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedExercise === ex.name ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600'}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{ex.name}</div>
                                                        <div className="flex gap-2 mt-1">
                                                            <div className="text-[10px] text-gray-500 uppercase font-bold">{ex.athleteCount} atleter</div>
                                                            <div className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">{ex.userSessions} pass</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-emerald-400">{pb ? `${formatNumber(pb)} kg` : '--'}</div>
                                                        {pb > 0 && ex.avg1RM > 0 && (
                                                            <div className={`text-[10px] font-black ${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {diff > 0 ? '+' : ''}{Math.round(diff)}%
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Quick Link to My Stats */}
                                            <Link
                                                to={`/styrka/${slugifiedName}`}
                                                className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/20 rounded-lg transition-all text-emerald-500"
                                                title="Se min statistik & modal"
                                            >
                                                <span className="text-xs">📊</span>
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        {selectedExerciseData ? (
                            <>
                                <div className="absolute top-0 right-0 p-8 opacity-5 font-black text-8xl pointer-events-none truncate max-w-full">
                                    {selectedExerciseData.name}
                                </div>
                                <div className="relative z-10">
                                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-8 flex items-baseline gap-3">
                                        {selectedExerciseData.name}
                                        <span className="text-sm font-bold text-gray-500 not-italic tracking-normal">{selectedExerciseData.athleteCount} atleter kör denna</span>
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/50 relative group/pb">
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Ditt Personbästa</div>
                                            <div className="text-2xl font-black text-emerald-400 flex items-center gap-2 cursor-help">
                                                {formatNumber(getUserPB(selectedExerciseData.name))}
                                                <span className="text-xs text-gray-500 font-bold uppercase">kg</span>
                                                <span className="text-emerald-400 p-1 bg-emerald-400/10 rounded text-[10px] animate-pulse">PB</span>
                                            </div>
                                            <PBHoverCard pb={getUserPBWithDetails(selectedExerciseData.name)} rmMode={rmMode} />
                                        </div>

                                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Ditt Snitt per pass</div>
                                            <div className="text-2xl font-black text-white">
                                                {Math.round(getUserAvgSets(selectedExerciseData.name))}
                                                <span className="text-xs text-gray-500 font-bold ml-1 uppercase">set</span>
                                            </div>
                                            {(() => {
                                                const userSets = getUserAvgSets(selectedExerciseData.name);
                                                const commSets = selectedExerciseData.avgSets;
                                                const diff = ((userSets - commSets) / commSets) * 100;
                                                return (
                                                    <div className={`text-[10px] mt-1 font-black uppercase ${diff > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                        {diff > 0 ? '+' : ''}{Math.round(diff)}% vs snitt ({commSets})
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Max i community</div>
                                            <div className="text-2xl font-black text-white">
                                                {formatNumber(selectedExerciseData.max1RM)}
                                                <span className="text-xs text-gray-500 font-bold ml-1 uppercase">kg</span>
                                            </div>
                                            <div className="text-[10px] text-gray-600 mt-1 uppercase font-bold">Respekt!</div>
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
                                            pbDetails={getUserPBWithDetails(selectedExerciseData.name)}
                                            rmMode={rmMode}
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

                                    <div className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-700/50 pt-8">
                                        <div className="text-center">
                                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Volym</div>
                                            <div className="text-xl font-black text-white leading-none">
                                                {formatTons(strengthSessions.reduce((acc: number, s) => acc + s.exercises.filter(ex => ex.exerciseName.toLowerCase() === selectedExerciseData.name.toLowerCase()).reduce((exAcc: number, ex) => exAcc + ex.sets.reduce((setAcc: number, set) => setAcc + (set.weight * set.reps), 0), 0), 0))}
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Totala Set</div>
                                            <div className="text-xl font-black text-white leading-none">
                                                {formatNumber(strengthSessions.reduce((acc: number, s) => acc + s.exercises.filter(ex => ex.exerciseName.toLowerCase() === selectedExerciseData.name.toLowerCase()).reduce((exAcc: number, ex) => exAcc + ex.sets.length, 0), 0))} <span className="text-[10px] text-gray-500 font-bold">st</span>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Utfört</div>
                                            <div className="text-xl font-black text-white leading-none">
                                                {strengthSessions.filter(s => s.exercises.some(ex => ex.exerciseName.toLowerCase() === selectedExerciseData.name.toLowerCase())).length} <span className="text-[10px] text-gray-500 font-bold">gånger</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed p-12">
                                <div className="text-6xl mb-4 opacity-20">🏋️</div>
                                <div className="font-black uppercase tracking-widest text-xs">Välj en övning för att se statistik</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const CardioTabContents = () => {
        if (!stats) return null;
        return (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(['5k', '10k', '21k'] as const).map(dist => {
                        const dStats = stats.cardio.distances[dist];
                        const cardioPB = getUserCardioPBWithDetails(parseFloat(dist));
                        if (!dStats) return null;

                        return (
                            <div key={dist} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative group/card hover:border-slate-600 transition-all">
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
                                                            <Link to={`/activity/${cardioPB.activityId}`} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-bold">🔗 Visa aktivitet</Link>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`text-xs mt-1 ${cardioPB.timeSeconds < dStats.avgTimeSeconds ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>
                                                    {cardioPB.timeSeconds < dStats.avgTimeSeconds ? 'Snabbare än snittet' : 'Kämpa på, du närmar dig snittet'}
                                                </div>
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
                            const count = filteredActivities.filter(e => e.distance && e.distance >= bucket.min && e.distance < bucket.max).length;
                            const maxOverallBucket = Math.max(...[0, 3, 5, 10, 15, 21].map((min, idx, arr) => filteredActivities.filter(e => e.distance && e.distance >= min && e.distance < (arr[idx + 1] || 999)).length), 1);
                            const heightPercent = (count / maxOverallBucket) * 100;
                            return (
                                <div key={bucket.label} className="flex flex-col items-center">
                                    <div className="h-32 w-full flex items-end justify-center">
                                        <div className="w-8 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all" style={{ height: `${heightPercent}%`, minHeight: count > 0 ? '8px' : '0px' }} />
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2">{bucket.label}</div>
                                    <div className="text-sm font-bold text-white">{count}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4">
            {/* STICKY HEADER & FILTERS */}
            <div className="sticky top-16 z-40 -mx-4 px-4 py-4 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 shadow-2xl shadow-slate-950/50 mb-4 transition-all duration-300">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-black italic text-white tracking-tight uppercase flex items-center gap-3">
                            <span className="text-emerald-500 text-3xl">📊</span> Community Stats
                        </h1>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">
                            Jämför dig mot {stats.global.totalUsers} atleter
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <div className="flex bg-slate-900/80 rounded-xl p-1 border border-slate-800 shadow-inner">
                            {['all', '12m', '2026', '1m'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTimeFilter(t as any)}
                                    className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${timeFilter === t ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {t === 'all' ? 'HELA' : t === '12m' ? '12 MÅN' : t === '2026' ? 'I ÅR' : '1 MÅN'}
                                </button>
                            ))}
                        </div>

                        <div className="flex bg-slate-900/80 rounded-xl p-1 border border-slate-800 shadow-inner">
                            {['all', 'male', 'female'].map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGenderFilter(g as any)}
                                    className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${genderFilter === g ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {g === 'all' ? 'ALLA' : g === 'male' ? 'MÄN' : 'KVINNOR'}
                                </button>
                            ))}
                        </div>

                        <div className="flex bg-slate-900/80 rounded-xl p-1 border border-slate-800 shadow-inner">
                            {['absolute', 'weight'].map(r => (
                                <button
                                    key={r}
                                    onClick={() => setRelativeFilter(r as any)}
                                    className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${relativeFilter === r ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30' : 'text-gray-500 hover:text-white'}`}
                                >
                                    {r === 'absolute' ? 'ABSOLUT' : 'RELATIV'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs with Icons - Also Sticky below the filters */}
            <div className="sticky top-[138px] lg:top-[128px] z-30 flex gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-xl mb-8">
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
            {/* Conditional Tab Rendering */}
            <div className="relative z-10">
                {activeTab === 'overview' && <OverviewTabContents />}
                {activeTab === 'strength' && <StrengthTabContents />}
                {activeTab === 'cardio' && <CardioTabContents />}
            </div>
        </div>
    );
};

