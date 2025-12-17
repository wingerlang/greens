/**
 * Storage Service - Abstraction layer for data persistence
 * Currently uses localStorage, designed for easy migration to SQLite or other backends
 * @module services/storage
 */

import { type AppData, type WeeklyPlan } from '../models/types.ts';
import { SAMPLE_FOOD_ITEMS, SAMPLE_RECIPES } from '../data/sampleData.ts';

// ============================================
// Storage Interface
// ============================================

export interface StorageService {
    load(): Promise<AppData>;
    save(data: AppData): Promise<void>;
    // Individual entity operations for future database support
    getWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan | undefined>;
    saveWeeklyPlan(plan: WeeklyPlan): Promise<void>;
    deleteWeeklyPlan(id: string): Promise<void>;
}

// ============================================
// LocalStorage Implementation
// ============================================

const STORAGE_KEY = 'greens-app-data';

const getDefaultData = (): AppData => ({
    foodItems: SAMPLE_FOOD_ITEMS,
    recipes: SAMPLE_RECIPES,
    mealEntries: [],
    weeklyPlans: [],
    pantryItems: [], // Default empty pantry
});

export class LocalStorageService implements StorageService {
    async load(): Promise<AppData> {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                // Ensure weeklyPlans exists (migration for older data)
                if (!data.weeklyPlans) {
                    data.weeklyPlans = [];
                }
                // Ensure pantryItems exists (migration)
                if (!data.pantryItems) {
                    data.pantryItems = [];
                }
                return data;
            }
        } catch (e) {
            console.error('Failed to load from storage:', e);
        }
        return getDefaultData();
    }

    async save(data: AppData): Promise<void> {
        try {
            console.log('[Storage] Saving to localStorage:', { weeklyPlansCount: data.weeklyPlans?.length });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to storage:', e);
        }
    }

    async getWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan | undefined> {
        const data = await this.load();
        return data.weeklyPlans?.find(p => p.weekStartDate === weekStartDate);
    }

    async saveWeeklyPlan(plan: WeeklyPlan): Promise<void> {
        const data = await this.load();
        const plans = data.weeklyPlans || [];
        const existingIndex = plans.findIndex(p => p.id === plan.id);

        if (existingIndex >= 0) {
            plans[existingIndex] = plan;
        } else {
            plans.push(plan);
        }

        data.weeklyPlans = plans;
        await this.save(data);
    }

    async deleteWeeklyPlan(id: string): Promise<void> {
        const data = await this.load();
        data.weeklyPlans = data.weeklyPlans?.filter(p => p.id !== id) || [];
        await this.save(data);
    }
}

// Default instance
export const storageService: StorageService = new LocalStorageService();
