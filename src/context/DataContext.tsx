import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import {
    type FoodItem,
    type Recipe,
    type MealEntry,
    type WeeklyPlan,
    type User,
    type PlannedMeal,
    type MealType,
    type AppData,
    type FoodItemFormData,
    type RecipeFormData,
    type MealEntryFormData,
    type WeeklyPlanFormData,
    type NutritionSummary,
    type RecipeWithNutrition,
    type AppSettings,
    generateId,
    getWeekStartDate,
    getWeekdayFromDate,
    getISODate,
    type DailyVitals,
    type ExerciseEntry,
    type WeightEntry,
    type ExerciseType,
    type ExerciseIntensity,
    type Competition,
    type CompetitionRule,
    type CompetitionParticipant,
    type TrainingCycle,
    type PerformanceGoal,
    type CoachConfig,
    type CoachGoal,
    type PlannedActivity,
    type StravaActivity,
    // Phase 8
    type SleepSession,
    type IntakeLog,
    type UniversalActivity,
    type InjuryLog, // Phase 7
    type RecoveryMetric, // Phase 7
    type StrengthSession, // Phase 12
    type StrengthMuscleGroup,
    type StrengthExercise,
    type UserPrivacy,
    type BodyMeasurementEntry, // Phase Legacy+
    type TrainingPeriod,
    type QuickMeal,
    type MealItem
} from '../models/types.ts';
import { type StrengthWorkout } from '../models/strengthTypes.ts';
import { storageService } from '../services/storage.ts';
import type { FeedEventType } from '../models/feedTypes.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import { generateTrainingPlan } from '../services/coach/planGenerator.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { slugify } from '../utils/formatters.ts';
import { calculatePerformanceScore } from '../utils/performanceEngine.ts';
import { safeFetch } from '../utils/http.ts';
import { calculateItemNutrition, calculateRecipeNutrition as calculateRecipeNutritionUtil, calculateMealItemNutrition } from '../utils/nutrition/calculations.ts';

// ============================================
// Context Types
// ============================================

interface DataContextType {
    // State
    foodItems: FoodItem[];
    recipes: Recipe[];
    mealEntries: MealEntry[];
    weeklyPlans: WeeklyPlan[];
    pantryItems: string[]; // Legacy: items marked as "have at home"
    pantryQuantities: Record<string, { quantity: number; unit: string }>; // New: quantity tracking
    userSettings: AppSettings;
    users: User[];
    currentUser: User | null;

    // Global UI State
    selectedDate: string;
    setSelectedDate: (date: string) => void;

    // User CRUD
    setCurrentUser: (user: User | null) => void;
    updateCurrentUser: (updates: Partial<User>) => void;
    addUser: (user: User) => void;
    toggleIncompleteDay: (date: string) => void;
    toggleCompleteDay: (date: string) => void;

    // Pantry CRUD
    togglePantryItem: (item: string) => void;
    setPantryItems: (items: string[]) => void;
    setPantryQuantity: (itemName: string, quantity: number, unit: string) => void;
    getPantryQuantity: (itemName: string) => { quantity: number; unit: string } | undefined;

    // FoodItem CRUD
    addFoodItem: (data: FoodItemFormData) => FoodItem;
    updateFoodItem: (id: string, data: Partial<FoodItemFormData>) => void;
    deleteFoodItem: (id: string) => void;
    getFoodItem: (id: string) => FoodItem | undefined;

    // Recipe CRUD
    addRecipe: (data: RecipeFormData) => Recipe;
    updateRecipe: (id: string, data: Partial<RecipeFormData>) => void;
    deleteRecipe: (id: string) => void;
    getRecipe: (id: string) => Recipe | undefined;
    getRecipeWithNutrition: (id: string) => RecipeWithNutrition | undefined;

    // MealEntry CRUD
    addMealEntry: (data: MealEntryFormData) => MealEntry;
    updateMealEntry: (id: string, data: Partial<MealEntryFormData>) => void;
    deleteMealEntry: (id: string) => void;
    getMealEntriesForDate: (date: string) => MealEntry[];

    // WeeklyPlan CRUD
    getWeeklyPlan: (weekStartDate: string) => WeeklyPlan | undefined;
    saveWeeklyPlan: (weekStartDate: string, meals: WeeklyPlan['meals']) => void;
    getPlannedMealsForDate: (date: string) => { mealType: MealType; meal: PlannedMeal }[];

    // Computed
    calculateRecipeNutrition: (recipe: Recipe) => NutritionSummary;
    calculateDailyNutrition: (date: string) => NutritionSummary;
    calculateBMR: () => number;
    calculateExerciseCalories: (type: ExerciseType, duration: number, intensity: ExerciseIntensity) => number;

    // Vitals CRUD
    dailyVitals: Record<string, DailyVitals>;
    updateVitals: (date: string, updates: Partial<DailyVitals>) => void;
    getVitalsForDate: (date: string) => DailyVitals;

    // Exercise CRUD
    exerciseEntries: ExerciseEntry[];
    addExercise: (data: Omit<ExerciseEntry, 'id' | 'createdAt'>) => ExerciseEntry;
    updateExercise: (id: string, updates: Partial<ExerciseEntry>) => void;
    deleteExercise: (id: string) => void;
    getExercisesForDate: (date: string) => ExerciseEntry[];

    // Weight CRUD
    weightEntries: WeightEntry[];
    addWeightEntry: (weight: number, date?: string, waist?: number, chest?: number, hips?: number, thigh?: number) => WeightEntry;
    bulkAddWeightEntries: (entries: Partial<WeightEntry>[]) => void;
    updateWeightEntry: (id: string, weight?: number, date?: string, updates?: Partial<WeightEntry>) => void;
    deleteWeightEntry: (id: string) => void;
    getLatestWeight: () => number;
    getLatestWaist: () => number | undefined;

    // Competition CRUD
    competitions: Competition[];
    addCompetition: (data: Omit<Competition, 'id' | 'createdAt'>) => Competition;
    updateCompetition: (id: string, updates: Partial<Competition>) => void;
    deleteCompetition: (id: string) => void;
    calculateParticipantPoints: (compId: string, userId: string, date: string) => number;

    // Training Cycle CRUD
    trainingCycles: TrainingCycle[];
    addTrainingCycle: (data: Omit<TrainingCycle, 'id'>) => TrainingCycle;
    updateTrainingCycle: (id: string, updates: Partial<TrainingCycle>) => void;
    deleteTrainingCycle: (id: string) => void;

    // Strength Sessions CRUD
    strengthSessions: StrengthWorkout[];
    addStrengthSession: (session: Omit<StrengthWorkout, 'id'>) => StrengthWorkout;
    updateStrengthSession: (id: string, updates: Partial<StrengthWorkout>) => void;
    deleteStrengthSession: (id: string) => void;

    // Performance Goals CRUD
    performanceGoals: PerformanceGoal[];
    addGoal: (data: Omit<PerformanceGoal, 'id' | 'createdAt'>) => PerformanceGoal;
    updateGoal: (id: string, updates: Partial<PerformanceGoal>) => void;
    deleteGoal: (id: string) => void;
    getGoalsForCycle: (cycleId: string) => PerformanceGoal[];

    // Training Periods CRUD
    trainingPeriods: TrainingPeriod[];
    addTrainingPeriod: (data: Omit<TrainingPeriod, 'id' | 'createdAt' | 'updatedAt'>) => TrainingPeriod;
    updateTrainingPeriod: (id: string, updates: Partial<TrainingPeriod>) => void;
    deleteTrainingPeriod: (id: string) => void;

    // Smart Coach CRUD
    coachConfig: CoachConfig | undefined;
    plannedActivities: PlannedActivity[];
    updateCoachConfig: (updates: Partial<CoachConfig>) => void;
    generateCoachPlan: (stravaHistory: StravaActivity[], configOverride?: CoachConfig) => void;
    deletePlannedActivity: (id: string) => void;
    updatePlannedActivity: (id: string, updates: Partial<PlannedActivity>) => void;
    savePlannedActivities: (activities: PlannedActivity[]) => void;
    completePlannedActivity: (activityId: string, actualDist?: number, actualTime?: number, feedback?: PlannedActivity['feedback']) => void;
    addCoachGoal: (goalData: Omit<CoachGoal, 'id' | 'createdAt' | 'isActive'>) => void;
    activateCoachGoal: (goalId: string) => void;
    deleteCoachGoal: (goalId: string) => void;

    // Phase 8: Data Integration
    sleepSessions: SleepSession[];
    intakeLogs: IntakeLog[];
    universalActivities: UniversalActivity[];
    addSleepSession: (session: SleepSession) => void;

    injuryLogs: InjuryLog[];
    recoveryMetrics: RecoveryMetric[];
    addInjuryLog: (log: Omit<InjuryLog, 'id' | 'createdAt' | 'updatedAt'>) => InjuryLog;
    updateInjuryLog: (id: string, updates: Partial<InjuryLog>) => void;
    deleteInjuryLog: (id: string) => void;
    addRecoveryMetric: (metric: Omit<RecoveryMetric, 'id'>) => RecoveryMetric;


    // Body Measurements
    bodyMeasurements: BodyMeasurementEntry[];
    addBodyMeasurement: (entry: Omit<BodyMeasurementEntry, 'id' | 'createdAt'>) => void;
    updateBodyMeasurement: (id: string, updates: Partial<BodyMeasurementEntry>) => void;
    deleteBodyMeasurement: (id: string) => void;

    // Quick Meals & Aliases
    quickMeals: QuickMeal[];
    addQuickMeal: (name: string, items: MealItem[]) => void;
    updateQuickMeal: (id: string, updates: Partial<Omit<QuickMeal, 'id' | 'userId' | 'createdAt'>>) => void;
    deleteQuickMeal: (id: string) => void;
    foodAliases: Record<string, string>;
    updateFoodAlias: (foodId: string, alias: string) => void;

    unifiedActivities: (ExerciseEntry & { source: string; _mergeData?: any })[];
    calculateStreak: (referenceDate?: string) => number;
    calculateTrainingStreak: (referenceDate?: string, type?: string) => number;
    calculateWeeklyTrainingStreak: (referenceDate?: string) => number;
    calculateCalorieGoalStreak: (referenceDate?: string) => number;

