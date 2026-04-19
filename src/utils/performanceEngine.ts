import { UserSettings, ExerciseEntry, UniversalActivity, BestEffort } from '../models/types.ts';

export interface AdaptiveGoals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    isAdapted: boolean;
    extraCalories: number;
}

/**
 * Calculates adaptive nutritional targets based on exercise load.
 * On high-intensity days, we increase protein for recovery and 
 * carbohydrates for glycogen replenishment.
 */
export function calculateAdaptiveGoals(
    settings: UserSettings,
    exercises: ExerciseEntry[],
    calorieTargetOverride?: number
): AdaptiveGoals {
    const baseCalories = calorieTargetOverride || settings.dailyCalorieGoal || 2000;
    const baseProtein = settings.dailyProteinGoal || 150;
    const baseCarbs = settings.dailyCarbsGoal || 50; // Often low for keto/deff
    const baseFat = settings.dailyFatGoal || 30;

    const totalBurned = exercises
        .filter(ex => !(ex.excludeFromStats || (ex as any).performance?.excludeFromStats))
        .reduce((sum, ex) => sum + ex.caloriesBurned, 0);

    if (totalBurned <= 50) {
        return {
            calories: baseCalories,
            protein: baseProtein,
            carbs: baseCarbs,
            fat: baseFat,
            isAdapted: false,
            extraCalories: 0
        };
    }

    // Adaptation Ratios:
    // Protein: 15% of extra calories for muscle repair
    // Carbs: 65% of extra calories for glycogen (Athletic focus)
    // Fat: 20% of extra calories for hormonal health

    const multiplier = settings.exerciseCalorieMultiplier ?? 1.0;
    const effectiveBurned = totalBurned * multiplier;

    const extraProtein = (effectiveBurned * 0.15) / 4;
    const extraCarbs = (effectiveBurned * 0.65) / 4;
    const extraFat = (effectiveBurned * 0.20) / 9;

    return {
        calories: Math.round(baseCalories + effectiveBurned),
        protein: Math.round(baseProtein + extraProtein),
        carbs: Math.round(baseCarbs + extraCarbs),
        fat: Math.round(baseFat + extraFat),
        isAdapted: true,
        extraCalories: Math.round(effectiveBurned)
    };
}

/**
 * Quantifies training stress (Load) based on duration, intensity and sub-type.
 * Similar to TSS (Training Stress Score) but uses available app metrics.
 */
export function calculateTrainingLoad(exercise: ExerciseEntry): number {
    const intensityFactors: Record<string, number> = {
        low: 0.5,
        moderate: 1.0,
        high: 1.6,
        ultra: 2.2
    };
    const iFactor = intensityFactors[exercise.intensity] || 1.0;

    const subTypeFactors: Record<string, number> = {
        default: 1.0,
        interval: 1.4,
        'long-run': 1.6,
        race: 2.0,
        tonnage: 1.1,
        ultra: 2.5,
        competition: 2.5
    };
    const factor = subTypeFactors[exercise.subType || 'default'] || 1.0;

    // Normalize so a 60min moderate workout is ~50-60 load points
    // 60 * 1.0 * 1.0 * 0.83 = ~50
    return Math.round(exercise.durationMinutes * iFactor * factor * 0.83);
}

/**
 * Calculates Grade Adjusted Pace (GAP).
 * Formula: ActualPace * (1 + 0.09 * (Gain / DistanceInMeters))
 */
export function calculateGAP(paceSecPerKm: number, gainMeters: number, distanceKm: number): number {
    if (!distanceKm || distanceKm === 0) return paceSecPerKm;

    // Grade = Rise / Run
    const grade = gainMeters / (distanceKm * 1000);

    // Heuristic: Each 1% of grade (0.01) adjusts effort by ~6.5% for running.
    // For uphill: pace feels slower (higher paceSec). 
    // GAP should show the "flats equivalent", so GAP < Pace for uphill.
    return paceSecPerKm / (1 + (6.5 * grade));
}

