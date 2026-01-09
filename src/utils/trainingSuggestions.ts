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

    // 3. Hyrox specific (occasional suggestion)
    if (Math.random() > 0.7) { // 30% chance to suggest challenge
         suggestions.push({
            id: generateId(),
            type: 'HYROX',
            label: 'Hyrox Mix',
            description: 'Högintensivt styrka & flås',
            reason: 'Utmana dig själv med ett Hyrox-pass!',
            duration: 60,
            intensity: 'high'
        });
    }

    return suggestions;
}
