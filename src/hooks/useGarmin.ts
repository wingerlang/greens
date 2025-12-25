import { useState, useCallback } from 'react';
import { SleepSession, UniversalActivity } from '../models/types.ts';
import { garminService } from '../services/garmin.ts';

export function useGarmin() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);

    const syncMetrics = useCallback(async () => {
        setIsSyncing(true);
        try {
            // Mock date range: Last 7 days
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 7);

            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const sleepData = await garminService.syncSleepData(startStr, endStr);
            const activities = await garminService.syncActivities(startStr, endStr);

            console.log('[useGarmin] Synced:', { sleep: sleepData.length, activities: activities.length });
            setLastSync(new Date().toISOString());

            // TODO: Merge into main DataContext
            return { sleepData, activities };
        } catch (error) {
            console.error('[useGarmin] Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, []);

    return {
        isSyncing,
        lastSync,
        syncMetrics
    };
}