/**
 * Calculates an objective physical performance score (Greens Score).
 * 0-100 where higher is more efficient.
 * For running: Based on GAP vs Heart Rate.
 * For strength: Based on Tonnage vs Duration.
 */
export function calculatePerformanceScore(activity: any, history: any[] = []): number {
    const breakdown = getPerformanceBreakdown(activity, history);
    return breakdown.totalScore;
}

export interface ScoreComponent {
    label: string;
    value: string;
    score: number;
    max: number;
    description: string;
    icon: string;
    color: string;
    isPersonalBest?: boolean;
}

export interface PerformanceBreakdown {
    totalScore: number;
    type: 'cardio' | 'strength' | 'unknown';
    components: ScoreComponent[];
    summary: string;
    isPersonalBest: boolean;
}

/**
 * Provides a detailed breakdown of the Greens Score.
 */
export function getPerformanceBreakdown(activity: any, history: any[] = []): PerformanceBreakdown {
    const type = (activity.type || activity.activityType || '').toLowerCase();
    const isRunning = ['running', 'run', 'walking', 'walk', 'hiking', 'trail'].some(t => type.includes(t));
    const isStrength = ['strength', 'weightlifting', 'gym', 'styrka', 'bodybuilding', 'crossfit'].some(t => type.includes(t));

    let components: ScoreComponent[] = [];
    let summary = '';
    let totalScore = 0;
    let isPersonalBest = false;

    // Filter history to current activity type and exclude current activity
    // Also EXCLUDE any activities marked as faulty (excludeFromStats)
    const activityDate = new Date(activity.date).getTime();
    const historyBefore = history.filter(h =>
        h.id !== activity.id &&
        !(h.excludeFromStats || h.performance?.excludeFromStats) &&
        new Date(h.date).getTime() < activityDate
    );

    const isCurrentExcluded = activity.excludeFromStats || activity.performance?.excludeFromStats;

    // 1. RUNNING / CARDIO
    if (isRunning) {
        const dist = activity.distance || activity.distanceKm || 0;
        const dur = activity.durationMinutes || 0;
        const hr = activity.heartRateAvg || activity.avgHeartRate || 0;
        const gain = activity.elevationGain || 0;

        if (dist === 0 || dur === 0) {
            return { totalScore: 0, type: 'cardio', components: [], summary: 'Ingen data för beräkning.', isPersonalBest: false };
        }

        const paceSec = (dur * 60) / dist;
        const gapSec = calculateGAP(paceSec, gain, dist);

        if (hr === 0) {
            totalScore = Math.min(100, Math.max(0, 120 - (gapSec / 5)));
            summary = 'Poäng baserat enbart på tempo då puls saknas.';
            components.push({
                label: 'Tempo (GAP)',
                value: `${Math.floor(gapSec / 60)}:${Math.round(gapSec % 60).toString().padStart(2, '0')}/km`,
                score: totalScore,
                max: 100,
                description: 'Din hastighet justerad för backar.',
                icon: '⚡',
                color: 'text-indigo-400'
            });
        }

        // Efficiency = Work (Distance/GAP) / Cost (HR)
        const efficiency = 1000000 / (gapSec * hr);
        let baseScore = efficiency * 3.0;

        totalScore = baseScore;
        components.push({
            label: 'Löpekonomi (idx)',
            value: `${efficiency.toFixed(1)} idx`,
            score: Math.min(100, baseScore),
            max: 100,
            description: 'Hur långt du kommer per hjärtslag. Högre är bättre.',
            icon: '📈',
            color: 'text-emerald-400'
        });

        if (dist > 10) {
            const bonus = dist > 35 ? 1.15 : (dist > 21 ? 1.1 : 1.05);
            const bonusPercent = Math.round((bonus - 1) * 100);
            totalScore *= bonus;
            components.push({
                label: 'Uthållighet',
                value: `+${bonusPercent}%`,
                score: bonusPercent * 5,
                max: 100,
                description: 'Bonus för långdistans.',
                icon: '🏃',
                color: 'text-amber-400'
            });
        }

        // --- PERSONALIZATION BONUSES ---
        if (dur >= 60) {
            totalScore += 10;
            components.push({ label: 'Uthållighets-boost', value: '+10', score: 100, max: 100, description: 'Bonus för pass över 60 minuter.', icon: '⏱️', color: 'text-blue-400' });
        } else if (dur >= 30) {
            totalScore += 5;
            components.push({ label: 'Uthållighets-boost', value: '+5', score: 50, max: 100, description: 'Bonus för pass över 30 minuter.', icon: '⏱️', color: 'text-blue-400' });
        }

        if (historyBefore.length > 0 && !isCurrentExcluded) {
            const runningHistory = historyBefore.filter(h => {
                const t = (h.type || h.activityType || '').toLowerCase();
                return ['running', 'run'].some(tag => t.includes(tag));
            });
            // ... (rest of running PB logic)
            if (runningHistory.length > 0) {
                const maxDist = Math.max(...runningHistory.map(h => h.distance || 0));
                if (dist > maxDist && dist > 2) {
                    isPersonalBest = true;
                    totalScore += 10;
                    components.push({ label: 'PB Distans', value: '🏆', score: 100, max: 100, description: 'Ditt längsta löppass hittills!', icon: '🗺️', color: 'text-yellow-400', isPersonalBest: true });
                }

                const similarDistHistory = runningHistory.filter(h => (h.distance || 0) >= dist * 0.8 && (h.distance || 0) <= dist * 1.2);
                if (similarDistHistory.length > 0) {
                    const fastestPace = Math.min(...similarDistHistory.map(h => (h.durationMinutes * 60) / (h.distance || 1)));
                    if (paceSec < fastestPace * 0.98) {
                        isPersonalBest = true;
                        totalScore += 10;
                        components.push({ label: 'PB Tempo', value: '🏆', score: 100, max: 100, description: 'Ditt snabbaste tempo på denna distans!', icon: '💨', color: 'text-yellow-400', isPersonalBest: true });
                    }
                }
            }
        }

        if (isCurrentExcluded) {
            components.push({ label: 'Data-varning', value: 'Exkluderad', score: 0, max: 100, description: 'Detta pass är markerat som felaktigt och räknas ej i statistik/PBs.', icon: '⚠️', color: 'text-red-400' });
        }

        const roundedScore = Math.min(100, Math.round(totalScore));
        summary = roundedScore > 85 ? 'Exceptionell prestation!' : (roundedScore > 65 ? 'Riktigt bra driv i passet.' : 'En stabil insats i banken.');

        return { totalScore: roundedScore, type: 'cardio', components, summary, isPersonalBest };
    }

    // 2. STRENGTH
    if (isStrength) {
        const tonnage = activity.tonnage || 0;
        const dur = activity.durationMinutes || 0;
        if (tonnage === 0 || dur === 0) return { totalScore: 0, type: 'strength', components: [], summary: 'Ingen tonnage-data tillgänglig.', isPersonalBest: false };

        const workRate = tonnage / dur;
        let baseScore = workRate * 0.4;
        totalScore = baseScore;

        components.push({
            label: 'Arbetsinsats',
            value: `${Math.round(workRate)} kg/min`,
            score: Math.min(100, baseScore),
            max: 100,
            description: 'Hur mycket vikt du flyttar per minut (intensitet).',
            icon: '🔥',
            color: 'text-purple-400'
        });

        components.push({
            label: 'Totalvolym',
            value: `${(tonnage / 1000).toFixed(1)} t`,
            score: Math.min(100, (tonnage / 20000) * 100),
            max: 100,
            description: 'Total mängd flyttad vikt.',
            icon: '🏋️',
            color: 'text-blue-400'
        });

        // --- PERSONALIZATION BONUSES ---
        if (dur >= 60) {
            totalScore += 10;
            components.push({ label: 'Volym-boost', value: '+10', score: 100, max: 100, description: 'Bonus för rejäl passlängd.', icon: '⏱️', color: 'text-indigo-400' });
        }

        if (historyBefore.length > 0 && !isCurrentExcluded) {
            const strengthHistory = historyBefore.filter(h => {
                const t = (h.type || h.activityType || '').toLowerCase();
                return ['strength', 'weightlifting', 'gym', 'styrka'].some(tag => t.includes(tag));
            });

            if (strengthHistory.length > 0) {
                const maxTonnage = Math.max(...strengthHistory.map(h => h.tonnage || 0));
                if (tonnage > maxTonnage && tonnage > 1000) {
                    isPersonalBest = true;
                    totalScore += 15;
                    components.push({ label: 'PB Tonnage', value: '🏆', score: 100, max: 100, description: 'Ditt tyngsta styrkepass någonsin!', icon: '💪', color: 'text-yellow-400', isPersonalBest: true });
                }

                const maxWorkRate = Math.max(...strengthHistory.map(h => (h.tonnage || 0) / (h.durationMinutes || 1)));
                if (workRate > maxWorkRate && workRate > 50) {
                    isPersonalBest = true;
                    totalScore += 10;
                    components.push({ label: 'PB Intensitet', value: '🏆', score: 100, max: 100, description: 'Ditt högsta arbetstempo hittills!', icon: '⚡', color: 'text-yellow-400', isPersonalBest: true });
                }
            }
        }

        if (isCurrentExcluded) {
            components.push({ label: 'Data-varning', value: 'Exkluderad', score: 0, max: 100, description: 'Detta pass är markerat som felaktigt och räknas ej i statistik/PBs.', icon: '⚠️', color: 'text-red-400' });
        }

        const roundedScore = Math.min(100, Math.round(totalScore));
        summary = roundedScore > 85 ? 'Massivt pass! Grym volym.' : (roundedScore > 65 ? 'Stabilt och intensivt pass.' : 'Bra tempo genom passet.');

        return { totalScore: roundedScore, type: 'strength', components, summary, isPersonalBest };
    }

    return { totalScore: 0, type: 'unknown', components: [], summary: 'Okänd aktivitetstyp.', isPersonalBest: false };
}

