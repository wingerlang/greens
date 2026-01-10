import { useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { PlannedActivity, generateId } from '../models/types.ts';
import { TrainingSuggestion } from '../utils/trainingSuggestions.ts';

// Helper to check if a date string is valid
const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

export function useSmartTrainingSuggestions(
    selectedDate: string | null,
    weeklyStats: any,
    goalProgress: any
) {
    const { exerciseEntries, plannedActivities, performanceGoals } = useData();

    return useMemo(() => {
        if (!selectedDate) return [];

        const suggestions: TrainingSuggestion[] = [];

        // 1. Rolling 4-Week Volume Analysis
        // ---------------------------------------------------------
        const fourWeeksAgo = new Date(selectedDate);
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        // Filter runs in the last 4 weeks
        const recentRuns = exerciseEntries.filter(e =>
            e.type === 'running' &&
            new Date(e.date) >= fourWeeksAgo &&
            new Date(e.date) < new Date(selectedDate)
        );

        // Calculate Average Weekly Volume
        const totalRecentKm = recentRuns.reduce((sum, e) => sum + (e.distance || 0), 0);
        const avgWeeklyKm = totalRecentKm / 4;

        // Calculate Long Run Pattern (Median of longest run per week)
        // Group by week, find max, then median of maxes
        // (Simplified for now: Median of top 25% longest runs)
        const sortedRuns = [...recentRuns].sort((a, b) => (b.distance || 0) - (a.distance || 0));
        const typicalLongRun = sortedRuns.length > 0 ? sortedRuns[0].distance : 0;

        // 2. Recovery Advisor (Load Check)
        // ---------------------------------------------------------
        // If current planned volume for this week is > 110% of 4-week average -> Suggest Rest/Recovery
        const isHighLoad = weeklyStats.forecast.runningKm > (avgWeeklyKm * 1.1);

        if (isHighLoad && avgWeeklyKm > 10) {
             suggestions.push({
                id: generateId(),
                type: 'REST',
                label: '🧘 Återhämtning',
                description: `Hög veckovolym (${weeklyStats.forecast.runningKm.toFixed(1)}km vs snitt ${avgWeeklyKm.toFixed(1)}km).`,
                reason: 'Minska skaderisken genom vila eller lätt alternativträning.',
                duration: 0,
                intensity: 'low'
            });

             suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: '🔄 Återhämtningsjogg',
                description: 'Mycket lugnt tempo (Zon 1-2).',
                reason: 'Aktiv vila för blodcirkulation.',
                duration: 30,
                distance: 5,
                intensity: 'low'
            });
        }

        // 3. Gap Filler (Goal Deficits)
        // ---------------------------------------------------------
        // Check if we are missing distance for a goal
        if (goalProgress.km) {
            const missingKm = goalProgress.km.target - weeklyStats.forecast.runningKm;
            // Only suggest if missing is significant but achievable (e.g. 3km - 20km)
            if (missingKm > 3 && missingKm < 25) {
                suggestions.push({
                    id: generateId(),
                    type: 'RUN',
                    label: `🎯 Nå veckomålet (${missingKm.toFixed(1)} km)`,
                    description: 'Detta pass stänger gapet till ditt distansmål.',
                    reason: 'Optimera veckan för att nå målet exakt.',
                    duration: Math.round(missingKm * 6), // Rough estimate 6min/km
                    distance: parseFloat(missingKm.toFixed(1)),
                    intensity: 'moderate'
                });
            }
        }

        // 4. Pattern Recognition (Long Run)
        // ---------------------------------------------------------
        // If user usually runs long (>12km) and hasn't planned one this week
        const hasLongRunPlanned = plannedActivities.some(a =>
            (a.category === 'LONG_RUN' || (a.estimatedDistance || 0) > 12) &&
            // Check if it's in the same week as selectedDate
            getWeekNumber(a.date) === getWeekNumber(selectedDate)
        );

        if (!hasLongRunPlanned && typicalLongRun && typicalLongRun > 10 && !isHighLoad) {
             // Suggest a long run based on typical distance
             // Smart increase: +5% or match typical
             const suggestedDist = Math.round(typicalLongRun);

             suggestions.push({
                id: generateId(),
                type: 'RUN',
                label: '🏃 Veckans Långpass',
                description: `Ett klassiskt långpass på ${suggestedDist}km.`,
                reason: 'Du har inte planerat något långpass denna vecka än.',
                duration: Math.round(suggestedDist * 6),
                distance: suggestedDist,
                intensity: 'moderate'
            });
        }

        return suggestions;

    }, [selectedDate, exerciseEntries, weeklyStats, goalProgress, plannedActivities]);
}

// Helper for week number
function getWeekNumber(dateStr: string): number {
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
