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
    save(data: AppData, options?: { skipApi?: boolean }): Promise<void>;
    // Individual entity operations for future database support
    getWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan | undefined>;
    saveWeeklyPlan(plan: WeeklyPlan): Promise<void>;
    deleteWeeklyPlan(id: string): Promise<void>;
    addWeightEntry(weight: number, date: string): Promise<void>;
    addMealEntry(meal: any): Promise<void>;
}

// ============================================
// LocalStorage Implementation
// ============================================


const STORAGE_KEY = 'greens-app-data';
const ENABLE_CLOUD_SYNC = true; // Set to true if running backend server

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
    competitions: [],
    trainingCycles: [],
    performanceGoals: [],
    plannedActivities: [],
    // Phase 8: Data Persistence & Integration
    sleepSessions: [],
    intakeLogs: [],
    universalActivities: []
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
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('http://localhost:8000/api/data', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const cloudData = await res.json() as AppData;
                    // CRITICAL: Only accept cloud data if it seems complete or at least exists
                    if (cloudData && Object.keys(cloudData).length > 2) {
                        console.log('[Storage] Loaded data from API');

                        // Safety merge: If cloud has NO recipes but local does, keep local recipes
                        const localStored = localStorage.getItem(STORAGE_KEY);
                        if (localStored) {
                            const localData = JSON.parse(localStored) as AppData;
                            if (localData.recipes?.length > 0 && (!cloudData.recipes || cloudData.recipes.length === 0)) {
                                console.warn('[Storage] Cloud has no recipes but local does. Merging.');
                                cloudData.recipes = localData.recipes;
                                if (!cloudData.foodItems || cloudData.foodItems.length < 5) cloudData.foodItems = localData.foodItems;
                            }
                        }

                        data = cloudData;
                        // Update local mirror
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    } else {
                        console.log('[Storage] Cloud data empty or invalid, fallback to local');
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
            // Run migrations & ensure data richness
            if (!data.foodItems || data.foodItems.length < SAMPLE_FOOD_ITEMS.length) {
                // If we have fewer food items than our sample set, merge them in to ensure data richness
                const existingIds = new Set(data.foodItems?.map(f => f.id) || []);
                const newItems = SAMPLE_FOOD_ITEMS.filter(f => !existingIds.has(f.id));
                data.foodItems = [...(data.foodItems || []), ...newItems];
            }

            if (!data.recipes || data.recipes.length < 10) {
                // RECOVERY: If recipes are lost, restore from sample data
                console.log('[Storage] Restoring missing recipes from sample set');
                const existingIds = new Set(data.recipes?.map(r => r.id) || []);
                const missingRecipes = SAMPLE_RECIPES.filter(r => !existingIds.has(r.id));
                data.recipes = [...(data.recipes || []), ...missingRecipes];
            }

            if (!data.mealEntries) data.mealEntries = [];
            if (!data.weeklyPlans) data.weeklyPlans = [];
            if (!data.pantryItems) data.pantryItems = [];
            if (!data.users) { data.users = SAMPLE_USERS; data.currentUserId = SAMPLE_USERS[0].id; }
            if (!data.dailyVitals) data.dailyVitals = {};
            if (!data.exerciseEntries) data.exerciseEntries = [];
            if (!data.weightEntries) data.weightEntries = [];
            if (!data.competitions) data.competitions = [];
            if (!data.trainingCycles) data.trainingCycles = [];
            if (!data.pantryQuantities) data.pantryQuantities = {};
            if (!data.plannedActivities) data.plannedActivities = [];

            // Phase 8
            if (!data.intakeLogs) data.intakeLogs = [];
            if (!data.universalActivities) data.universalActivities = [];
        }

        return data;
    }

    async save(data: AppData, options?: { skipApi?: boolean }): Promise<void> {
        try {
            // 1. Save Local
            // console.log('[Storage] Saving to localStorage:', { weeklyPlansCount: data.weeklyPlans?.length });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

            // 2. Sync to API if logged in (and not skipped)
            if (options?.skipApi) return;

            const token = getToken();
            if (token && ENABLE_CLOUD_SYNC) {
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

    async addWeightEntry(weight: number, date: string): Promise<void> {
        // 1. API Optimization: Send ONLY weight entry
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('http://localhost:8000/api/weight', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ weight, date })
                });

                if (!res.ok) throw new Error('API sync failed');

                console.log('[Storage] Weight synced via Granular API');
            } catch (e) {
                console.error('[Storage] Fallback to full sync due to error:', e);
            }
        }
    }

    async addMealEntry(meal: any): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('http://localhost:8000/api/meals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(meal)
                });
                if (!res.ok) throw new Error('API sync failed');
                console.log('[Storage] Meal synced via Granular API');
            } catch (e) {
                console.error('[Storage] Fallback to full sync:', e);
            }
        }
    }
}

// Default instance
export const storageService: StorageService = new LocalStorageService();
