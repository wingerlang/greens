/**
 * Storage Service - Abstraction layer for data persistence
 * Currently uses localStorage, designed for easy migration to SQLite or other backends
 * @module services/storage
 */

import { type AppData, type WeeklyPlan } from '../models/types.ts';
import { SAMPLE_FOOD_ITEMS, SAMPLE_RECIPES, SAMPLE_USERS } from '../data/sampleData.ts';

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
    users: SAMPLE_USERS,
    currentUserId: SAMPLE_USERS[0].id,
    exerciseEntries: [],
    weightEntries: [],
    competitions: []
});

// Helper to get token (if any)
const getToken = () => {
    return localStorage.getItem('auth_token');
};

export class LocalStorageService implements StorageService {
    async load(): Promise<AppData> {
        let data: AppData | null = null;

        // 1. Try API first if token exists
        const token = getToken();
        if (token) {
            try {
                const res = await fetch('http://localhost:8000/api/data', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const cloudData = await res.json();
                    if (cloudData && Object.keys(cloudData).length > 0) {
                        data = cloudData;
                        console.log('[Storage] Loaded data from API');
                        // Update local mirror
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    }
                }
            } catch (e) {
                console.warn('[Storage] API load failed, falling back to local', e);
            }
        }

        // 2. Fallback to LocalStorage
        if (!data) {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    data = JSON.parse(stored);
                }
            } catch (e) {
                console.error('Failed to load from storage:', e);
            }
        }

        // 3. Defaults & Migrations
        if (!data) {
            data = getDefaultData();
        } else {
            // Run migrations
            if (!data.weeklyPlans) data.weeklyPlans = [];
            if (!data.pantryItems) data.pantryItems = [];
            if (!data.users) { data.users = SAMPLE_USERS; data.currentUserId = SAMPLE_USERS[0].id; }
            if (!data.dailyVitals) data.dailyVitals = {};
            if (!data.exerciseEntries) data.exerciseEntries = [];
            if (!data.weightEntries) data.weightEntries = [];
            if (!data.competitions) data.competitions = [];
        }

        return data;
    }

    async save(data: AppData): Promise<void> {
        try {
            // 1. Save Local
            console.log('[Storage] Saving to localStorage:', { weeklyPlansCount: data.weeklyPlans?.length });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

            // 2. Sync to API if logged in
            const token = getToken();
            if (token) {
                // Fire and forget (don't await to avoid UI lag, but catch errors)
                fetch('http://localhost:8000/api/data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(data)
                }).catch(e => console.error('[Storage] Failed to sync to API:', e));
            }

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
