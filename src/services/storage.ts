/**
 * Storage Service - Abstraction layer for data persistence
 * Currently uses localStorage, designed for easy migration to SQLite or other backends
 * @module services/storage
 */

import { type AppData, type WeeklyPlan, type PerformanceGoal, type TrainingPeriod, type WeightEntry, type PlannedActivity, type QuickMeal, type RaceDefinition, type RaceIgnoreRule } from '../models/types.ts';
import { SAMPLE_FOOD_ITEMS, SAMPLE_RECIPES, SAMPLE_USERS } from '../data/sampleData.ts';
import { notificationService } from './notificationService.ts';

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
    addWeightEntry(entry: WeightEntry): Promise<void>;
    addMealEntry(meal: any): Promise<void>;
    saveGoal(goal: PerformanceGoal): Promise<void>;
    deleteGoal(id: string): Promise<void>;
    savePeriod(period: TrainingPeriod): Promise<void>;
    deletePeriod(id: string): Promise<void>;
    createFeedEvent(event: any): Promise<any>;
    createFoodItem(food: any): Promise<any>;
    updateFoodItem(food: any): Promise<any>;
    deleteFoodItem(id: string): Promise<void>;
    // Recipe Granular
    saveRecipe(recipe: any): Promise<any>;
    deleteRecipe(id: string): Promise<void>;
    // Exercise Granular
    saveExerciseEntry(entry: any): Promise<any>;
    deleteExerciseEntry(id: string, date: string): Promise<void>;
    deleteUniversalActivity(id: string, date: string): Promise<void>;
    deleteStrengthSession(id: string): Promise<void>;
    // Granular updates
    updateMealEntry(meal: any): Promise<void>;
    deleteMealEntry(id: string, date: string): Promise<void>;
    updateWeightEntry(entry: any): Promise<void>;
    deleteWeightEntry(id: string, date: string): Promise<void>;
    saveBodyMeasurement(entry: any): Promise<void>;
    deleteBodyMeasurement(id: string): Promise<void>;
    // Planned Activity Granular
    savePlannedActivity(activity: PlannedActivity): Promise<void>;
    savePlannedActivities(activities: PlannedActivity[]): Promise<void>;
    deletePlannedActivity(id: string): Promise<void>;
    // Quick Meals Granular
    saveQuickMeal(meal: QuickMeal): Promise<void>;
    deleteQuickMeal(id: string): Promise<void>;
    // Race Definitions
    saveRaceDefinition(def: RaceDefinition): Promise<void>;
    deleteRaceDefinition(id: string): Promise<void>;
    saveRaceIgnoreRule(rule: RaceIgnoreRule): Promise<void>;
    deleteRaceIgnoreRule(id: string): Promise<void>;
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
    // Data Persistence & Integration
    sleepSessions: [],
    intakeLogs: [],
    universalActivities: [],
    bodyMeasurements: [],
    quickMeals: [],
    foodAliases: {}
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
                const res = await fetch('/api/data', {
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
                        // Update local mirror (optional, maybe skip if we want "never cached")
                        // But writing to cache is okay, reading from it is the issue.
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

                        // RETURN IMMEDIATELY - Do not fallback/merge with local
                        return data;
                    } else {
                        console.log('[Storage] Cloud data empty or invalid');
                    }
                } else {
                    // Critical: Notify on load failure if server is reachable but errors
                    notificationService.notify('error', 'Kunde inte ladda data från servern (API Error)');
                }
            } catch (e) {
                console.warn('[Storage] API load failed', e);
                // Critical: Notify on network failure
                notificationService.notify('error', 'Kunde inte ladda data från servern (Nätverksfel)');
            }
        }

        // 2. Fallback to LocalStorage (only if API failed or no token)
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

            if (!data.intakeLogs) data.intakeLogs = [];
            if (!data.universalActivities) data.universalActivities = [];
            if (!data.quickMeals) data.quickMeals = [];
            if (!data.foodAliases) data.foodAliases = {};
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
                // Critical: Strict wait for "Save Profile"
                try {
                    const res = await fetch('/api/data', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(data)
                    });

                    if (res.ok) {
                        notificationService.notify('success', 'Data sparad till servern');
                    } else {
                        notificationService.notify('error', 'Kunde inte spara data till servern');
                    }
                } catch (e) {
                    console.error('[Storage] Failed to sync to API:', e);
                    notificationService.notify('error', 'Nätverksfel vid sparning');
                }
            }

        } catch (e) {
            console.error('Failed to save to storage:', e);
            notificationService.notify('error', 'Kunde inte spara lokalt');
        }
    }

    async getWeeklyPlan(weekStartDate: string): Promise<WeeklyPlan | undefined> {
        const data = await this.load();
        return data.weeklyPlans?.find(p => p.weekStartDate === weekStartDate);
    }

    async saveWeeklyPlan(plan: WeeklyPlan): Promise<void> {
        // 1. Update Local Storage (Optimistic)
        const data = await this.load();
        const plans = data.weeklyPlans || [];
        const existingIndex = plans.findIndex(p => p.weekStartDate === plan.weekStartDate);

        if (existingIndex >= 0) {
            plans[existingIndex] = plan;
        } else {
            plans.push(plan);
        }
        data.weeklyPlans = plans;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // 2. Sync to Granular API
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/plans', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(plan)
                });
                if (res.ok) {
                    notificationService.notify('success', 'Veckoplan sparad');
                } else {
                    notificationService.notify('error', 'Kunde inte spara veckoplan');
                }
            } catch (e) {
                console.error('[Storage] Plan sync failed:', e);
                notificationService.notify('error', 'Nätverksfel vid sparande av plan');
            }
        }
    }

    async deleteWeeklyPlan(id: string): Promise<void> {
        // Note: Ideally we delete by weekStartDate, but if ID is passed, we must find the date.
        // The interface defines deleteWeeklyPlan(id), but our repo deletes by weekStartDate.
        // We will need to lookup the plan first.

        const data = await this.load();
        const planToDelete = data.weeklyPlans?.find(p => p.id === id);

        // Update Local
        data.weeklyPlans = data.weeklyPlans?.filter(p => p.id !== id) || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // Sync to API
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC && planToDelete) {
            try {
                await fetch(`/api/plans?start=${planToDelete.weekStartDate}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                notificationService.notify('success', 'Veckoplan borttagen');
            } catch (e) {
                console.error('[Storage] Plan delete failed:', e);
                notificationService.notify('error', 'Kunde inte ta bort veckoplan');
            }
        }
    }

    async addWeightEntry(entry: WeightEntry): Promise<void> {
        // 1. API Optimization: Send ONLY weight entry
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/weight', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(entry)
                });

                if (res.ok) {
                    notificationService.notify('success', 'Vikt sparad');
                } else {
                    throw new Error('API sync failed');
                }

                console.log('[Storage] Weight synced via Granular API');
            } catch (e) {
                console.error('[Storage] Weight sync error:', e);
                notificationService.notify('error', 'Kunde inte spara vikt till servern');
            }
        }
    }

    async addMealEntry(meal: any): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/meals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(meal)
                });
                console.log('[StorageService] addMealEntry sent payload', meal);
                if (!res.ok) {
                    throw new Error('API sync failed');
                }
                // Silently succeed - no notification needed for frequent meal logging
            } catch (e) {
                console.error('[Storage] Meal sync error:', e);
                notificationService.notify('error', 'Kunde inte spara måltid');
            }
        }
    }

    async updateMealEntry(meal: any): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/meals/${meal.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(meal)
                });
                if (res.ok) {
                    notificationService.notify('success', 'Måltid uppdaterad');
                } else {
                    throw new Error('API sync failed');
                }
            } catch (e) {
                console.error('[Storage] Meal update error:', e);
                notificationService.notify('error', 'Kunde inte uppdatera måltid');
            }
        }
    }

    async deleteMealEntry(id: string, date: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/meals/${id}?date=${date}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    notificationService.notify('success', 'Måltid borttagen');
                } else {
                    throw new Error('API sync failed');
                }
            } catch (e) {
                console.error('[Storage] Meal delete error:', e);
                notificationService.notify('error', 'Kunde inte ta bort måltid');
            }
        }
    }

    async updateWeightEntry(entry: any): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/weight/${entry.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(entry)
                });
                if (res.ok) {
                    notificationService.notify('success', 'Vikt uppdaterad');
                } else {
                    throw new Error('API sync failed');
                }
            } catch (e) {
                console.error('[Storage] Weight update error:', e);
                notificationService.notify('error', 'Kunde inte uppdatera vikt');
            }
        }
    }

    async deleteWeightEntry(id: string, date: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/weight/${id}?date=${date}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    notificationService.notify('success', 'Vikt borttagen');
                } else {
                    throw new Error('API sync failed');
                }
            } catch (e) {
                console.error('[Storage] Weight delete error:', e);
                notificationService.notify('error', 'Kunde inte ta bort vikt');
            }
        }
    }

    async saveGoal(goal: PerformanceGoal): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/goals', {
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
                await fetch(`/api/goals?id=${id}`, {
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
                const res = await fetch('/api/periods', {
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
                await fetch(`/api/periods?id=${id}`, {
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
                const res = await fetch('/api/feed/events', {
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

    async createFoodItem(food: any): Promise<any> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/foods', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(food)
                });

                if (res.ok) {
                    const data = await res.json();
                    return data.item; // Return updated item (e.g. with permanent image URL)
                } else {
                    throw new Error('API create failed');
                }
            } catch (e) {
                console.error('[Storage] Food create failed:', e);
            }
        }
        return food; // Fallback to local
    }

    async updateFoodItem(food: any): Promise<any> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/foods/${food.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(food)
                });

                if (res.ok) {
                    const data = await res.json();
                    return data.item; // Return updated item
                } else {
                    throw new Error('API update failed');
                }
            } catch (e) {
                console.error('[Storage] Food update failed:', e);
            }
        }
        return food; // Fallback
    }

    async deleteFoodItem(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`/api/foods/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error('[Storage] Food delete failed:', e);
            }
        }
    }

    async saveRecipe(recipe: any): Promise<any> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const method = recipe.createdAt === recipe.updatedAt ? 'POST' : 'PUT'; // Heuristic, or just upsert with PUT if ID exists? API supports POST for create, PUT for update.
                // But addRecipe in DataContext passes a new recipe.
                // We'll try POST if creating, PUT if updating.
                // Actually, DataContext calls addRecipe then this.
                // Let's rely on backend UPSERT or standard REST.
                // Our API implementation: POST (Create), PUT (Update with ID).

                // For simplicity, let's assume we can determine if it's new.
                // If it's brand new, DataContext just created it.
                // BUT, to be safe, we can check if we are updating.

                // Let's use POST for create, PUT for update.
                // But here we just receive "recipe".
                // We can try to fetch it first? No that's slow.
                // Let's try PUT if we have ID, but PUT usually requires existing resource.
                // Our API: POST /api/recipes checks if ID exists? No, it just saves.
                // Actually our POST /api/recipes implementation just does `recipeRepo.saveRecipe`.
                // And PUT /api/recipes/:id also does `recipeRepo.saveRecipe`.
                // So effectively both are UPSERT in the repo layer.
                // But PUT checks if existing to return 404.
                // So safe bet: Use POST for everything if we don't care about 404 on update.
                // Or:
                const url = recipe.createdAt === recipe.updatedAt ? '/api/recipes' : `/api/recipes/${recipe.id}`;
                const fetchMethod = recipe.createdAt === recipe.updatedAt ? 'POST' : 'PUT';

                const res = await fetch(url, {
                    method: fetchMethod,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(recipe)
                });

                if (res.ok) {
                    notificationService.notify('success', 'Recept sparat');
                    const data = await res.json();
                    return data.recipe;
                } else {
                    throw new Error('API sync failed');
                }
            } catch (e) {
                console.error('[Storage] Recipe sync error:', e);
                notificationService.notify('error', 'Kunde inte spara recept');
            }
        }
        return recipe;
    }

    async deleteRecipe(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`/api/recipes/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                notificationService.notify('success', 'Recept borttaget');
            } catch (e) {
                console.error('[Storage] Recipe delete failed:', e);
                notificationService.notify('error', 'Kunde inte ta bort recept');
            }
        }
    }

    async saveExerciseEntry(entry: any): Promise<any> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const method = entry.createdAt === entry.updatedAt ? 'POST' : 'PUT'; // Similar heuristic as recipes, or check if we have ID
                const url = entry.createdAt === entry.updatedAt ? '/api/exercise-entries' : `/api/exercise-entries/${entry.id}`;
                const fetchMethod = entry.createdAt === entry.updatedAt ? 'POST' : 'PUT';

                const res = await fetch(url, {
                    method: fetchMethod,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(entry)
                });

                if (res.ok) {
                    notificationService.notify('success', 'Träning sparad');
                    const data = await res.json();
                    return data.entry;
                } else {
                    throw new Error('API sync failed');
                }
            } catch (e) {
                console.error('[Storage] Exercise sync error:', e);
                notificationService.notify('error', 'Kunde inte spara träning');
            }
        }
        return entry;
    }

    async deleteExerciseEntry(id: string, date: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`/api/exercise-entries/${id}?date=${date}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                notificationService.notify('success', 'Träning borttagen');
            } catch (e) {
                console.error('[Storage] Exercise delete failed:', e);
                notificationService.notify('error', 'Kunde inte ta bort träning');
            }
        }
    }

    async deleteUniversalActivity(id: string, date: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/activities/${id}?date=${date}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    notificationService.notify('success', 'Aktivitet borttagen');
                } else {
                    const err = await res.json();
                    throw new Error(err.error || 'API Error');
                }
            } catch (e) {
                console.error('[Storage] Universal activity delete failed:', e);
                notificationService.notify('error', 'Kunde inte ta bort aktivitet');
            }
        }
    }

    async deleteStrengthSession(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/strength/workout/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    notificationService.notify('success', 'Styrkepass borttaget');
                } else {
                    const err = await res.json();
                    throw new Error(err.error || 'API Error');
                }
            } catch (e) {
                console.error('[Storage] Strength session delete failed:', e);
                notificationService.notify('error', 'Kunde inte ta bort styrkepass');
            }
        }
    }


    // ============================================
    // Race Definitions
    // ============================================

    async saveRaceDefinition(def: RaceDefinition): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const url = '/api/races/definitions'; // Simplified, assuming backend handles UPSERT on POST or we use POST for all
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(def)
                });
                if (!res.ok) throw new Error('API sync failed');
            } catch (e) {
                console.error('[Storage] Race def sync failed:', e);
            }
        }
    }

    async deleteRaceDefinition(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`/api/races/definitions/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error('[Storage] Race def delete failed:', e);
            }
        }
    }

    async saveRaceIgnoreRule(rule: RaceIgnoreRule): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/races/ignore-rules', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(rule)
                });
                if (!res.ok) throw new Error('API sync failed');
            } catch (e) {
                console.error('[Storage] Ignore rule sync failed:', e);
            }
        }
    }

    async deleteRaceIgnoreRule(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`/api/races/ignore-rules/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error('[Storage] Ignore rule delete failed:', e);
            }
        }
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

    async saveBodyMeasurement(entry: any): Promise<void> {
        const data = await this.load();
        if (!data.bodyMeasurements) data.bodyMeasurements = [];
        const idx = data.bodyMeasurements.findIndex((m: any) => m.id === entry.id);
        if (idx >= 0) {
            data.bodyMeasurements[idx] = entry;
        } else {
            data.bodyMeasurements.push(entry);
        }
        // Save local immediately for optimistic UI
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // API sync (Strict)
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/measurements', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(entry)
                });

                if (res.ok) {
                    notificationService.notify('success', 'Mått sparat');
                } else {
                    notificationService.notify('error', 'Kunde inte spara mått till servern');
                }
            } catch (e) {
                console.error('[Storage] Body measurement sync failed:', e);
                notificationService.notify('error', 'Nätverksfel vid sparande av mått');
            }
        }
    }

    async deleteBodyMeasurement(id: string): Promise<void> {
        const data = await this.load();
        data.bodyMeasurements = data.bodyMeasurements?.filter((m: any) => m.id !== id) || [];
        // Save local immediately
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // API sync (Strict)
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/measurements/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    notificationService.notify('success', 'Mått borttaget');
                } else {
                    notificationService.notify('error', 'Kunde inte ta bort mått från servern');
                }
            } catch (e) {
                console.error('[Storage] Body measurement delete failed:', e);
                notificationService.notify('error', 'Nätverksfel vid borttagning av mått');
            }
        }
    }

    async savePlannedActivity(activity: PlannedActivity): Promise<void> {
        // Optimistic local update not strictly needed as DataContext handles it, 
        // but storage service should ideally update the blob too if we keep using load() from blob.
        // However, with granular sync, we should be careful. 
        // For now, let's just sync to API. DataContext manages local state.

        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/planned-activities', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(activity)
                });
                if (!res.ok) {
                    console.error('[Storage] Failed to save planned activity');
                }
            } catch (e) {
                console.error('[Storage] Planned activity sync failed:', e);
            }
        }
    }

    async savePlannedActivities(activities: PlannedActivity[]): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/planned-activities', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(activities)
                });
                if (!res.ok) {
                    console.error('[Storage] Failed to bulk save planned activities');
                }
            } catch (e) {
                console.error('[Storage] Planned activities bulk sync failed:', e);
            }
        }
    }

    async deletePlannedActivity(id: string): Promise<void> {
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch(`/api/planned-activities?id=${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) {
                    console.error('[Storage] Failed to delete planned activity');
                }
            } catch (e) {
                console.error('[Storage] Planned activity delete failed:', e);
            }
        }
    }

    async saveQuickMeal(meal: QuickMeal): Promise<void> {
        // Local Optimistic
        const data = await this.load();
        if (!data.quickMeals) data.quickMeals = [];
        const idx = data.quickMeals.findIndex(m => m.id === meal.id);
        if (idx >= 0) data.quickMeals[idx] = meal;
        else data.quickMeals.push(meal);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // API
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                const res = await fetch('/api/quick-meals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(meal)
                });
                if (res.ok) notificationService.notify('success', 'Snabbval sparat');
            } catch (e) {
                console.error('[Storage] QuickMeal sync failed:', e);
            }
        }
    }

    async deleteQuickMeal(id: string): Promise<void> {
        // Local
        const data = await this.load();
        data.quickMeals = data.quickMeals?.filter(m => m.id !== id) || [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // API
        const token = getToken();
        if (token && ENABLE_CLOUD_SYNC) {
            try {
                await fetch(`/api/quick-meals?id=${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                notificationService.notify('success', 'Snabbval borttaget');
            } catch (e) {
                console.error('[Storage] QuickMeal delete failed:', e);
            }
        }
    }
}

// Default instance
export const storageService: StorageService = new LocalStorageService();