/**
 * Target distances for best effort analysis (in km).
 */
export const PERFORMANCE_TARGETS = [
    { name: 'Marathon', km: 42.195, stravaName: 'Marathon' },
    { name: '30k', km: 30.0, stravaName: '30k' },
    { name: 'Halvmarathon', km: 21.0975, stravaName: 'Half-Marathon' },
    { name: '15k', km: 15.0, stravaName: '15k' },
    { name: '10k', km: 10.0, stravaName: '10k' },
    { name: '5k', km: 5.0, stravaName: '5k' },
    { name: '3k', km: 3.0, stravaName: '3k' },
    { name: '2k', km: 2.0, stravaName: '2k' },
    { name: '1 mile', km: 1.60934, stravaName: '1 mile' },
    { name: '1k', km: 1.0, stravaName: '1k' },
    { name: '800m', km: 0.8, stravaName: '800m' },
    { name: '400m', km: 0.4, stravaName: '400m' }
];

/**
 * Returns all identified best efforts for an activity.
 * Combines Strava's native best efforts (if available) with 
 * a sliding-window analysis of splits/laps with linear interpolation.
 */
export function getBestEffortsForActivity(activity: UniversalActivity): BestEffort[] {
    const perf = activity.performance;
    if (!perf || (perf.activityType !== 'running' && !['run', 'trail'].some(t => (activity.plan?.activityType || '').toLowerCase().includes(t)))) {
        return [];
    }

    const results: Record<string, BestEffort> = {};

    // 1. Start with Strava's best efforts if available
    if (perf.bestEfforts && perf.bestEfforts.length > 0) {
        perf.bestEfforts.forEach(be => {
            results[be.name] = { ...be, source: 'strava' };
        });
    }

    // 2. Scan splits AND laps for potentially better efforts or missing distances
    const segmentSets = [
        { data: perf.splits || [], type: 'splits' as const },
        { data: perf.laps || [], type: 'laps' as const }
    ].filter(s => s.data.length > 0);
    
    for (const { data: segments, type: segmentType } of segmentSets) {
        for (const target of PERFORMANCE_TARGETS) {
            const targetM = target.km * 1000;
            let bestTime = Infinity;
            let bestHr = 0;
            let startKm = 0;
            let bestSegmentName = '';
            let bestSegmentDist = 0;

            // Sliding window over segments
            for (let i = 0; i < segments.length; i++) {
                let distAcc = 0;
                let timeAcc = 0;
                let hrSum = 0;
                let hrTimeAcc = 0;
                let j = i;

                while (j < segments.length && distAcc < targetM) {
                    const seg = segments[j];
                    distAcc += seg.distance;
                    timeAcc += seg.movingTime;
                    
                    if (seg.averageHeartrate) {
                        hrSum += seg.averageHeartrate * seg.movingTime;
                        hrTimeAcc += seg.movingTime;
                    }
                    j++;
                }

                if (distAcc >= targetM) {
                    const overshootM = distAcc - targetM;
                    const lastSegment = segments[j - 1];
                    const pace = lastSegment.movingTime / Math.max(lastSegment.distance, 1);
                    const correctedTime = timeAcc - (overshootM * pace);

                    if (correctedTime < bestTime) {
                        bestTime = correctedTime;
                        bestHr = hrTimeAcc > 0 ? Math.round(hrSum / hrTimeAcc) : 0;
                        startKm = (segments[i] as any).split || (i + 1);
                        bestSegmentName = (segments[i] as any).name || '';
                        bestSegmentDist = segments[i].distance;
                    }
                }
            }

            if (bestTime !== Infinity) {
                // Find any existing effort for this specific distance (within 10m tolerance)
                const existingKey = Object.keys(results).find(k => {
                    const e = results[k];
                    return Math.abs(e.distance - targetM) < 10;
                });
                
                const current = existingKey ? results[existingKey] : undefined;
                
                // If we found a faster time (or none identified), update
                if (!current || bestTime < current.movingTime) {
                    // If we are overwriting a Strava record, keep the Strava name if it's special
                    const key = existingKey || target.name;
                    results[key] = {
                        name: key,
                        distance: targetM,
                        movingTime: bestTime,
                        elapsedTime: bestTime,
                        startDate: perf.startTimeLocal || activity.date,
                        startKm: startKm,
                        avgHeartRate: bestHr > 0 ? bestHr : undefined,
                        source: segmentType,
                        segmentName: bestSegmentName,
                        segmentDistance: bestSegmentDist
                    } as any;
                }
            }
        }
    }

    return Object.values(results);
}
/**
 * Returns the date of the last time a faster performance was achieved for a given distance.
 */
