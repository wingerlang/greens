// Hook for HR zone detection and management
import { useState, useEffect, useCallback } from 'react';
import { profileService } from '../../../services/profileService.ts';

export interface HRZone {
    name: string;
    min: number;
    max: number;
}

export interface HRZoneData {
    maxHR: number;
    estimatedRestingHR: number;
    estimatedLTHR: number;
    activitiesAnalyzed: number;
    confidence: 'low' | 'medium' | 'high';
    maxHRActivity?: { name: string; date: string };
    zones: Record<string, HRZone>;
}

export interface UseHRZonesResult {
    savedZones: HRZoneData | null;
    detectedZones: HRZoneData | null;
    loading: boolean;
    error: string | null;
    hasUnsavedDetection: boolean;
    saveZones: (zones: HRZoneData) => Promise<boolean>;
    applyDetected: () => Promise<boolean>;
    refresh: () => Promise<void>;
}

export function useHRZones(): UseHRZonesResult {
    const [savedZones, setSavedZones] = useState<HRZoneData | null>(null);
    const [detectedZones, setDetectedZones] = useState<HRZoneData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [saved, detected] = await Promise.all([
                profileService.getHRZones(),
                profileService.detectHRZones()
            ]);
            setSavedZones(saved);
            setDetectedZones(detected);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load HR zones');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const saveZones = async (zones: HRZoneData): Promise<boolean> => {
        const success = await profileService.saveHRZones(zones);
        if (success) {
            setSavedZones(zones);
        }
        return success;
    };

    const applyDetected = async (): Promise<boolean> => {
        if (!detectedZones) return false;
        return saveZones(detectedZones);
    };

    const hasUnsavedDetection = !!detectedZones && !savedZones;

    return {
        savedZones,
        detectedZones,
        loading,
        error,
        hasUnsavedDetection,
        saveZones,
        applyDetected,
        refresh: load
    };
}
