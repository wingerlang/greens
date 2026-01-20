
import type { ExerciseEntry } from '../../../models/types.ts';
import type { StrengthWorkout } from '../../../models/strengthTypes.ts';
import { calculateWilks } from '../../../utils/strengthCalculators.ts';

export interface BeastStats {
    cooper: {
        distance: number; // meters
        score: number;
        sourceActivityId?: string;
        date?: string;
    };
    strength: {
        squat: number;
        bench: number;
        deadlift: number;
        total: number;
        wilks: number;
        score: number;
    };
    weightlifting: {
        snatch: number;
        cleanJerk: number;
        total: number;
        sinclair: number;
        score: number;
    };
    hyrox: {
        timeSeconds: number;
        score: number;
        date?: string;
    };
    totalScore: number;
}

// Name matchers
const MATCHERS = {
    squat: ['knäböj', 'squat', 'back squat', 'back_squat'],
    bench: ['bänkpress', 'bench press', 'bench_press'],
    deadlift: ['marklyft', 'deadlift'],
    snatch: ['ryck', 'snatch'],
    cleanJerk: ['stöt', 'clean & jerk', 'clean and jerk', 'clean_and_jerk']
};

function matches(name: string, queries: string[]): boolean {
    if (!name) return false;
    const n = name.toLowerCase().trim();
    return queries.some(q => n.includes(q));
}

function getMaxLift(sessions: StrengthWorkout[], matchers: string[]): number {
    let max = 0;
    sessions.forEach(session => {
        if (!session.exercises) return;
        session.exercises.forEach(ex => {
            const name = ex.exerciseName || (ex as any).name || "";
            if (matches(name, matchers)) {
                if (ex.sets && Array.isArray(ex.sets)) {
                    ex.sets.forEach(set => {
                        if (set.weight && set.weight > max) {
                            max = set.weight;
                        }
                    });
                }
            }
        });
    });
    return max;
}

import { calculateCooperScore, calculateStrengthScore, calculateWeightliftingScore, calculateHyroxScore, calculateSinclair } from './beastCalculators.ts';

export function calculateBeastStats(
    activities: ExerciseEntry[],
    strengthSessions: StrengthWorkout[],
    userWeight: number,
    userGender: 'male' | 'female' = 'male'
): BeastStats {

    // 1. COOPER TEST (Running)
    let bestCooperDist = 0;
    let bestCooperRunId: string | undefined;
    let bestCooperDate: string | undefined;

    activities.forEach(a => {
        if (a.type === 'running' && a.durationMinutes >= 12 && a.distance && a.distance > 0) {
            const distMeters = a.distance * 1000;
            // 12 min extrapolated distance = (Total Distance / Total Minutes) * 12
            const cooperMeters = (distMeters / a.durationMinutes) * 12;

            if (cooperMeters > bestCooperDist) {
                bestCooperDist = Math.round(cooperMeters);
                bestCooperRunId = a.id;
                bestCooperDate = a.date;
            }
        }
    });

    const cooperScore = calculateCooperScore(bestCooperDist);

    // 2. STRENGTH (Powerlifting)
    const maxSquat = getMaxLift(strengthSessions, MATCHERS.squat);
    const maxBench = getMaxLift(strengthSessions, MATCHERS.bench);
    const maxDeadlift = getMaxLift(strengthSessions, MATCHERS.deadlift);
    const totalPL = maxSquat + maxBench + maxDeadlift;
    const strengthScore = calculateStrengthScore(userWeight, totalPL, userGender);

    // 3. WEIGHTLIFTING (Olympic)
    const maxSnatch = getMaxLift(strengthSessions, MATCHERS.snatch);
    const maxCJ = getMaxLift(strengthSessions, MATCHERS.cleanJerk);
    const totalWL = maxSnatch + maxCJ;
    const wlScore = calculateWeightliftingScore(userWeight, totalWL, userGender);
    const sinclair = calculateSinclair(userWeight, totalWL, userGender);

    // 4. HYROX
    let bestHyroxTime = 0;
    let bestHyroxDate: string | undefined;

    activities.forEach(a => {
        // Priority 1: Structured Hyrox Stats
        if (a.hyroxStats?.totalTime) {
            if (bestHyroxTime === 0 || a.hyroxStats.totalTime < bestHyroxTime) {
                bestHyroxTime = a.hyroxStats.totalTime;
                bestHyroxDate = a.date;
            }
        }
        // Priority 2: Manual "Hyrox" typed activity
        else if (a.type === 'hyrox' as any || a.title?.toLowerCase().includes('hyrox')) {
            const timeSec = a.durationMinutes * 60;
            if (bestHyroxTime === 0 || timeSec < bestHyroxTime) {
                bestHyroxTime = timeSec;
                bestHyroxDate = a.date;
            }
        }
    });

    const hyroxScore = calculateHyroxScore(bestHyroxTime);

    return {
        cooper: {
            distance: bestCooperDist,
            score: cooperScore,
            sourceActivityId: bestCooperRunId,
            date: bestCooperDate
        },
        strength: {
            squat: maxSquat,
            bench: maxBench,
            deadlift: maxDeadlift,
            total: totalPL,
            wilks: calculateWilks(userWeight, totalPL, userGender),
            score: strengthScore
        },
        weightlifting: {
            snatch: maxSnatch,
            cleanJerk: maxCJ,
            total: totalWL,
            sinclair: sinclair,
            score: wlScore
        },
        hyrox: {
            timeSeconds: bestHyroxTime,
            score: hyroxScore,
            date: bestHyroxDate
        },
        totalScore: Math.round((cooperScore + strengthScore + wlScore + hyroxScore) / 4)
    };
}
