import { StrengthWorkout, normalizeExerciseName, MuscleGroup } from '../models/strengthTypes.ts';
import { calculateEstimated1RM } from './strengthCalculators.ts';
import { WeeklyLoadData, LoadInsight, SetAnalysis } from '../models/loadAnalysisTypes.ts';
import { getWeekStartDate } from '../models/types.ts';

/**
 * Core Load Analysis Engine
 * Calculates Effective Sets and e1RM trends.
 */

// Configuration
const WINDOW_DAYS = 60;
const DECAY_DAYS = 30;
const DECAY_FACTOR = 0.9; // 10% drop
const INTENSITY_THRESHOLD = 0.75; // 75% of Reference Max

export function calculateEffectiveLoad(
    sessions: StrengthWorkout[],
    mappings: Record<string, MuscleGroup>,
    filters: {
        startDate?: string;
        endDate?: string;
        exercise?: string;
        muscle?: string;
    }
): WeeklyLoadData[] {
    // 1. Sort sessions chronologically
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - b.date.getTime());

    // 2. Filter sessions (Date range only initially, exercise/muscle filtering happens per set)
    const filteredSessions = sortedSessions.filter(s => {
        if (filters.startDate && s.date < filters.startDate) return false;
        if (filters.endDate && s.date > filters.endDate) return false;
        return true;
    });

    // 3. Flatten into chronological stream of sets
    // We need to track Reference Max *per exercise* over time.
    // So we need to iterate ALL history (even before startDate) to build the Reference Max correctly.
    // However, for performance, we can start a bit earlier or just accept cold start if history is truncated.
    // Better: Use all sortedSessions for Reference Max calculation, but only aggregate result for the filtered range.

    const weeklyMap = new Map<string, {
        effectiveSets: number;
        totalSets: number;
        maxE1RM: number;
        e1RMSum: number;
        e1RMCount: number;
        exercises: Set<string>;
    }>();

    // State for Reference Max: { [normalizedName]: { max: number, date: string, history: {val, date}[] } }
    // Actually, "Reference Max" is the max of the LAST X DAYS. So we need a history buffer per exercise.
    const historyBuffer: Record<string, { e1rm: number; date: number }[]> = {};

    // Helper to get Reference Max for a specific date and exercise
    const getReferenceMax = (exerciseName: string, currentDate: number): number => {
        const history = historyBuffer[exerciseName] || [];

        // 1. Filter out entries older than WINDOW_DAYS
        const validWindowStart = currentDate - (WINDOW_DAYS * 24 * 60 * 60 * 1000);

        // Optimization: Clean up history buffer occasionally? Not strictly needed for <10k sets.
        const recentBests = history.filter(h => h.date >= validWindowStart);

        if (recentBests.length === 0) return 0; // Cold start

        // Find max in window
        let refMax = Math.max(...recentBests.map(h => h.e1rm));

        // 2. Check for Decay (Inactivity)
        // Find the MOST RECENT entry before today
        // Actually, the "history" contains all past sets. The most recent set might be 40 days ago.
        // Wait, if the most recent set was 40 days ago, it would be filtered out by WINDOW_DAYS?
        // Logic check: "Reference Max: The highest recorded Set_e1RM for this exercise during the last X days."
        // If user hasn't trained in 40 days, the window is empty -> RefMax = 0.
        // This implicitly handles the decay! If you haven't trained in 60 days, your RefMax is 0.
        // BUT, the spec says: "If inactive > 30 days... lower by 10%".
        // This implies we SHOULD remember older maxes but penalize them?
        // Or does it mean: "If within window (60d) but gap > 30d?"

        // Let's refine based on spec: "Om användaren inte tränat på 60 dagar kommer Reference_Max vara gammalt och för högt."
        // "Lösning: Om användaren varit inaktiv i > 30 dagar, nollställ eller sänk Reference_Max..."

        // If the window is 60 days, and I haven't trained in 31 days, my max from 32 days ago is still valid in the window.
        // But it might be too high. So we apply decay.

        const lastActivity = recentBests[recentBests.length - 1]; // Assuming sorted insertion?
        // We push chronologically, so last is newest.
        if (lastActivity) {
            const daysSinceLast = (currentDate - lastActivity.date) / (1000 * 60 * 60 * 24);
            if (daysSinceLast > DECAY_DAYS) {
                refMax *= DECAY_FACTOR;
            }
        }

        return refMax;
    };

    const addToHistory = (exerciseName: string, e1rm: number, date: number) => {
        if (!historyBuffer[exerciseName]) historyBuffer[exerciseName] = [];
        historyBuffer[exerciseName].push({ e1rm, date });
    };

    // Iterate all sessions
    for (const session of sortedSessions) {
        const sessionDate = new Date(session.date).getTime();
        const weekKey = getWeekStartDate(new Date(session.date)) + ` (v.${getWeekNumber(new Date(session.date))})`;
        // We can just use ISO week start

        for (const exercise of session.exercises) {
            const name = exercise.exerciseName;
            const normalized = normalizeExerciseName(name);

            // FILTER CHECK
            // 1. Exercise Name Filter
            if (filters.exercise) {
                if (normalized !== normalizeExerciseName(filters.exercise)) continue;
            }

            // 2. Muscle Group Filter
            const muscleGroup = mappings[normalized] || 'other'; // default to other/unknown
            if (filters.muscle) {
                // Check if user selected "Legs" and muscle is "Quads" -> Need mapping?
                // Or user selects "Quads" specifically.
                // Spec said "Per Muscle Group (e.g. Ben)".
                // If the filter is "Legs", we should match quads, hams, glutes, calves.
                // The filters.muscle is likely a specific group from our list (e.g. 'quads').
                // If we want "Macro Groups", we handle that in UI or here.
                // Let's assume strict match for now as granular control is requested.
                if (muscleGroup !== filters.muscle) continue;
            }

            // Reference Max for this exercise at this moment
            const refMax = getReferenceMax(normalized, sessionDate);

            // Iterate Sets
            for (const set of exercise.sets) {
                if (set.reps <= 0 || set.weight <= 0) continue; // Skip invalid

                // Calculate e1RM
                const e1rm = calculateEstimated1RM(set.weight, set.reps);

                // Add to history (for FUTURE reference max calculations)
                addToHistory(normalized, e1rm, sessionDate);

                // Analyze Set
                // If Cold Start (refMax == 0), set is Effective by default (Ratio 1.0)
                let isEffective = false;

                if (refMax === 0) {
                    isEffective = true;
                } else {
                    const ratio = e1rm / refMax;
                    if (ratio >= INTENSITY_THRESHOLD) {
                        isEffective = true;
                    }
                }

                // Aggregate Result (ONLY if within Date Range)
                const isInRange = (!filters.startDate || session.date >= filters.startDate) &&
                                  (!filters.endDate || session.date <= filters.endDate);

                if (isInRange) {
                    const weekStart = getWeekStartDate(new Date(session.date));

                    if (!weeklyMap.has(weekStart)) {
                        weeklyMap.set(weekStart, {
                            effectiveSets: 0,
                            totalSets: 0,
                            maxE1RM: 0,
                            e1RMSum: 0,
                            e1RMCount: 0,
                            exercises: new Set()
                        });
                    }

                    const entry = weeklyMap.get(weekStart)!;
                    entry.totalSets += 1;
                    if (isEffective) {
                        entry.effectiveSets += 1;
                        entry.e1RMSum += e1rm;
                        entry.e1RMCount += 1;
                    }
                    if (e1rm > entry.maxE1RM) {
                        entry.maxE1RM = e1rm;
                    }
                    entry.exercises.add(normalized);
                }
            }
        }
    }

    // Convert Map to Array
    const results: WeeklyLoadData[] = Array.from(weeklyMap.entries()).map(([dateStr, data]) => {
        const d = new Date(dateStr);
        const weekNum = getWeekNumber(d);

        return {
            week: `v.${weekNum}`,
            weekNumber: weekNum,
            year: d.getFullYear(),
            effectiveSets: data.effectiveSets,
            totalSets: data.totalSets,
            maxE1RM: Math.round(data.maxE1RM * 10) / 10,
            averageE1RM: data.e1RMCount > 0 ? Math.round((data.e1RMSum / data.e1RMCount) * 10) / 10 : 0,
            exerciseCount: data.exercises.size
        };
    });

    return results.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.weekNumber - b.weekNumber;
    });
}

