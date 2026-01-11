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

    // --- GOAL BASED SUGGESTIONS ---

    // 1. Weekly Volume Goals (Distance)
    if (weeklyStats) {
        const kmGoal = goals.find(g => g.status === 'active' && g.targets?.some(t => t.unit === 'km'));
        if (kmGoal) {
            const targetKm = kmGoal.targets?.find(t => t.unit === 'km')?.value || 0;
            const remaining = Math.max(0, targetKm - weeklyStats.running.km);

            // If we have distance left and it's getting late in the week (Thu-Sun)
            const isLateWeek = dayOfWeek === 0 || dayOfWeek >= 4;

            if (remaining > 0 && isLateWeek) {
                // Suggest exact remaining distance to hit goal
                // Cap at 30km to avoid suggesting marathons for mere mortals, unless they are close
                const suggestKm = remaining > 30 ? 30 : remaining;

                suggestions.push({
                    id: generateId(),
                    type: 'RUN',
                    label: 'Måljakt 🎯',
                    description: `${suggestKm.toFixed(1)} km löpning`,
                    reason: `Du saknar ${remaining.toFixed(1)} km för att nå ditt veckomål på ${targetKm} km`,
                    distance: parseFloat(suggestKm.toFixed(1)),
                    duration: suggestKm * estimatedEasyPace, // Use estimated pace
                    intensity: 'moderate'
                });
            }
        }
    }

    // 2. Frequency Goals (Strength)
    const strengthGoal = goals.find(g => g.status === 'active' && g.name.toLowerCase().includes('styrka'));
    if (strengthGoal && weeklyStats) {
        const targetSessions = strengthGoal.targets?.find(t => t.unit?.includes('pass'))?.value || 3; // default to 3 if parsing fails
        const currentSessions = weeklyStats.strength.sessions;
        const remainingSessions = Math.max(0, targetSessions - currentSessions);
        const daysLeft = 7 - (dayOfWeek === 0 ? 7 : dayOfWeek) + 1; // Days remaining incl today

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
    // Filter history for this specific weekday
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

        // Find most common
        const sortedTypes = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const mostCommonType = sortedTypes[0][0];

        // Calculate averages for the most common type
        const relevantEntries = sameWeekdayHistory.filter(e => e.type === mostCommonType);
        const avgDuration = Math.round(relevantEntries.reduce((sum, e) => sum + e.durationMinutes, 0) / relevantEntries.length / 5) * 5; // round to nearest 5
        const avgDist = relevantEntries.some(e => e.distance)
            ? Math.round(relevantEntries.reduce((sum, e) => sum + (e.distance || 0), 0) / relevantEntries.length * 10) / 10
            : undefined;

        // Map to suggestion
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
        } else if (mostCommonType === 'strength' && !suggestions.some(s => s.type === 'STRENGTH')) {
            suggestions.push({
                id: generateId(),
                type: 'STRENGTH',
                label: 'Vanlig Dag',
                description: `${avgDuration} min styrketräning`,
                reason: `Du brukar köra styrka på ${weekdayName}ar`,
                duration: avgDuration,
                intensity: 'high'
            });
        }
    }

    // 4. Recovery suggestion (if trained hard yesterday)
    // Check previous day
    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const prevDayTraining = history.filter(e => e.date === prevDateStr);

    const trainedHardYesterday = prevDayTraining.some(e =>
        e.intensity === 'high' || e.intensity === 'ultra' || e.durationMinutes > 90
    );

    if (trainedHardYesterday && !suggestions.some(s => s.type === 'REST')) {
        const duration = 30;
        // Recovery pace is usually slower, maybe pace * 1.1?
        const recoveryPace = estimatedEasyPace * 1.1; // 10% slower for recovery
        const distance = duration / recoveryPace;

        suggestions.push({
            id: generateId(),
            type: 'RUN', // Changed from REST to RUN for recovery jog
            label: 'Återhämtningsjogg 🧘',
            description: `${duration} min återhämtning (~${distance.toFixed(1)} km)`,
            reason: 'Tufft pass igår – kroppen behöver återhämtning',
            duration: duration,
            distance: parseFloat(distance.toFixed(1)),
            intensity: 'low'
        });
    } else {
        // If rested yesterday, suggest workout
        const restedYesterday = prevDayTraining.length === 0;
        if (restedYesterday && suggestions.length === 0) {
            const duration = 45;
            const distance = duration / estimatedEasyPace;

            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Korta distanspasset ⚡',
                description: `${duration} min lugn jogg (~${distance.toFixed(1)} km)`,
                reason: 'Du vilade igår, dags att röra på sig?',
                duration: duration,
                distance: parseFloat(distance.toFixed(1)),
                intensity: 'moderate'
            });
        }
    }

    // 5. Common distance suggestions based on recent runs
    const thirtyDaysAgo = new Date(dateObj);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRuns = history.filter(e =>
        e.type === 'running' &&
        new Date(e.date) >= thirtyDaysAgo &&
        e.distance && e.distance > 0
    );

    if (recentRuns.length >= 3) {
        // Find common distance buckets (5K, 10K, 15K, etc)
        const distances = recentRuns.map(r => Math.round((r.distance || 0) / 1000));
        const counts: Record<number, number> = {};
        distances.forEach(d => {
            const bucket = d <= 6 ? 5 : d <= 12 ? 10 : d <= 17 ? 15 : 20;
            counts[bucket] = (counts[bucket] || 0) + 1;
        });

        const sortedBuckets = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sortedBuckets.length > 0) {
            const topDistance = parseInt(sortedBuckets[0][0]);
            const count = sortedBuckets[0][1];

            if (count >= 2 && !suggestions.some(s => s.distance === topDistance)) { // Avoid duplicate if "Vanlig Dag" caught it
                // Check if we already have a run suggestion that matches this distance approximately
                const alreadyHasSimilar = suggestions.some(s => s.type === 'RUN' && s.distance && Math.abs(s.distance - topDistance) < 2);

                if (!alreadyHasSimilar) {
                    suggestions.push({
                        id: generateId(),
                        type: 'RUN',
                        label: `${topDistance} km favoriten`,
                        description: `Din vanligaste distans senaste månaden`,
                        reason: `Du har sprungit ${topDistance}km ${count} gånger senaste 30 dagarna`,
                        distance: topDistance,
                        duration: topDistance * 6, // ~6 min/km average
                        intensity: 'moderate'
                    });
                }
            }
        }
    }

    // 6. Strength suggestion if not trained strength recently
    const lastStrengthDate = history
        .filter(e => e.type === 'strength')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date;

    const daysSinceStrength = lastStrengthDate
        ? Math.floor((dateObj.getTime() - new Date(lastStrengthDate).getTime()) / 86400000)
        : 999;

    if (daysSinceStrength >= 3 && !suggestions.some(s => s.type === 'STRENGTH')) {
        suggestions.push({
            id: generateId(),
            type: 'STRENGTH',
            label: 'Styrkepass',
            description: '45-60 min styrketräning',
            reason: daysSinceStrength === 999
                ? 'Dags att köra styrka?'
                : `${daysSinceStrength} dagar sedan sist – dags för styrka?`,
            duration: 50,
            intensity: 'high'
        });
    }

    // 7. Long run reminder (Use user preference or default 15km+ as "long")
    const longRunThreshold = userSettings?.trainingPreferences?.longRunThreshold || 15;

    // Find runs that meet this threshold
    const longRuns = history.filter(e =>
        e.type === 'running' &&
        (e.distance || 0) >= longRunThreshold
    );
    const lastLongRun = longRuns.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    const daysSinceLongRun = lastLongRun
        ? Math.floor((dateObj.getTime() - new Date(lastLongRun.date).getTime()) / 86400000)
        : 999;

    if (daysSinceLongRun >= 7 && !suggestions.some(s => s.label?.includes('Långpass'))) {
        // Only suggest long run on weekends or if it's been a really long time
        if (dayOfWeek === 0 || dayOfWeek === 6 || daysSinceLongRun > 14) {
            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Långpass',
                description: `${longRunThreshold}-${longRunThreshold + 3} km lugn löpning`,
                reason: daysSinceLongRun === 999
                    ? `Bygg uthållighet med ett pass över ${longRunThreshold}km?`
                    : `${daysSinceLongRun} dagar sedan pass över ${longRunThreshold}km – dags igen?`,
                distance: longRunThreshold,
                duration: longRunThreshold * estimatedEasyPace,
                intensity: 'moderate'
            });
        }
    }

    // 8. Hard run reminder (tempo/intervals)
    const hardRuns = history.filter(e =>
        e.type === 'running' &&
        (e.intensity === 'high' || e.intensity === 'ultra')
    );
    const lastHardRun = hardRuns.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    const daysSinceHardRun = lastHardRun
        ? Math.floor((dateObj.getTime() - new Date(lastHardRun.date).getTime()) / 86400000)
        : 999;

    if (daysSinceHardRun >= 7 && !suggestions.some(s => s.label?.includes('Tempo') || s.label?.includes('Intervall'))) {
        // Only suggest hard runs mid-week usually
        if (dayOfWeek >= 2 && dayOfWeek <= 4) {
            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Tempopass',
                description: '6-8 km med fart',
                reason: daysSinceHardRun === 999
                    ? 'Jobba på farten med ett tempopass?'
                    : `${daysSinceHardRun} dagar sedan hårt pass – dags för fartlek?`,
                distance: 7,
                duration: 40,
                intensity: 'high'
            });
        }
    }

    // --- ADVANCED SMART FEATURES (User Request: Progressive Overload & Variety) ---

    // Calculate Last Week's Stats from History
    const startOfTargetWeek = new Date(dateObj);
    const day = startOfTargetWeek.getDay();
    const diff = startOfTargetWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfTargetWeek.setDate(diff); // Monday of target week

    const startOfLastWeek = new Date(startOfTargetWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfTargetWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);

    // Normalize dates for string comparison
    const startLastWeekStr = startOfLastWeek.toISOString().split('T')[0];
    const endLastWeekStr = endOfLastWeek.toISOString().split('T')[0];

    const lastWeekRuns = history.filter(e =>
        e.type === 'running' &&
        e.date >= startLastWeekStr &&
        e.date <= endLastWeekStr
    );

    const lastWeekDistance = lastWeekRuns.reduce((sum, e) => sum + (e.distance || 0), 0);
    const lastWeekTime = lastWeekRuns.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

    // 9. Progressive Overload: "Beat Last Week"
    // Only applied if we have weeklyStats (Forecast) available and last week wasn't empty
    if (weeklyStats && lastWeekDistance > 5) { // Threshold 5km to avoid suggesting against empty weeks
        const forecastTotal = weeklyStats.forecast.runningKm; // Actual + Planned
        const targetGrowth = lastWeekDistance * 1.05; // 5% growth
        const missingGrowth = targetGrowth - forecastTotal;

        // If we are UNDER the growth target, suggesting adding a run
        // Only suggest if we have valid days left
        if (missingGrowth > 2 && !suggestions.some(s => s.label.includes('Progress'))) {
            const duration = missingGrowth * estimatedEasyPace;

            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Progressionspass 📈',
                description: `${missingGrowth.toFixed(1)} km lugn löpning`,
                reason: `Slå förra veckans ${lastWeekDistance.toFixed(1)} km! Du behöver ${missingGrowth.toFixed(1)} km till.`,
                distance: parseFloat(missingGrowth.toFixed(1)),
                duration: duration,
                intensity: 'moderate'
            });
        }
    }

    // 10. Load Management Warning: "Too Much Too Soon"
    // If forecast > 150% of last week -> Suggest Rest or Easy
    if (weeklyStats && lastWeekDistance > 10) {
        const forecastTotal = weeklyStats.forecast.runningKm;
        if (forecastTotal > lastWeekDistance * 1.5) {
            suggestions.unshift({ // Add to TOP
                id: generateId(),
                type: 'REST',
                label: 'Varning: Hög Belastning ⚠️',
                description: 'Överväg en vilodag/lätt dag',
                reason: `Din prognos (${forecastTotal.toFixed(1)}km) är >50% högre än förra veckan (${lastWeekDistance.toFixed(1)}km). Risk för skada!`,
                duration: 0,
                intensity: 'low'
            });
        }
    }

    // 11. Variety Logic: Check for lack of intensity
    const tenDaysAgo = new Date(dateObj);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0];

    const recentIntensity = history.filter(e =>
        e.type === 'running' &&
        e.date >= tenDaysAgoStr &&
        (e.intensity === 'high' || e.intensity === 'ultra')
    );

    if (recentIntensity.length === 0 && history.some(e => e.type === 'running')) { // Only if they are a runner
        if (!suggestions.some(s => s.label.includes('Tempo') || s.label.includes('Intervall'))) {
            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Variationspass: Intervaller ⚡',
                description: '4x4 min intervaller',
                reason: 'Ingen högintensiv träning registrerad på 10 dagar. Dags att höja pulsen?',
                duration: 45,
                distance: 7,
                intensity: 'high'
            });
        }
    }
    const score = (s: TrainingSuggestion) => {
        if (s.label === 'Måljakt' || s.label === 'Styrkemål') return 100;
        if (s.type === 'REST' && (trainedHardYesterday || suggestions.some(r => r.type === 'REST'))) return 90;
        if (s.label === 'Vanlig Dag') return 80;
        return 0;
    };

    return suggestions.sort((a, b) => score(b) - score(a));
}
