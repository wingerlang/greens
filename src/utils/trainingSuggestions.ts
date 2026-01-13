import { ExerciseEntry, PlannedActivity, generateId, PerformanceGoal, WeeklyStats, UserSettings } from '../models/types.ts';

// Helper to estimate user's easy pace (min/km) based on last 4 weeks history
function getEstimatedEasyPace(history: ExerciseEntry[]): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 28);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const recentRuns = history.filter(e =>
        e.type === 'running' &&
        e.date >= cutoffStr &&
        e.distance &&
        e.distance > 0 &&
        e.durationMinutes &&
        e.durationMinutes > 0
    );

    if (recentRuns.length === 0) return 6.0; // Default 6:00 min/km

    // Calculate pace (min/km) for each run
    const paces = recentRuns.map(r => r.durationMinutes / (r.distance! || 1));

    // Sort to find median
    paces.sort((a, b) => a - b);
    const mid = Math.floor(paces.length / 2);

    // If even number, average the two middle ones, else take middle
    const medianPace = paces.length % 2 !== 0
        ? paces[mid]
        : (paces[mid - 1] + paces[mid]) / 2;

    // Sanity check (3:00 to 12:00 min/km)
    return Math.max(3, Math.min(12, medianPace));
}

export interface TrainingSuggestion {
    id: string;
    type: 'RUN' | 'STRENGTH' | 'HYROX' | 'BIKE' | 'REST';
    label: string;
    description: string;
    reason: string;
    duration?: number;
    distance?: number;
    intensity?: 'low' | 'moderate' | 'high';
}

const WEEKDAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

/**
 * Smart suggestion engine for training
 * Analyzes history to suggest workouts for a specific date
 */
