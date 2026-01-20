import { ExerciseEntry } from '../models/types.ts';
import { CYCLING_POWER_PROFILE, ASSAULT_BIKE_STANDARDS, PowerStandard, AssaultBikeStandard } from '../pages/tools/data/cyclingStandards.ts';

/**
 * Calculates Watts per Kilogram
 */
export const calculateWattsPerKg = (watts: number, weightKg: number): number => {
    if (!weightKg || weightKg === 0) return 0;
    return Math.round((watts / weightKg) * 100) / 100;
};

/**
 * Estimates FTP based on 20 minute max power (95% rule)
 */
export const estimateFtp = (twentyMinWatts: number): number => {
    return Math.round(twentyMinWatts * 0.95);
};

/**
 * Determines cycling performance level based on W/kg and duration
 */
export const getCyclingLevel = (
    wKg: number,
    duration: '5s' | '1m' | '5m' | 'ftp',
    gender: 'male' | 'female' = 'male'
): string => {
    const standards = CYCLING_POWER_PROFILE[gender];

    // Find the highest level the user qualifies for
    for (const std of standards) {
        let threshold = 0;
        switch(duration) {
            case '5s': threshold = std.wKg5s; break;
            case '1m': threshold = std.wKg1m; break;
            case '5m': threshold = std.wKg5m; break;
            case 'ftp': threshold = std.wKgFtp; break;
        }

        if (wKg >= threshold) {
            return std.level;
        }
    }

    return 'Untrained';
};

/**
 * Determines Assault Bike level based on Calories in a given time domain
 */
export const getAssaultBikeLevel = (
    cals: number,
    duration: '1m' | '10m' | '20m',
    gender: 'male' | 'female' = 'male'
): string => {
    const standards = ASSAULT_BIKE_STANDARDS[gender];

    for (const std of standards) {
        let threshold = 0;
        switch(duration) {
            case '1m': threshold = std.oneMinCals; break;
            case '10m': threshold = std.tenMinCals; break;
            case '20m': threshold = std.twentyMinCals; break;
        }

        if (cals >= threshold) {
            return std.level;
        }
    }

    return 'Beginner';
};

interface AssaultBikeRecord {
    calsPerMin: number;
    totalCals: number;
    durationMinutes: number;
    date: string;
    level: string;
    isEstimate: boolean;
}

/**
 * Scans history for best Assault Bike efforts
 */
export const analyzeAssaultBikePerformance = (
    entries: ExerciseEntry[],
    gender: 'male' | 'female' = 'male'
): { best1m: AssaultBikeRecord | null; best10m: AssaultBikeRecord | null; best20m: AssaultBikeRecord | null } => {

    const assaultKeywords = ['assault', 'air bike', 'echo', 'airbike'];

    // Filter for Assault Bike activities
    const assaultActivities = entries.filter(e => {
        const title = (e.title || '').toLowerCase();
        const notes = (e.notes || '').toLowerCase();
        return assaultKeywords.some(k => title.includes(k) || notes.includes(k));
    });

    let best1m: AssaultBikeRecord | null = null;
    let best10m: AssaultBikeRecord | null = null;
    let best20m: AssaultBikeRecord | null = null;

    assaultActivities.forEach(activity => {
        if (!activity.caloriesBurned || !activity.durationMinutes) return;

        const cals = activity.caloriesBurned;
        const mins = activity.durationMinutes;
        const calsPerMin = cals / mins;

        // Logic to categorize effort duration
        // We look for activities that are CLOSE to the target duration (within reasonable margin)
        // Or if it's a longer activity, we can't extract a 1min max unless we have splits (which we don't here typically).
        // So we only look at "tests" - i.e., activities where the total duration is close to the benchmark.

        const isCloseTo = (actual: number, target: number) => Math.abs(actual - target) <= 1; // +/- 1 min tolerance

        if (isCloseTo(mins, 1)) {
            const level = getAssaultBikeLevel(cals, '1m', gender);
            if (!best1m || cals > best1m.totalCals) {
                best1m = { calsPerMin, totalCals: cals, durationMinutes: mins, date: activity.date, level, isEstimate: false };
            }
        }

        if (isCloseTo(mins, 10)) {
            const level = getAssaultBikeLevel(cals, '10m', gender);
            if (!best10m || cals > best10m.totalCals) {
                best10m = { calsPerMin, totalCals: cals, durationMinutes: mins, date: activity.date, level, isEstimate: false };
            }
        }

        if (isCloseTo(mins, 20)) {
            const level = getAssaultBikeLevel(cals, '20m', gender);
            if (!best20m || cals > best20m.totalCals) {
                best20m = { calsPerMin, totalCals: cals, durationMinutes: mins, date: activity.date, level, isEstimate: false };
            }
        }
    });

    return { best1m, best10m, best20m };
};

/**
 * Scans history for best 20min Cycling Power
 */
export const getBest20MinPower = (entries: ExerciseEntry[]): { watts: number; date: string } | null => {
    // Look for cycling activities with averageWatts
    const cyclingActivities = entries.filter(e =>
        (e.type === 'cycling' || e.title?.toLowerCase().includes('zwift') || e.title?.toLowerCase().includes('wattbike')) &&
        e.averageWatts &&
        e.durationMinutes >= 20
    );

    let best: { watts: number; date: string } | null = null;

    cyclingActivities.forEach(e => {
        // This is a rough approximation. Average power for a 20min+ ride IS NOT the 20min max power.
        // However, if the ride is exactly 20-30 mins, it's a decent proxy for a test.
        // Or if it's an FTP test logged.

        // We will take the highest Average Watts recorded for any ride >= 20 mins.
        // This is conservative (safe) but might under-report if they did 20m hard inside a 2h ride.
        // But without stream data, it's the best we can do.

        if (e.averageWatts && (!best || e.averageWatts > best.watts)) {
            best = { watts: e.averageWatts, date: e.date };
        }
    });

    return best;
};