    // System
    refreshData: () => Promise<void>;
    isLoading: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

// ============================================
// Provider Component
// ============================================

interface DataProviderProps {
    children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {

    const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
    const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
    const [pantryItems, setPantryItems] = useState<string[]>([]);
    const [pantryQuantities, setPantryQuantitiesState] = useState<Record<string, { quantity: number; unit: string }>>({});
    const [userSettings, setUserSettings] = useState<AppSettings>({
        visibleMeals: ['breakfast', 'lunch', 'dinner', 'snack']
    });
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUserState] = useState<User | null>(null);
    const [selectedDate, setSelectedDate] = useState(getISODate());
    const [dailyVitals, setDailyVitals] = useState<Record<string, DailyVitals>>({});
    const [exerciseEntries, setExerciseEntries] = useState<ExerciseEntry[]>([]);
    const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [trainingCycles, setTrainingCycles] = useState<TrainingCycle[]>([]);
    const [strengthSessions, setStrengthSessions] = useState<StrengthWorkout[]>([]);
    const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoal[]>([]);
    const [trainingPeriods, setTrainingPeriods] = useState<TrainingPeriod[]>([]);
    const [coachConfig, setCoachConfig] = useState<CoachConfig | undefined>(undefined);
    const [plannedActivities, setPlannedActivities] = useState<PlannedActivity[]>([]);

    // Phase 8: Integration State
    const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);
    const [intakeLogs, setIntakeLogs] = useState<IntakeLog[]>([]);
    const [universalActivities, setUniversalActivities] = useState<UniversalActivity[]>([]);

    // Phase 7: Physio-AI State
    const [injuryLogs, setInjuryLogs] = useState<InjuryLog[]>([]);
    const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetric[]>([]);
    const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurementEntry[]>([]);

    // Quick Meals & Aliases
    const [quickMeals, setQuickMeals] = useState<QuickMeal[]>([]);
    const [foodAliases, setFoodAliases] = useState<Record<string, string>>({});

    const [isLoaded, setIsLoaded] = useState(false);

