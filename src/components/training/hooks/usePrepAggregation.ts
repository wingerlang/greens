import { useMemo } from 'react';
import { ExerciseEntry, PlannedActivity } from '../../../models/types.ts';
import { isCompetition, isWarmupOrCooldown } from '../../../utils/activityUtils.ts';
import { useData } from '../../../context/DataContext.tsx';

export interface PrepEvent {
    id: string;
    date: string;
    title: string;
    distance: number;
    durationSeconds?: number;
    durationFormatted?: string;
    bucketLabel?: string;
    previousDurationSeconds?: number;
    improvementSeconds?: number;
    isRace: boolean;
    activity?: ExerciseEntry | PlannedActivity;
}

export function usePrepAggregation(event: PrepEvent, allActivities: ExerciseEntry[], timeframeWeeks: number) {
    const { weightEntries, calculateDailyNutrition } = useData();

    return useMemo(() => {
        const eventDate = new Date(event.date).getTime();
        const timeframeMs = timeframeWeeks * 7 * 24 * 60 * 60 * 1000;
        const startDateMs = eventDate - timeframeMs;

        const windowActivities = allActivities.filter(a => {
            const time = new Date(a.date).getTime();
            return time >= startDateMs && time <= eventDate;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let totalRunVolumeKm = 0;
        let totalRunTimeMin = 0;
        let totalRunHRSum = 0;
        let totalRunHRCount = 0;
        let totalDaysInPeriod = timeframeWeeks * 7;
        let activeDaysCount = 0;
        let totalActiveTimeMin = 0;
        let totalHRSum = 0;
        let totalHRCount = 0;

        let totalCyclingVolumeKm = 0;
        let totalCyclingTimeMin = 0;
        let totalAltTimeMin = 0;
        let totalOtherTimeMin = 0;
        let totalElevationGain = 0;
        let maxElevationInOneRun = 0;
        let totalRunCount = 0;
        let warmupCount = 0;
        const warmups: ExerciseEntry[] = [];

        let fastestPaceSecPerKm = 999;
        let slowestPaceSecPerKm = 0;
        let theFastestRun: ExerciseEntry | null = null;
        let theSlowestRun: ExerciseEntry | null = null;
        let theMaxElevationRun: ExerciseEntry | null = null;

        let qualityCount = 0;
        let longerDistCount = 0;
        let longRunCount = 0;
        let ultraLongRunCount = 0;
        let distanceCount = 0;

        let strengthCount = 0;
        const strengthSessions: ExerciseEntry[] = [];
        let cyclingCount = 0;
        let otherCount = 0;

        const sessionsPerDay: Record<string, number> = {};
        const activeDays = new Set<string>();

        const races: ExerciseEntry[] = [];
        const qualitySessions: ExerciseEntry[] = [];
        const trainingRuns: ExerciseEntry[] = [];



        const weeklyVolume: Record<string, number> = {};
        const weeklyDurationRun: Record<string, number> = {};
        const weeklyDurationTotal: Record<string, number> = {};
        const weeklyHealth: Record<string, { kcalTotal: number; weightSum: number; weightCount: number; strengthCount: number; raceCount: number; maxRaceDistance: number; raceList: { title: string; distance: number }[] }> = {};

        for (let i = 0; i < timeframeWeeks; i++) {
            const weekKey = `Vecka -${timeframeWeeks - i}`;
            weeklyVolume[weekKey] = 0;
            weeklyDurationRun[weekKey] = 0;
            weeklyDurationTotal[weekKey] = 0;
            weeklyHealth[weekKey] = { kcalTotal: 0, weightSum: 0, weightCount: 0, strengthCount: 0, raceCount: 0, maxRaceDistance: 0, raceList: [] };
        }

        // Pre-fill days for kcal
        for (let i = 0; i < timeframeWeeks * 7; i++) {
            const dateMs = eventDate - i * 24 * 60 * 60 * 1000;
            const dateStr = new Date(dateMs).toISOString().split('T')[0];
            const weeksBeforeEvent = Math.floor(i / 7);

            if (weeksBeforeEvent < timeframeWeeks) {
                const weekKey = `Vecka -${weeksBeforeEvent + 1}`;
                if (weeklyHealth[weekKey]) {
                    const nut = calculateDailyNutrition(dateStr);
                    if (nut && nut.calories > 0) {
                        weeklyHealth[weekKey].kcalTotal += nut.calories;
                    }
                }
            }
        }

        windowActivities.forEach(act => {
            const actTimeMs = new Date(act.date).getTime();
            const daysBeforeEvent = Math.floor((eventDate - actTimeMs) / (1000 * 60 * 60 * 24));
            const weeksBeforeEvent = Math.floor(daysBeforeEvent / 7);

            if (weeksBeforeEvent < timeframeWeeks) {
                const weekKey = `Vecka -${weeksBeforeEvent + 1}`;
                const isRunning = act.type.toLowerCase().includes('run') || act.type.toLowerCase().includes('löpning');
                const isRace = isCompetition(act);

                weeklyDurationTotal[weekKey] = (weeklyDurationTotal[weekKey] || 0) + (act.durationMinutes || 0);

                if (isRunning) {
                    if (act.id !== event.id) {
                        weeklyVolume[weekKey] = (weeklyVolume[weekKey] || 0) + (act.distance || 0);
                        weeklyDurationRun[weekKey] = (weeklyDurationRun[weekKey] || 0) + (act.durationMinutes || 0);
                    }
                    if (isRace) {
                        weeklyHealth[weekKey].raceCount++;
                        const dist = act.distance || 0;
                        if (dist > (weeklyHealth[weekKey].maxRaceDistance || 0)) {
                            weeklyHealth[weekKey].maxRaceDistance = dist;
                        }
                        weeklyHealth[weekKey].raceList.push({
                            title: act.title || act.notes || 'Tävling',
                            distance: dist
                        });
                    }
                }
                if (act.type.toLowerCase().includes('strength') || act.type.toLowerCase().includes('styrka') || act.type.toLowerCase() === 'weighttraining') {
                    weeklyHealth[weekKey].strengthCount++;
                }
            }

            const dateStr = act.date.substring(0, 10);
            sessionsPerDay[dateStr] = (sessionsPerDay[dateStr] || 0) + 1;
            activeDays.add(dateStr);
            totalActiveTimeMin += (act.durationMinutes || 0);

            const isRunning = act.type.toLowerCase().includes('run') || act.type.toLowerCase().includes('löpning');
            const isRace = isCompetition(act);

            if (isRace && isRunning) races.push(act);

            if (isRunning && act.distance && act.durationMinutes) {
                if (act.id === event.id) return;

                totalRunVolumeKm += act.distance;
                totalRunTimeMin += act.durationMinutes;
                totalElevationGain += (act.elevationGain || 0);

                const hr = (act as any).averageHeartrate || (act as any).avgHeartRate;
                if (hr) {
                    totalRunHRSum += hr;
                    totalRunHRCount++;
                    totalHRSum += hr;
                    totalHRCount++;
                }
                
                if (isWarmupOrCooldown(act)) {
                    warmupCount++;
                    warmups.push(act);
                } else {
                    totalRunCount++;
                }

                const isQuality = !isRace && (
                    act.title?.toLowerCase().includes('intervall') ||
                    act.notes?.toLowerCase().includes('intervall') ||
                    act.title?.toLowerCase().includes('tempo') ||
                    act.title?.toLowerCase().includes('tröskel') ||
                    act.subType === 'interval' ||
                    act.subType === 'tempo'
                );

                if (isRace) {
                    // Handled
                } else if (isQuality) {
                    qualityCount++;
                    qualitySessions.push(act);
                    trainingRuns.push({ ...act, isQuality: true } as any);
                } else {
                    trainingRuns.push({ ...act, isQuality: false } as any);
                    if (act.distance >= 14) {
                        if (act.distance >= 40) ultraLongRunCount += 1;
                        else if (act.distance >= 20) longRunCount += 1;
                        else longerDistCount += 1;
                    } else {
                        distanceCount += 1;
                    }
                }
            } else {
                const lowType = act.type.toLowerCase();
                if (lowType.includes('strength') || lowType.includes('styrka') || lowType === 'weighttraining') {
                    strengthCount++;
                    strengthSessions.push(act);
                    totalOtherTimeMin += (act.durationMinutes || 0);
                } else if (lowType.includes('cycle') || lowType.includes('cykel') || lowType === 'virtualride' || lowType === 'ride') {
                    cyclingCount++;
                    totalCyclingVolumeKm += (act.distance || 0);
                    totalCyclingTimeMin += (act.durationMinutes || 0);
                    totalAltTimeMin += (act.durationMinutes || 0);
                } else if (lowType.includes('cardio') || lowType.includes('cross') || lowType.includes('row') || lowType.includes('swim') || lowType.includes('mrc')) {
                    otherCount++;
                    totalAltTimeMin += (act.durationMinutes || 0);
                } else {
                    otherCount++;
                    totalOtherTimeMin += (act.durationMinutes || 0);
                }
            }
        });

        trainingRuns.forEach(act => {
            const pace = (act.durationMinutes * 60) / act.distance;
            if (pace < fastestPaceSecPerKm && pace > 120) {
                fastestPaceSecPerKm = pace;
                theFastestRun = act;
            }
            if (pace > slowestPaceSecPerKm && pace < 900) { // Cap at 15min/km to filter out obvious walks
                slowestPaceSecPerKm = pace;
                theSlowestRun = act;
            }
            if ((act.elevationGain || 0) > maxElevationInOneRun) {
                maxElevationInOneRun = act.elevationGain || 0;
                theMaxElevationRun = act;
            }
        });

        const top3LongRuns = [...trainingRuns]
            .sort((a, b) => (b.distance || 0) - (a.distance || 0))
            .slice(0, 3);

        weightEntries.forEach(w => {
            const wTimeMs = new Date(w.date).getTime();
            if (wTimeMs >= startDateMs && wTimeMs <= eventDate) {
                const daysBeforeEvent = Math.floor((eventDate - wTimeMs) / (1000 * 60 * 60 * 24));
                const weeksBeforeEvent = Math.floor(daysBeforeEvent / 7);
                if (weeksBeforeEvent < timeframeWeeks) {
                    const weekKey = `Vecka -${weeksBeforeEvent + 1}`;
                    if (weeklyHealth[weekKey]) {
                        weeklyHealth[weekKey].weightSum += w.weight;
                        weeklyHealth[weekKey].weightCount++;
                    }
                }
            }
        });

        const avgWeeklyVol = totalRunVolumeKm / timeframeWeeks;
        let lastWeekVol = 0;
        let prevWeeksVolAvg = 0;
        if (timeframeWeeks > 1) {
            lastWeekVol = weeklyVolume['Vecka -1'] || 0;
            const prevTotal = Object.entries(weeklyVolume)
                .filter(([k]) => k !== 'Vecka -1')
                .reduce((sum, [, v]) => sum + v, 0);
            prevWeeksVolAvg = prevTotal / (timeframeWeeks - 1);
        }

        const avgPaceSecPerKm = totalRunCount > 0 ? (totalRunTimeMin * 60) / totalRunVolumeKm : 0;
        const doubleDaysCount = Object.values(sessionsPerDay).filter(count => count > 1).length;
        const avgSessionsPerWeek = Object.keys(sessionsPerDay).length / timeframeWeeks;
        const restDays = totalDaysInPeriod - activeDays.size;

        const sortedActiveDays = Array.from(activeDays).sort();
        let longestStreak = 0;
        let currentStreak = 0;
        let lastDate: Date | null = null;
        sortedActiveDays.forEach(dateStr => {
            const d = new Date(dateStr);
            if (!lastDate) { currentStreak = 1; } else {
                const diffDays = Math.ceil(Math.abs(d.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) currentStreak++; else currentStreak = 1;
            }
            if (currentStreak > longestStreak) longestStreak = currentStreak;
            lastDate = d;
        });

        const peakVolumeWeek = Math.max(0, ...Object.values(weeklyVolume));
        let peakWeekName = '';
        Object.entries(weeklyVolume).forEach(([k, v]) => {
            if (v === peakVolumeWeek) peakWeekName = k;
        });
        const consistencyScore = (activeDays.size / totalDaysInPeriod) * 100;
        const qualityVol = qualitySessions.reduce((sum, s) => sum + (s.distance || 0), 0);
        const qualityRatio = totalRunVolumeKm > 0 ? (qualityVol / totalRunVolumeKm) * 100 : 0;

        const pros: string[] = [];
        const cons: string[] = [];
        if (longRunCount >= 3) pros.push("Bra uthållighetsgrund med regelbundna långpass"); else cons.push("Få långpass i perioden, potentiellt svag uthållighetsbas");
        if (qualityCount >= Math.floor(timeframeWeeks / 2)) pros.push("Konsekvent upprätthållande av kvalitetspass/fart"); else cons.push("Avsaknad av kontinuitet i kvalitetspass");
        if (strengthCount >= Math.floor(timeframeWeeks * 0.5)) pros.push("Bra skadeförebyggande rutin (styrke/alternativ träning)"); else if (strengthCount === 0) cons.push("Ingen styrketräning loggad (ökad skaderisk)");
        if (timeframeWeeks > 1 && lastWeekVol < prevWeeksVolAvg * 0.85) pros.push("Tydlig och vältajmad formtoppning (Tapering)"); else if (timeframeWeeks > 1 && lastWeekVol > prevWeeksVolAvg * 1.05) cons.push("Ingen tapering genomförd sista veckan");
        if (longestStreak >= 5) pros.push(`Stark kontinuitet i träningen (max-streak: ${longestStreak} dagar)`);
        if (restDays < timeframeWeeks) cons.push("Väldigt få vilodagar (potentiell underåterhämtning)");

        const rawChartData = Object.keys(weeklyVolume).sort((a, b) => {
            const numA = parseInt(a.split('-')[1]);
            const numB = parseInt(b.split('-')[1]);
            return numA - numB;
        }).map(key => ({
            week: key,
            vol: Math.round(weeklyVolume[key] * 10) / 10,
            durRun: weeklyDurationRun[key] || 0,
            durTotal: weeklyDurationTotal[key] || 0,
            raceCount: weeklyHealth[key].raceCount,
            maxRaceDistance: weeklyHealth[key].maxRaceDistance,
            raceList: weeklyHealth[key].raceList,
            weight: weeklyHealth[key].weightCount > 0 ? Math.round((weeklyHealth[key].weightSum / weeklyHealth[key].weightCount) * 10) / 10 : null,
            kcal: weeklyHealth[key].kcalTotal > 0 ? Math.round(weeklyHealth[key].kcalTotal / 7) : null
        }));

        const weightDataPoints = weightEntries.filter(w => new Date(w.date).getTime() >= startDateMs && new Date(w.date).getTime() <= eventDate);
        const hasHealthData = weightDataPoints.length >= 3;

        const longRunsList = windowActivities.filter(r => {
            const isRun = r.type.toLowerCase().includes('run') || r.type.toLowerCase().includes('löpning');
            const isQuality = r.title?.toLowerCase().includes('intervall') || r.notes?.toLowerCase().includes('intervall') || r.subType === 'interval';
            return isRun && (r.distance || 0) >= 20 && r.id !== event.id && !isCompetition(r) && !isQuality;
        });
        const longerDistList = windowActivities.filter(r => {
            const isRun = r.type.toLowerCase().includes('run') || r.type.toLowerCase().includes('löpning');
            const isQuality = r.title?.toLowerCase().includes('intervall') || r.notes?.toLowerCase().includes('intervall') || r.subType === 'interval' || r.subType === 'tempo';
            return isRun && (r.distance || 0) >= 14 && (r.distance || 0) < 20 && r.id !== event.id && !isCompetition(r) && !isQuality;
        });
        const easyRunsList = windowActivities.filter(r => {
            const isRun = r.type.toLowerCase().includes('run') || r.type.toLowerCase().includes('löpning');
            const isQuality = r.title?.toLowerCase().includes('intervall') || r.notes?.toLowerCase().includes('intervall') || r.subType === 'interval' || r.subType === 'tempo';
            return isRun && (r.distance || 0) < 14 && r.id !== event.id && !isCompetition(r) && !isQuality;
        });

        const longRunVol = longRunsList.reduce((sum, s) => sum + (s.distance || 0), 0);
        const longRunRatio = totalRunVolumeKm > 0 ? (longRunVol / totalRunVolumeKm) * 100 : 0;

        return {
            top3LongRuns, fastestRun: theFastestRun as ExerciseEntry | null,
            slowestRun: theSlowestRun as ExerciseEntry | null, maxElevationRun: theMaxElevationRun as ExerciseEntry | null,
            peakWeekName,
            races: races.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            qualityCount, distanceCount, longRunCount, longerDistCount, ultraLongRunCount,
            totalElevationGain, maxElevationInOneRun, fastestPaceSecPerKm, totalActiveTimeMin, restDays, activeDaysCount: activeDays.size, totalDaysInPeriod,
            longRunsList: longRunsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            longerDistList: longerDistList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            easyRunsList: easyRunsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            avgWeeklyVol, lastWeekVol, prevWeeksVolAvg, avgPaceSecPerKm,
            avgHR: totalHRCount > 0 ? Math.round(totalHRSum / totalHRCount) : null,
            avgRunHR: totalRunHRCount > 0 ? Math.round(totalRunHRSum / totalRunHRCount) : null,
            strengthCount,
            strengthSessions: strengthSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            cyclingCount, otherCount, doubleDaysCount, avgSessionsPerWeek,
            chartData: rawChartData, hasHealthData,
            weightDataPoints: weightDataPoints.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            windowActivities, longestStreak, peakVolumeWeek, consistencyScore, qualityRatio, longRunRatio,
            pros, cons,
            qualitySessions: qualitySessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            slowestPaceSecPerKm,
            totalRunTimeMin,
            totalCyclingVolumeKm,
            totalCyclingTimeMin,
            totalAltTimeMin,
            totalOtherTimeMin,
            totalRunCount,
            warmupCount,
            warmups,
            totalRunVolumeKm
        };
    }, [event, allActivities, timeframeWeeks, weightEntries, calculateDailyNutrition]);
}
