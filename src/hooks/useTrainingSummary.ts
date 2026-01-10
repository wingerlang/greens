import { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { calculatePerformanceScore } from '../utils/performanceEngine.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { UniversalActivity } from '../models/types.ts';
import { PersonalBest } from '../models/strengthTypes.ts';

export interface SummaryStats {
    totalDist: number;
    totalTime: number;
    totalCals: number;
    totalSessions: number;
    totalPRs: number;
    runningPRs: number;
    strengthPRs: number;
    raceCount: number;
    avgScore: number;
    activeDays: number;
    longestGap: number;
    totalTonnage: number;
    uniqueExercises: number;
    totalSets: number;
    totalReps: number;
    mostTrainedExercise: string;
    types: { name: string; count: number; time: number; dist: number }[];
    longestRuns: UniversalActivity[];
    fastestRuns: UniversalActivity[];
    maxScores: { activity: UniversalActivity; score: number }[];
    topVolumeSessions: any[];
    topLifts: { weight: number; exercise: string; date: string; id: string }[];
}

export function useTrainingSummary(startDate: string, endDate: string) {
    const { universalActivities = [], strengthSessions = [], unifiedActivities = [] } = useData();
    const { token } = useAuth();
    const [strengthPBs, setStrengthPBs] = useState<PersonalBest[]>([]);

    // Load Strength PBs
    useEffect(() => {
        if (!token) return;
        fetch('/api/strength/pbs', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.personalBests && Array.isArray(data.personalBests)) {
                    setStrengthPBs(data.personalBests);
                }
            })
            .catch(err => console.error('Failed to load strength PBs', err));
    }, [token]);

    const filteredActivities = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Set end to end of day
        end.setHours(23, 59, 59, 999);

        // Pre-calculate IDs that should be hidden (components of merges)
        const hiddenIds = new Set<string>();
        universalActivities.forEach((u: UniversalActivity) => {
            if (u.mergedIntoId) hiddenIds.add(u.id);
            if (u.mergeInfo?.isMerged && u.mergeInfo.originalActivityIds) {
                u.mergeInfo.originalActivityIds.forEach(id => hiddenIds.add(id));
            }
        });

        return universalActivities
            .filter((a: UniversalActivity) => !hiddenIds.has(a.id))
            .filter((a: UniversalActivity) => {
                const d = new Date(a.date);
                return d >= start && d <= end;
            }).sort((a: UniversalActivity, b: UniversalActivity) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [universalActivities, startDate, endDate]);

    const filteredStrengthSessions = useMemo(() => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return strengthSessions.filter(s => {
            const d = new Date(s.date);
            return d >= start && d <= end;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [strengthSessions, startDate, endDate]);

    const stats = useMemo((): SummaryStats => {
        let totalDist = 0;
        let totalTime = 0;
        let totalCals = 0;
        let totalSessions = filteredActivities.length;
        let totalScore = 0;
        let scoreCount = 0;
        let runningPRs = 0;
        let strengthPRs = 0;
        let raceCount = 0;
        let totalTonnage = 0;
        let activeDays = new Set<string>();

        const typeMap = new Map<string, { count: number, time: number, dist: number }>();

        let longestGap = 0;
        let lastDate: Date | null = null;

        const filteredStrengthPBs = strengthPBs.filter(pb => {
            const d = new Date(pb.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return d >= start && d <= end;
        });
        strengthPRs = filteredStrengthPBs.length;

        filteredActivities.forEach((a: UniversalActivity) => {
            const dist = a.performance?.distanceKm || 0;
            const time = a.performance?.durationMinutes || 0;
            const cals = a.performance?.calories || 0;
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
            const score = calculatePerformanceScore(mappedActivity as any);
            const prs = a.performance?.prCount || 0;

            totalDist += dist;
            totalTime += time;
            totalCals += cals;

            if (a.performance?.activityType === 'running') {
                runningPRs += prs;
            }

            // Count races based on workout_type or subType
            const workoutType = (a as any).workout_type?.toLowerCase() || '';
            const subType = a.performance?.subType?.toLowerCase() || '';
            if (workoutType.includes('race') || subType.includes('race') || (a as any).type?.toLowerCase() === 'race') {
                raceCount++;
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

        // Strength Stats
        let bestLift = { weight: 0, exercise: '', activity: null as UniversalActivity | null };
        let maxVolumeSession: any = null;
        let totalSets = 0;
        let totalReps = 0;
        const exerciseCountMap = new Map<string, number>();
        const uniqueExercisesSet = new Set<string>();

        filteredStrengthSessions.forEach(s => {
            totalTonnage += (s.totalVolume || 0);
            s.exercises.forEach(e => {
                uniqueExercisesSet.add(e.exerciseName.toLowerCase());
                exerciseCountMap.set(e.exerciseName, (exerciseCountMap.get(e.exerciseName) || 0) + 1);
                e.sets.forEach(set => {
                    totalSets++;
                    totalReps += (set.reps || 0);
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

            if (!maxVolumeSession || (s.totalVolume || 0) > (maxVolumeSession.totalVolume || 0)) {
                maxVolumeSession = s;
            }
        });

        // Find most trained exercise
        let mostTrainedExercise = '';
        let maxCount = 0;
        exerciseCountMap.forEach((count, exercise) => {
            if (count > maxCount) {
                maxCount = count;
                mostTrainedExercise = exercise;
            }
        });

        const totalPRs = runningPRs + strengthPRs;

        const longestRuns = [...filteredActivities]
            .filter((a: UniversalActivity) => a.performance?.activityType === 'running')
            .sort((a: UniversalActivity, b: UniversalActivity) => (b.performance?.distanceKm || 0) - (a.performance?.distanceKm || 0))
            .slice(0, 3);

        const fastestRuns = [...filteredActivities]
            .filter((a: UniversalActivity) => a.performance?.activityType === 'running' && (a.performance?.distanceKm || 0) > 5)
            .sort((a: UniversalActivity, b: UniversalActivity) => {
                const paceA = (a.performance?.durationMinutes || 0) / (a.performance?.distanceKm || 1);
                const paceB = (b.performance?.durationMinutes || 0) / (b.performance?.distanceKm || 1);
                return paceA - paceB;
            })
            .slice(0, 3);

        const maxScores = [...filteredActivities]
            .map((a: UniversalActivity) => {
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
                return { activity: a, score: calculatePerformanceScore(mappedActivity as any) };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);

        const topVolumeSessions = [...filteredStrengthSessions]
            .sort((a, b) => (b.totalVolume || 0) - (a.totalVolume || 0))
            .slice(0, 3);

        const allLifts: { weight: number, exercise: string, date: string, id: string }[] = [];
        filteredStrengthSessions.forEach(s => {
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
            raceCount,
            avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
            activeDays: activeDays.size,
            types: Array.from(typeMap.entries()).map(([k, v]) => ({ name: k, ...v })),
            longestGap,
            totalTonnage,
            uniqueExercises: uniqueExercisesSet.size,
            totalSets,
            totalReps,
            mostTrainedExercise,
            longestRuns,
            fastestRuns,
            maxScores,
            topVolumeSessions,
            topLifts
        };
    }, [filteredActivities, filteredStrengthSessions, strengthPBs, startDate, endDate]);

    return {
        stats,
        activities: filteredActivities,
        strengthSessions: filteredStrengthSessions
    };
}
