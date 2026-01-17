import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { calculatePerformanceScore } from '../utils/performanceEngine.ts';
import { formatDuration, formatSwedishDate, formatPace, getRelativeTime } from '../utils/dateUtils.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
import { Dumbbell, Loader2 } from 'lucide-react';
import { WeeklyVolumeChart } from '../components/training/WeeklyVolumeChart.tsx';
import { WeeklyDistanceChart } from '../components/training/WeeklyDistanceChart.tsx';
import { PersonalBest } from '../models/strengthTypes.ts';
import { calculateGoalProgress } from '../utils/goalCalculations.ts';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { EXERCISE_TYPES } from '../components/training/ExerciseModal.tsx';
import type { UniversalActivity } from '../models/types.ts';


function formatYearRange(years: number[]) {
    if (years.length === 0) return '';
    if (years.length === 1) return years[0].toString();

    const sorted = [...years].sort((a, b) => a - b);

    // Group consecutive years into ranges
    const ranges: { start: number; end: number }[] = [];
    let currentRange = { start: sorted[0], end: sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === currentRange.end + 1) {
            // Consecutive year, extend current range
            currentRange.end = sorted[i];
        } else {
            // Gap found, save current range and start new one
            ranges.push(currentRange);
            currentRange = { start: sorted[i], end: sorted[i] };
        }
    }
    ranges.push(currentRange); // Don't forget the last range

    // Format each range
    return ranges.map(r =>
        r.start === r.end
            ? r.start.toString()
            : `${r.start}-${r.end}`
    ).join(', ');
}

