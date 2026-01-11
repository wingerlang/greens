import { ExerciseEntry, PlannedActivity, generateId } from '../models/types.ts';

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
    targetDate: string
): TrainingSuggestion[] {
    const suggestions: TrainingSuggestion[] = [];
    const dateObj = new Date(targetDate);
    const dayOfWeek = dateObj.getDay(); // 0-6
    const weekdayName = WEEKDAY_NAMES[dayOfWeek];

    // 1. Analyze weekday patterns (last 8 weeks)
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
        if (mostCommonType === 'running') {
            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Löpning',
                description: `${avgDuration} min${avgDist ? ` • ${avgDist} km` : ''}`,
                reason: `Du brukar springa på ${weekdayName}ar`,
                duration: avgDuration,
                distance: avgDist,
                intensity: 'moderate'
            });
        } else if (mostCommonType === 'strength') {
            suggestions.push({
                id: generateId(),
                type: 'STRENGTH',
                label: 'Styrka',
                description: `${avgDuration} min styrketräning`,
                reason: `Du brukar köra styrka på ${weekdayName}ar`,
                duration: avgDuration,
                intensity: 'high'
            });
        }
    }

    // 2. Recovery suggestion (if trained hard yesterday)
    // Check previous day
    const prevDate = new Date(dateObj);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const prevDayTraining = history.filter(e => e.date === prevDateStr);

    const trainedHardYesterday = prevDayTraining.some(e =>
        e.intensity === 'high' || e.intensity === 'ultra' || e.durationMinutes > 90
    );

    if (trainedHardYesterday) {
        suggestions.push({
            id: generateId(),
            type: 'REST',
            label: 'Återhämtning',
            description: 'Vila eller lätt promenad',
            reason: 'Tufft pass igår – kroppen behöver återhämtning',
            duration: 30,
            intensity: 'low'
        });
    } else {
        // If rested yesterday, suggest workout
        const restedYesterday = prevDayTraining.length === 0;
        if (restedYesterday && suggestions.length === 0) {
            suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: 'Distanspass',
                description: '45 min lugn löpning',
                reason: 'Du vilade igår, dags att röra på sig?',
                duration: 45,
                intensity: 'moderate'
            });
        }
    }

    // 3. Common distance suggestions based on recent runs
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

            if (count >= 2 && !suggestions.some(s => s.distance === topDistance)) {
                suggestions.push({
                    id: generateId(),
                    type: 'RUN',
                    label: `${topDistance} km pass`,
                    description: `Din vanligaste distans senaste månaden`,
                    reason: `Du har sprungit ${topDistance}km ${count} gånger senaste 30 dagarna`,
                    distance: topDistance,
                    duration: topDistance * 6, // ~6 min/km average
                    intensity: 'moderate'
                });
            }
        }
    }

    // 4. Strength suggestion if not trained strength recently
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

    // 5. Long run reminder (10km+ runs)
    const longRuns = history.filter(e =>
        e.type === 'running' &&
        (e.distance || 0) >= 10000
    );
    const lastLongRun = longRuns.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    const daysSinceLongRun = lastLongRun
        ? Math.floor((dateObj.getTime() - new Date(lastLongRun.date).getTime()) / 86400000)
        : 999;

    if (daysSinceLongRun >= 7 && !suggestions.some(s => s.label?.includes('Långpass'))) {
        suggestions.push({
            id: generateId(),
            type: 'RUN',
            label: 'Långpass',
            description: '12-15 km lugn löpning',
            reason: daysSinceLongRun === 999
                ? 'Bygg uthållighet med ett längre pass?'
                : `${daysSinceLongRun} dagar sedan längre löpning – dags för långpass?`,
            distance: 12,
            duration: 75,
            intensity: 'moderate'
        });
    }

    // 6. Hard run reminder (tempo/intervals)
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

    return suggestions;
}

