// Hook for activity statistics
import { useState, useEffect, useCallback } from 'react';
import { profileService } from '../../../services/profileService.ts';

export interface PeriodStats {
    activities: number;
    totalDistance: number;
    totalDuration: number;
    totalCalories: number;
}

export interface ActivityTypeStats {
    count: number;
    distance: number;
    duration: number;
}

export interface RecentActivity {
    name?: string;
    type: string;
    date: string;
    distance?: number;
    duration?: number;
}

export interface ActivityStatsData {
    thisWeek: PeriodStats;
    lastWeek: PeriodStats;
    thisMonth: PeriodStats;
    lastMonth: PeriodStats;
    thisYear: PeriodStats;
    allTime: PeriodStats;
    byType: Record<string, ActivityTypeStats>;
    recentActivities: RecentActivity[];
}

export interface UseActivityStatsResult {
    stats: ActivityStatsData | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useActivityStats(): UseActivityStatsResult {
    const [stats, setStats] = useState<ActivityStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await profileService.getActivityStats();
            setStats(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load activity stats');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return {
        stats,
        loading,
        error,
        refresh: load
    };
}
