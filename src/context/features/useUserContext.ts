import React, { useState, useCallback, useEffect } from 'react';
import {
    type User,
    type AppSettings,
    type DailyVitals,
    type UserPrivacy,
    getISODate,
    DEFAULT_USER_SETTINGS
} from '../../models/types.ts';
import { storageService } from '../../services/storage.ts';
import type { FeedEventType } from '../../models/feedTypes.ts';

export function useUserContext() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUserState] = useState<User | null>(null);
    const [userSettings, setUserSettings] = useState<AppSettings>(DEFAULT_USER_SETTINGS as AppSettings);
    const [dailyVitals, setDailyVitals] = useState<Record<string, DailyVitals>>({});

    // Helper for Feed events
    const emitFeedEvent = React.useCallback((type: FeedEventType, title: string, payload: any, metrics?: any[], summary?: string) => {
        if (!currentUser) return;

        // Map FeedEventType to Privacy Category
        let category: keyof UserPrivacy['sharing'] = 'social';
        if (type.startsWith('WORKOUT')) category = 'training';
        if (type.startsWith('NUTRITION') || type === 'HYDRATION') category = 'nutrition';
        if (type.startsWith('HEALTH')) category = 'health';
        if (type === 'BODY_METRIC') category = 'body';

        const visibility = (currentUser.privacy?.sharing as any)?.[category] || 'FRIENDS';

        storageService.createFeedEvent({
            type,
            title,
            payload,
            metrics,
            summary,
            timestamp: new Date().toISOString(),
            visibility
        }).catch(err => console.error("Feed event failed:", err));
    }, [currentUser]);

    const setCurrentUser = React.useCallback((user: User | null) => {
        setCurrentUserState(user);
    }, []);

    const addUser = React.useCallback((user: User) => {
        setUsers(prev => [...prev, user]);
    }, []);

    const updateCurrentUser = React.useCallback((updates: Partial<User>) => {
        if (!currentUser) return;

        const updatedUser = { ...currentUser, ...updates };
        setCurrentUserState(updatedUser);

        setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    }, [currentUser]);

    const updateVitals = React.useCallback((date: string, updates: Partial<DailyVitals>) => {
        setDailyVitals(prev => {
            const existing = prev[date] || {
                water: 0,
                sleep: 0,
                caffeine: 0,
                alcohol: 0,
                updatedAt: new Date().toISOString()
            };
            const newData = {
                ...prev,
                [date]: {
                    ...existing,
                    ...updates,
                    updatedAt: new Date().toISOString()
                }
            };

            // Life Stream: Add event for water if increased
            if (updates.water && updates.water > (existing.water || 0)) {
                emitFeedEvent(
                    'HYDRATION',
                    'Drank water',
                    { type: 'HYDRATION', amountMl: (updates.water - (existing.water || 0)) * 1000 },
                    [{ label: 'Amount', value: (updates.water - (existing.water || 0)).toFixed(1), unit: 'L', icon: '💧' }]
                );
            }

            return newData;
        });
    }, [emitFeedEvent]);

    const getVitalsForDate = React.useCallback((date: string): DailyVitals => {
        return dailyVitals[date] || {
            water: 0,
            sleep: 0,
            caffeine: 0,
            alcohol: 0,
            updatedAt: new Date().toISOString()
        };
    }, [dailyVitals]);

    const toggleIncompleteDay = React.useCallback((date: string) => {
        setDailyVitals(prev => {
            const currentVitals = prev[date] || { water: 0, sleep: 0, updatedAt: new Date().toISOString() };
            return {
                ...prev,
                [date]: {
                    ...currentVitals,
                    incomplete: !currentVitals.incomplete,
                    updatedAt: new Date().toISOString()
                }
            };
        });
    }, []);

    const toggleCompleteDay = React.useCallback((date: string) => {
        setDailyVitals(prev => {
            const currentVitals = prev[date] || { water: 0, sleep: 0, updatedAt: new Date().toISOString() };
            return {
                ...prev,
                [date]: {
                    ...currentVitals,
                    completed: !currentVitals.completed,
                    // If we mark as complete, we probably want to ensure it's not marked as incomplete
                    incomplete: !currentVitals.completed ? false : currentVitals.incomplete,
                    updatedAt: new Date().toISOString()
                }
            };
        });
    }, []);

    // Sync userSettings state with currentUser.settings
    React.useEffect(() => {
        if (currentUser?.settings) {
            // Only update if they differ to avoid loops
            if (JSON.stringify(userSettings) !== JSON.stringify(currentUser.settings)) {
                setUserSettings(currentUser.settings);
            }
        }
    }, [currentUser?.settings, userSettings]);

    return {
        // State
        users,
        currentUser,
        userSettings,
        dailyVitals,

        // Setters (for hydration/sync)
        setUsers,
        setCurrentUser: setCurrentUserState, // Internal setter for hydration
        setUserSettings,
        setDailyVitals,

        // Actions
        setCurrentUserPublic: setCurrentUser, // Renamed to avoid conflict with setter
        addUser,
        updateCurrentUser,
        updateVitals,
        getVitalsForDate,
        toggleIncompleteDay,
        toggleCompleteDay,
        emitFeedEvent
    };
}