export function generateLoadInsights(data: WeeklyLoadData[]): LoadInsight {
    // Need at least 2 weeks of data to show a trend, ideally 4
    if (data.length < 2) {
        return {
            scenario: 'INSUFFICIENT_DATA',
            title: 'Samlar data...',
            message: 'Logga fler pass för att få en analys av din utveckling.',
            color: 'text-slate-400'
        };
    }

    // Take last 4 weeks (or available)
    const recent = data.slice(-4);

    // Averages
    const avgEffectiveSets = recent.reduce((sum, w) => sum + w.effectiveSets, 0) / recent.length;
    const avgStrength = recent.reduce((sum, w) => sum + w.maxE1RM, 0) / recent.length; // Use Peak Strength as proxy for capability? Or Avg? Spec says "Trend"

    // Calculate Trends (Slope)
    const strengthTrend = calculateSlope(recent.map(w => w.maxE1RM)); // Using Max e1RM for trend is usually better than avg intensity
    const setsTrend = calculateSlope(recent.map(w => w.effectiveSets));

    // Scenario A: Progress
    // Strength is going up (+ slope)
    if (strengthTrend > 1.0) { // Tolerance
        return {
            scenario: 'PROGRESS',
            title: 'Bra jobbat!',
            message: 'Din nuvarande volym ger resultat. Du blir starkare vecka för vecka.',
            color: 'text-emerald-400'
        };
    }

    // Scenario C: Stagnation / Junk Volume
    // High Volume (>20), Flat/Down Strength
    if (avgEffectiveSets > 20 && strengthTrend <= 1.0) {
        return {
            scenario: 'JUNK_VOLUME',
            title: 'Varning för hög volym',
            message: 'Du tränar mycket men styrkan ökar inte. Överväg att sänka volymen för mer återhämtning.',
            color: 'text-amber-400'
        };
    }

    // Scenario D: Detraining
    // Low Volume (<3)
    if (avgEffectiveSets < 3) {
        return {
            scenario: 'DETRAINING',
            title: 'Låg träningsdos',
            message: 'Din volym är låg. Öka antalet tuffa set för att driva utveckling.',
            color: 'text-blue-400'
        };
    }

    // Scenario B: Undertraining / Sandbagging
    // High Volume (>15) but Strength Flat?
    // Spec: "Effective Sets high (>15) BUT Intensity Ratio avg low... AND e1RM flat"
    // Since we calculate Effective Sets based on Ratio > 0.75, "High Effective Sets" implies we ARE hitting the threshold.
    // However, maybe we are Just hovering at 0.75?
    // Let's stick to the simpler logic: High volume, no gain -> likely junk or too light.
    if (avgEffectiveSets > 15 && strengthTrend <= 1.0) {
         return {
            scenario: 'UNDER_TRAINING',
            title: 'Kvantitet över kvalitet?',
            message: 'Du gör många set, men styrkan står stilla. Försök höja vikten och göra färre set.',
            color: 'text-orange-400'
        };
    }

    // Default / Maintenance
    return {
        scenario: 'PROGRESS', // Default benign
        title: 'Stabil utveckling',
        message: 'Du håller igång träningen. Fortsätt utmana dig själv för att se tydligare resultat.',
        color: 'text-slate-300'
    };
}

// Simple linear regression slope
function calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}

function getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