export function getTrainingSuggestions(
    history: ExerciseEntry[],
    targetDate: string,
    goals: PerformanceGoal[] = [],
    weeklyStats?: WeeklyStats,
    userSettings?: UserSettings
): TrainingSuggestion[] {
    const suggestions: TrainingSuggestion[] = [];
    const dateObj = new Date(targetDate);
    const dayOfWeek = dateObj.getDay(); // 0-6
    const weekdayName = WEEKDAY_NAMES[dayOfWeek];

    const estimatedEasyPace = getEstimatedEasyPace(history); // Calculate once

    // Helper: Check if a user has run hard recently (Tempo, Interval, or High Intensity)
    // Returns number of days since last hard session
    const getDaysSinceHardRun = () => {
        const hardRuns = history.filter(e =>
            e.type === 'running' &&
            (
                e.intensity === 'high' ||
                e.intensity === 'ultra' ||
                e.title?.toLowerCase().includes('tempo') ||
                e.title?.toLowerCase().includes('intervall') ||
                e.title?.toLowerCase().includes('tävling') ||
                e.title?.toLowerCase().includes('hårt')
            )
        );
        const lastHardRun = hardRuns.sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];

        return lastHardRun
            ? Math.floor((dateObj.getTime() - new Date(lastHardRun.date).getTime()) / 86400000)
            : 999;
    };

    const daysSinceHardRun = getDaysSinceHardRun();

    // --- GOAL BASED SUGGESTIONS ---

    // 1. Weekly Volume Goals (Distance)
    if (weeklyStats) {
        const kmGoal = goals.find(g => g.status === 'active' && g.targets?.some(t => t.unit === 'km'));
        if (kmGoal) {
            const targetKm = kmGoal.targets?.find(t => t.unit === 'km')?.value || 0;
            // Use FORECAST (Planned + Completed) to avoid suggesting if already planned
            const forecastKm = weeklyStats.forecast.runningKm;

            // Check if user is already way over goal (>110%)
            if (forecastKm > targetKm * 1.1) {
                // Suggest Recovery Jog
                const duration = 30;
                const distance = duration / (estimatedEasyPace * 1.2); // Very slow

                suggestions.push({
                    id: generateId(),
                    type: 'RUN',
                    label: 'Återhämtningsjogg 🧘',
                    description: `${duration} min mycket lugn jogg`,
                    reason: `Du ligger redan 10% över veckomålet (${forecastKm.toFixed(1)} km vs ${targetKm} km).`,
                    distance: parseFloat(distance.toFixed(1)),
                    duration: duration,
                    intensity: 'low'
                });
            } else if (forecastKm < targetKm) {
                // We are UNDER goal
                const remaining = Math.max(0, targetKm - forecastKm);

                // If we have distance left and it's getting late in the week (Thu-Sun)
                const isLateWeek = dayOfWeek === 0 || dayOfWeek >= 4;

                if (remaining > 0 && isLateWeek) {
                    const suggestKm = remaining > 30 ? 30 : remaining;
                    suggestions.push({
                        id: generateId(),
                        type: 'RUN',
                        label: 'Måljakt 🎯',
                        description: `${suggestKm.toFixed(1)} km löpning`,
                        reason: `Du saknar ${remaining.toFixed(1)} km för att nå veckomålet (prognos: ${forecastKm.toFixed(1)}/${targetKm})`,
                        distance: parseFloat(suggestKm.toFixed(1)),
                        duration: suggestKm * estimatedEasyPace,
                        intensity: 'moderate'
                    });
                }

                // If under goal AND hasn't run hard recently -> Suggest Intervals/Tempo
                if (daysSinceHardRun > 5 && !suggestions.some(s => s.intensity === 'high')) {
                    suggestions.push({
                        id: generateId(),
                        type: 'RUN',
                        label: 'Kvalitetspass 🔥',
                        description: 'Intervaller eller Tempo',
                        reason: `Du ligger under målet och har inte kört hårt på ${daysSinceHardRun} dagar.`,
                        distance: 8,
                        duration: 45,
                        intensity: 'high'
                    });
                }
            }
        }
    }

    // 2. Frequency Goals (Strength)
    const strengthGoal = goals.find(g => g.status === 'active' && g.name.toLowerCase().includes('styrka'));
    if (strengthGoal && weeklyStats) {
        const targetSessions = strengthGoal.targets?.find(t => t.unit?.includes('pass'))?.value || 3;
        // Use forecast for strength too
        const forecastSessions = weeklyStats.forecast.strengthSessions;
        const remainingSessions = Math.max(0, targetSessions - forecastSessions);
        const daysLeft = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek) + 1;

        if (remainingSessions > 0 && remainingSessions >= daysLeft && !suggestions.some(s => s.type === 'STRENGTH')) {
            suggestions.push({
                id: generateId(),
                type: 'STRENGTH',
                label: 'Styrkemål',
                description: '45-60 min styrka',
                reason: `Ligg i! ${remainingSessions} pass kvar för att nå veckomålet.`,
                duration: 50,
                intensity: 'high'
            });
        }
    }

    // --- HISTORY / PATTERN BASED SUGGESTIONS ---

    // 3. Analyze weekday patterns (last 8 weeks)
    const sameWeekdayHistory = history.filter(e => {
        const d = new Date(e.date);
        return d.getDay() === dayOfWeek;
    });

    if (sameWeekdayHistory.length > 0) {
        // Count frequencies
        const counts: Record<string, number> = {};
        sameWeekdayHistory.forEach(e => {
            counts[e.type] = (counts[e.type] || 0) + 1;
        });

        const sortedTypes = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const mostCommonType = sortedTypes[0][0];

        const relevantEntries = sameWeekdayHistory.filter(e => e.type === mostCommonType);
        const avgDuration = Math.round(relevantEntries.reduce((sum, e) => sum + e.durationMinutes, 0) / relevantEntries.length / 5) * 5;
        const avgDist = relevantEntries.some(e => e.distance)
            ? Math.round(relevantEntries.reduce((sum, e) => sum + (e.distance || 0), 0) / relevantEntries.length * 10) / 10
            : undefined;

        if (mostCommonType === 'running' && !suggestions.some(s => s.type === 'RUN')) {
            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Vanlig Dag',
                description: `${avgDuration} min${avgDist ? ` • ${avgDist} km` : ''}`,
                reason: `Du brukar springa på ${weekdayName}ar`,
                duration: avgDuration,
                distance: avgDist,
                intensity: 'moderate'
            });
        }
    }

    // 4. Smart Distances (Bucket Logic)
    const thirtyDaysAgo = new Date(dateObj);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRuns = history.filter(e =>
        e.type === 'running' &&
        new Date(e.date) >= thirtyDaysAgo &&
        e.distance && e.distance > 0
    );

    if (recentRuns.length >= 3) {
        // Round to nearest 0.5 or integer
        const distances = recentRuns.map(r => {
            const dist = r.distance || 0;
            // Round to nearest 2.5km bucket for broad categorization, or keep specific for median?
            // User request: "5km, 7.5km, 8km, 12km"
            return dist;
        });

        // Find Mode (most common rounded to nearest 0.5)
        const counts: Record<string, number> = {};
        distances.forEach(d => {
            const rounded = (Math.round(d * 2) / 2).toFixed(1); // 5.0, 7.5, 12.0
            counts[rounded] = (counts[rounded] || 0) + 1;
        });

        const sortedBuckets = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        // Take top 2 most common distances
        for (let i = 0; i < Math.min(2, sortedBuckets.length); i++) {
            const distVal = parseFloat(sortedBuckets[i][0]);
            const count = sortedBuckets[i][1];

            // Only suggest if significant frequency (at least 20% of runs or >2 times)
            if (count >= 2 && !suggestions.some(s => Math.abs((s.distance || 0) - distVal) < 1)) {
                suggestions.push({
                    id: generateId(),
                    type: 'RUN',
                    label: `${distVal} km standard`,
                    description: `En av dina vanligaste distanser`,
                    reason: `Du har sprungit ca ${distVal}km ${count} gånger senaste månaden`,
                    distance: distVal,
                    duration: distVal * estimatedEasyPace,
                    intensity: 'moderate'
                });
            }
        }
    }

    // 5. Recovery / Rest logic
    // Check previous day
    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const prevDayTraining = history.filter(e => e.date === prevDateStr);

    const trainedHardYesterday = prevDayTraining.some(e =>
        e.intensity === 'high' || e.intensity === 'ultra' || e.durationMinutes > 90
    );

    if (trainedHardYesterday && !suggestions.some(s => s.intensity === 'low')) {
        const duration = 30;
        const distance = duration / (estimatedEasyPace * 1.1);

        suggestions.push({
            id: generateId(),
            type: 'RUN',
            label: 'Återhämtning',
            description: `${duration} min lätt jogg`,
            reason: 'Tufft pass igår – ta det lugnt idag',
            duration: duration,
            distance: parseFloat(distance.toFixed(1)),
            intensity: 'low'
        });
    }

    // 6. Strength Patterns - Suggest common strength workouts
    const strengthHistory = history.filter(e => e.type === 'strength');
    if (strengthHistory.length > 0) {
        // Group by title to find favorites
        const counts: Record<string, number> = {};
        strengthHistory.forEach(e => {
            // Normalize title a bit?
            const title = e.title?.trim() || 'Styrkepass';
            counts[title] = (counts[title] || 0) + 1;
        });

        const sortedStrength = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        // Suggest top 3 most distinct strength workouts
        for (let i = 0; i < Math.min(3, sortedStrength.length); i++) {
            const [title, count] = sortedStrength[i];

            // Skip generic names if we have better ones, or limit them?
            // Also skip if already suggested
            if (!suggestions.some(s => s.label === title)) {
                suggestions.push({
                    id: generateId(),
                    type: 'STRENGTH',
                    label: title,
                    description: 'Ett av dina vanligaste pass',
                    reason: `Du har kört "${title}" ${count} gånger totalt`,
                    duration: 45, // Default for now, could be improved by calculating avg duration for this title
                    intensity: 'moderate'
                });
            }
        }
    }

    // Scoring / Sorting
    const score = (s: TrainingSuggestion) => {
        if (s.label.includes('Återhämtningsjogg')) return 110; // Top priority if over goal
        if (s.label.includes('Måljakt') || s.label.includes('Styrkemål')) return 100;
        if (s.label.includes('Kvalitetspass')) return 95;
        if (s.label.includes('standard')) return 80;
        if (s.label === 'Vanlig Dag') return 70;
        return 50;
    };

    return suggestions
        .filter(s => {
            const interests = userSettings?.trainingInterests;
            if (!interests) return true; // Default to showing all if no settings
            if (s.type === 'RUN' && interests.running === false) return false;
            if (s.type === 'STRENGTH' && interests.strength === false) return false;
            if (s.type === 'HYROX' && interests.hyrox === false) return false;
            return true;
        })
        .sort((a, b) => score(b) - score(a));
}
