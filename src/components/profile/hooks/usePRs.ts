// Hook for Personal Records (PR) management
import { useState, useEffect, useCallback } from 'react';
import { profileService } from '../../../services/profileService.ts';

export interface PersonalRecord {
    category: string;
    time: string;
    date?: string;
    activityId?: string;
    isManual?: boolean;
}

export interface DetectedPR {
    category: string;
    time: string;
    date: string;
    activityId: string;
    activityName: string;
}

export interface UsePRsResult {
    prs: PersonalRecord[];
    detectedPRs: DetectedPR[];
    loading: boolean;
    error: string | null;
    savePR: (pr: Omit<PersonalRecord, 'isManual'> & { isManual?: boolean }) => Promise<boolean>;
    deletePR: (category: string) => Promise<boolean>;
    approvePR: (detected: DetectedPR) => Promise<boolean>;
    refresh: () => Promise<void>;
}

export const PR_CATEGORIES = ['1 km', '5 km', '10 km', 'Halvmarathon', 'Marathon'];

export function usePRs(): UsePRsResult {
    const [prs, setPRs] = useState<PersonalRecord[]>([]);
    const [detectedPRs, setDetectedPRs] = useState<DetectedPR[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [savedPRs, detected] = await Promise.all([
                profileService.getPRs(),
                profileService.detectPRs()
            ]);
            setPRs(savedPRs || []);
            // Filter detected to only show those not already saved
            const savedCategories = new Set((savedPRs || []).map((p: PersonalRecord) => p.category));
            setDetectedPRs((detected || []).filter((d: DetectedPR) => !savedCategories.has(d.category)));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load PRs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const savePR = async (pr: Omit<PersonalRecord, 'isManual'> & { isManual?: boolean }): Promise<boolean> => {
        const success = await profileService.savePR(pr);
        if (success) {
            await load();
        }
        return success;
    };

    const deletePR = async (category: string): Promise<boolean> => {
        const success = await profileService.deletePR(category);
        if (success) {
            await load();
        }
        return success;
    };

    const approvePR = async (detected: DetectedPR): Promise<boolean> => {
        return savePR({
            category: detected.category,
            time: detected.time,
            date: detected.date,
            activityId: detected.activityId,
            isManual: false
        });
    };

    return {
        prs,
        detectedPRs,
        loading,
        error,
        savePR,
        deletePR,
        approvePR,
        refresh: load
    };
}