    // Helper for Feed events
    const emitFeedEvent = useCallback((type: FeedEventType, title: string, payload: any, metrics?: any[], summary?: string) => {
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

    // Optimization: Skip auto-save for atomic updates that are handled by dedicated API calls
    const skipAutoSave = useRef(false);

    // Guard: Prevent async refresh from overwriting local state after initial load
    // Using a counter to track latest valid load
    const refreshCounterRef = useRef(0);

    // Load from storage on mount - only runs once, does not overwrite after isLoaded=true
    const refreshData = useCallback(async () => {
        const currentLoadId = ++refreshCounterRef.current;

        // If already loaded, this is a background refresh. We should be careful.
        setIsLoaded(false);
        const data = await storageService.load();

        // If a new load or local update started while we were fetching, DISCARD these results
        if (currentLoadId !== refreshCounterRef.current) {
            console.log('[DataContext] Discarding stale load results');
            return;
        }


        // De-duplicate items to prevent React key warnings and glitches
        const deDuplicate = <T extends { id: string }>(items: T[]): T[] => {
            const seen = new Set();
            return items.filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
        };

        // CRITICAL: Skip auto-save for this batch of state updates
        // This prevents race condition where refreshData() re-posts old local data
        skipAutoSave.current = true;

        setFoodItems(deDuplicate(data.foodItems || []));
        setRecipes(deDuplicate(data.recipes || []));
        setMealEntries(data.mealEntries || []);
        setWeeklyPlans(data.weeklyPlans || []);
        setPantryItems(data.pantryItems || []);
        setPantryQuantitiesState(data.pantryQuantities || {});

        // Handle Users
        let loadedUsers = data.users || [];

        // If we are online, try to fetch the real user list for Community/Social features
        // If we are online, try to fetch the real user list for Community/Social features
        const token = localStorage.getItem('auth_token');
        if (token) {
            // Create AbortController for this refresh cycle
            const abortController = new AbortController();
            const signal = abortController.signal;

            try {
                console.log('[DataContext] Starting parallel sync...');

                // execute all independent fetches in parallel
                const [userPayload, mePayload, planData, strengthData, quickMealsData] = await Promise.all([
                    safeFetch<{ users: User[] }>('/api/users', { headers: { 'Authorization': `Bearer ${token}` }, signal }),
                    safeFetch<{ user: User }>('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` }, signal }),
                    safeFetch<{ activities: PlannedActivity[] }>('/api/planned-activities', { headers: { 'Authorization': `Bearer ${token}` } }),
                    safeFetch<{ workouts: StrengthWorkout[] }>('/api/strength/workouts', { headers: { 'Authorization': `Bearer ${token}` } }),
                    safeFetch<QuickMeal[]>('/api/quick-meals', { headers: { 'Authorization': `Bearer ${token}` } })
                ]);


                // 1. Handle Users
                if (userPayload && userPayload.users && Array.isArray(userPayload.users)) {
                    console.log('[DataContext] Loaded real users list:', userPayload.users.map(u => u.username));
                    loadedUsers = userPayload.users;
                    data.users = loadedUsers;
                }

                // 2. Handle Me (Current User)
                if (mePayload && mePayload.user) {
                    console.log('[DataContext] Resolved current user:', mePayload.user.username);
                    data.currentUserId = mePayload.user.id;
                    if (!loadedUsers.find(u => u.id === mePayload.user.id)) {
                        loadedUsers.push(mePayload.user);
                    }
                }

                // 3. Handle Planned Activities
                if (planData && planData.activities && Array.isArray(planData.activities)) {
                    console.log('[DataContext] Loaded planned activities globally:', planData.activities.length);
                    const newActivities = planData.activities;
                    const existing = data.plannedActivities || [];
                    const newIds = new Set(newActivities.map((a: PlannedActivity) => a.id));
                    const merged = [
                        ...existing.filter((a: PlannedActivity) => !newIds.has(a.id)),
                        ...newActivities
                    ];
                    data.plannedActivities = merged;
                }

                // 4. Handle Strength Workouts
                if (strengthData && strengthData.workouts && Array.isArray(strengthData.workouts)) {
                    console.log('[DataContext] Loaded strength workouts globally:', strengthData.workouts.length);
                    data.strengthSessions = strengthData.workouts;

                    // Update local mirror so next load has it
                    const stored = localStorage.getItem('greens-app-data');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        parsed.strengthSessions = strengthData.workouts;
                        localStorage.setItem('greens-app-data', JSON.stringify(parsed));
                    }
                }

                // 5. Handle Quick Meals
                if (quickMealsData && Array.isArray(quickMealsData)) {
                    console.log('[DataContext] Loaded quick meals:', quickMealsData.length);
                    data.quickMeals = quickMealsData;
                    setQuickMeals(quickMealsData);

                    // Update local mirror
                    const stored = localStorage.getItem('greens-app-data');
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        parsed.quickMeals = quickMealsData;
                        localStorage.setItem('greens-app-data', JSON.stringify(parsed));
                    }
                }

            } catch (e: unknown) {
                if (e instanceof Error && e.name === 'AbortError') {
                    console.log('[DataContext] Request aborted (expected during re-renders)');
                } else {
                    console.error('[DataContext] Exception during parallel sync:', e);
                }
            }
        } else {
            console.log('[DataContext] No token found, skipping online sync.');
        }

        setUsers(loadedUsers);

        if (data.currentUserId) {
            const current = loadedUsers.find(u => u.id === data.currentUserId);
            if (current) setCurrentUserState(current);
        } else if (loadedUsers.length > 0) {
            setCurrentUserState(loadedUsers[0]);
        }

        if (data.userSettings) {
            setUserSettings(data.userSettings);
        }

        if (data.dailyVitals) {
            setDailyVitals(data.dailyVitals);
        }
        if (data.exerciseEntries) {
            setExerciseEntries(data.exerciseEntries);
        }
        if (data.weightEntries) {
            const normalizedWeights = (data.weightEntries || []).map((w: any) => {
                let date = w.date;
                if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    if (date.includes('/') || date.includes('.')) {
                        const sep = date.includes('/') ? '/' : '.';
                        const parts = date.split(sep);
                        if (parts.length === 3) {
                            if (parts[2].length === 4) { // DD/MM/YYYY
                                date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            } else if (parts[0].length === 4) { // YYYY/MM/DD
                                date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                            }
                        }
                    }
                }
                return { ...w, date };
            });
            setWeightEntries(normalizedWeights);
        }
        if (data.competitions) {
            setCompetitions(data.competitions || []);
        }
        if (data.trainingCycles) {
            setTrainingCycles(data.trainingCycles || []);
        }
        if (data.strengthSessions) {
            setStrengthSessions(data.strengthSessions || []);
        }
        if (data.performanceGoals) {
            // Migration: Assign orphan goals to stored user
            const migrated = (data.performanceGoals || []).map((g: PerformanceGoal) => ({
                ...g,
                userId: g.userId || data.currentUserId || 'unknown'
            }));
            setPerformanceGoals(migrated);
        }
        if ((data as any).trainingPeriods) {
            setTrainingPeriods((data as any).trainingPeriods || []);
        }
        if (data.coachConfig) {
            setCoachConfig(data.coachConfig);
        }
        if (data.plannedActivities) setPlannedActivities(data.plannedActivities || []);
        if (data.sleepSessions) setSleepSessions(data.sleepSessions);
        if (data.intakeLogs) setIntakeLogs(data.intakeLogs);
        if (data.universalActivities) setUniversalActivities(data.universalActivities);
        if (data.injuryLogs) setInjuryLogs(data.injuryLogs);
        if (data.recoveryMetrics) setRecoveryMetrics(data.recoveryMetrics);
        if (data.bodyMeasurements) setBodyMeasurements(data.bodyMeasurements || []);
        if (data.quickMeals) setQuickMeals(data.quickMeals);
        if (data.foodAliases) setFoodAliases(data.foodAliases || {});

        setIsLoaded(true);
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Save to storage on changes
    useEffect(() => {
        if (isLoaded) {
            const shouldSkipApi = skipAutoSave.current;
            if (shouldSkipApi) {
                console.log("Optimizing auto-save: Skipping API sync for atomic update");
                skipAutoSave.current = false;
            }

            storageService.save({
                foodItems,
                recipes,
                mealEntries,
                weeklyPlans,
                pantryItems,
                pantryQuantities,
                userSettings,
                users,
                currentUserId: currentUser?.id,
                dailyVitals,
                exerciseEntries,
                weightEntries,
                competitions,
                trainingCycles,
                strengthSessions,
                performanceGoals,
                trainingPeriods,
                coachConfig,
                plannedActivities,
                // Phase 8
                sleepSessions,
                intakeLogs,
                universalActivities,
                injuryLogs,
                recoveryMetrics,
                bodyMeasurements,
                quickMeals,
                foodAliases
            }, { skipApi: true }); // FIX: Permanently disable Global API Dump. Rely on Granular Sync.
        }
    }, [
        foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities,
        userSettings, users, currentUser, isLoaded, dailyVitals, exerciseEntries,
        weightEntries, competitions, trainingCycles, strengthSessions, performanceGoals,
        coachConfig, plannedActivities,
        // Phase 8
        sleepSessions, intakeLogs, universalActivities,
        // Phase 7
        injuryLogs, recoveryMetrics,
        // Phase 13
        bodyMeasurements,
        quickMeals, foodAliases
    ]);

    // ============================================
    // Pantry CRUD
    // ============================================

    const togglePantryItem = useCallback((item: string) => {
        setPantryItems((prev: string[]) => {
            const next = [...prev];
            const index = next.indexOf(item);
            if (index >= 0) {
                next.splice(index, 1);
            } else {
                next.push(item);
            }
            return next;
        });
    }, []);

    // Set specific quantity for a pantry item
    const setPantryQuantity = useCallback((itemName: string, quantity: number, unit: string) => {
        const key = itemName.toLowerCase();
        setPantryQuantitiesState(prev => {
            if (quantity <= 0) {
                // Remove item if quantity is 0 or negative
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: { quantity, unit } };
        });
        // Also add to pantryItems if not present
        setPantryItems(prev => {
            if (!prev.includes(key)) {
                return [...prev, key];
            }
            return prev;
        });
    }, []);

    // Get quantity of a pantry item
    const getPantryQuantity = useCallback((itemName: string): { quantity: number; unit: string } | undefined => {
        return pantryQuantities[itemName.toLowerCase()];
    }, [pantryQuantities]);

    // ============================================
    // User Management
    // ============================================

    const setCurrentUser = useCallback((user: User | null) => {
        setCurrentUserState(user);
    }, []);

    const addUser = useCallback((user: User) => {
        setUsers(prev => [...prev, user]);
    }, []);

    const updateCurrentUser = useCallback((updates: Partial<User>) => {
        if (!currentUser) return;

        const updatedUser = { ...currentUser, ...updates };
        setCurrentUserState(updatedUser);

        setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    }, [currentUser]);

    const toggleIncompleteDay = useCallback((date: string) => {
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

    const toggleCompleteDay = useCallback((date: string) => {
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


    // ============================================
    // FoodItem CRUD
    // ============================================

    const addFoodItem = useCallback((data: FoodItemFormData): FoodItem => {
        const now = new Date().toISOString();
        const newItem: FoodItem = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        };
        // Optimistic update
        setFoodItems((prev: FoodItem[]) => [...prev, newItem]);

        // Sync to API and update local state with server response (e.g. permanent Image URL)
        skipAutoSave.current = true;
        storageService.createFoodItem(newItem).then((serverItem) => {
            if (serverItem) {
                setFoodItems(prev => prev.map(i => i.id === newItem.id ? serverItem : i));
            }
        }).catch(e => console.error("Failed to sync food:", e));

        return newItem;
    }, []);

    const updateFoodItem = useCallback((id: string, data: Partial<FoodItemFormData>): void => {
        setFoodItems((prev: FoodItem[]) => {
            const next = prev.map((item: FoodItem) =>
                item.id === id
                    ? { ...item, ...data, updatedAt: new Date().toISOString() }
                    : item
            );

            // Sync updated item
            const updatedItem = next.find(i => i.id === id);
            if (updatedItem) {
                skipAutoSave.current = true;
                storageService.updateFoodItem(updatedItem).then((serverItem) => {
                    if (serverItem) {
                        setFoodItems(current => current.map(i => i.id === id ? serverItem : i));
                    }
                }).catch(e => console.error("Failed to sync food:", e));
            }

            return next;
        });
    }, []);

    const deleteFoodItem = useCallback((id: string): void => {
        setFoodItems((prev: FoodItem[]) => prev.filter((item: FoodItem) => item.id !== id));
        skipAutoSave.current = true;
        storageService.deleteFoodItem(id).catch(e => console.error("Failed to delete food:", e));
    }, []);

    const getFoodItem = useCallback((id: string): FoodItem | undefined => {
        return foodItems.find(item => item.id === id);
    }, [foodItems]);

    // ============================================
    // Recipe CRUD
    // ============================================

    const addRecipe = useCallback((data: RecipeFormData): Recipe => {
        const now = new Date().toISOString();
        const newRecipe: Recipe = {
            ...data,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
        };
        setRecipes((prev: Recipe[]) => [...prev, newRecipe]);

        skipAutoSave.current = true;
        storageService.saveRecipe(newRecipe).catch(e => console.error("Failed to save recipe", e));

        return newRecipe;
    }, []);

    const updateRecipe = useCallback((id: string, data: Partial<RecipeFormData>): void => {
        const existing = recipes.find(r => r.id === id);
        if (!existing) return;

        const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };

        setRecipes((prev: Recipe[]) => prev.map(r => r.id === id ? updated : r));

        skipAutoSave.current = true;
        storageService.saveRecipe(updated).catch(e => console.error("Failed to update recipe", e));
    }, [recipes]);

    const deleteRecipe = useCallback((id: string): void => {
        setRecipes((prev: Recipe[]) => prev.filter((recipe: Recipe) => recipe.id !== id));
        skipAutoSave.current = true;
        storageService.deleteRecipe(id).catch(e => console.error("Failed to delete recipe", e));
    }, []);

    const getRecipe = useCallback((id: string): Recipe | undefined => {
        return recipes.find(recipe => recipe.id === id);
    }, [recipes]);

    // ============================================
    // Nutrition Calculations
    // ============================================

    const calculateRecipeNutrition = useCallback((recipe: Recipe): NutritionSummary => {
        return calculateRecipeNutritionUtil(recipe, foodItems);
    }, [foodItems]);

    const getRecipeWithNutrition = useCallback((id: string): RecipeWithNutrition | undefined => {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return undefined;

        const nutrition = calculateRecipeNutrition(recipe);
        const servings = recipe.servings || 1;

        return {
            ...recipe,
            nutrition,
            nutritionPerServing: {
                calories: Math.round(nutrition.calories / servings),
                protein: Math.round((nutrition.protein / servings) * 10) / 10,
                carbs: Math.round((nutrition.carbs / servings) * 10) / 10,
                fat: Math.round((nutrition.fat / servings) * 10) / 10,
                fiber: Math.round((nutrition.fiber / servings) * 10) / 10,
            },
        };
    }, [recipes, calculateRecipeNutrition]);

    // ============================================
    // MealEntry CRUD
    // ============================================

    const addMealEntry = useCallback((data: MealEntryFormData): MealEntry => {
        const newEntry: MealEntry = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
        };
        console.log('[DataContext] addMealEntry', newEntry);
        setMealEntries((prev: MealEntry[]) => [...prev, newEntry]);

        // Optimistic update done, now fire granular API call
        skipAutoSave.current = true;
        storageService.addMealEntry(newEntry).catch(e => {
            console.error("Failed to sync meal:", e);
        });

        // Life Stream: Add event
        // Calculate nutrition summary for the feed event
        let totalCals = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let totalAlcoholUnits = 0; // Track alcohol units
        let totalCaffeine = 0; // Track caffeine

        newEntry.items.forEach(item => {
            const { nutrition, caffeine, alcoholUnits } = calculateMealItemNutrition(item, recipes, foodItems);

            totalCals += nutrition.calories;
            totalProtein += nutrition.protein;
            totalCarbs += nutrition.carbs;
            totalFat += nutrition.fat;

            if (caffeine) totalCaffeine += caffeine;
            if (alcoholUnits) totalAlcoholUnits += alcoholUnits;
        });

        // Update daily vitals with alcohol units/caffeine if any were consumed
        if (totalAlcoholUnits > 0 || totalCaffeine > 0) {
            const date = newEntry.date;
            setDailyVitals(prev => {
                const existing = prev[date] || { water: 0, sleep: 0, updatedAt: new Date().toISOString() };

                const newAlcohol = (existing.alcohol || 0) + Math.round(totalAlcoholUnits * 10) / 10;
                const newCaffeine = (existing.caffeine || 0) + Math.round(totalCaffeine);

                return {
                    ...prev,
                    [date]: {
                        ...existing,
                        alcohol: totalAlcoholUnits > 0 ? newAlcohol : existing.alcohol,
                        caffeine: totalCaffeine > 0 ? newCaffeine : existing.caffeine,
                        updatedAt: new Date().toISOString()
                    }
                };
            });
            console.log(`[Vitals] Added ${totalAlcoholUnits.toFixed(1)} units alcohol and ${totalCaffeine}mg caffeine for ${date}`);
        }

        emitFeedEvent(
            'NUTRITION_MEAL',
            `Loggade ${newEntry.mealType.charAt(0).toUpperCase() + newEntry.mealType.slice(1)}`,
            {
                type: 'NUTRITION_MEAL',
                mealType: newEntry.mealType,
                calories: Math.round(totalCals),
                protein: Math.round(totalProtein),
                carbs: Math.round(totalCarbs),
                fat: Math.round(totalFat),
            },
            [{ label: 'Energi', value: Math.round(totalCals), unit: 'kcal', icon: '🔥' }]
        );

        return newEntry;
    }, [foodItems, recipes, calculateRecipeNutrition, emitFeedEvent]);

    const updateMealEntry = useCallback((id: string, data: Partial<MealEntry>): void => {
        let entryToUpdate: MealEntry | undefined;

        setMealEntries((prev: MealEntry[]) => {
            const next = prev.map((entry: MealEntry) => {
                if (entry.id === id) {
                    const updated = { ...entry, ...data };
                    entryToUpdate = updated;
                    return updated;
                }
                return entry;
            });
            return next;
        });

        // Sync via Granular API outside of state updater
        if (entryToUpdate) {
            skipAutoSave.current = true;
            storageService.updateMealEntry(entryToUpdate).catch(e => console.error("Failed to update meal", e));
        }
    }, [storageService]);

    const deleteMealEntry = useCallback((id: string): void => {
        let entryToDelete: MealEntry | undefined;

        setMealEntries((prev: MealEntry[]) => {
            const entry = prev.find(e => e.id === id);
            if (entry) {
                entryToDelete = entry;
                skipAutoSave.current = true;
            }
            return prev.filter((entry: MealEntry) => entry.id !== id);
        });

        if (entryToDelete) {
            storageService.deleteMealEntry(id, entryToDelete.date).catch(e => console.error("Failed to delete meal", e));
        }
    }, [storageService]);

    // ============================================
    // Strength Session CRUD (Phase 12)
    // ============================================

    const addStrengthSession = useCallback((session: Omit<StrengthWorkout, 'id'>): StrengthWorkout => {
        const newSession: StrengthWorkout = {
            ...session as any, // Cast for simplicity during migration
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setStrengthSessions(prev => [...prev, newSession]);

        // Life Stream: Add event
        const totalVol = newSession.totalVolume || 0;

        emitFeedEvent(
            'WORKOUT_STRENGTH',
            newSession.name || 'Styrkepass slutfört',
            {
                type: 'WORKOUT_STRENGTH',
                sessionId: newSession.id,
                exerciseCount: (newSession.exercises || []).length,
                setCount: (newSession.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).length, 0),
                totalVolume: totalVol,
            },
            [
                { label: 'Volym', value: Math.round(totalVol / 1000), unit: 't', icon: '🏋️' },
                { label: 'Övningar', value: (newSession.exercises || []).length, icon: '📋' }
            ],
            `${(newSession.exercises || []).length} övningar • ${Math.round(totalVol / 1000)}t total volym`
        );

        return newSession;
    }, [emitFeedEvent]);

    const updateStrengthSession = useCallback((id: string, updates: Partial<StrengthWorkout>): void => {
        setStrengthSessions(prev => {
            const next = prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s);
            const updated = next.find(s => s.id === id);
            if (updated) {
                // Persist via Universal Activities logic fallback or via a dedicated Strength endpoint if we had one.
                // Our backend PATCH /api/activities/:id handles Strength fallbacks!
                const dateParam = updated.date.split('T')[0];
                fetch(`/api/activities/${id}?date=${dateParam}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        title: updated.name,
                        notes: updated.notes,
                        durationMinutes: updated.duration
                    })
                }).catch(e => console.error("Failed to persist strength session update:", e));
            }
            return next;
        });
    }, []);

    const deleteStrengthSession = useCallback((id: string): void => {
        let sessionToDelete: StrengthWorkout | undefined;

        setStrengthSessions(prev => {
            const session = prev.find(s => s.id === id);
            if (session) {
                sessionToDelete = session;
            }
            return prev.filter(s => s.id !== id);
        });

        if (sessionToDelete) {
            storageService.deleteStrengthSession(id).catch(e => console.error("Failed to delete strength session", e));
        }

        // Also remove from universalActivities if it's there
        setUniversalActivities(prev => prev.filter(a => a.id !== id));
    }, [storageService]);


    // ============================================
    // Exercise & Weight Management
    // ============================================

    const addExercise = useCallback((data: Omit<ExerciseEntry, 'id' | 'createdAt'>): ExerciseEntry => {
        const newEntry: ExerciseEntry = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
            calorieBreakdown: data.calorieBreakdown || (data.caloriesBurned > 0 ? `Källhänvisning: Manuellt inlägg\nBeräkning: Baserad på angiven intensitet (${data.intensity}) och längd (${data.durationMinutes} min).` : undefined),
        };
        setExerciseEntries(prev => [...prev, newEntry]);

        skipAutoSave.current = true;
        storageService.saveExerciseEntry(newEntry).catch(e => console.error("Failed to save exercise", e));

        // Life Stream: Add event (Simplified: all activities trigger a feed event)
        const typeLabel = (data.type.charAt(0).toUpperCase() + data.type.slice(1)).replace('Strength', 'Styrka').replace('Walking', 'Promenad').replace('Running', 'Löpning').replace('Cycling', 'Cykling');

        const isStrength = data.type === 'strength';

        emitFeedEvent(
            isStrength ? 'WORKOUT_STRENGTH' : 'WORKOUT_CARDIO',
            data.notes || typeLabel,
            {
                type: isStrength ? 'WORKOUT_STRENGTH' : 'WORKOUT_CARDIO',
                exerciseType: data.type,
                duration: data.durationMinutes,
                distance: data.distance,
                calories: data.caloriesBurned,
                intensity: data.intensity
            },
            [
                { label: 'Tid', value: data.durationMinutes, unit: 'min', icon: '⏱️' },
                ...(data.distance ? [{ label: 'Distans', value: data.distance.toFixed(1), unit: 'km', icon: '📍' }] : []),
                { label: 'Energi', value: Math.round(data.caloriesBurned), unit: 'kcal', icon: '🔥' }
            ],
            `${data.distance ? `${data.distance.toFixed(1)} km • ` : ''}${data.durationMinutes} min`
        );

        return newEntry;
    }, [emitFeedEvent]);

    const updateExercise = useCallback((id: string, updates: Partial<ExerciseEntry>) => {
        const existing = exerciseEntries.find(e => e.id === id);

        if (!existing) {
            // Fallback 1: Check strengthSessions
            const strSession = strengthSessions.find(s => s.id === id);
            if (strSession) {
                updateStrengthSession(id, {
                    name: updates.title || strSession.name,
                    notes: updates.notes || strSession.notes,
                    duration: updates.durationMinutes || strSession.duration
                });
                return;
            }

            // Fallback 2: Check universalActivities (Strava/Virtual)
            // This allows editing Strava activities (Type, Duration, Title, Notes)
            const uniActivity = universalActivities.find(a => a.id === id);
            if (uniActivity) {
                // Optimistic Update
                setUniversalActivities(prev => prev.map(ua => {
                    if (ua.id === id) {
                        return {
                            ...ua,
                            plan: {
                                ...ua.plan,
                                title: updates.title || ua.plan?.title,
                                activityType: updates.type || ua.plan?.activityType || ua.performance?.activityType || 'other',
                                distanceKm: updates.distance !== undefined ? updates.distance : (ua.plan?.distanceKm || 0)
                            },
                            performance: {
                                ...ua.performance,
                                activityType: updates.type || ua.performance?.activityType,
                                durationMinutes: updates.durationMinutes !== undefined ? updates.durationMinutes : ua.performance?.durationMinutes,
                                notes: updates.notes || ua.performance?.notes,
                                subType: updates.subType || ua.performance?.subType,
                                // Also update distance in performance if changed
                                distanceKm: updates.distance !== undefined ? updates.distance : ua.performance?.distanceKm
                            }
                        } as UniversalActivity;
                    }
                    return ua;
                }));

                // Persist to Backend
                const dateParam = uniActivity.date.split('T')[0];
                fetch(`/api/activities/${id}?date=${dateParam}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        title: updates.title,
                        notes: updates.notes,
                        durationMinutes: updates.durationMinutes,
                        type: updates.type,
                        distance: updates.distance,
                        intensity: updates.intensity
                    })
                }).catch(e => console.error("Failed to persist virtual activity update:", e));
                return;
            }

            return;
        }

        const updated = { ...existing, ...updates };

        // If intensity or duration updated and it's a manual entry (or we want to override for manual edits), refresh the breakdown
        if ((updates.intensity || updates.durationMinutes || updates.caloriesBurned) && !updates.calorieBreakdown) {
            updated.calorieBreakdown = `Källhänvisning: Manuellt inlägg\nBeräkning: Baserad på angiven intensitet (${updated.intensity}) och längd (${updated.durationMinutes} min).`;
        }

        // Update local exerciseEntries
        setExerciseEntries(prev => prev.map(e => e.id === id ? updated : e));

        // ALSO update universalActivities if this ID matches a server activity
        // This ensures Strava activities get their title and subType updated and persisted
        setUniversalActivities(prev => prev.map(ua => {
            if (ua.id === id) {
                return {
                    ...ua,
                    plan: updates.title ? {
                        ...ua.plan,
                        title: updates.title,
                        activityType: ua.plan?.activityType || ua.performance?.activityType || 'other',
                        distanceKm: ua.plan?.distanceKm || ua.performance?.distanceKm || 0
                    } : ua.plan,
                    performance: {
                        ...ua.performance,
                        subType: updates.subType || ua.performance?.subType
                    }
                } as UniversalActivity;
            }
            return ua;
        }));

        skipAutoSave.current = true;

        if (existing.date && updated.date && existing.date !== updated.date) {
            // Date changed: Delete old, Save new
            storageService.deleteExerciseEntry(id, existing.date).catch(e => console.error("Failed to delete old exercise", e));
            storageService.saveExerciseEntry(updated).catch(e => console.error("Failed to save new exercise", e));
        } else {
            storageService.saveExerciseEntry(updated).catch(e => console.error("Failed to update exercise", e));
        }
    }, [exerciseEntries, strengthSessions, universalActivities, updateStrengthSession, storageService]);