export function getFastestSince(
    currentActivity: UniversalActivity,
    targetDistanceM: number,
    targetTimeSec: number,
    allActivities: UniversalActivity[]
): { id: string; date: string; title: string } | 'PB' | null {
    if (!allActivities || allActivities.length === 0) return null;

    const currentDate = new Date(currentActivity.date).getTime();
    
    // Sort activities by date descending to find the MOST RECENT better one first
    const historical = allActivities
        .filter(a => 
            a.id !== currentActivity.id && 
            new Date(a.date).getTime() < currentDate &&
            !((a as any).excludeFromStats || a.performance?.excludeFromStats)
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (historical.length === 0) return 'PB';

    let foundBetter = false;
    let betterActivity: { id: string; date: string; title: string } | null = null;
    let isAllTimePB = true;

    for (const activity of historical) {
        const efforts = getBestEffortsForActivity(activity);
        const relevantEffort = efforts.find(e => 
            Math.abs(e.distance - targetDistanceM) < 2
        );

        if (relevantEffort) {
            if (relevantEffort.movingTime < targetTimeSec) {
                if (!foundBetter) {
                    foundBetter = true;
                    betterActivity = {
                        id: activity.id,
                        date: activity.date,
                        title: activity.plan?.title || activity.performance?.notes || activity.performance?.activityType || 'Aktivitet'
                    };
                }
                isAllTimePB = false;
                break; // Found the most recent better one
            }
        }
    }

    if (foundBetter) return betterActivity;
    if (isAllTimePB) return 'PB';
    
    return null;
}
