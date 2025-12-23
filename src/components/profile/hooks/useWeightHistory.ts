// Hook for weight history data management
import { useState, useEffect, useCallback } from 'react';
import { profileService } from '../../../services/profileService.ts';

export interface WeightEntry {
    weight: number;
    date: string;
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
    const [history, setHistory] = useState<WeightEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await profileService.getWeightHistory();
            setHistory(data || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load weight history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const logWeight = async (weight: number, date?: string): Promise<boolean> => {
        const success = await profileService.logWeight(weight, date);
        if (success) {
            await load();
        }
        return success;
    };

    // Calculate derived values
    const latestWeight = history.length > 0 ? history[history.length - 1] : null;
    const previousWeight = history.length > 1 ? history[history.length - 2] : null;

    // 7-day trend
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentEntries = history.filter(h => new Date(h.date) >= weekAgo);
    const weekTrend = recentEntries.length >= 2
        ? recentEntries[recentEntries.length - 1].weight - recentEntries[0].weight
        : null;

    return {
        history,
        loading,
        error,
        latestWeight,
        previousWeight,
        weekTrend,
        logWeight,
        refresh: load
    };
}
