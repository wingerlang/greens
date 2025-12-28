import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Theme, type UserSettings, type MealType, DEFAULT_USER_SETTINGS } from '../models/types.ts';
import { useData } from './DataContext.tsx';

// ============================================
// Settings Context
// ============================================

interface SettingsContextType {
    settings: UserSettings;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    setVisibleMeals: (meals: MealType[]) => void;
    toggleMealVisibility: (meal: MealType) => void;
    updateSettings: (settings: Partial<UserSettings>) => void;
    setDensityMode: (mode: 'compact' | 'slim' | 'cozy') => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const SETTINGS_STORAGE_KEY = 'greens-user-settings';

const loadSettings = (): UserSettings => {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return DEFAULT_USER_SETTINGS;
};

const saveSettings = (settings: UserSettings): void => {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
};

interface SettingsProviderProps {
    children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
    const { currentUser, updateCurrentUser } = useData();
    const [settings, setSettings] = useState<UserSettings>(() => currentUser?.settings || loadSettings());

    // Sync from currentUser
    useEffect(() => {
        if (currentUser?.settings) {
            setSettings(currentUser.settings);
        }
    }, [currentUser?.id]);

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.theme);
    }, [settings.theme]);

    // Push to currentUser (Data Context) on change
    useEffect(() => {
        if (currentUser) {
            // Only update if settings actually changed from what's in currentUser
            if (JSON.stringify(currentUser.settings) !== JSON.stringify(settings)) {
                updateCurrentUser({ settings });
            }
        }
    }, [settings]);

    const setTheme = (theme: Theme) => {
        setSettings((prev: UserSettings) => ({ ...prev, theme }));
    };

    const toggleTheme = () => {
        setSettings((prev: UserSettings) => ({
            ...prev,
            theme: prev.theme === 'dark' ? 'light' : 'dark'
        }));
    };

    const setVisibleMeals = (meals: MealType[]) => {
        setSettings((prev: UserSettings) => ({ ...prev, visibleMeals: meals }));
    };

    const toggleMealVisibility = (meal: MealType) => {
        setSettings((prev: UserSettings) => {
            const isVisible = prev.visibleMeals.includes(meal);
            return {
                ...prev,
                visibleMeals: isVisible
                    ? prev.visibleMeals.filter((m: MealType) => m !== meal)
                    : [...prev.visibleMeals, meal]
            };
        });
    };

    const updateSettings = (updates: Partial<UserSettings>) => {
        setSettings((prev: UserSettings) => ({ ...prev, ...updates }));
    };

    const setDensityMode = (mode: 'compact' | 'slim' | 'cozy') => {
        setSettings((prev: UserSettings) => ({ ...prev, densityMode: mode }));
    };

    const value: SettingsContextType = {
        settings,
        theme: settings.theme,
        setTheme,
        toggleTheme,
        setVisibleMeals,
        toggleMealVisibility,
        updateSettings,
        setDensityMode,
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings(): SettingsContextType {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
