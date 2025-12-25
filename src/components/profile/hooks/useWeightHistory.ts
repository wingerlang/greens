// Hook for weight history data management - uses DataContext for instant reactivity
import { useMemo, useCallback } from 'react';
import { useData } from '../../../context/DataContext.tsx';

export interface WeightEntry {
    weight: number;
    date: string;
    createdAt?: string;
    id?: string;
}

export interface UseWeightHistoryResult {
    history: WeightEntry[];
    loading: boolean;
    error: string | null;
    latestWeight: WeightEntry | null;
    previousWeight: WeightEntry | null;
    weekTrend: number | null;
    logWeight: (weight: number, date?: string) => Promise<boolean>;
    refresh: () => Promise<void>;
}

export function useWeightHistory(): UseWeightHistoryResult {
    const { weightEntries, addWeightEntry, refreshData } = useData();

    // Convert DataContext weightEntries to the format expected by this hook
    // We enforce sorting here as well to match DataContext's logic perfectly
    const history = useMemo(() => {
        if (!Array.isArray(weightEntries)) return [];

        return [...weightEntries]
            .sort((a, b) => {
                // Primary: Date desc
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;

                // Tiebreaker 1: CreatedAt desc
                const timeA = a.createdAt || "";
                const timeB = b.createdAt || "";
                const timeCompare = timeB.localeCompare(timeA);
                if (timeCompare !== 0) return timeCompare;

                // Tiebreaker 2: ID desc
                return (b.id || "").localeCompare(a.id || "");
            })
            .map(entry => ({
                weight: entry.weight,
                date: entry.date,
                createdAt: entry.createdAt,
                id: entry.id
            }));
    }, [weightEntries]);

    const loading = false;

    const logWeight = useCallback(async (weight: number, date?: string): Promise<boolean> => {
        try {
            addWeightEntry(weight, date || new Date().toISOString().split('T')[0]);
            return true;
        } catch {
            return false;
        }
    }, [addWeightEntry]);

    // Calculate derived values - history is newest-first, so index 0 is latest
    const latestWeight = useMemo(() => history.length > 0 ? history[0] : null, [history]);
    const previousWeight = useMemo(() => history.length > 1 ? history[1] : null, [history]);

    // 7-day trend (need oldest-first for this calculation)
    const weekTrend = useMemo(() => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        // Take history (newest first), filter for recent, reverse to get oldest first
        const recentEntries = history
            .filter(h => new Date(h.date) >= weekAgo)
            .reverse();

        return recentEntries.length >= 2
            ? recentEntries[recentEntries.length - 1].weight - recentEntries[0].weight
            : null;
    }, [history]);

    return {
        history,
        loading,
        error: null,
        latestWeight,
        previousWeight,
        weekTrend,
        logWeight,
        refresh: refreshData
    };
}
