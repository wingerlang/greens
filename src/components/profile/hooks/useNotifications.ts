// Hook for notification settings
import { useState, useEffect, useCallback } from 'react';
import { profileService } from '../../../services/profileService.ts';

export interface NotificationSettings {
    emailDigest: boolean;
    pushWorkouts: boolean;
    pushGoals: boolean;
    pushSocial: boolean;
    pushReminders: boolean;
    weeklyReport: boolean;
    marketingEmails: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
    emailDigest: true,
    pushWorkouts: true,
    pushGoals: true,
    pushSocial: false,
    pushReminders: true,
    weeklyReport: true,
    marketingEmails: false
};

export interface UseNotificationsResult {
    settings: NotificationSettings;
    loading: boolean;
    error: string | null;
    toggle: (key: keyof NotificationSettings) => Promise<void>;
    update: (settings: Partial<NotificationSettings>) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
    const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await profileService.getNotifications();
            setSettings(data || DEFAULT_NOTIFICATIONS);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load notifications');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const update = async (updates: Partial<NotificationSettings>): Promise<void> => {
        const newSettings = { ...settings, ...updates };
        setSettings(newSettings);
        await profileService.updateNotifications(updates);
    };

    const toggle = async (key: keyof NotificationSettings): Promise<void> => {
        await update({ [key]: !settings[key] });
    };

    return {
        settings,
        loading,
        error,
        toggle,
        update,
        refresh: load
    };
}