export function YearInReviewPage() {
    const { universalActivities = [], strengthSessions = [], performanceGoals = [], unifiedActivities = [], isLoading } = useData();
    const { token } = useAuth();

    // ... hooks ...

    if (isLoading && universalActivities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                <p className="animate-pulse">Hämtar din träningshistorik...</p>
            </div>
        );
    }
    const navigate = useNavigate();
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

    // State for activity detail modal
    const [selectedActivity, setSelectedActivity] = useState<UniversalActivity | null>(null);

    // Expand state for highlight cards (show 5, expand to show more)
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

    // Dynamically calculate available years from data
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        // Check unifiedActivities
        unifiedActivities.forEach(a => {
            const y = new Date(a.date).getFullYear();
            if (!isNaN(y)) years.add(y);
        });
        // Check strengthSessions too just in case
        strengthSessions.forEach(s => {
            const y = new Date(s.date).getFullYear();
            if (!isNaN(y)) years.add(y);
        });

        // Ensure current year is always available
        years.add(new Date().getFullYear());

        return Array.from(years).sort((a, b) => b - a);
    }, [unifiedActivities, strengthSessions]);

    const [selectedYears, setSelectedYears] = useState<number[]>(() => {
        const yearsParam = searchParams.get('years');
        if (yearsParam) {
            // Support both comma (legacy) and underscore (new)
            return yearsParam.split(/[_,]/).map(Number).filter(n => !isNaN(n));
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
        // Default to current year only
        return [new Date().getFullYear()];
    });

    // Sync to URL & LocalStorage
    useEffect(() => {
        if (selectedYears.length > 0) {
            setSearchParams({ years: selectedYears.join('_') }, { replace: true });
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

    // Compute activities in legacy format for goal calculations
    const legacyActivities = useMemo(() => {
        return unifiedActivities
            .map(u => {
                // Manual safe cast or mapper adjustment
                const entry = mapUniversalToLegacyEntry(u as any);
                if (!entry) return null;
                // Add missing source if needed by ExerciseEntry & source
                return { ...entry, source: u.source };
            })
            .filter((a): a is import('../models/types').ExerciseEntry & { source: string } => a !== null);
    }, [unifiedActivities]);

    // Data for goal calculations
    const { weightEntries = [], mealEntries = [], foodItems = [], recipes = [] } = useData();

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
            const score = calculatePerformanceScore({ ...a, durationMinutes: time, distance: dist, type: a.performance?.activityType } as any, []);
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

        // Highlights - Top runs split by training vs race
        // Include running, trail, hiking, and virtual runs
        const runningTypes = ['running', 'trail', 'trailrunning', 'trail running', 'trail_running', 'hiking', 'virtualrun', 'run'];
        const allRuns = [...yearlyActivities]
            .filter((a: UniversalActivity) => {
                const type = (a.performance?.activityType || '').toLowerCase();
                return runningTypes.some(rt => type.includes(rt) || rt.includes(type));
            })
            .sort((a: UniversalActivity, b: UniversalActivity) => (b.performance?.distanceKm || 0) - (a.performance?.distanceKm || 0));

        const longestRaces = allRuns
            .filter((a: UniversalActivity) => a.performance?.subType === 'race')
            .slice(0, 10);

        const longestTrainingRuns = allRuns
            .filter((a: UniversalActivity) => a.performance?.subType !== 'race')
            .slice(0, 10);

        const fastestRuns = [...yearlyActivities]
            .filter((a: UniversalActivity) => a.performance?.activityType === 'running' && (a.performance?.distanceKm || 0) > 5)
            .sort((a: UniversalActivity, b: UniversalActivity) => {
                const paceA = (a.performance?.durationMinutes || 0) / (a.performance?.distanceKm || 1);
                const paceB = (b.performance?.durationMinutes || 0) / (b.performance?.distanceKm || 1);
                return paceA - paceB;
            })
            .slice(0, 10);

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
            .slice(0, 10);

        // Best Lifts (Top 10) - Group by session + exercise, count sets AT max weight only
        const liftMap = new Map<string, { weight: number, reps: number, distance?: number, exercise: string, date: string, id: string, setsAtMaxWeight: number, isPB?: boolean }>();
        yearlyStrengthSessions.forEach(s => {
            s.exercises.forEach(e => {
                const key = `${s.id}_${e.exerciseName}`;
                let maxWeight = 0;
                // First pass: find max weight
                e.sets.forEach(set => {
                    const weight = set.weight || 0;
                    if (weight > maxWeight) maxWeight = weight;
                });
                // Second pass: count sets at max weight and find max reps/dist
                let setsAtMaxWeight = 0;
                let maxRepsAtMaxWeight = 0;
                let maxDistanceAtMaxWeight = 0;
                e.sets.forEach(set => {
                    if ((set.weight || 0) === maxWeight && maxWeight > 0) {
                        setsAtMaxWeight++;
                        if ((set.reps || 0) > maxRepsAtMaxWeight) maxRepsAtMaxWeight = set.reps || 0;
                        if ((set.distance || 0) > maxDistanceAtMaxWeight) maxDistanceAtMaxWeight = set.distance || 0;
                    }
                });
                if (maxWeight > 0) {
                    const existing = liftMap.get(key);
                    if (!existing || maxWeight > existing.weight) {
                        const isPB = strengthPBs.some(pb =>
                            pb.workoutId === s.id &&
                            pb.exerciseName === e.exerciseName &&
                            (pb.type === '1rm' || pb.type === 'reps' || pb.type === '3rm' || pb.type === '5rm' || pb.type === '10rm')
                        );

                        liftMap.set(key, {
                            weight: maxWeight,
                            reps: maxRepsAtMaxWeight,
                            distance: maxDistanceAtMaxWeight > 0 ? maxDistanceAtMaxWeight : undefined,
                            exercise: e.exerciseName,
                            date: s.date,
                            id: s.id,
                            setsAtMaxWeight,
                            isPB
                        });
                    }
                }
            });
        });
        const topLifts = Array.from(liftMap.values()).sort((a, b) => b.weight - a.weight).slice(0, 10);

        // Biggest Training Day - most hours on a single day (non-race activities only)
        const dayTotals = new Map<string, { date: string, totalMinutes: number, activities: Array<{ type: string, minutes: number, id: string, name: string, distance?: number, time?: string | null }> }>();

        // Include all activities except races and walking
        yearlyActivities.forEach((a: UniversalActivity) => {
            if (a.performance?.subType === 'race') return; // Skip races
            const actType = (a.performance?.activityType || '').toLowerCase();
            if (actType === 'walking' || actType === 'walk') return; // Skip walking
            const date = a.date.split('T')[0];
            const minutes = a.performance?.durationMinutes || 0;
            const existing = dayTotals.get(date) || { date, totalMinutes: 0, activities: [] as any[] };
            existing.totalMinutes += minutes;

            // Extract time - try startTimeLocal first, then date string
            let timeStr = null;
            if (a.performance?.startTimeLocal?.includes('T')) {
                timeStr = a.performance.startTimeLocal.split('T')[1].substring(0, 5);
            } else if (a.date.includes('T')) {
                timeStr = a.date.split('T')[1].substring(0, 5);
            }

            existing.activities.push({
                type: a.performance?.activityType || 'other',
                minutes,
                id: a.id,
                name: a.plan?.title || a.performance?.notes || a.performance?.activityType || 'Aktivitet',
                distance: a.performance?.distanceKm || 0,
                time: timeStr
            });
            dayTotals.set(date, existing);
        });

        // Include strength sessions
        yearlyStrengthSessions.forEach(s => {
            const date = s.date.split('T')[0];
            const minutes = s.duration || 0;
            const existing = dayTotals.get(date) || { date, totalMinutes: 0, activities: [] as any[] };
            existing.totalMinutes += minutes;

            // Extract time - try startTime field or createdAt
            let timeStr = (s as any).startTime || null;
            if (!timeStr && s.createdAt?.includes('T')) {
                timeStr = s.createdAt.split('T')[1].substring(0, 5);
            }

            existing.activities.push({
                type: 'strength',
                minutes,
                id: s.id,
                name: s.name || 'Styrkepass',
                time: timeStr
            });
            dayTotals.set(date, existing);
        });

        const biggestTrainingDays = Array.from(dayTotals.values())
            .sort((a, b) => b.totalMinutes - a.totalMinutes)
            .slice(0, 14);

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
            longestRaces,
            longestTrainingRuns,
            fastestRuns,
            topVolumeSessions,
            topLifts,
            longestGap,
            totalTonnage,
            biggestTrainingDays
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

    // 7. Hourly Analysis Data (Time of Day)
    const hourlyData = useMemo(() => {
        // Create buckets 0-23
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: `${i.toString().padStart(2, '0')}:00`,
            frequency: 0,
            volume: 0, // Total duration in minutes
            tonnage: 0 // Strength volume in kg
        }));

        // "No Data" bucket (arbitrary index 24 for the chart)
        const noDataBucket = {
            hour: 100, // Special ID
            label: '?', // Label for X-Axis
            frequency: 0,
            volume: 0,
            tonnage: 0
        };

        // Process running/cardio activities
        yearlyActivities.forEach((a: UniversalActivity) => {
            // Check if we have a real time.
            const st = a.performance?.startTimeLocal;

            // STRICT CHECK: Must be ISO with time component AND not just midnight-default
            const hasExplicitTime = !!st &&
                st.length > 10 && // longer than "YYYY-MM-DD"
                !st.endsWith('T00:00:00.000Z') &&
                !st.endsWith('T00:00:00Z');

            if (hasExplicitTime) {
                const date = new Date(st!);
                const hour = date.getHours();
                if (hours[hour]) {
                    hours[hour].frequency += 1;
                    hours[hour].volume += (a.performance?.durationMinutes || 0);
                }
            } else {
                noDataBucket.frequency += 1;
                noDataBucket.volume += (a.performance?.durationMinutes || 0);
            }
        });

        // Process strength sessions
        yearlyStrengthSessions.forEach(s => {
            // Strength sessions usually lack time unless specifically set
            // Check if s.date has specific time
            // If it's just "YYYY-MM-DD" (len 10) or "YYYY-MM-DDT00:00:00..." it's a date-only entry
            const isDateOnly = s.date.length <= 10 || s.date.includes('T00:00:00');

            if (!isDateOnly) {
                const date = new Date(s.date);
                const hour = date.getHours();
                if (hours[hour]) {
                    hours[hour].frequency += 1;
                    hours[hour].tonnage += (s.totalVolume || 0);
                    hours[hour].volume += (s.duration || 0);
                }
            } else {
                noDataBucket.frequency += 1;
                noDataBucket.tonnage += (s.totalVolume || 0);
                noDataBucket.volume += (s.duration || 0);
            }
        });

        // Append NoData bucket at the end if it has data
        const result = [...hours];
        if (noDataBucket.frequency > 0) {
            result.push(noDataBucket);
        }

        return result;
    }, [yearlyActivities, yearlyStrengthSessions]);

    // Type Colors
    const COLORS = {
        running: '#10b981', // emerald-500
        cycling: '#06b6d4', // cyan-500
        strength: '#8b5cf6', // violet-500
        walking: '#f59e0b', // amber-500
        other: '#64748b'    // slate-500
    };

    const [selectedHour, setSelectedHour] = useState<number | null>(null);

    const getPeriodColor = (hour: number) => {
        // Natt: 23:30-04:00 (index 0-3, 23)
        // Morgon: 04:00-10:59 (index 4-10)
        // Lunch: 11:00-13:30 (index 11-13)
        // Eftermiddag: 13:30-17:00 (index 14-16)
        // Kväll: 17:00-23:30 (index 17-22)

        if (hour === 100) return '#64748b'; // Slate for unknown
        if (hour >= 23 || hour < 4) return '#475569'; // Night - Slate
        if (hour >= 4 && hour < 11) return '#d97706'; // Morning - Amber
        if (hour >= 11 && hour < 14) return '#10b981'; // Lunch - Emerald
        if (hour >= 14 && hour < 17) return '#06b6d4'; // Afternoon - Cyan
        if (hour >= 17 && hour < 23) return '#8b5cf6'; // Evening - Violet
        return '#64748b';
    };

    return (
        <>
            <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-12 animate-in fade-in duration-700">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-6">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            {formatYearRange(selectedYears)}
                        </h1>
                        <p className="text-slate-400 uppercase tracking-widest font-bold mt-2">Annual Performance Review</p>
                    </div>

                    <div className="flex gap-2 bg-slate-900 border border-white/10 rounded-lg p-1 overflow-x-auto max-w-full">
                        {availableYears.map(y => (
                            <button
                                key={y}
                                onClick={() => toggleYear(y)}
                                className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap ${selectedYears.includes(y)
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
                                const progress = calculateGoalProgress(
                                    goal,
                                    legacyActivities,
                                    mealEntries,
                                    foodItems,
                                    recipes,
                                    weightEntries
                                );
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
                                        label={{ fill: 'white', fontSize: 11, fontWeight: 'bold' }}
                                    >
                                        {stats.types.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name.toLowerCase()] || COLORS.other} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
                                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                        formatter={(val: number) => [`${val} pass`, '']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                                <span className="text-3xl font-black text-white">{Math.round(stats.totalTime / 60)}</span>
                                <span className="block text-[10px] text-white uppercase tracking-widest">Timmar</span>
                            </div>
                        </div>
                        <div className="w-full space-y-2 mt-4">
                            {stats.types.sort((a, b) => b.count - a.count).slice(0, 4).map(t => (
                                <div key={t.name} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (COLORS as any)[t.name.toLowerCase()] || COLORS.other }}></div>
                                        <span className="capitalize text-white font-medium">{t.name}</span>
                                    </div>
                                    <span className="font-bold text-white">{t.count} ({Math.round(t.count / stats.totalSessions * 100)}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* TIME OF DAY ANALYSIS - Full width section */}
                <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span>🕐</span> Träningstid på dygnet
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    stroke="#64748b"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={1}
                                />
                                <YAxis
                                    yAxisId="freq"
                                    stroke="#f59e0b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    label={{ value: 'Pass', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 10 }}
                                />
                                <YAxis
                                    yAxisId="vol"
                                    orientation="right"
                                    stroke="#06b6d4"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${Math.round(v / 60)}h`}
                                    label={{ value: 'Volym', angle: 90, position: 'insideRight', fill: '#06b6d4', fontSize: 10 }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                                    labelStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any, name: string) => {
                                        if (name === 'Frekvens') return [`${value} pass`, 'Antal pass'];
                                        // Convert minutes to hours + minutes
                                        const hours = Math.floor(value / 60);
                                        const mins = Math.round(value % 60);
                                        const formatted = hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
                                        return [formatted, 'Total tid'];
                                    }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar
                                    yAxisId="freq"
                                    name="Frekvens"
                                    dataKey="frequency"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={25}
                                    onClick={(data) => setSelectedHour(data.hour)}
                                    cursor="pointer"
                                >
                                    {hourlyData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={getPeriodColor(entry.hour)}
                                            stroke={selectedHour === entry.hour ? '#fff' : 'none'}
                                            strokeWidth={2}
                                            className="transition-all duration-300 hover:opacity-80"
                                        />
                                    ))}
                                </Bar>
                                <Bar
                                    yAxisId="vol"
                                    name="Total träningstid"
                                    dataKey="volume"
                                    fill="#06b6d4"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={25}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        {(() => {
                            const peak = hourlyData.reduce((max, h) => h.frequency > max.frequency ? h : max, hourlyData[0]);
                            // Morgon: 04:00-10:59 (index 4-10)
                            const totalMorning = hourlyData.slice(4, 11).reduce((sum, h) => sum + h.frequency, 0);
                            // Lunch: 11:00-13:30 (index 11-13, partial 14)
                            const totalLunch = hourlyData.slice(11, 14).reduce((sum, h) => sum + h.frequency, 0);
                            // Eftermiddag: 13:30-17:00 (index 14-16, partial 13)
                            const totalAfternoon = hourlyData.slice(14, 17).reduce((sum, h) => sum + h.frequency, 0);
                            // Kväll: 17:00-23:30 (index 17-23)
                            const totalEvening = hourlyData.slice(17, 24).reduce((sum, h) => sum + h.frequency, 0);
                            // Natt: 23:30-04:00 (index 0-3)
                            const totalNight = hourlyData.slice(0, 4).reduce((sum, h) => sum + h.frequency, 0);
                            return (
                                <>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Peak-tid</p>
                                        <p className="text-lg font-black text-amber-400">{peak?.label || '-'}</p>
                                        <p className="text-[10px] text-slate-400">{peak?.frequency || 0} pass</p>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Morgon (04-10)</p>
                                        <div className="flex items-baseline justify-center gap-1">
                                            <p className="text-lg font-black text-amber-400">{totalMorning}</p>
                                            <span className="text-xs text-slate-500">pass</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Lunch (11-13)</p>
                                        <div className="flex items-baseline justify-center gap-1">
                                            <p className="text-lg font-black text-emerald-400">{totalLunch}</p>
                                            <span className="text-xs text-slate-500">pass</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Em (14-16)</p>
                                        <div className="flex items-baseline justify-center gap-1">
                                            <p className="text-lg font-black text-cyan-400">{totalAfternoon}</p>
                                            <span className="text-xs text-slate-500">pass</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Kväll (17-23)</p>
                                        <div className="flex items-baseline justify-center gap-1">
                                            <p className="text-lg font-black text-violet-400">{totalEvening}</p>
                                            <span className="text-xs text-slate-500">pass</span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {selectedHour !== null && (
                        <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getPeriodColor(selectedHour) }}></span>
                                Aktiviteter kl {selectedHour.toString().padStart(2, '0')}:00 - {(selectedHour + 1).toString().padStart(2, '0')}:00
                                <div className="ml-auto">
                                    <button
                                        onClick={() => setSelectedHour(null)}
                                        className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-white/5"
                                    >
                                        Stäng detaljer
                                    </button>
                                </div>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {unifiedActivities
                                    .map(a => {
                                        // Resolve the "real" activity if it's nested
                                        const resolved = (a as any)._mergeData?.universalActivity || a;
                                        return { original: a, resolved };
                                    })
                                    .filter(({ resolved }) => {
                                        // Include currently selected years
                                        const y = new Date(resolved.date).getFullYear();
                                        if (!selectedYears.includes(y)) return false;

                                        // Check hour matching the chart logic
                                        const hasExplicitTime = !!resolved.performance?.startTimeLocal &&
                                            !resolved.performance.startTimeLocal.endsWith('T00:00:00.000Z') &&
                                            !resolved.performance.startTimeLocal.endsWith('T00:00:00Z');

                                        const d = new Date(resolved.performance?.startTimeLocal || resolved.date);
                                        const isMidnight = d.getHours() === 0 && d.getMinutes() === 0;

                                        if (selectedHour === 100) {
                                            // Show items that fall into "No Data" bucket
                                            // These are items without explicit time AND that default to midnight
                                            return !hasExplicitTime && isMidnight;
                                        } else {
                                            // Show items for specific hour
                                            // If it has explicit time, match hour
                                            // If it doesn't - it falls into No Data so exclude it here
                                            if (!hasExplicitTime && isMidnight) return false;
                                            return d.getHours() === selectedHour;
                                        }
                                    })
                                    .sort((a, b) => new Date(b.resolved.date).getTime() - new Date(a.resolved.date).getTime())
                                    .map(({ original: a, resolved }) => (
                                        <div
                                            key={resolved.id}
                                            onClick={() => setSelectedActivity(a)}
                                            className="bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex flex-col overflow-hidden">
                                                <div className="flex items-center gap-2">
                                                    {(resolved as any).source === 'strava' || (resolved.performance?.source?.source === 'strava') && (
                                                        <span className="text-[10px] bg-[#FC4C02]/20 text-[#FC4C02] px-1 rounded font-bold">Strava</span>
                                                    )}
                                                    {(resolved as any).source === 'garmin' && (
                                                        <span className="text-[10px] bg-[#000000]/20 text-[#555] px-1 rounded font-bold bg-white/10">Garmin</span>
                                                    )}
                                                    {(resolved as any).type === 'planned' && (
                                                        <span className="text-[10px] bg-slate-700 text-slate-300 px-1 rounded font-bold">Planned</span>
                                                    )}
                                                    <span className="text-xs font-bold text-slate-300 truncate group-hover:text-white transition-colors">
                                                        {
                                                            // Priority: Explicit Title -> Strava Name -> Plan Title -> Activity Type -> Generic
                                                            (resolved as any).title ||
                                                            (resolved as any).performance?.title ||
                                                            (resolved as any).strava?.name ||
                                                            resolved.plan?.title ||
                                                            ((resolved as any).performance?.activityType === 'strength' ? 'Styrkepass' :
                                                                (resolved as any).performance?.activityType === 'running' ? 'Löppass' :
                                                                    (resolved as any).performance?.activityType ? (resolved as any).performance.activityType.charAt(0).toUpperCase() + (resolved as any).performance.activityType.slice(1) :
                                                                        'Aktivitet')
                                                        }
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                                                    <span>{formatSwedishDate(resolved.date)}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {new Date(resolved.performance?.startTimeLocal || resolved.date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                {resolved.performance?.distanceKm ? (
                                                    <span className="text-sm font-black text-white">
                                                        {resolved.performance.distanceKm.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">km</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-black text-white">
                                                        {resolved.performance?.durationMinutes || (resolved as any).durationMinutes || 0} <span className="text-[10px] text-slate-500 font-normal">min</span>
                                                    </span>
                                                )}
                                                {resolved.performance?.activityType && (
                                                    <span className="text-[9px] uppercase font-bold text-slate-600 bg-slate-900/50 px-1.5 py-0.5 rounded border border-white/5">
                                                        {resolved.performance.activityType}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

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
                        {/* Running Distance - Toggle between Weekly (1 year) and Monthly (>1 year) */}
                        <div className="bg-slate-900/30 border border-white/5 p-6 rounded-3xl">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <span>🏃</span> {selectedYears.length > 1 ? 'Distans per månad (Löpning)' : 'Distans per vecka (Löpning)'}
                            </h3>
                            <div className="w-full h-80">
                                {selectedYears.length > 1 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={(() => {
                                            // Compute Monthly Data on the fly
                                            const buckets = new Map<string, number>();
                                            // Initialize range to ensure continuous timeline logic could go here, 
                                            // but sparse is fine for bar chart usually.

                                            // Sort activities first to ensure order?
                                            // actually mapping to YYYY-MM handles sorting by string 
                                            yearlyActivities.filter(a => a.performance?.activityType === 'running').forEach(a => {
                                                const d = new Date(a.date);
                                                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                buckets.set(key, (buckets.get(key) || 0) + (a.performance?.distanceKm || 0));
                                            });

                                            return Array.from(buckets.entries())
                                                .sort((a, b) => a[0].localeCompare(b[0]))
                                                .map(([date, dist]) => ({ date, dist }));
                                        })()}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(val) => val.substring(2)} // YY-MM
                                                minTickGap={30}
                                            />
                                            <YAxis stroke="#10b981" fontSize={12} tickLine={false} axisLine={false} unit="km" />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                                labelStyle={{ color: '#cbd5e1' }}
                                                formatter={(value: number) => [`${Math.round(value)} km`, 'Distans']}
                                                labelFormatter={(label) => label}
                                            />
                                            <Bar dataKey="dist" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <WeeklyDistanceChart activities={yearlyActivities} fixedDateRange={dateRange} />
                                )}
                            </div>
                        </div>
                    </div >

                    {/* Running Deep Dive: Weekly Pace & Session Length */}
                    < div className="grid grid-cols-1 lg:grid-cols-2 gap-8" >
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
                    </div >

                    {/* HIGHLIGHTS CARDS */}
                    < div >
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span>🏆</span> Periodens Höjdpunkter
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Longest Races */}
                            {stats.longestRaces.length > 0 && (
                                <div className="bg-slate-900/50 border border-rose-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                                    <p className="text-rose-400 text-sm font-bold uppercase tracking-widest text-center mb-2">-- Längsta Tävlingar --</p>
                                    <div className="space-y-3">
                                        {stats.longestRaces.slice(0, expandedCards['races'] ? 10 : 5).map((a: UniversalActivity, i: number) => (
                                            <div
                                                key={i}
                                                className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20 shadow-lg shadow-rose-500/5' : 'py-1'}`}
                                                onClick={() => setSelectedActivity(a)}
                                            >
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        {(() => {
                                                            const type = a.performance?.activityType || 'other';
                                                            const typeInfo = EXERCISE_TYPES.find(t => t.type === type) || EXERCISE_TYPES.find(t => t.type === 'other');
                                                            return (
                                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-white/5 tracking-tighter shrink-0 flex items-center gap-1">
                                                                    <span>{typeInfo?.icon}</span>
                                                                    {typeInfo?.label}
                                                                </span>
                                                            );
                                                        })()}
                                                        <span className={`font-bold truncate ${i === 0 ? 'text-sm text-rose-300' : 'text-xs text-slate-400'}`} title={a.plan?.title || a.performance?.notes || 'Tävling'}>
                                                            {a.plan?.title || a.performance?.notes || 'Tävling'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-baseline gap-2 mt-0.5">
                                                        <span className={`font-black ${i === 0 ? 'text-2xl text-white' : 'text-base text-slate-300'}`}>
                                                            {a.performance?.distanceKm?.toFixed(1)} <span className="text-xs text-slate-500">km</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase">• {formatSwedishDate(a.date)}</span>
                                                        {a.performance?.durationMinutes && a.performance?.distanceKm && (
                                                            <span className="text-[10px] text-rose-400 font-bold">
                                                                • {formatPace((a.performance.durationMinutes * 60) / a.performance.distanceKm).replace('/km', '')} min/km
                                                            </span>
                                                        )}
                                                        {new Date(a.date).getFullYear() === new Date().getFullYear() && (
                                                            <span className="ml-1 text-[10px] text-rose-300 animate-pulse bg-rose-500/10 px-1 rounded border border-rose-500/20">✨ I år</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-rose-500/20 text-rose-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {stats.longestRaces.length > 5 && (
                                        <button
                                            onClick={() => setExpandedCards(prev => ({ ...prev, races: !prev['races'] }))}
                                            className="text-xs text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1 justify-center transition-colors"
                                        >
                                            {expandedCards['races'] ? '▲ Visa mindre' : `▼ Visa ${stats.longestRaces.length - 5} till`}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Longest Training Runs */}
                            <div className="bg-slate-900/50 border border-emerald-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                                <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest text-center mb-2">-- Längsta Träningspass --</p>
                                <div className="space-y-3">
                                    {stats.longestTrainingRuns.slice(0, expandedCards['training'] ? 10 : 5).map((a: UniversalActivity, i: number) => (
                                        <div
                                            key={i}
                                            className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'py-1'}`}
                                            onClick={() => setSelectedActivity(a)}
                                        >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {(() => {
                                                        const type = a.performance?.activityType || 'other';
                                                        const typeInfo = EXERCISE_TYPES.find(t => t.type === type) || EXERCISE_TYPES.find(t => t.type === 'other');
                                                        return (
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-white/5 tracking-tighter shrink-0 flex items-center gap-1">
                                                                <span>{typeInfo?.icon}</span>
                                                                {typeInfo?.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className={`font-bold truncate ${i === 0 ? 'text-sm text-emerald-300' : 'text-xs text-slate-400'}`} title={a.plan?.title || a.performance?.notes || a.performance?.activityType || 'Löpning'}>
                                                        {a.plan?.title || a.performance?.notes || a.performance?.activityType || 'Löpning'}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-2 mt-0.5">
                                                    <span className={`font-black ${i === 0 ? 'text-2xl text-white' : 'text-base text-slate-300'}`}>
                                                        {a.performance?.distanceKm?.toFixed(1)} <span className="text-xs text-slate-500">km</span>
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">• {formatSwedishDate(a.date)}</span>
                                                    {a.performance?.durationMinutes && a.performance?.distanceKm && (
                                                        <span className="text-[10px] text-emerald-400 font-bold">
                                                            • {formatPace((a.performance.durationMinutes * 60) / a.performance.distanceKm).replace('/km', '')} min/km
                                                        </span>
                                                    )}
                                                    {new Date(a.date).getFullYear() === new Date().getFullYear() && (
                                                        <span className="ml-1 text-[10px] text-emerald-300 animate-pulse bg-emerald-500/10 px-1 rounded border border-emerald-500/20">✨ I år</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                                {stats.longestTrainingRuns.length > 5 && (
                                    <button
                                        onClick={() => setExpandedCards(prev => ({ ...prev, training: !prev['training'] }))}
                                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1 justify-center transition-colors"
                                    >
                                        {expandedCards['training'] ? '▲ Visa mindre' : `▼ Visa ${Math.min(5, stats.longestTrainingRuns.length - 5)} till`}
                                    </button>
                                )}
                            </div>

                            {/* Fastest Runs */}
                            <div className="bg-slate-900/50 border border-cyan-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                                <p className="text-cyan-400 text-sm font-bold uppercase tracking-widest text-center mb-2">-- Snabbaste Tempo --</p>
                                <div className="space-y-3">
                                    {stats.fastestRuns.slice(0, expandedCards['fastest'] ? 10 : 5).map((a, i) => (
                                        <div
                                            key={i}
                                            className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/20 shadow-lg shadow-cyan-500/5' : 'py-1'}`}
                                            onClick={() => setSelectedActivity(a)}
                                        >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {(() => {
                                                        const type = a.performance?.activityType || 'other';
                                                        const typeInfo = EXERCISE_TYPES.find(t => t.type === type) || EXERCISE_TYPES.find(t => t.type === 'other');
                                                        return (
                                                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded border border-white/5 tracking-tighter shrink-0 flex items-center gap-1">
                                                                <span>{typeInfo?.icon}</span>
                                                                {typeInfo?.label}
                                                            </span>
                                                        );
                                                    })()}
                                                    <span className={`font-bold truncate ${i === 0 ? 'text-sm text-cyan-300' : 'text-xs text-slate-400'}`} title={a.plan?.title || a.performance?.notes || a.performance?.activityType || 'Löpning'}>
                                                        {a.plan?.title || a.performance?.notes || a.performance?.activityType || 'Löpning'}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-2 mt-0.5">
                                                    <span className={`font-black ${i === 0 ? 'text-2xl text-white' : 'text-base text-slate-300'}`}>
                                                        {formatPace((a.performance?.durationMinutes! * 60) / a.performance?.distanceKm!).replace('/km', '')} <span className="text-xs text-slate-500">min/km</span>
                                                    </span>
                                                    <span className={`text-[10px] font-bold ${i === 0 ? 'text-cyan-300' : 'text-cyan-400'}`}>
                                                        • {a.performance?.distanceKm?.toFixed(1)} km
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">• {formatSwedishDate(a.date)}</span>
                                                    {new Date(a.date).getFullYear() === new Date().getFullYear() && (
                                                        <span className="ml-1 text-[10px] text-cyan-300 animate-pulse bg-cyan-500/10 px-1 rounded border border-cyan-500/20">✨ I år</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                                {stats.fastestRuns.length > 5 && (
                                    <button
                                        onClick={() => setExpandedCards(prev => ({ ...prev, fastest: !prev['fastest'] }))}
                                        className="text-xs text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1 justify-center transition-colors"
                                    >
                                        {expandedCards['fastest'] ? '▲ Visa mindre' : `▼ Visa ${Math.min(5, stats.fastestRuns.length - 5)} till`}
                                    </button>
                                )}
                            </div>

                            {/* Best Lifts */}
                            <div className="bg-slate-900/50 border border-purple-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                                <p className="text-purple-400 text-sm font-bold uppercase tracking-widest text-center mb-2">-- Tyngsta Lyft --</p>
                                <div className="space-y-3">
                                    {stats.topLifts.slice(0, expandedCards['lifts'] ? 10 : 5).map((l, i) => (
                                        <div
                                            key={i}
                                            className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-purple-500/10 p-3 rounded-2xl border border-purple-500/20 shadow-lg shadow-purple-500/5' : 'py-1'}`}
                                            onClick={() => {
                                                const session = yearlyStrengthSessions.find(s => s.id === l.id);
                                                if (session) setSelectedActivity(session as any as UniversalActivity);
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <span className={`font-black truncate ${i === 0 ? 'text-lg text-white' : 'text-sm text-slate-300'} max-w-[120px]`} title={l.exercise}>{l.exercise}</span>
                                                <span className={`font-black ${i === 0 ? 'text-2xl text-white' : 'text-base text-slate-400'}`}>
                                                    {l.weight} <span className="text-xs text-slate-500">kg</span>
                                                    <span className="text-xs text-purple-400 ml-1">
                                                        × {l.distance && (l.reps <= 1) ? `${l.distance}m` : l.reps}
                                                        {l.setsAtMaxWeight > 1 && ` [${l.setsAtMaxWeight} set]`}
                                                    </span>
                                                    {l.isPB && <span className="ml-2 text-[10px] bg-amber-500 text-slate-900 px-1 rounded font-black align-middle shadow-sm shadow-amber-500/50">🏆 PB</span>}
                                                </span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px] text-slate-600 font-bold uppercase">{formatSwedishDate(l.date)}</span>
                                                    <span className="text-[10px] text-slate-400/60 font-medium italic truncate">({getRelativeTime(l.date)})</span>
                                                    {new Date(l.date).getFullYear() === new Date().getFullYear() && (
                                                        <span className="text-[10px] text-purple-300 animate-pulse">✨ I år</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-purple-500/20 text-purple-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                                {stats.topLifts.length > 5 && (
                                    <button
                                        onClick={() => setExpandedCards(prev => ({ ...prev, lifts: !prev['lifts'] }))}
                                        className="text-xs text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1 justify-center transition-colors"
                                    >
                                        {expandedCards['lifts'] ? '▲ Visa mindre' : `▼ Visa ${Math.min(5, stats.topLifts.length - 5)} till`}
                                    </button>
                                )}
                            </div>

                            {/* Volume Sessions */}
                            <div className="bg-slate-900/50 border border-fuchsia-500/10 rounded-3xl p-6 flex flex-col space-y-4">
                                <p className="text-fuchsia-400 text-sm font-bold uppercase tracking-widest text-center mb-2">-- Största Volympass --</p>
                                <div className="space-y-3">
                                    {stats.topVolumeSessions.slice(0, expandedCards['volume'] ? 10 : 5).map((s, i) => (
                                        <div
                                            key={i}
                                            className={`cursor-pointer group flex items-center justify-between transition-all hover:scale-[1.02] ${i === 0 ? 'bg-fuchsia-500/10 p-3 rounded-2xl border border-fuchsia-500/20 shadow-lg shadow-fuchsia-500/5' : 'py-1'}`}
                                            onClick={() => setSelectedActivity(s as any as UniversalActivity)}
                                        >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className={`font-black ${i === 0 ? 'text-2xl text-white' : 'text-base text-slate-300'}`}>
                                                    {(s.totalVolume! / 1000).toFixed(1)} <span className="text-xs text-slate-500">ton</span>
                                                </span>
                                                <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                                    {s.exercises.slice(0, 3).map((e, idx) => (
                                                        <span key={idx} className="text-[9px] px-1 bg-slate-800 text-slate-400 rounded border border-white/5 truncate max-w-[80px]">
                                                            {e.exerciseName}
                                                        </span>
                                                    ))}
                                                    {s.exercises.length > 3 && <span className="text-[9px] text-slate-600">+{s.exercises.length - 3} till</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">{formatSwedishDate(s.date)}</span>
                                                    <span className="text-[10px] text-slate-400/60 font-medium italic">({getRelativeTime(s.date)})</span>
                                                    {new Date(s.date).getFullYear() === new Date().getFullYear() && (
                                                        <span className="text-[10px] text-fuchsia-300 animate-pulse">✨ I år</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-black p-2 rounded-full ${i === 0 ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-600'}`}>#{i + 1}</span>
                                        </div>
                                    ))}
                                </div>
                                {stats.topVolumeSessions.length > 5 && (
                                    <button
                                        onClick={() => setExpandedCards(prev => ({ ...prev, volume: !prev['volume'] }))}
                                        className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-bold uppercase tracking-wider flex items-center gap-1 justify-center transition-colors"
                                    >
                                        {expandedCards['volume'] ? '▲ Visa mindre' : `▼ Visa ${Math.min(5, stats.topVolumeSessions.length - 5)} till`}
                                    </button>
                                )}
                            </div>

                        </div>

                    </div>

                    {/* Biggest Training Days - Full Width */}
                    {stats.biggestTrainingDays.length > 0 && (() => {
                        // Calculate totals for the displayed days
                        const displayedDays = stats.biggestTrainingDays.slice(0, expandedCards['days'] ? 15 : 6);
                        const totals = displayedDays.reduce((acc: { running: number, cycling: number, time: number }, day: any) => {
                            day.activities.forEach((act: any) => {
                                if (act.type === 'running') acc.running += act.distance || 0;
                                if (act.type === 'cycling') acc.cycling += act.distance || 0;
                                acc.time += act.minutes || 0;
                            });
                            return acc;
                        }, { running: 0, cycling: 0, time: 0 });

                        return (
                            <div className="mt-6 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-amber-950/20 border border-amber-500/20 rounded-2xl p-5 flex flex-col space-y-4 shadow-2xl shadow-amber-500/5">
                                {/* Elegant Centered Header */}
                                <div className="flex items-center justify-center gap-3">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/30 to-amber-500/50" />
                                    <h3 className="text-amber-400 text-lg font-black uppercase tracking-[0.25em] whitespace-nowrap flex items-center gap-2">
                                        <span className="text-xl">🏆</span>
                                        Största Träningsdagar
                                    </h3>
                                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-amber-500/30 to-amber-500/50" />
                                </div>

                                {/* Summary Stats */}
                                <div className="flex items-center justify-center gap-6 text-xs">
                                    {totals.running > 0 && (
                                        <div className="flex items-center gap-1.5 text-emerald-400">
                                            <span>🏃</span>
                                            <span className="font-black text-sm">{totals.running.toFixed(0)}km</span>
                                            <span className="text-emerald-500/60">löpning</span>
                                        </div>
                                    )}
                                    {totals.cycling > 0 && (
                                        <div className="flex items-center gap-1.5 text-cyan-400">
                                            <span>🚴</span>
                                            <span className="font-black text-sm">{totals.cycling.toFixed(0)}km</span>
                                            <span className="text-cyan-500/60">cykel</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-amber-400/80">
                                        <span>⏱️</span>
                                        <span className="font-black text-sm">{Math.floor(totals.time / 60)}h {Math.round(totals.time % 60)}m</span>
                                        <span className="text-amber-500/50">totalt</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {displayedDays.map((day: any, i: number) => {
                                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                                        const isTop3 = i < 3;
                                        const bgClass = i === 0
                                            ? 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border-amber-500/30 shadow-lg shadow-amber-500/10'
                                            : i === 1
                                                ? 'bg-gradient-to-br from-slate-400/15 via-slate-400/5 to-transparent border-slate-400/20'
                                                : i === 2
                                                    ? 'bg-gradient-to-br from-orange-700/15 via-orange-700/5 to-transparent border-orange-700/20'
                                                    : 'bg-slate-900/50 border-white/5';

                                        // Pass count label
                                        const passCount = day.activities.length;
                                        const passLabel = passCount === 1 ? 'singel' : passCount === 2 ? 'dubbel' : passCount === 3 ? 'trippel' : passCount === 4 ? 'quad' : passCount >= 5 ? 'multi' : null;

                                        // Day-specific totals
                                        const dayTotals = day.activities.reduce((acc: { running: number, cycling: number, time: number }, act: any) => {
                                            if (act.type === 'running') acc.running += act.distance || 0;
                                            if (act.type === 'cycling') acc.cycling += act.distance || 0;
                                            acc.time += act.minutes || 0;
                                            return acc;
                                        }, { running: 0, cycling: 0, time: 0 });

                                        return (
                                            <div
                                                key={day.date}
                                                className={`relative p-3 rounded-xl border transition-all hover:scale-[1.01] ${bgClass}`}
                                            >
                                                {/* Subtle pass count label */}
                                                {passLabel && passCount > 1 && (
                                                    <span className="absolute top-2 right-2 text-[8px] font-bold uppercase tracking-widest text-slate-600/60 rotate-0">
                                                        {passLabel}
                                                    </span>
                                                )}

                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            {medal && <span className="text-xl">{medal}</span>}
                                                            <div className="flex items-baseline gap-2">
                                                                <span className={`font-black ${isTop3 ? 'text-2xl text-white' : 'text-lg text-slate-300'}`}>
                                                                    {Math.floor(day.totalMinutes / 60)}h {Math.round(day.totalMinutes % 60)}m
                                                                </span>

                                                                {/* Inline Summary Stats */}
                                                                <div className="flex items-center gap-2 ml-2">
                                                                    {dayTotals.running > 0 && (
                                                                        <span className="text-[11px] font-black text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg shadow-sm shadow-emerald-500/5">
                                                                            <span className="text-[14px]">🏃</span> {dayTotals.running.toFixed(1)}
                                                                        </span>
                                                                    )}
                                                                    {dayTotals.cycling > 0 && (
                                                                        <span className="text-[11px] font-black text-cyan-400 flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-lg shadow-sm shadow-cyan-500/5">
                                                                            <span className="text-[14px]">🚴</span> {dayTotals.cycling.toFixed(1)}
                                                                        </span>
                                                                    )}
                                                                    {new Date(day.date).getFullYear() === new Date().getFullYear() && (
                                                                        <span className="text-[9px] font-black text-amber-400 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md animate-pulse">
                                                                            ✨ I ÅR
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isTop3 ? 'text-amber-400/70' : 'text-slate-500'}`}>
                                                            {formatSwedishDate(day.date)}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${isTop3 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-600'}`}>
                                                        #{i + 1}
                                                    </span>
                                                </div>

                                                <div className="space-y-0.5 border-t border-white/5 pt-2">
                                                    {day.activities.map((act: any, idx: number) => {
                                                        const hours = Math.floor(act.minutes / 60);
                                                        const mins = Math.round(act.minutes % 60);
                                                        const duration = hours > 0 ? `${hours}h${mins}m` : `${mins}m`;
                                                        const typeInfo = EXERCISE_TYPES.find(t => t.type === act.type) || EXERCISE_TYPES.find(t => t.type === 'other');
                                                        const colorMap: Record<string, { text: string, bg: string }> = {
                                                            running: { text: 'text-emerald-400', bg: 'bg-emerald-500/15' },
                                                            cycling: { text: 'text-cyan-400', bg: 'bg-cyan-500/15' },
                                                            strength: { text: 'text-purple-400', bg: 'bg-purple-500/15' },
                                                            walking: { text: 'text-amber-300', bg: 'bg-amber-500/15' },
                                                            swimming: { text: 'text-blue-400', bg: 'bg-blue-500/15' },
                                                            other: { text: 'text-slate-400', bg: 'bg-slate-500/15' }
                                                        };
                                                        const colors = colorMap[act.type] || colorMap.other;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                onClick={() => {
                                                                    const fullAct = unifiedActivities.find(u => u.id === act.id) || yearlyActivities.find(ya => ya.id === act.id);
                                                                    if (fullAct) setSelectedActivity(fullAct as UniversalActivity);
                                                                }}
                                                                className="flex items-center gap-1.5 text-sm cursor-pointer group hover:bg-white/5 py-1 px-1 -mx-1 rounded transition-all"
                                                            >
                                                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${colors.text} ${colors.bg}`}>
                                                                    {act.time || '—'}
                                                                </span>
                                                                <span className="text-base shrink-0">{typeInfo?.icon}</span>
                                                                <span className="font-semibold text-slate-300 truncate group-hover:text-amber-400 transition-colors flex-1 min-w-0">
                                                                    {act.name}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {act.distance > 0 && (
                                                                        <span className={`text-xs font-black px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                                                            {act.distance.toFixed(1)}km
                                                                        </span>
                                                                    )}
                                                                    <span className="text-xs text-slate-400 font-bold">
                                                                        {duration}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {stats.biggestTrainingDays.length > 6 && (
                                    <button
                                        onClick={() => setExpandedCards(prev => ({ ...prev, days: !prev['days'] }))}
                                        className="text-xs text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider flex items-center gap-2 justify-center transition-colors pt-1 group"
                                    >
                                        <span className={`transition-transform ${expandedCards['days'] ? 'rotate-180' : ''}`}>▼</span>
                                        {expandedCards['days'] ? 'Visa färre' : `Visa ${Math.min(9, stats.biggestTrainingDays.length - 6)} till`}
                                    </button>
                                )}
                            </div>
                        );
                    })()}


                    {/* HEATMAP / CONTRIBUTION GRID */}
                    < div className="space-y-8" >
                        <div className="flex flex-col md:flex-row justify-between items-end mb-2 gap-4">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <span>🗓️</span> Aktivitetshistorik
                            </h3>
                            <div className="flex gap-4 text-sm text-slate-400">
                                <div className="flex items-center gap-2" title="Längsta paus mellan två träningspass under perioden">
                                    <span>🔥</span> <span>Längsta utan träning: <span className="text-white font-bold">{stats.longestGap} dagar</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>📅</span> <span>Aktiva dagar: <span className="text-white font-bold">{stats.activeDays}</span></span>
                                </div>
                            </div>
                        </div>

                        {
                            [...selectedYears].sort((a, b) => b - a).map(year => (
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
                            ))
                        }
                    </div >
                </div >

                {/* Activity Detail Modal */}
                {
                    selectedActivity && (
                        <ActivityDetailModal
                            activity={(() => {
                                // If it already looks like a legacy entry (has type but not performance), use it directly
                                if (!(selectedActivity as any).performance && (selectedActivity as any).type) {
                                    return selectedActivity as any;
                                }
                                // Otherwise map it or fallback
                                return mapUniversalToLegacyEntry(selectedActivity) || {
                                    id: selectedActivity.id,
                                    date: selectedActivity.date,
                                    type: (selectedActivity as any).type || 'other',
                                    durationMinutes: (selectedActivity.performance?.durationMinutes || 0),
                                    intensity: 'moderate',
                                    caloriesBurned: (selectedActivity.performance?.calories || 0),
                                    source: (selectedActivity.performance?.source?.source || 'generated'),
                                    title: selectedActivity.plan?.title ||
                                        (selectedActivity as any).title ||
                                        (selectedActivity as any).name ||
                                        (selectedActivity.performance?.activityType ? `${selectedActivity.performance.activityType.charAt(0).toUpperCase()}${selectedActivity.performance.activityType.slice(1)}` : undefined) ||
                                        'Ospecificerad Aktivitet',
                                    notes: selectedActivity.performance?.notes || '',
                                    _mergeData: { universalActivity: selectedActivity }
                                };
                            })()}
                            universalActivity={selectedActivity}
                            onClose={() => setSelectedActivity(null)}
                        />
                    )
                }

            </div >
        </>
    );
};