    const deleteExercise = useCallback((id: string) => {
        let entryToDelete: ExerciseEntry | undefined;
        let sessionToDelete: StrengthWorkout | undefined;
        let activityToDelete: UniversalActivity | undefined;

        // 1. Legacy Entries
        setExerciseEntries(prev => {
            const entry = prev.find(e => e.id === id);
            if (entry) {
                entryToDelete = entry;
            }
            return prev.filter(e => e.id !== id);
        });

        if (entryToDelete) {
            storageService.deleteExerciseEntry(id, entryToDelete.date).catch(e => console.error("Failed to delete exercise", e));
        }

        // 2. Strength Sessions
        setStrengthSessions(prev => {
            const session = prev.find(s => s.id === id);
            if (session) {
                sessionToDelete = session;
            }
            return prev.filter(s => s.id !== id);
        });

        if (sessionToDelete) {
            storageService.deleteStrengthSession(id).catch(e => console.error("Failed to delete strength session", e));
        }

        // 3. Universal Activities (Strava/Merged etc)
        setUniversalActivities(prev => {
            const activity = prev.find(a => a.id === id);
            if (activity) {
                activityToDelete = activity;

                // If this was a merged activity, we should restore visibility of original activities
                if (activity.mergeInfo?.isMerged && activity.mergeInfo.originalActivityIds) {
                    const originalIds = activity.mergeInfo.originalActivityIds;
                    return prev
                        .filter(a => a.id !== id)
                        .map(a => {
                            if (originalIds.includes(a.id)) {
                                const updated = { ...a };
                                delete updated.mergedIntoId;
                                return updated;
                            }
                            return a;
                        });
                }
            }
            return prev.filter(a => a.id !== id);
        });

        if (activityToDelete) {
            storageService.deleteUniversalActivity(id, activityToDelete.date).catch(e => console.error("Failed to delete universal activity", e));
        }
    }, [storageService]);



    const addWeightEntry = useCallback((weight: number, date: string = getISODate(), waist?: number, chest?: number, hips?: number, thigh?: number): WeightEntry => {
        // Check if an entry for this date already exists
        const existingEntry = weightEntries.find(w => w.date === date);

        if (existingEntry) {
            // Update existing entry
            const updatedEntry = {
                ...existingEntry,
                weight,
                waist: waist !== undefined ? waist : existingEntry.waist,
                chest: chest !== undefined ? chest : existingEntry.chest,
                hips: hips !== undefined ? hips : existingEntry.hips,
                thigh: thigh !== undefined ? thigh : existingEntry.thigh,
                updatedAt: new Date().toISOString()
            };

            setWeightEntries(prev => {
                const next = prev.map(w => w.id === existingEntry.id ? updatedEntry : w);
                return next.sort((a, b) => b.date.localeCompare(a.date));
            });

            // Sync via API
            storageService.updateWeightEntry(updatedEntry).catch(err => {
                console.error("Failed to sync weight update:", err);
            });

            return updatedEntry;
        }

        // Otherwise create new entry
        const newEntry: WeightEntry = {
            id: generateId(),
            weight,
            date,
            waist,
            chest,
            hips,
            thigh,
            createdAt: new Date().toISOString(),
        };

        // Optimistic UI Update
        setWeightEntries(prev => {
            const next = [...prev, newEntry];
            return next.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                const timeA = a.createdAt || "";
                const timeB = b.createdAt || "";
                return timeB.localeCompare(timeA);
            });
        });

