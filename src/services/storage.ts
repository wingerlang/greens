/**
 * Storage Service - Abstraction layer for data persistence
 * Currently uses localStorage, designed for easy migration to SQLite or other backends
 * @module services/storage
 */

import { type AppData, type WeeklyPlan, type PerformanceGoal, type TrainingPeriod, type BodyMeasurementEntry } from '../models/types.ts';
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
    addBodyMeasurement(entry: BodyMeasurementEntry): Promise<void>;
    addMealEntry(meal: any): Promise<void>;
    saveGoal(goal: PerformanceGoal): Promise<void>;
    deleteGoal(id: string): Promise<void>;
    savePeriod(period: TrainingPeriod): Promise<void>;
    deletePeriod(id: string): Promise<void>;
    createFeedEvent(event: any): Promise<any>;
    // Clear specific data from local cache
    clearLocalCache(type: 'meals' | 'exercises' | 'weight' | 'sleep' | 'water' | 'caffeine' | 'food' | 'all'): void;
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
                            // Safety: Merge performance goals intelligently
                            // Combine local and cloud goals by ID, preferring cloud versions if they exist (unless local is newer - but we don't track localUpdatedAt robustly yet)
                            // Ideally we would check timestamps, but for now: union of IDs is safer than overwrite.
                            const cloudGoals = cloudData.performanceGoals || [];
                            const localGoals = localData.performanceGoals || [];

                            if (localGoals.length > 0) {
                                console.log('[Storage] Merging local goals with cloud goals');
                                const mergedGoals = [...cloudGoals];
                                const cloudIds = new Set(cloudGoals.map(g => g.id));

                                localGoals.forEach(localG => {
                                    if (!cloudIds.has(localG.id)) {
                                        // Goal exists locally but not in cloud -> Preserve it (it's likely new)
                                        console.log(`[Storage] Preserving local-only goal: ${localG.name} (${localG.id})`);
                                        mergedGoals.push(localG);
                                    }
                                });
                                cloudData.performanceGoals = mergedGoals;
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

    async addBodyMeasurement(entry: BodyMeasurementEntry): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('http://localhost:8000/api/measurements', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(entry)
                });

                if (!res.ok) throw new Error('API sync failed');
                console.log('[Storage] Measurement synced via Granular API');
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

    async saveGoal(goal: PerformanceGoal): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('http://localhost:8000/api/goals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(goal)
                });
                if (!res.ok) throw new Error('API sync failed');
            } catch (e) {
                console.error('[Storage] Goal sync failed:', e);
            }
        }
    }

    async deleteGoal(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`http://localhost:8000/api/goals?id=${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error('[Storage] Goal delete failed:', e);
            }
        }
    }

    async savePeriod(period: TrainingPeriod): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('http://localhost:8000/api/periods', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(period)
                });
                if (!res.ok) throw new Error('API sync failed');
            } catch (e) {
                console.error('[Storage] Period sync failed:', e);
            }
        }
    }

    async deletePeriod(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`http://localhost:8000/api/periods?id=${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error('[Storage] Period delete failed:', e);
            }
        }
    }

    async createFeedEvent(event: any): Promise<any> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('http://localhost:8000/api/feed/events', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(event)
                });
                if (res.ok) {
                    const data = await res.json();
                    return data.event;
                }
            } catch (e) {
                console.error('[Storage] Failed to create feed event:', e);
            }
        }
        return null;
    }

    /**
     * Clear specific data from localStorage cache
     * This MUST be called after server reset to prevent data resurrection
     */
    clearLocalCache(type: 'meals' | 'exercises' | 'weight' | 'sleep' | 'water' | 'caffeine' | 'food' | 'all'): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;

            if (type === 'all') {
                // Clear everything
                localStorage.removeItem(STORAGE_KEY);
                console.log('[Storage] Cleared all local cache');
                return;
            }

            const data = JSON.parse(stored) as AppData;

            if (type === 'meals' || type === 'food') {
                data.mealEntries = [];
                console.log('[Storage] Cleared mealEntries from local cache');
            } else if (type === 'exercises') {
                data.exerciseEntries = [];
                (data as any).trainingCycles = [];
                (data as any).plannedActivities = [];
                (data as any).strengthSessions = [];
                console.log('[Storage] Cleared exercise data from local cache');
            } else if (type === 'weight') {
                data.weightEntries = [];
                console.log('[Storage] Cleared weightEntries from local cache');
            } else if (type === 'sleep') {
                if ((data as any).sleepSessions) (data as any).sleepSessions = [];
                if ((data as any).dailyVitals) {
                    Object.keys((data as any).dailyVitals).forEach(date => {
                        const v = (data as any).dailyVitals[date];
                        if (v) { v.sleepHours = undefined; v.sleepQuality = undefined; }
                    });
                }
                console.log('[Storage] Cleared sleep data from local cache');
            } else if (type === 'water') {
                if ((data as any).dailyVitals) {
                    Object.keys((data as any).dailyVitals).forEach(date => {
                        const v = (data as any).dailyVitals[date];
                        if (v) v.water = undefined;
                    });
                }
                console.log('[Storage] Cleared water data from local cache');
            } else if (type === 'caffeine') {
                if ((data as any).dailyVitals) {
                    Object.keys((data as any).dailyVitals).forEach(date => {
                        const v = (data as any).dailyVitals[date];
                        if (v) v.caffeine = undefined;
                    });
                }
                console.log('[Storage] Cleared caffeine data from local cache');
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('[Storage] Failed to clear local cache:', e);
        }
    }
}

// Default instance
export const storageService: StorageService = new LocalStorageService();
