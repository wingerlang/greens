import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { calculatePerformanceScore } from '../utils/performanceEngine.ts';
import { formatDuration, formatSwedishDate, formatPace } from '../utils/dateUtils.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { WeeklyVolumeChart } from '../components/training/WeeklyVolumeChart.tsx';
import { WeeklyDistanceChart } from '../components/training/WeeklyDistanceChart.tsx';
import { PersonalBest } from '../models/strengthTypes.ts';
import { calculateGoalProgress } from '../utils/goalCalculations.ts';
import type { UniversalActivity } from '../models/types.ts';


function formatYearRange(years: number[]) {
    if (years.length === 0) return '';
    if (years.length === 1) return years[0].toString();
    const sorted = [...years].sort((a, b) => a - b);
    // Check if consecutive
    const isConsecutive = sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1);
    if (isConsecutive) return `${sorted[0]} - ${sorted[sorted.length - 1]}`;
    return sorted.join(', ');
}

export function YearInReviewPage() {
    const { universalActivities = [], strengthSessions = [], performanceGoals = [], unifiedActivities = [] } = useData();
    const { token } = useAuth();
    const [selectedActivity, setSelectedActivity] = useState<UniversalActivity | null>(null);
    const [strengthPBs, setStrengthPBs] = useState<PersonalBest[]>([]);
    const [paceInterval, setPaceInterval] = useState<'1d' | '1w' | '2w' | '1m' | '3m'>('2w');
    const [durationInterval, setDurationInterval] = useState<'1d' | '1w' | '2w' | '1m' | '3m'>('2w');

    const durationLabel = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        if (h > 0) return `${h}h ${m}min`;
        return `${m}min`;
    };

    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedYears, setSelectedYears] = useState<number[]>(() => {
        const yearsParam = searchParams.get('years');
        if (yearsParam) {
            return yearsParam.split(',').map(Number).filter(n => !isNaN(n));
        }
        // Try localStorage
        const saved = localStorage.getItem('yir_years');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                // ignore
            }
        }
        return [new Date().getFullYear()];
    });

    // Sync to URL & LocalStorage
    useEffect(() => {
        if (selectedYears.length > 0) {
            setSearchParams({ years: selectedYears.join(',') }, { replace: true });
            localStorage.setItem('yir_years', JSON.stringify(selectedYears));
        }
    }, [selectedYears, setSearchParams]);

    const toggleYear = (year: number) => {
        setSelectedYears(prev => {
            let next;
            if (prev.includes(year)) {
                if (prev.length === 1) return prev; // Prevent empty
                next = prev.filter(y => y !== year);
            } else {
                next = [...prev, year];
            }
            return next.sort((a, b) => a - b);
        });
    };

    // Load Strength PBs
    useEffect(() => {
        if (!token) return;
        fetch('/api/strength/pbs', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.pbs && Array.isArray(data.pbs)) {
                    setStrengthPBs(data.pbs);
                }
            })
            .catch(err => console.error('Failed to load strength PBs', err));
    }, [token]);

    // 1. Filter Data for the selected years
    const yearlyActivities = useMemo(() => {
        // Pre-calculate IDs that should be hidden (components of merges)
        const hiddenIds = new Set<string>();
        universalActivities.forEach((u: UniversalActivity) => {
            if (u.mergedIntoId) hiddenIds.add(u.id);
            if (u.mergeInfo?.isMerged && u.mergeInfo.originalActivityIds) {
                u.mergeInfo.originalActivityIds.forEach(id => hiddenIds.add(id));
            }
        });

        return universalActivities
            .filter((a: UniversalActivity) => !hiddenIds.has(a.id)) // Filter out merged components AND merged-into activities
            .filter((a: UniversalActivity) => {
                const d = new Date(a.date);
                return selectedYears.includes(d.getFullYear());
            }).sort((a: UniversalActivity, b: UniversalActivity) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [universalActivities, selectedYears]);

    // 1.1 Filter Strength Sessions for the selected years (Source of Truth for Strength)
    const yearlyStrengthSessions = useMemo(() => {
        return strengthSessions.filter(s => {
            const d = new Date(s.date);
            return selectedYears.includes(d.getFullYear());
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [strengthSessions, selectedYears]);

    // 1.2 Filter Goals for the selected years
    const yearlyGoals = useMemo(() => {
        if (selectedYears.length === 0) return [];
        const startOfYear = new Date(Math.min(...selectedYears), 0, 1).toISOString();
        const endOfYear = new Date(Math.max(...selectedYears), 11, 31, 23, 59, 59, 999).toISOString(); // End of last day

        return performanceGoals.filter(goal => {
            // Check if goal overlaps with selected years
            const goalStart = goal.startDate;
            const goalEnd = goal.endDate || new Date().toISOString(); // Open-ended goals assumed active
            return goalStart <= endOfYear && goalEnd >= startOfYear;
        });
    }, [performanceGoals, selectedYears]);

    // 2. Aggregate Stats
    const stats = useMemo(() => {
        let totalDist = 0;
        let totalTime = 0;
        let totalCals = 0;
        let totalSessions = yearlyActivities.length;
        let totalScore = 0;
        let scoreCount = 0;
        let totalPRs = 0;
        let runningPRs = 0;
        let strengthPRs = 0;
        let totalTonnage = 0;
        let activeDays = new Set<string>();

        // Type Breakdown
        const typeMap = new Map<string, { count: number, time: number, dist: number }>();

        // Consistency
        let longestGap = 0;
        let lastDate: Date | null = null;

        // Count Strength PBs from fetched data
        const yearlyStrengthPBs = strengthPBs.filter(pb => {
            const d = new Date(pb.date);
            return selectedYears.includes(d.getFullYear());
        });
        strengthPRs = yearlyStrengthPBs.length;

        yearlyActivities.forEach((a: UniversalActivity) => {
            const dist = a.performance?.distanceKm || 0;
            const time = a.performance?.durationMinutes || 0;
            const cals = a.performance?.calories || 0;
            const score = calculatePerformanceScore({ ...a, durationMinutes: time, distance: dist, type: a.performance?.activityType } as any);
            const prs = a.performance?.prCount || 0;

            totalDist += dist;
            totalTime += time;
            totalCals += cals;
            // Only add running PRs from activities here, as we count Strength PBs separately
            if (a.performance?.activityType === 'running') {
                runningPRs += prs;
            } else if (a.performance?.activityType === 'strength') {
                // Ignore prCount here as we use strengthPBs list
            }

            activeDays.add(a.date.split('T')[0]);

            const type = a.performance?.activityType || 'other';

            if (score > 0) {
                totalScore += score;
                scoreCount++;
            }

            const curr = typeMap.get(type) || { count: 0, time: 0, dist: 0 };
            typeMap.set(type, {
                count: curr.count + 1,
                time: curr.time + time,
                dist: curr.dist + dist
            });

            // Gap Calculation
            const currentDate = new Date(a.date);
            if (lastDate) {
                const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > longestGap) {
                    longestGap = diffDays;
                }
            }
            lastDate = currentDate;
        });

        // Strength Specifics (using strengthSessions)
        let bestLift = { weight: 0, exercise: '', activity: null as UniversalActivity | null };
        let maxVolumeSession: any = null; // Use StrengthWorkout type effectively

        yearlyStrengthSessions.forEach(s => {
            totalTonnage += (s.totalVolume || 0);
            // Find Best Lift
            s.exercises.forEach(e => {
                e.sets.forEach(set => {
                    const weight = set.weight || 0;
                    if (weight > bestLift.weight) {
                        bestLift = {
                            weight: weight,
                            exercise: e.exerciseName,
                            activity: {
                                id: s.id,
                                date: s.date,
                                source: 'strength',
                                performance: { activityType: 'strength' }
                            } as any
                        };
                    }
                });
            });

            // Find Max Volume Session
            if (!maxVolumeSession || (s.totalVolume || 0) > (maxVolumeSession.totalVolume || 0)) {
                maxVolumeSession = s;
            }
        });

        totalPRs = runningPRs + strengthPRs;

        // Highlights - Top 3
        const longestRuns = [...yearlyActivities]
            .filter((a: UniversalActivity) => a.performance?.activityType === 'running')
            .sort((a: UniversalActivity, b: UniversalActivity) => (b.performance?.distanceKm || 0) - (a.performance?.distanceKm || 0))
            .slice(0, 3);

        const fastestRuns = [...yearlyActivities]
            .filter((a: UniversalActivity) => a.performance?.activityType === 'running' && (a.performance?.distanceKm || 0) > 5)
            .sort((a: UniversalActivity, b: UniversalActivity) => {
                const paceA = (a.performance?.durationMinutes || 0) / (a.performance?.distanceKm || 1);
                const paceB = (b.performance?.durationMinutes || 0) / (b.performance?.distanceKm || 1);
                return paceA - paceB;
            })
            .slice(0, 3);

        const maxScores = [...yearlyActivities]
            .map((a: UniversalActivity) => {
                // Map UniversalActivity to the format expected by calculatePerformanceScore
                const mappedActivity = {
                    ...a,
                    type: a.performance?.activityType || 'other',
                    activityType: a.performance?.activityType || 'other',
                    durationMinutes: a.performance?.durationMinutes || 0,
                    distance: a.performance?.distanceKm || 0,
                    distanceKm: a.performance?.distanceKm || 0,
                    heartRateAvg: a.performance?.avgHeartRate || 0,
                    avgHeartRate: a.performance?.avgHeartRate || 0,
                    elevationGain: a.performance?.elevationGain || 0,
                };
                return { activity: a, score: calculatePerformanceScore(mappedActivity, []) };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        const topVolumeSessions = [...yearlyStrengthSessions]
            .sort((a, b) => (b.totalVolume || 0) - (a.totalVolume || 0))
            .slice(0, 3);

        // Best Lifts (Top 3)
        const allLifts: { weight: number, exercise: string, date: string, id: string }[] = [];
        yearlyStrengthSessions.forEach(s => {
            s.exercises.forEach(e => {
                e.sets.forEach(set => {
                    const weight = set.weight || 0;
                    if (weight > 0) {
                        allLifts.push({ weight, exercise: e.exerciseName, date: s.date, id: s.id });
                    }
                });
            });
        });
        const topLifts = allLifts.sort((a, b) => b.weight - a.weight).slice(0, 3);

        return {
            totalDist,
            totalTime,
            totalCals,
            totalSessions,
            totalPRs,
            runningPRs,
            strengthPRs,
            avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
            activeDays: activeDays.size,
            types: Array.from(typeMap.entries()).map(([k, v]) => ({ name: k, ...v })),
            longestRuns,
            fastestRuns,
            maxScores,
            topVolumeSessions,
            topLifts,
            longestGap,
            totalTonnage
        };
    }, [yearlyActivities, yearlyStrengthSessions, strengthPBs, selectedYears]);

    // 3. Monthly Breakdown Data
    const monthlyData = useMemo(() => {
        const months = Array(12).fill(0).map((_, i) => ({
            name: new Date(2024, i, 1).toLocaleString('sv-SE', { month: 'short' }).replace('.', ''), // Generic year
            dist: 0,
            time: 0,
            cals: 0,
            count: 0
        }));

        yearlyActivities.forEach((a: UniversalActivity) => {
            const m = new Date(a.date).getMonth();
            if (months[m]) {
                months[m].dist += (a.performance?.distanceKm || 0);
                months[m].time += (a.performance?.durationMinutes || 0);
                months[m].cals += (a.performance?.calories || 0);
                months[m].count += 1;
            }
        });
        return months;
    }, [yearlyActivities]);

    // 4. Smoothed Chart Data (Pace & Duration)
    const smoothedPaceData = useMemo(() => {
        if (selectedYears.length === 0) return [];
        const minYear = Math.min(...selectedYears);
        const startDate = new Date(minYear, 0, 1);
        const intervalDays = paceInterval === '1d' ? 1 : paceInterval === '1w' ? 7 : paceInterval === '2w' ? 14 : paceInterval === '1m' ? 30 : 90;
        const buckets = new Map<number, { totalTime: number, totalDist: number, firstDate: Date }>();

        yearlyActivities.forEach((a: UniversalActivity) => {
            if (a.performance?.activityType === 'running' && (a.performance.distanceKm || 0) > 0) {
                const d = new Date(a.date);
                const daysSinceStart = Math.floor((d.getTime() - startDate.getTime()) / 86400000);
                const bucketIndex = Math.floor(daysSinceStart / intervalDays);

                const curr = buckets.get(bucketIndex) || { totalTime: 0, totalDist: 0, firstDate: d };
                buckets.set(bucketIndex, {
                    totalTime: curr.totalTime + (a.performance.durationMinutes || 0),
                    totalDist: curr.totalDist + (a.performance.distanceKm || 0),
                    firstDate: curr.firstDate < d ? curr.firstDate : d
                });
            }
        });

        const totalDays = selectedYears.length * 366; // Approximation for max buckets
        const maxBuckets = Math.ceil(totalDays / intervalDays);
        const result = Array.from({ length: maxBuckets }, (_, i) => {
            const data = buckets.get(i);
            if (!data || data.totalDist === 0) return { bucket: i, pace: null, date: null };
            return {
                bucket: i,
                pace: data.totalTime / data.totalDist,
                date: data.firstDate
            };
        }).filter(d => d.date !== null); // Filter out empty buckets for cleaner chart

        return result;
    }, [yearlyActivities, paceInterval, selectedYears]);

    const smoothedDurationData = useMemo(() => {
        if (selectedYears.length === 0) return [];
        const minYear = Math.min(...selectedYears);
        const startDate = new Date(minYear, 0, 1);
        const intervalDays = durationInterval === '1d' ? 1 : durationInterval === '1w' ? 7 : durationInterval === '2w' ? 14 : durationInterval === '1m' ? 30 : 90;
        const buckets = new Map<number, { totalTime: number, count: number, firstDate: Date }>();

        yearlyActivities.forEach((a: UniversalActivity) => {
            const d = new Date(a.date);
            const daysSinceStart = Math.floor((d.getTime() - startDate.getTime()) / 86400000);
            const bucketIndex = Math.floor(daysSinceStart / intervalDays);

            const curr = buckets.get(bucketIndex) || { totalTime: 0, count: 0, firstDate: d };
            buckets.set(bucketIndex, {
                totalTime: curr.totalTime + (a.performance?.durationMinutes || 0),
                count: curr.count + 1,
                firstDate: curr.firstDate < d ? curr.firstDate : d
            });
        });

        const totalDays = selectedYears.length * 366; // Approximation for max buckets
        const maxBuckets = Math.ceil(totalDays / intervalDays);
        const result = Array.from({ length: maxBuckets }, (_, i) => {
            const data = buckets.get(i);
            if (!data || data.count === 0) return { bucket: i, avgDuration: 0, date: null };
            return {
                bucket: i,
                avgDuration: Math.round(data.totalTime / data.count),
                date: data.firstDate
            };
        }).filter(d => d.date !== null); // Filter out empty buckets for cleaner chart

        return result;
    }, [yearlyActivities, durationInterval, selectedYears]);

    // Strength Workouts for Volume Chart - Use direct source
    const strengthWorkoutsForChart = yearlyStrengthSessions;

    // 6. Heatmap Data (Calendar Grid) - Calculate for all selected years
    const yearlyGrids = useMemo(() => {
        const grids: Record<number, any[]> = {};

        selectedYears.forEach(year => {
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31);
            const days = [];
            let current = new Date(start);

            const activityMap = new Map();
            yearlyActivities.forEach((a: UniversalActivity) => {
                const d = new Date(a.date);
                if (d.getFullYear() !== year) return;
                const date = a.date.split('T')[0];
                const existing = activityMap.get(date) || 0;
                activityMap.set(date, existing + (a.performance?.durationMinutes || 0));
            });

            while (current <= end) {
                const iso = current.toISOString().split('T')[0];
                days.push({
                    date: iso,
                    minutes: activityMap.get(iso) || 0,
                    dayOfWeek: current.getDay()
                });
                current.setDate(current.getDate() + 1);
            }
            grids[year] = days;
        });
        return grids;
    }, [yearlyActivities, selectedYears]);

    // Computed Range for Charts
    const dateRange = useMemo(() => {
        if (selectedYears.length === 0) return undefined;
        const minYear = Math.min(...selectedYears);
        const maxYear = Math.max(...selectedYears);
        const now = new Date();
        const endYearDate = new Date(maxYear, 11, 31);

        // Cap at today if latest selected year is current year
        const end = (maxYear === now.getFullYear()) ? now : endYearDate;

        return {
            start: new Date(minYear, 0, 1),
            end
        };
    }, [selectedYears]);

    // Type Colors
    const COLORS = {
        running: '#10b981', // emerald-500
        cycling: '#06b6d4', // cyan-500
        strength: '#8b5cf6', // violet-500
        walking: '#f59e0b', // amber-500
        other: '#64748b'    // slate-500
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {formatYearRange(selectedYears)}
                    </h1>
                    <p className="text-slate-400 uppercase tracking-widest font-bold mt-2">Annual Performance Review</p>
                </div>

                <div className="flex gap-2 bg-slate-900 border border-white/10 rounded-lg p-1">
                    {[2023, 2024, 2025, 2026].map(y => (
                        <button
                            key={y}
                            onClick={() => toggleYear(y)}
                            className={`px-4 py-2 rounded-md font-bold text-sm transition-all ${selectedYears.includes(y)
                                ? 'bg-emerald-500 text-white shadow-lg'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                }`}
                        >
                            {selectedYears.includes(y) && <span className="mr-1">✓</span>}
                            {y}
                        </button>
                    ))}
                </div>
            </header>

            {/* HERO STATS */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">🏃</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Distans</p>
                    <p className="text-3xl font-black text-white">
                        {Math.round(stats.totalDist).toLocaleString()} <span className="text-lg text-emerald-400">km</span>
                    </p>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">⏱️</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Total Tid</p>
                    <p className="text-3xl font-black text-white">
                        {Math.round(stats.totalTime / 60).toLocaleString()} <span className="text-lg text-cyan-400">h</span>
                    </p>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">💪</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Muskelvolym</p>
                    <p className="text-3xl font-black text-white">
                        {Math.round(stats.totalTonnage / 1000).toLocaleString()} <span className="text-lg text-purple-400">ton</span>
                    </p>
                </div>

                {/* PR Split Card */}
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">🏆</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Satta PRs</p>
                    <div className="flex gap-4">
                        <div>
                            <p className="text-2xl font-black text-white">{stats.runningPRs}</p>
                            <p className="text-[10px] text-emerald-400 font-bold uppercase">Löpning</p>
                        </div>
                        <div className="w-[1px] bg-white/10"></div>
                        <div>
                            <p className="text-2xl font-black text-white">{stats.strengthPRs}</p>
                            <p className="text-[10px] text-purple-400 font-bold uppercase">Styrka</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl select-none">📊</div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Antal Pass</p>
                    <p className="text-3xl font-black text-white">
                        {stats.totalSessions} <span className="text-lg text-indigo-400">st</span>
                    </p>
                </div>
            </div>

            {/* GOALS SECTION */}
            {yearlyGoals.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-2xl font-black flex items-center gap-2">
                        <span>🎯</span> Måluppfyllelse
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {yearlyGoals.map(goal => {
                            const progress = calculateGoalProgress(goal, unifiedActivities);
                            const percent = Math.min(100, Math.round(progress.percentage));
                            const isCompleted = progress.isComplete;
                            const isFailed = !isCompleted && new Date(goal.endDate || '') < new Date() && goal.period !== 'daily' && goal.period !== 'weekly'; // Simple fail check

                            return (
                                <div key={goal.id} className={`p-4 rounded-2xl border ${isCompleted ? 'bg-emerald-900/20 border-emerald-500/30' : isFailed ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-900/50 border-white/5'
                                    }`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-3xl">{goal.icon || '🎯'}</div>
                                        {isCompleted ? (
                                            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">KLARAT</span>
                                        ) : isFailed ? (
                                            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full">MISSAT</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full">PÅGÅR</span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-sm mb-1 line-clamp-1" title={goal.name}>{goal.name}</h4>
                                    <p className="text-xs text-slate-400 mb-3">{goal.description || 'Ingen beskrivning'}</p>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold">
                                            <span>{Math.round(progress.current)} {goal.targets[0]?.unit}</span>
                                            <span className="text-slate-500">/ {progress.target}</span>
                                        </div>
                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-blue-500'}`}
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-right text-slate-500">{percent}%</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MAIN CHART SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Monthly Progress Chart */}
                <div className="lg:col-span-2 bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>📈</span> Årsutveckling & Volym
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="dist" stroke="#10b981" fontSize={12} tickLine={false} axisLine={false} unit="km" />
                                <YAxis yAxisId="time" orientation="right" stroke="#6366f1" fontSize={12} tickLine={false} axisLine={false} unit="h" />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    labelStyle={{ color: '#cbd5e1' }}
                                    formatter={(value: any, name: string) => {
                                        // If name is the dataKey, we might get 'dist' or 'time' potentially? 
                                        // But Recharts usually passes the `name` prop if present.
                                        // Let's rely on checking the user facing name.
                                        const isDist = name === 'Distans (km)';
                                        return [
                                            isDist ? `${Math.round(value)} km` : `${Math.round(value)} h`,
                                            isDist ? 'Distans' : 'Tid'
                                        ];
                                    }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar yAxisId="dist" name="Distans (km)" dataKey="dist" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar yAxisId="time" name="Tid (h)" dataKey={(d) => d.time / 60} fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Distribution */}
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center">
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2 w-full">
                        <span>🍰</span> Fördelning
                    </h3>
                    <div className="w-full h-64 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.types}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                >
                                    {stats.types.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name.toLowerCase()] || COLORS.other} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }}
                                    formatter={(val: number) => [`${val} pass`, '']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Text */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-3xl font-black text-white">{Math.round(stats.totalTime / 60)}</span>
                            <span className="block text-[10px] text-slate-500 uppercase tracking-widest">Timmar</span>
                        </div>
                    </div>
                    <div className="w-full space-y-2 mt-4">
                        {stats.types.sort((a, b) => b.count - a.count).slice(0, 4).map(t => (
                            <div key={t.name} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (COLORS as any)[t.name.toLowerCase()] || COLORS.other }}></div>
                                    <span className="capitalize text-slate-300">{t.name}</span>
                                </div>
                                <span className="font-bold text-slate-400">{t.count} ({Math.round(t.count / stats.totalSessions * 100)}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* NEW: Weekly Volume Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Strength Volume */}
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>💪</span> Volym per vecka (Styrka)
                    </h3>
                    <div className="w-full">
                        <WeeklyVolumeChart workouts={strengthWorkoutsForChart} fixedDateRange={dateRange} />
                    </div>
                </div>

                {/* Running Distance */}
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>🏃</span> Distans per vecka (Löpning)
                    </h3>
                    <div className="w-full">
                        <WeeklyDistanceChart activities={yearlyActivities} fixedDateRange={dateRange} />
                    </div>
                </div>
            </div>

            {/* Running Deep Dive: Weekly Pace & Session Length */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span>⚡</span> Snitthastighet (Löpning)
                        </h3>
                        <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-white/5">
                            {(['1d', '1w', '2w', '1m', '3m'] as const).map(i => (
                                <button
                                    key={i}
                                    onClick={() => setPaceInterval(i)}
                                    className={`text-[9px] font-black uppercase px-2 py-1 rounded transition-all ${paceInterval === i ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={smoothedPaceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                                <XAxis
                                    dataKey="bucket"
                                    stroke="#64748b"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v, i) => {
                                        const d = smoothedPaceData[i]?.date;
                                        if (!d) return '';
                                        return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
                                    }}
                                />
                                <YAxis
                                    stroke="#10b981"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={['dataMin - 0.2', 'dataMax + 0.2']}
                                    reversed={true}
                                    tickFormatter={(val) => `${Math.floor(val)}:${Math.round((val % 1) * 60).toString().padStart(2, '0')}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    formatter={(val: number) => [formatPace(val * 60), 'Snittempo']}
                                    labelFormatter={(label, payload) => {
                                        const d = payload[0]?.payload?.date;
                                        return d ? d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }) : `Period ${Number(label) + 1}`;
                                    }}
                                />
                                <Line type="monotone" dataKey="pace" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <span>⏳</span> Genomsnittlig passlängd
                        </h3>
                        <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-white/5">
                            {(['1d', '1w', '2w', '1m', '3m'] as const).map(i => (
                                <button
                                    key={i}
                                    onClick={() => setDurationInterval(i)}
                                    className={`text-[9px] font-black uppercase px-2 py-1 rounded transition-all ${durationInterval === i ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={smoothedDurationData}>
                                <defs>
                                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" />
                                <XAxis
                                    dataKey="bucket"
                                    stroke="#64748b"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v, i) => {
                                        const d = smoothedDurationData[i]?.date;
                                        if (!d) return '';
                                        return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
                                    }}
                                />
                                <YAxis stroke="#6366f1" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                    formatter={(val: number) => [durationLabel(val), 'Snittlängd']}
                                    labelFormatter={(label, payload) => {
                                        const d = payload[0]?.payload?.date;
                                        return d ? d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }) : `Period ${Number(label) + 1}`;
                                    }}
                                />
                                <Area type="monotone" dataKey="avgDuration" stroke="#6366f1" fillOpacity={1} fill="url(#colorDuration)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* HIGHLIGHTS CARDS */}
            <div>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span>🏆</span> Årets Höjdpunkter
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {/* Longest Runs Top 3 */}
                    <div className="bg-slate-900/50 border border-emerald-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                        <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Längsta Löpningar</p>
                        <div className="space-y-4">
                            {stats.longestRuns.map((a, i) => (
                                <div
                                    key={i}
                                    className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : ''
                                        }`}
                                    onClick={() => setSelectedActivity(a)}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-black ${i === 0 ? 'text-3xl text-white' : 'text-lg text-slate-300'}`}>
                                            {a.performance?.distanceKm?.toFixed(1)} <span className="text-xs text-slate-500">km</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">{formatSwedishDate(a.date)}</span>
                                    </div>
                                    <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fastest Runs Top 3 */}
                    <div className="bg-slate-900/50 border border-cyan-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                        <p className="text-cyan-400 text-xs font-bold uppercase tracking-wider">Snabbaste Tempo</p>
                        <div className="space-y-4">
                            {stats.fastestRuns.map((a, i) => (
                                <div
                                    key={i}
                                    className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-cyan-500/10 p-4 rounded-2xl border border-cyan-500/20 shadow-lg shadow-cyan-500/5' : ''
                                        }`}
                                    onClick={() => setSelectedActivity(a)}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-black ${i === 0 ? 'text-3xl text-white' : 'text-lg text-slate-300'}`}>
                                            {formatPace((a.performance?.durationMinutes! * 60) / a.performance?.distanceKm!)} <span className="text-xs text-slate-500">min/km</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[120px]">
                                            {a.performance?.distanceKm?.toFixed(1)} km • {formatSwedishDate(a.date)}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Best Lifts Top 3 */}
                    <div className="bg-slate-900/50 border border-purple-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                        <p className="text-purple-400 text-xs font-bold uppercase tracking-wider">Tyngsta Lyft</p>
                        <div className="space-y-4">
                            {stats.topLifts.map((l, i) => (
                                <div
                                    key={i}
                                    className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-purple-500/10 p-4 rounded-2xl border border-purple-500/20 shadow-lg shadow-purple-500/5' : ''
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-black truncate ${i === 0 ? 'text-xl text-white' : 'text-base text-slate-300'} max-w-[140px]`} title={l.exercise}>{l.exercise}</span>
                                        <span className={`font-black ${i === 0 ? 'text-3xl text-white' : 'text-lg text-slate-400'}`}>
                                            {l.weight} <span className="text-xs text-slate-500">kg</span>
                                        </span>
                                        <span className="text-[10px] text-slate-600 font-bold uppercase">{formatSwedishDate(l.date)}</span>
                                    </div>
                                    <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-purple-500/20 text-purple-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Heaviest Sessions Top 3 */}
                    <div className="bg-slate-900/50 border border-fuchsia-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                        <p className="text-fuchsia-400 text-xs font-bold uppercase tracking-wider">Största Volympass</p>
                        <div className="space-y-4">
                            {stats.topVolumeSessions.map((s, i) => (
                                <div
                                    key={i}
                                    className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-fuchsia-500/10 p-4 rounded-2xl border border-fuchsia-500/20 shadow-lg shadow-fuchsia-500/5' : ''
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-black ${i === 0 ? 'text-3xl text-white' : 'text-lg text-slate-300'}`}>
                                            {(s.totalVolume! / 1000).toFixed(1)} <span className="text-xs text-slate-500">ton</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase">{formatSwedishDate(s.date)}</span>
                                    </div>
                                    <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Performance Scores Top 3 */}
                    <div className="bg-slate-900/50 border border-indigo-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                        <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider">Bästa Prestationer</p>
                        <div className="space-y-4">
                            {stats.maxScores.map((ms, i) => (
                                <div
                                    key={i}
                                    className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5' : ''
                                        }`}
                                    onClick={() => setSelectedActivity(ms.activity)}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-black ${i === 0 ? 'text-3xl text-white' : 'text-lg text-slate-300'}`}>
                                            {Math.round(ms.score)} <span className="text-xs text-slate-500">p</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px]">
                                            {ms.activity.performance?.activityType} • {formatSwedishDate(ms.activity.date)}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* HEATMAP / CONTRIBUTION GRID */}
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-end mb-2 gap-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>🗓️</span> Aktivitetshistorik
                    </h3>
                    <div className="flex gap-4 text-sm text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>🔥</span> <span>Uppehåll: <span className="text-white font-bold">{stats.longestGap} dagar</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>📅</span> <span>Aktiva dagar: <span className="text-white font-bold">{stats.activeDays}</span></span>
                        </div>
                    </div>
                </div>

                {[...selectedYears].sort((a, b) => b - a).map(year => (
                    <div key={year} className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{year} Activity Map</span>
                            <span className="text-[10px] text-slate-600 font-bold uppercase">{yearlyGrids[year]?.filter((d: any) => d.minutes > 0)?.length || 0} aktiva dagar</span>
                        </div>
                        <div className="flex gap-[3px] overflow-x-auto pb-2">
                            {Array.from({ length: 53 }).map((_, weekIndex) => (
                                <div key={weekIndex} className="flex flex-col gap-[3px]">
                                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                                        const dayData = yearlyGrids[year]?.[weekIndex * 7 + dayIndex];
                                        if (!dayData) return <div key={dayIndex} className="w-3 h-3 rounded-sm bg-transparent" />;

                                        const intensityClass =
                                            dayData.minutes === 0 ? 'bg-slate-800/50' :
                                                dayData.minutes < 30 ? 'bg-emerald-900' :
                                                    dayData.minutes < 60 ? 'bg-emerald-700' :
                                                        dayData.minutes < 90 ? 'bg-emerald-500' :
                                                            'bg-emerald-300';

                                        return (
                                            <div
                                                key={dayIndex}
                                                className={`w-3 h-3 rounded-sm ${intensityClass} hover:ring-2 hover:ring-white/50 transition-all cursor-pointer`}
                                                title={`${dayData.date}: ${dayData.minutes} min`}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal for viewing highlights */}
            {selectedActivity && (
                <ActivityDetailModal
                    activity={{ ...mapUniversalToLegacyEntry(selectedActivity)!, source: (selectedActivity as any).source || 'manual' }}
                    universalActivity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}