        storageService.addWeightEntry(newEntry).catch(err => {
            console.error("Failed to sync weight:", err);
        });

        // Life Stream: Add event
        emitFeedEvent(
            'BODY_METRIC',
            'Ny invägning',
            { type: 'BODY_METRIC', metricType: 'weight', value: weight, unit: 'kg' },
            [{ label: 'Vikt', value: weight, unit: 'kg', icon: '⚖️' }]
        );

        return newEntry;
    }, [weightEntries, emitFeedEvent]);

    const bulkAddWeightEntries = useCallback((entries: Partial<WeightEntry>[]) => {
        const newEntries = entries.map(e => ({
            id: generateId(),
            date: e.date || getISODate(),
            weight: e.weight || 0,
            waist: e.waist,
            chest: e.chest,
            hips: e.hips,
            thigh: e.thigh,
            createdAt: new Date().toISOString()
        } as WeightEntry));

        setWeightEntries(prev => {
            const next = [...prev, ...newEntries];
            return next.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
        });
    }, []);

    const updateWeightEntry = useCallback((id: string, weight?: number, date?: string, updates?: Partial<WeightEntry>) => {
        setWeightEntries(prev => {
            const next = prev.map(w => w.id === id ? { ...w, ...(weight !== undefined ? { weight } : {}), ...(date ? { date } : {}), ...updates } : w);

            // Sync via Granular API
            const updated = next.find(w => w.id === id);
            if (updated) {
                // We don't skip auto-save here because we want the biometric fields to be captured in the monolithic blob
                storageService.updateWeightEntry(updated).catch(e => console.error("Failed to update weight", e));
            }

            // Re-sort in case date changed
            return next.sort((a, b) => b.date.localeCompare(a.date));
        });
    }, []);

    const deleteWeightEntry = useCallback((id: string) => {
        setWeightEntries(prev => {
            const entry = prev.find(w => w.id === id);
            if (entry) {
                skipAutoSave.current = true;
                storageService.deleteWeightEntry(id, entry.date).catch(e => console.error("Failed to delete weight", e));
            }
            return prev.filter(w => w.id !== id);
        });
    }, []);

    const getLatestWeight = useCallback((): number => {
        return weightEntries[0]?.weight || 0;
    }, [weightEntries]);

    const getLatestWaist = useCallback((): number | undefined => {
        return weightEntries.find(w => w.waist !== undefined)?.waist;
    }, [weightEntries]);

    // ============================================
    // Derived: Unified Activities (Manual + Strava + Strength)
    // ============================================

    const unifiedActivities = useMemo(() => {
        const serverEntries = universalActivities
            .filter(u => !u.mergedIntoId) // Filter out merged activities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        const normalizedServer = serverEntries.map(e => {
            const u = universalActivities.find(item => item.id === e.id);
            return {
                ...e,
                source: 'strava' as const,
                avgHeartRate: u?.performance?.avgHeartRate,
                maxHeartRate: u?.performance?.maxHeartRate,
                _mergeData: {
                    strava: e,
                    universalActivity: u
                }
            };
        });
        const normalizedLocal = exerciseEntries.map(e => ({ ...e, source: 'manual' }));

        // Convert strength workouts to ExerciseEntry format
        const rawStrengthEntries = (strengthSessions as any[]).map(w => ({
            id: w.id,
            date: w.date,
            type: 'strength' as const,
            durationMinutes: w.duration || w.durationMinutes || 60,
            intensity: 'moderate' as const,
            caloriesBurned: 0,
            distance: undefined,
            tonnage: w.totalVolume || 0,
            totalSets: w.totalSets || 0,
            totalReps: w.totalReps || 0,
            title: w.name || w.title || 'Styrkepass',
            notes: w.name || w.title,
            source: 'strength',
            createdAt: w.createdAt || new Date().toISOString(),
            subType: undefined,
            externalId: undefined,
            movingTime: (w.duration || w.durationMinutes || 60) * 60
        }));

        // Content-based deduplication (Defense in Depth against near-identical duplicates with different IDs)
        const strengthEntries: typeof rawStrengthEntries = [];
        const seenCombined = new Set<string>();

        rawStrengthEntries.forEach(se => {
            const dateKey = se.date.split('T')[0];
            // Key: date-tonnage-approxDuration (10 min buckets)
            const durationBucket = Math.round(se.durationMinutes / 10) * 10;
            const contentKey = `${dateKey}-${se.tonnage}-${durationBucket}`;

            if (!seenCombined.has(contentKey)) {
                strengthEntries.push(se);
                seenCombined.add(contentKey);
            } else {
                console.log(`🔍 Combined duplicate strength session detected: ${se.title} (${se.tonnage}kg, ${se.durationMinutes}min)`);
            }
        });

        // Smart Merge: Combine StrengthLog with Strava data
        const mergedStravaIds = new Set<string>();

        // Group strength sessions by date for better matching
        const strengthByDate = new Map<string, typeof strengthEntries[0][]>();
        strengthEntries.forEach(se => {
            const d = se.date.split('T')[0];
            if (!strengthByDate.has(d)) strengthByDate.set(d, []);
            strengthByDate.get(d)!.push(se);
        });

        // Group strava strength by date
        const stravaStrengthByDate = new Map<string, typeof normalizedServer[0][]>();
        normalizedServer.forEach(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength') ||
                e.type?.toLowerCase() === 'other'; // Be aggressive, let the merge logic decide
            if (isWeightTraining) {
                const d = e.date.split('T')[0];
                if (!stravaStrengthByDate.has(d)) stravaStrengthByDate.set(d, []);
                stravaStrengthByDate.get(d)!.push(e);
            }
        });

        const mergedStrengthEntries: any[] = [];

        // Iterate through all local strength entries and try to find a match
        strengthEntries.forEach(se => {
            const sw = (strengthSessions as any[]).find(s => s.id === se.id);
            const dateKey = se.date.split('T')[0];
            const candidates = stravaStrengthByDate.get(dateKey) || [];

            // 0. Respect explicit separation
            if (sw?.mergeInfo?.isMerged === false) {
                mergedStrengthEntries.push(se);
                return;
            }

            // 1. Check for explicit persistence (already merged in DB)
            let match: any = null;
            if (sw?.mergeInfo?.isMerged && sw.mergeInfo.stravaActivityId) {
                match = candidates.find(c => c.id === sw.mergeInfo?.stravaActivityId);
            }

            // 2. Otherwise try auto-matching
            if (!match) {
                // Filter out already merged ones
                const availableCandidates = candidates.filter(c => !mergedStravaIds.has(c.id));

                // Find best match among available candidates
                // 1. By approximate duration (within 10 mins)
                match = availableCandidates.find(c => Math.abs(c.durationMinutes - se.durationMinutes) <= 10);

                // 2. If no match, just take the first available one if there's only one candidate left for this day
                if (!match && availableCandidates.length === 1) {
                    match = availableCandidates[0];
                }
            }

            if (match) {
                mergedStravaIds.add(match.id);
                const universalMatch = universalActivities.find(u => u.id === match!.id);
                const perf = universalMatch?.performance;
                const sw = (strengthSessions as any[]).find(s => s.id === se.id);

                mergedStrengthEntries.push({
                    ...se,
                    source: 'merged' as const,
                    caloriesBurned: match.caloriesBurned || se.caloriesBurned,
                    durationMinutes: match.durationMinutes || se.durationMinutes,
                    totalSets: se.totalSets,
                    totalReps: se.totalReps,
                    avgHeartRate: perf?.avgHeartRate,
                    maxHeartRate: perf?.maxHeartRate,
                    subType: match.subType,
                    _mergeData: {
                        strava: match,
                        strength: se,
                        strengthWorkout: sw,
                        universalActivity: universalMatch,
                    }
                });
            } else {
                mergedStrengthEntries.push(se);
            }
        });

        // Any Strava weight activities NOT merged should still be included as 'strava' source
        const deduplicatedServer = normalizedServer.filter(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength') ||
                e.type?.toLowerCase() === 'other'; // Be aggressive, let the merge logic decide

            if (isWeightTraining) {
                return !mergedStravaIds.has(e.id);
            }
            return true;
        });

        const initialResult = [...deduplicatedServer, ...normalizedLocal, ...mergedStrengthEntries];

        // Final De-duplication: Ensure only one entry per unique ID (Defense in Depth)
        const finalMap = new Map<string, typeof initialResult[0]>();
        initialResult.forEach(item => {
            const existing = finalMap.get(item.id);
            if (!existing) {
                finalMap.set(item.id, item);
            } else {
                // Priority: merged > strava/strength > manual
                const getPriority = (source: string) => {
                    if (source === 'merged') return 3;
                    if (source === 'strava' || source === 'strength') return 2;
                    return 1;
                };
                if (getPriority(item.source) > getPriority(existing.source)) {
                    finalMap.set(item.id, item);
                }
            }
        });

        return Array.from(finalMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [universalActivities, exerciseEntries, strengthSessions]);

    // ============================================
    // Automatic Reconciliation: Sync Planned Activities with Actual Sessions
    // ============================================

    useEffect(() => {
        if (!isLoaded || plannedActivities.length === 0 || unifiedActivities.length === 0) return;

        let hasChanges = false;
        const usedActivityIds = new Set<string>(); // Prevent double-matching

        const updatedPlanned = plannedActivities.map(planned => {
            // Only sync those that are still 'PLANNED'
            if (planned.status !== 'PLANNED') return planned;

            // Find matching activity on same date with matching type
            // Use scoring to find the BEST match, not just the first match
            const candidates = unifiedActivities
                .filter(actual => !usedActivityIds.has(actual.id))
                .map(actual => {
                    const sameDate = actual.date.split('T')[0] === planned.date.split('T')[0];
                    if (!sameDate) return { actual, score: 0 };

                    // Type mapping for reconciliation
                    const pType = planned.type;
                    const aType = actual.type;

                    // Type compatibility check
                    const isRunMatch = pType === 'RUN' && (aType === 'running' || aType === 'walking' || aType === 'other');
                    const isStrengthMatch = pType === 'STRENGTH' && aType === 'strength';
                    const isBikeMatch = pType === 'BIKE' && aType === 'cycling';
                    const isHyroxMatch = pType === 'HYROX' && (aType === 'running' || aType === 'strength' || aType === 'other');

                    if (!isRunMatch && !isStrengthMatch && !isBikeMatch && !isHyroxMatch) {
                        return { actual, score: 0 };
                    }

                    // Calculate match score (0-100)
                    let score = 50; // Base score for type match

                    // Duration similarity bonus (up to +25 points)
                    // A 51min workout vs planned 45min = 13% difference = +22 points
                    // Estimate planned duration from distance (assuming ~6min/km for runs) or use 45min default for strength
                    const plannedDuration = planned.estimatedDistance ? planned.estimatedDistance * 6 : 45;
                    const actualDuration = actual.durationMinutes || 0;
                    if (actualDuration > 0 && plannedDuration > 0) {
                        const durationDiff = Math.abs(actualDuration - plannedDuration) / plannedDuration;
                        if (durationDiff <= 0.30) {
                            score += 25 * (1 - durationDiff / 0.30); // 0-25 points
                        }
                    }

                    // Time proximity bonus (up to +25 points)
                    // Activity at 11:37 vs planned 12:00 = 23min diff = +24 points
                    if (planned.startTime && actual.date.includes('T')) {
                        const plannedHM = planned.startTime.split(':').map(Number);
                        const actualTime = actual.date.split('T')[1];
                        if (actualTime) {
                            const actualHM = actualTime.split(':').map(Number);
                            const plannedMinutes = (plannedHM[0] || 0) * 60 + (plannedHM[1] || 0);
                            const actualMinutes = (actualHM[0] || 0) * 60 + (actualHM[1] || 0);
                            const timeDiffMinutes = Math.abs(plannedMinutes - actualMinutes);
                            if (timeDiffMinutes <= 120) { // Within 2 hours
                                score += 25 * (1 - timeDiffMinutes / 120);
                            }
                        }
                    } else {
                        // No time info - still give partial credit
                        score += 10;
                    }

                    return { actual, score };
                })
                .filter(c => c.score > 0)
                .sort((a, b) => b.score - a.score);

            const bestMatch = candidates[0];
            // Require at least 50 score (type match) to consider it a match
            if (bestMatch && bestMatch.score >= 50) {
                hasChanges = true;
                usedActivityIds.add(bestMatch.actual.id);
                return {
                    ...planned,
                    status: 'COMPLETED' as const,
                    completedDate: bestMatch.actual.date,
                    actualDistance: bestMatch.actual.distance || planned.estimatedDistance,
                    actualTimeSeconds: (bestMatch.actual.durationMinutes || 0) * 60,
                    // Store a reference to the activity that completed it
                    externalId: bestMatch.actual.id
                };
            }

            return planned;
        });

        if (hasChanges) {
            console.log(`[DataContext] Auto-reconciled ${updatedPlanned.filter(p => p.status === 'COMPLETED' && !plannedActivities.find(o => o.id === p.id && o.status === 'COMPLETED')).length} tasks.`);
            setPlannedActivities(updatedPlanned);
        }
    }, [unifiedActivities, plannedActivities, isLoaded]);

    const getExercisesForDate = useCallback((date: string): ExerciseEntry[] => {
        // Use startsWith to match YYYY-MM-DD even if activity has time time YYYY-MM-DDTHH:mm:ss
        return unifiedActivities.filter(e => e.date.startsWith(date));
    }, [unifiedActivities]);


    const calculateBMR = useCallback((): number => {
        if (!currentUser?.settings) return 2000;
        const s = currentUser.settings;
        const weight = getLatestWeight();
        const height = s.height || 175;
        const currentYear = new Date().getFullYear();
        const age = s.birthYear ? (currentYear - s.birthYear) : 30;
        const gender = s.gender || 'other';

        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        if (gender === 'male') bmr += 5;
        else if (gender === 'female') bmr -= 161;
        else bmr -= 78; // Average/other

        return Math.round(bmr);
    }, [currentUser, getLatestWeight]);

    const calculateExerciseCalories = useCallback((type: ExerciseType, duration: number, intensity: ExerciseIntensity): number => {
        const weight = getLatestWeight();

        // MET values
        const METS: Record<ExerciseType, Record<ExerciseIntensity, number>> = {
            running: { low: 6, moderate: 8, high: 11, ultra: 14 },
            cycling: { low: 4, moderate: 6, high: 10, ultra: 12 },
            strength: { low: 2.5, moderate: 3.5, high: 5.0, ultra: 7.0 }, // Adjusted downwards to align better with Strava
            walking: { low: 2.5, moderate: 3.5, high: 4.5, ultra: 5.5 },
            swimming: { low: 5, moderate: 7, high: 10, ultra: 12 },
            yoga: { low: 2, moderate: 2.5, high: 3.5, ultra: 4 },
            other: { low: 3, moderate: 4.5, high: 6, ultra: 8 }
        };

        const met = METS[type][intensity];
        return Math.round(met * weight * (duration / 60));
    }, [getLatestWeight]);

    const getMealEntriesForDate = useCallback((date: string): MealEntry[] => {
        if (!Array.isArray(mealEntries)) return [];
        return mealEntries.filter(entry => entry.date === date);
    }, [mealEntries]);

    const calculateDailyNutrition = useCallback((date: string): NutritionSummary => {
        const entries = getMealEntriesForDate(date);
        const summary: NutritionSummary = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
        };

        for (const entry of entries) {
            for (const item of entry.items) {
                const { nutrition: baseNutrition } = calculateMealItemNutrition(item, recipes, foodItems);

                // Account for pieces as a multiplier for the entire entry
                const multiplier = entry.pieces ?? 1;
                const nutrition = {
                    calories: baseNutrition.calories * multiplier,
                    protein: baseNutrition.protein * multiplier,
                    carbs: baseNutrition.carbs * multiplier,
                    fat: baseNutrition.fat * multiplier,
                    fiber: (baseNutrition.fiber || 0) * multiplier,
                    iron: (baseNutrition.iron || 0) * multiplier,
                    calcium: (baseNutrition.calcium || 0) * multiplier,
                    zinc: (baseNutrition.zinc || 0) * multiplier,
                    vitaminB12: (baseNutrition.vitaminB12 || 0) * multiplier,
                    vitaminC: (baseNutrition.vitaminC || 0) * multiplier,
                    vitaminA: (baseNutrition.vitaminA || 0) * multiplier,
                    proteinCategories: baseNutrition.proteinCategories
                };

                summary.calories += nutrition.calories;
                summary.protein += nutrition.protein;
                summary.carbs += nutrition.carbs;
                summary.fat += nutrition.fat;
                summary.fiber += nutrition.fiber;

                // Accumulate Micros
                summary.iron = (summary.iron || 0) + (nutrition.iron || 0);
                summary.calcium = (summary.calcium || 0) + (nutrition.calcium || 0);
                summary.zinc = (summary.zinc || 0) + (nutrition.zinc || 0);
                summary.vitaminB12 = (summary.vitaminB12 || 0) + (nutrition.vitaminB12 || 0);
                summary.vitaminC = (summary.vitaminC || 0) + (nutrition.vitaminC || 0);
                summary.vitaminA = (summary.vitaminA || 0) + (nutrition.vitaminA || 0);

                if (nutrition.proteinCategories) {
                    summary.proteinCategories = summary.proteinCategories || [];
                    nutrition.proteinCategories.forEach(cat => {
                        if (!summary.proteinCategories?.includes(cat)) {
                            summary.proteinCategories?.push(cat);
                        }
                    });
                }
            }
        }

        return {
            calories: Math.max(0, Math.round(summary.calories)),
            protein: Math.round(summary.protein * 10) / 10,
            carbs: Math.round(summary.carbs * 10) / 10,
            fat: Math.round(summary.fat * 10) / 10,
            fiber: Math.round(summary.fiber * 10) / 10,
            iron: Math.round((summary.iron || 0) * 10) / 10,
            calcium: Math.round(summary.calcium || 0),
            zinc: Math.round((summary.zinc || 0) * 10) / 10,
            vitaminB12: Math.round((summary.vitaminB12 || 0) * 100) / 100,
            vitaminC: Math.round(summary.vitaminC || 0),
            vitaminA: Math.round(summary.vitaminA || 0),
            proteinCategories: summary.proteinCategories || [],
        };
    }, [getMealEntriesForDate, recipes, foodItems, getExercisesForDate]);

    // ============================================
    // Weekly Plan CRUD
    // ============================================

    const getWeeklyPlan = useCallback((weekStartDate: string): WeeklyPlan | undefined => {
        return weeklyPlans.find(p => p.weekStartDate === weekStartDate);
    }, [weeklyPlans]);

    const saveWeeklyPlan = useCallback((weekStartDate: string, meals: WeeklyPlan['meals']): void => {
        const now = new Date().toISOString();
        const existingIndex = weeklyPlans.findIndex((p: WeeklyPlan) => p.weekStartDate === weekStartDate);

        let newPlan: WeeklyPlan;

        if (existingIndex >= 0) {
            newPlan = {
                ...weeklyPlans[existingIndex],
                meals,
                updatedAt: now,
            };
        } else {
            newPlan = {
                id: generateId(),
                weekStartDate,
                meals,
                createdAt: now,
                updatedAt: now,
            };
        }

        setWeeklyPlans((prev: WeeklyPlan[]) => {
            const idx = prev.findIndex(p => p.weekStartDate === weekStartDate);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newPlan;
                return updated;
            }
            return [...prev, newPlan];
        });

        // Sync Granularly & Skip Monolithic Auto-Save
        skipAutoSave.current = true;
        storageService.saveWeeklyPlan(newPlan).catch(e => console.error("Failed to save weekly plan:", e));
    }, [weeklyPlans]);

    // Get planned meals for a specific date
    const getPlannedMealsForDate = useCallback((date: string): { mealType: MealType; meal: PlannedMeal }[] => {
        const weekStart = getWeekStartDate(new Date(date));
        const plan = weeklyPlans.find(p => p.weekStartDate === weekStart);
        if (!plan) return [];

        const weekday = getWeekdayFromDate(date);
        if (!weekday) return [];

        const dayMeals = plan.meals[weekday];
        if (!dayMeals) return [];

        const result: { mealType: MealType; meal: PlannedMeal }[] = [];
        const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

        for (const mealType of mealTypes) {
            const meal = dayMeals[mealType];
            if (meal && meal.recipeId) {
                result.push({ mealType, meal });
            }
        }

        return result;
    }, [weeklyPlans]);

    // ============================================
    // Vitals Management
    // ============================================

    const updateVitals = useCallback((date: string, updates: Partial<DailyVitals>) => {
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

    const getVitalsForDate = useCallback((date: string): DailyVitals => {
        return dailyVitals[date] || {
            water: 0,
            sleep: 0,
            caffeine: 0,
            alcohol: 0,
            updatedAt: new Date().toISOString()
        };
    }, [dailyVitals]);

    const calculateStreak = useCallback((referenceDate?: string): number => {
        const anchor = referenceDate ? new Date(referenceDate) : new Date();
        const anchorISO = getISODate(anchor);

        // Yesterday relative to anchor
        const prevDay = new Date(anchor);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayISO = getISODate(prevDay);

        const isDayActive = (date: string) => {
            const meals = getMealEntriesForDate(date);
            const exercises = getExercisesForDate(date);
            const vitals = dailyVitals[date];
            const weightEntry = weightEntries.some(w => w.date === date);

            // Active if logged meals, exercises, weights, or significant vitals
            return meals.length > 0 ||
                exercises.length > 0 ||
                weightEntry ||
                (vitals && (vitals.water > 0 || (vitals.caffeine ?? 0) > 0 || (vitals.alcohol ?? 0) > 0 || (vitals.sleep ?? 0) > 0));
        };

        let streak = 0;
        let checkDate = new Date(anchor);

        const anchorActive = isDayActive(anchorISO);
        const prevActive = isDayActive(prevDayISO);

        if (!anchorActive && !prevActive) return 0;

        // If anchor is not active, but prev is, we count from prev (streak maintained but not incremented for today yet)
        if (!anchorActive) checkDate = prevDay;

        while (true) {
            const dateStr = getISODate(checkDate);
            if (isDayActive(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
            if (streak > 3650) break;
        }
        return streak;
    }, [dailyVitals, getMealEntriesForDate, getExercisesForDate]);

    const calculateTrainingStreak = useCallback((referenceDate?: string, type?: string): number => {
        const anchor = referenceDate ? new Date(referenceDate) : new Date();
        const anchorISO = getISODate(anchor);

        const prevDay = new Date(anchor);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayISO = getISODate(prevDay);

        const isTrainingDay = (date: string) => {
            const exercises = getExercisesForDate(date);
            if (!type) {
                // Any training
                return exercises.length > 0;
            } else if (type === 'strength') {
                return exercises.some(e => e.type === 'strength');
            } else if (type === 'running') {
                // Cardio mode: running, cycling, walking, swimming
                return exercises.some(e => ['running', 'cycling', 'walking', 'swimming'].includes(e.type));
            }
            return false;
        };

        let streak = 0;
        let checkDate = new Date(anchor);

        if (!isTrainingDay(anchorISO) && !isTrainingDay(prevDayISO)) return 0;
        if (!isTrainingDay(anchorISO)) checkDate = prevDay;

        while (true) {
            if (isTrainingDay(getISODate(checkDate))) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
            if (streak > 1000) break;
        }
        return streak;
    }, [getExercisesForDate]);

    const calculateWeeklyTrainingStreak = useCallback((referenceDate?: string, _deprecated_type?: string): number => {
        // Count weeks where there was at least one training session
        let streak = 0;
        let checkDate = referenceDate ? new Date(referenceDate) : new Date();

        // Move to the beginning of current week (Monday) of the checkDate
        const day = checkDate.getDay();
        const diff = checkDate.getDate() - day + (day === 0 ? -6 : 1);
        checkDate.setDate(diff);

        // Helper to check if a specific calendar week has any training
        const hasTrainingInWeek = (startDate: Date) => {
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                if (getExercisesForDate(getISODate(d)).length > 0) return true;

                // Note: We don't stop at "today" because we might be looking at past data, 
                // so we just check the full week as it existed.
            }
            return false;
        };

        // If current week has no training yet, check last week.
        // But only if we are treating "current week" as potential gap.
        // If reference is today, and we haven't trained THIS week, we check last week.
        if (!hasTrainingInWeek(new Date(checkDate))) {
            const lastWeek = new Date(checkDate);
            lastWeek.setDate(lastWeek.getDate() - 7);
            if (!hasTrainingInWeek(lastWeek)) return 0;
            checkDate = lastWeek;
        }

        while (true) {
            if (hasTrainingInWeek(new Date(checkDate))) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 7);
            } else {
                break;
            }
            if (streak > 520) break;
        }
        return streak;
    }, [getExercisesForDate]);

    const calculateCalorieGoalStreak = useCallback((referenceDate?: string): number => {
        const anchor = referenceDate ? new Date(referenceDate) : new Date();
        const anchorISO = getISODate(anchor);

        const prevDay = new Date(anchor);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDayISO = getISODate(prevDay);

        const isGoalMet = (date: string) => {
            const data = calculateDailyNutrition(date);
            const target = currentUser?.settings?.dailyCalorieGoal || 2500;
            return data.calories > 0 && data.calories <= target;
        };

        let streak = 0;
        let checkDate = new Date(anchor);

        if (!isGoalMet(anchorISO) && !isGoalMet(prevDayISO)) return 0;
        if (!isGoalMet(anchorISO)) checkDate = prevDay;

        while (true) {
            if (isGoalMet(getISODate(checkDate))) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
            if (streak > 1000) break;
        }
        return streak;
    }, [calculateDailyNutrition, userSettings]);

    // ============================================
    // Context Value
    // ============================================

    // ============================================
    // Phase 7: Physio-AI CRUD
    // ============================================

    const addInjuryLog = useCallback((data: Omit<InjuryLog, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newLog: InjuryLog = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setInjuryLogs(prev => [...prev, newLog]);
        return newLog;
    }, []);

    const updateInjuryLog = useCallback((id: string, updates: Partial<InjuryLog>) => {
        setInjuryLogs(prev => prev.map(log =>
            log.id === id ? { ...log, ...updates, updatedAt: new Date().toISOString() } : log
        ));
    }, []);

    const deleteInjuryLog = useCallback((id: string) => {
        setInjuryLogs(prev => prev.filter(log => log.id !== id));
    }, []);

    const addRecoveryMetric = useCallback((metric: Omit<RecoveryMetric, 'id'>) => {
        const newMetric: RecoveryMetric = {
            ...metric,
            id: generateId()
        };
        setRecoveryMetrics(prev => {
            // Ensure only one metric per day per user? Or just append?
            // Let's replace if exists for same date to keep it clean
            const filtered = prev.filter(m => m.date !== metric.date);
            return [...filtered, newMetric];
        });
        return newMetric;
    }, []);

    const addBodyMeasurement = useCallback((entry: Omit<BodyMeasurementEntry, 'id' | 'createdAt'>) => {
        const newEntry: BodyMeasurementEntry = {
            ...entry,
            id: generateId(),
            createdAt: new Date().toISOString()
        };
        setBodyMeasurements(prev => [...prev, newEntry]);

        // Sync with WeightEntry if it exists for this date
        setWeightEntries(prev => {
            const existing = prev.find(w => w.date === entry.date);
            if (existing) {
                const updates: Partial<WeightEntry> = {};
                if (entry.type === 'waist') updates.waist = entry.value;
                if (entry.type === 'chest') updates.chest = entry.value;
                if (entry.type === 'hips') updates.hips = entry.value;
                if (entry.type === 'thigh_left' || entry.type === 'thigh_right') updates.thigh = entry.value;

                if (Object.keys(updates).length > 0) {
                    const updatedWeight = { ...existing, ...updates, updatedAt: new Date().toISOString() };
                    storageService.updateWeightEntry(updatedWeight).catch(e => console.error("Failed to sync weight measurement:", e));
                    return prev.map(w => w.id === existing.id ? updatedWeight : w);
                }
            }
            return prev;
        });

        // Persist
        storageService.saveBodyMeasurement?.(newEntry).catch(e => console.error("Failed to sync measurement:", e));
    }, []);

    const updateBodyMeasurement = useCallback((id: string, updates: Partial<BodyMeasurementEntry>) => {
        setBodyMeasurements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }, []);

    const deleteBodyMeasurement = useCallback((id: string) => {
        setBodyMeasurements(prev => prev.filter(e => e.id !== id));
        storageService.deleteBodyMeasurement?.(id).catch(e => console.error("Failed to delete measurement:", e));
    }, []);

    // ============================================
    // Quick Meals & Aliases
    // ============================================

    const addQuickMeal = useCallback((name: string, items: MealItem[]) => {
        const newMeal: QuickMeal = {
            id: generateId(),
            userId: currentUser?.id || 'unknown',
            name,
            items,
            createdAt: new Date().toISOString()
        };
        setQuickMeals(prev => [...prev, newMeal]);
        skipAutoSave.current = true;
        storageService.saveQuickMeal(newMeal).catch(console.error);
    }, [currentUser]);

    const deleteQuickMeal = useCallback((id: string) => {
        setQuickMeals(prev => prev.filter(m => m.id !== id));
        skipAutoSave.current = true;
        storageService.deleteQuickMeal(id).catch(console.error);
    }, []);

    const updateQuickMeal = useCallback((id: string, updates: Partial<Omit<QuickMeal, 'id' | 'userId' | 'createdAt'>>) => {
        setQuickMeals(prev => prev.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, ...updates };
            // Save to storage
            storageService.saveQuickMeal(updated).catch(console.error);
            return updated;
        }));
        skipAutoSave.current = true;
    }, []);

    const updateFoodAlias = useCallback((foodId: string, alias: string) => {
        setFoodAliases(prev => {
            const next = { ...prev };
            if (alias && alias.trim()) next[foodId] = alias.trim();
            else delete next[foodId];
            return next;
        });
    }, []);

    // ============================================
    // Derived: Unified Activities (Manual + Strava + Strength)
    // ============================================



    const value: DataContextType = {
        foodItems,
        recipes,
        mealEntries,
        weeklyPlans,
        userSettings,
        addFoodItem,
        updateFoodItem,
        deleteFoodItem,
        getFoodItem,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        getRecipe,
        getRecipeWithNutrition,
        addMealEntry,
        updateMealEntry,
        deleteMealEntry,
        getMealEntriesForDate,
        getWeeklyPlan,
        saveWeeklyPlan,
        getPlannedMealsForDate,
        pantryItems,
        pantryQuantities,
        togglePantryItem,
        setPantryItems,
        setPantryQuantity,
        getPantryQuantity,
        calculateRecipeNutrition,
        calculateDailyNutrition,
        users,
        currentUser,
        setCurrentUser,
        updateCurrentUser,
        selectedDate,
        setSelectedDate,
        addUser,
        toggleIncompleteDay,
        toggleCompleteDay,
        dailyVitals,
        updateVitals,
        getVitalsForDate,
        calculateStreak,
        calculateTrainingStreak,
        calculateWeeklyTrainingStreak,
        calculateCalorieGoalStreak,
        exerciseEntries,
        addExercise,
        updateExercise,
        deleteExercise,
        getExercisesForDate,
        weightEntries,
        addWeightEntry,
        bulkAddWeightEntries,
        updateWeightEntry,
        deleteWeightEntry,
        getLatestWeight,
        getLatestWaist,
        calculateBMR,
        calculateExerciseCalories,
        competitions,
        addCompetition: useCallback((data) => {
            const newComp: Competition = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString()
            };
            setCompetitions(prev => [...prev, newComp]);
            return newComp;
        }, []),
        updateCompetition: useCallback((id, updates) => {
            setCompetitions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        }, []),
        deleteCompetition: useCallback((id) => {
            setCompetitions(prev => prev.filter(c => c.id !== id));
        }, []),

        // Training Cycle CRUD
        trainingCycles,
        addTrainingCycle: useCallback((data) => {
            const newCycle: TrainingCycle = {
                ...data,
                id: generateId()
            };
            setTrainingCycles(prev => [...prev, newCycle]);
            return newCycle;
        }, []),
        updateTrainingCycle: useCallback((id, updates) => {
            setTrainingCycles(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        }, []),
        deleteTrainingCycle: useCallback((id) => {
            setTrainingCycles(prev => prev.filter(c => c.id !== id));
        }, []),
        calculateParticipantPoints: useCallback((compId, userId, date) => {
            const comp = competitions.find(c => c.id === compId);
            if (!comp) return 0;
            // Logic for calculating points based on rules will be implemented in a service/util
            return 0; // Placeholder
        }, [competitions]),

        // Performance Goals CRUD
        performanceGoals: useMemo(() => performanceGoals.filter(g => {
            // Show if belongs to user OR if strict privacy isn't enforced (legacy cleanup)
            // But based on user request "Måluppfyllelse måste vara kopplat till personen...", strict is better.
            // We'll migrate legacy data separately or accept they disappear for secondary users.
            return g.userId === currentUser?.id;
        }), [performanceGoals, currentUser]),
        addGoal: useCallback((data) => {
            const newGoal: PerformanceGoal = {
                ...data,
                id: generateId(),
                userId: currentUser?.id || 'unknown',
                createdAt: new Date().toISOString()
            };
            setPerformanceGoals(prev => [...prev, newGoal]);
            // Persist Granularly
            skipAutoSave.current = true;
            storageService.saveGoal(newGoal).catch(e => console.error("Failed to save goal", e));
            return newGoal;
        }, [currentUser]),
        updateGoal: useCallback((id, updates) => {
            setPerformanceGoals(prev => {
                const next = prev.map(g => g.id === id ? { ...g, ...updates } : g);
                const updatedGoal = next.find(g => g.id === id);
                if (updatedGoal) {
                    skipAutoSave.current = true;
                    storageService.saveGoal(updatedGoal).catch(e => console.error("Failed to update goal", e));
                }
                return next;
            });
        }, []),
        deleteGoal: useCallback((id) => {
            setPerformanceGoals(prev => prev.filter(g => g.id !== id));
            skipAutoSave.current = true;
            storageService.deleteGoal(id).catch(e => console.error("Failed to delete goal", e));
        }, []),
        getGoalsForCycle: useCallback((cycleId) => {
            return performanceGoals.filter(g => g.cycleId === cycleId);
        }, [performanceGoals]),

        // Training Periods CRUD
        trainingPeriods,
        addTrainingPeriod: useCallback((data) => {
            const newPeriod: TrainingPeriod = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            setTrainingPeriods(prev => [...prev, newPeriod]);
            skipAutoSave.current = true;
            storageService.savePeriod(newPeriod).catch(e => console.error("Failed to save period", e));
            return newPeriod;
        }, []),
        updateTrainingPeriod: useCallback((id, updates) => {
            setTrainingPeriods(prev => {
                const next = prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p);
                const updatedPeriod = next.find(p => p.id === id);
                if (updatedPeriod) {
                    skipAutoSave.current = true;
                    storageService.savePeriod(updatedPeriod).catch(e => console.error("Failed to update period", e));
                }
                return next;
            });
        }, []),
        deleteTrainingPeriod: useCallback((id) => {
            // 1. Remove period locally
            setTrainingPeriods(prev => prev.filter(p => p.id !== id));
            skipAutoSave.current = true;
            storageService.deletePeriod(id).catch(e => console.error("Failed to delete period", e));

            // 2. Unlink goals locally (Orphan them)
            setPerformanceGoals(prev => prev.map(g => {
                if (g.periodId === id) {
                    const updated = { ...g, periodId: undefined };
                    // We should also sync this update to backend, but to avoid 10 calls,
                    // we rely on the user eventually saving or us doing a bulk update.
                    // For correctness, we fire individual updates.
                    storageService.saveGoal(updated).catch(e => console.error("Failed to unlink goal", e));
                    return updated;
                }
                return g;
            }));
        }, []),

        // Smart Coach Implementation
        coachConfig,
        plannedActivities,
        updateCoachConfig: useCallback((updates) => {
            setCoachConfig(prev => prev ? { ...prev, ...updates } : updates as CoachConfig);
        }, []),
        generateCoachPlan: useCallback((stravaHistory, configOverride) => {
            const config = configOverride || coachConfig;
            if (!config) return;
            const newPlan = generateTrainingPlan(config, stravaHistory, plannedActivities);
            setPlannedActivities(newPlan);
        }, [coachConfig, plannedActivities]),
        deletePlannedActivity: useCallback((id) => {
            setPlannedActivities(prev => prev.filter(a => a.id !== id));
            skipAutoSave.current = true;
            storageService.deletePlannedActivity(id).catch(e => console.error("Failed to delete planned activity", e));
        }, []),
        updatePlannedActivity: useCallback((id, updates) => {
            setPlannedActivities(prev => {
                const next = prev.map(a => a.id === id ? { ...a, ...updates } : a);
                const updated = next.find(a => a.id === id);
                if (updated) {
                    skipAutoSave.current = true;
                    storageService.savePlannedActivity(updated).catch(e => console.error("Failed to update planned activity", e));
                }
                return next;
            });
        }, []),
        savePlannedActivities: useCallback((newActivities: PlannedActivity[]) => {
            setPlannedActivities(prev => {
                // Merge strategy: Filter out old activities on target dates if we wanted to replace
                // But safer is to just Append and let user delete duplicates if they exist,
                // OR filter out "PLANNED" status items on dates we are writing to.

                // For now, simpler: Just Append.
                // deduplicate by ID just in case
                const ids = new Set(newActivities.map(a => a.id));
                const filtered = prev.filter(a => !ids.has(a.id));

                const next = [...filtered, ...newActivities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // Sync to API
                skipAutoSave.current = true;
                storageService.savePlannedActivities(newActivities).catch(e => console.error("Failed to save planned activities", e));

                return next;
            });
        }, []),
        completePlannedActivity: useCallback((activityId: string, actualDist?: number, actualTime?: number, feedback?: PlannedActivity['feedback']) => {
            setPlannedActivities(prev => {
                const next = prev.map(a => {
                    if (a.id === activityId) {
                        return {
                            ...a,
                            status: 'COMPLETED' as const,
                            feedback,
                            completedDate: getISODate(),
                            actualDistance: actualDist || a.estimatedDistance,
                            actualTimeSeconds: actualTime
                        };
                    }
                    return a;
                });

                const completed = next.find(a => a.id === activityId);
                const original = prev.find(a => a.id === activityId);

                if (completed && original?.status !== 'COMPLETED') {
                    skipAutoSave.current = true;
                    storageService.savePlannedActivity(completed).catch(e => console.error("Failed to save completed plan", e));

                    // Automatically add to exercise log
                    addExercise({
                        date: completed.completedDate!,
                        type: 'running',
                        durationMinutes: Math.round((actualTime || (completed.estimatedDistance * 300)) / 60), // fallback to 5min/km
                        intensity: feedback === 'HARD' || feedback === 'TOO_HARD' ? 'high' : 'moderate',
                        caloriesBurned: calculateExerciseCalories('running', (actualTime || (completed.estimatedDistance * 300)) / 60, 'moderate'),
                        distance: actualDist || completed.estimatedDistance,
                        notes: `Coached Session: ${completed.title}. Feedback: ${feedback || 'None'}`
                    });
                }

                return next;
            });
        }, [addExercise, calculateExerciseCalories]),
        addCoachGoal: useCallback((goalData: Omit<CoachGoal, 'id' | 'createdAt' | 'isActive'>) => {
            const newGoal: CoachGoal = {
                ...goalData,
                id: generateId(),
                createdAt: new Date().toISOString(),
                isActive: (coachConfig?.goals?.length || 0) === 0 // First goal is active
            };
            setCoachConfig(prev => prev ? { ...prev, goals: [...(prev.goals || []), newGoal] } : {
                userProfile: { maxHr: 190, restingHr: 60 },
                preferences: { weeklyVolumeKm: 30, longRunDay: 'Sunday', intervalDay: 'Tuesday', trainingDays: [2, 4, 0] },
                goals: [newGoal]
            });
        }, [coachConfig]),
        activateCoachGoal: useCallback((goalId: string) => {
            setCoachConfig(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    goals: prev.goals.map(g => ({ ...g, isActive: g.id === goalId }))
                };
            });
            // Note: Plan regeneration should be triggered by the UI if needed
        }, []),
        deleteCoachGoal: useCallback((goalId: string) => {
            setCoachConfig(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    goals: prev.goals.filter(g => g.id !== goalId)
                };
            });
        }, []),


        strengthSessions,
        addStrengthSession,
        updateStrengthSession,
        deleteStrengthSession,

        // Phase 8: Data Integration
        sleepSessions,
        intakeLogs,
        universalActivities,

        addSleepSession: useCallback((session: SleepSession) => {
            setSleepSessions(prev => {
                const filtered = prev.filter(s => s.date !== session.date); // Replace existing/overlap
                return [...filtered, session].sort((a, b) => b.date.localeCompare(a.date));
            });
            // Also update simple VITALS for backward compat
            if (session.durationSeconds) {
                updateVitals(session.date, {
                    sleep: parseFloat((session.durationSeconds / 3600).toFixed(1))
                });
            }

            // Life Stream: Add event
            const hours = session.durationSeconds ? session.durationSeconds / 3600 : 0;
            emitFeedEvent(
                'HEALTH_SLEEP',
                'Sömn loggad',
                { type: 'HEALTH_SLEEP', hours, score: session.score },
                [{ label: 'Tid', value: hours.toFixed(1), unit: 'h', icon: '😴' }]
            );
        }, [updateVitals, emitFeedEvent]),

        // Phase 7: Physio-AI
        injuryLogs,
        recoveryMetrics,
        addInjuryLog,
        updateInjuryLog,
        deleteInjuryLog,
        addRecoveryMetric,

        // Body Measurements
        bodyMeasurements,
        addBodyMeasurement,
        updateBodyMeasurement,
        deleteBodyMeasurement,

        // Quick Meals
        quickMeals,
        addQuickMeal,
        updateQuickMeal,
        deleteQuickMeal,
        foodAliases,
        updateFoodAlias,

        unifiedActivities,
        refreshData,
        isLoading: !isLoaded
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

// ============================================
// Custom Hook
// ============================================

export function useData(): DataContextType {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
