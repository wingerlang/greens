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
    type TrainingPeriod
} from '../models/types.ts';
import { type StrengthWorkout } from '../models/strengthTypes.ts';
import { storageService } from '../services/storage.ts';
import type { FeedEventType } from '../models/feedTypes.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import { generateTrainingPlan } from '../services/coach/planGenerator.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { slugify } from '../utils/formatters.ts';
import { calculatePerformanceScore } from '../utils/performanceEngine.ts';

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

    // User CRUD
    setCurrentUser: (user: User | null) => void;
    updateCurrentUser: (updates: Partial<User>) => void;
    addUser: (user: User) => void;
    toggleIncompleteDay: (date: string) => void;

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
    addWeightEntry: (weight: number, date?: string, waist?: number) => WeightEntry;
    bulkAddWeightEntries: (entries: Partial<WeightEntry>[]) => void;
    updateWeightEntry: (id: string, weight: number, date: string, waist?: number) => void;
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

    unifiedActivities: (ExerciseEntry & { source: string })[];
    calculateStreak: () => number;
    calculateTrainingStreak: () => number;
    calculateWeeklyTrainingStreak: () => number;
    calculateCalorieGoalStreak: () => number;

    // System
    refreshData: () => Promise<void>;
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
        const token = localStorage.getItem('auth_token');
        if (token) {
            // Create AbortController for this refresh cycle - allows cancellation if component re-renders
            const abortController = new AbortController();
            const signal = abortController.signal;

            try {
                console.log('[DataContext] Fetching /api/users...');
                const userRes = await fetch('/api/users', {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal
                });
                if (userRes.ok) {
                    const userPayload = await userRes.json();
                    if (userPayload.users && Array.isArray(userPayload.users)) {
                        console.log('[DataContext] Loaded real users list:', userPayload.users.map((u: User) => u.username));
                        loadedUsers = userPayload.users;
                        // Update local cache of users immediately
                        data.users = loadedUsers;
                    }
                } else {
                    console.error('[DataContext] Failed to fetch users list:', userRes.status);
                }

                // NEW: Also fetch the "me" profile to ensure currentUserId is correct
                console.log('[DataContext] Fetching /api/auth/me...');
                const meRes = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal
                });
                if (meRes.ok) {
                    const mePayload = await meRes.json();
                    if (mePayload.user) {
                        console.log('[DataContext] Resolved current user:', mePayload.user.username);
                        data.currentUserId = mePayload.user.id;
                        // Update the users list with this fresh profile if not already there
                        if (!loadedUsers.find(u => u.id === mePayload.user.id)) {
                            loadedUsers.push(mePayload.user);
                        }
                    }
                }
            } catch (e: unknown) {
                // Ignore AbortError - this is expected when requests are cancelled during re-renders
                if (e instanceof Error && e.name === 'AbortError') {
                    console.log('[DataContext] Request aborted (expected during re-renders)');
                } else {
                    console.error('[DataContext] Exception during online sync:', e);
                }
            }
        } else {
            console.log('[DataContext] No token found, skipping online sync.');
        }

        // EXTRA SYNC: Strength Workouts
        if (token) {
            try {
                // Fetch full strength history to ensure YearInReview has data
                const strengthRes = await fetch('/api/strength/workouts', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (strengthRes.ok) {
                    const strengthData = await strengthRes.json();
                    if (strengthData.workouts && Array.isArray(strengthData.workouts)) {
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
                }
            } catch (e) {
                console.error('[DataContext] Failed to fetch strength workouts:', e);
            }
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
            setPerformanceGoals(data.performanceGoals || []);
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
                bodyMeasurements
            }, { skipApi: shouldSkipApi });
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
        bodyMeasurements
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
        setUserSettings(prev => {
            const current = prev.incompleteDays?.[date] ?? false;
            const updated = {
                ...prev,
                incompleteDays: {
                    ...prev.incompleteDays,
                    [date]: !current
                }
            };
            return updated;
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
        return newRecipe;
    }, []);

    const updateRecipe = useCallback((id: string, data: Partial<RecipeFormData>): void => {
        setRecipes((prev: Recipe[]) =>
            prev.map((recipe: Recipe) =>
                recipe.id === id
                    ? { ...recipe, ...data, updatedAt: new Date().toISOString() }
                    : recipe
            )
        );
    }, []);

    const deleteRecipe = useCallback((id: string): void => {
        setRecipes((prev: Recipe[]) => prev.filter((recipe: Recipe) => recipe.id !== id));
    }, []);

    const getRecipe = useCallback((id: string): Recipe | undefined => {
        return recipes.find(recipe => recipe.id === id);
    }, [recipes]);

    // ============================================
    // Nutrition Calculations
    // ============================================

    const calculateRecipeNutrition = useCallback((recipe: Recipe): NutritionSummary => {
        // Use ingredientsText if available (new UI), otherwise use ingredients array
        if (recipe.ingredientsText && recipe.ingredientsText.trim()) {
            const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems);
            return {
                calories: Math.round(estimate.calories),
                protein: Math.round(estimate.protein * 10) / 10,
                carbs: Math.round(estimate.carbs * 10) / 10,
                fat: Math.round(estimate.fat * 10) / 10,
                fiber: Math.round(estimate.fiber * 10) / 10,
                iron: estimate.iron,
                calcium: estimate.calcium,
                zinc: estimate.zinc,
                vitaminB12: estimate.vitaminB12,
                vitaminC: estimate.vitaminC,
                vitaminA: estimate.vitaminA,
                proteinCategories: estimate.proteinCategories,
            };
        }

        // Fallback to ingredients array
        const summary: NutritionSummary = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
        };

        for (const ingredient of recipe.ingredients) {
            const foodItem = foodItems.find(f => f.id === ingredient.foodItemId);
            if (foodItem) {
                // All values in FoodItem are per 100g/100ml
                const multiplier = ingredient.quantity / 100;
                summary.calories += foodItem.calories * multiplier;
                summary.protein += foodItem.protein * multiplier;
                summary.carbs += foodItem.carbs * multiplier;
                summary.fat += foodItem.fat * multiplier;
                summary.fiber += (foodItem.fiber || 0) * multiplier;
                summary.iron = (summary.iron || 0) + (foodItem.iron || 0) * multiplier;
                summary.calcium = (summary.calcium || 0) + (foodItem.calcium || 0) * multiplier;
                summary.zinc = (summary.zinc || 0) + (foodItem.zinc || 0) * multiplier;
                summary.vitaminB12 = (summary.vitaminB12 || 0) + (foodItem.vitaminB12 || 0) * multiplier;
                summary.vitaminC = (summary.vitaminC || 0) + (foodItem.vitaminC || 0) * multiplier;
                summary.vitaminA = (summary.vitaminA || 0) + (foodItem.vitaminA || 0) * multiplier;
                if (foodItem.proteinCategory) {
                    summary.proteinCategories = summary.proteinCategories || [];
                    if (!summary.proteinCategories.includes(foodItem.proteinCategory)) {
                        summary.proteinCategories.push(foodItem.proteinCategory);
                    }
                }
            }
        }

        return {
            calories: Math.round(summary.calories),
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

        // Helper to extract alcohol percentage from food name (e.g., "vol. % 5,4" or "vol. % 14")
        const extractAlcoholPercent = (name: string): number | null => {
            const match = name.match(/vol\.?\s*%\s*(\d+(?:[,.]?\d*)?)/i);
            if (match) {
                return parseFloat(match[1].replace(',', '.'));
            }
            return null;
        };

        // Calculate alcohol units: (volume in ml × ABV%) / 1000
        // Standard unit = 10ml pure alcohol = ~0.79g
        const calculateAlcoholUnits = (grams: number, alcoholPercent: number): number => {
            // Assume beverages: grams ≈ ml (density ~1)
            // Units = (ml × ABV%) / 1000
            return (grams * alcoholPercent) / 1000;
        };

        newEntry.items.forEach(item => {
            if (item.type === 'foodItem') {
                const food = foodItems.find(f => f.id === item.referenceId);
                if (food) {
                    const mult = item.servings / 100;
                    totalCals += food.calories * mult;
                    totalProtein += food.protein * mult;
                    totalCarbs += food.carbs * mult;
                    totalFat += food.fat * mult;

                    // Check for alcohol content
                    const alcoholPercent = extractAlcoholPercent(food.name);
                    if (alcoholPercent && alcoholPercent > 0) {
                        const units = calculateAlcoholUnits(item.servings, alcoholPercent);
                        totalAlcoholUnits += units;
                    }
                }
            } else if (item.type === 'recipe') {
                const recipe = recipes.find(r => r.id === item.referenceId);
                if (recipe) {
                    const nutrition = calculateRecipeNutrition(recipe);
                    const perServing = recipe.servings || 1;
                    const mult = item.servings / perServing;
                    totalCals += nutrition.calories * mult;
                    totalProtein += nutrition.protein * mult;
                    totalCarbs += nutrition.carbs * mult;
                    totalFat += nutrition.fat * mult;
                }
            }
        });

        // Update daily vitals with alcohol units if any were consumed
        if (totalAlcoholUnits > 0) {
            const date = newEntry.date;
            setDailyVitals(prev => {
                const existing = prev[date] || { water: 0, sleep: 0, updatedAt: new Date().toISOString() };
                return {
                    ...prev,
                    [date]: {
                        ...existing,
                        alcohol: (existing.alcohol || 0) + Math.round(totalAlcoholUnits * 10) / 10,
                        updatedAt: new Date().toISOString()
                    }
                };
            });
            console.log(`[Alcohol] Added ${totalAlcoholUnits.toFixed(1)} units for ${date}`);
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

    const updateMealEntry = useCallback((id: string, data: Partial<MealEntryFormData>): void => {
        setMealEntries((prev: MealEntry[]) => {
            const next = prev.map((entry: MealEntry) =>
                entry.id === id ? { ...entry, ...data } : entry
            );

            // Sync via Granular API
            const updated = next.find(e => e.id === id);
            if (updated) {
                skipAutoSave.current = true;
                storageService.updateMealEntry(updated).catch(e => console.error("Failed to update meal", e));
            }
            return next;
        });
    }, []);

    const deleteMealEntry = useCallback((id: string): void => {
        setMealEntries((prev: MealEntry[]) => {
            const entry = prev.find(e => e.id === id);
            if (entry) {
                skipAutoSave.current = true;
                storageService.deleteMealEntry(id, entry.date).catch(e => console.error("Failed to delete meal", e));
            }
            return prev.filter((entry: MealEntry) => entry.id !== id);
        });
    }, []);

    // ============================================
    // Exercise & Weight Management
    // ============================================

    const addExercise = useCallback((data: Omit<ExerciseEntry, 'id' | 'createdAt'>): ExerciseEntry => {
        const newEntry: ExerciseEntry = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
        };
        setExerciseEntries(prev => [...prev, newEntry]);

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
        // Update local exerciseEntries
        setExerciseEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));

        // ALSO update universalActivities if this ID matches a server activity
        // This ensures Strava activities get their subType updated and persisted
        setUniversalActivities(prev => prev.map(ua => {
            if (ua.id === id) {
                return {
                    ...ua,
                    performance: {
                        ...ua.performance,
                        subType: updates.subType || ua.performance?.subType
                    }
                } as UniversalActivity;
            }
            return ua;
        }));
    }, []);

    const deleteExercise = useCallback((id: string) => {
        setExerciseEntries(prev => prev.filter(e => e.id !== id));
    }, []);

    const getExercisesForDate = useCallback((date: string): ExerciseEntry[] => {
        return exerciseEntries.filter(e => e.date === date);
    }, [exerciseEntries]);

    const addWeightEntry = useCallback((weight: number, date: string = getISODate(), waist?: number): WeightEntry => {
        const newEntry: WeightEntry = {
            id: generateId(),
            weight,
            date,
            waist,
            createdAt: new Date().toISOString(),
        };

        // Optimistic UI Update - use functional update to get latest state
        setWeightEntries(prev => {
            const next = [...prev, newEntry];

            // ROBUST SORTING: Date (desc), CreatedAt (desc), ID (desc)
            const sorted = next.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;

                // Tiebreaker 1: CreatedAt
                const timeA = a.createdAt || "";
                const timeB = b.createdAt || "";
                const timeCompare = timeB.localeCompare(timeA);
                if (timeCompare !== 0) return timeCompare;

                // Tiebreaker 2: ID (absolute stability)
                return (b.id || "").localeCompare(a.id || "");
            });

            // Immediately persist to localStorage to prevent any race conditions
            try {
                const currentData = localStorage.getItem('greens-app-data');
                if (currentData) {
                    const parsed = JSON.parse(currentData);
                    parsed.weightEntries = sorted;
                    localStorage.setItem('greens-app-data', JSON.stringify(parsed));
                }
            } catch (e) {
                console.error('[WeightEntry] Failed to immediately persist:', e);
            }

            return sorted;
        });

        // Sync via API but DO NOT skip auto-save.
        // We want the subsequent auto-save loop to persist the new state to the monolithic blob
        // as a safety net, even if the granular API call fails or if reload happens before cache is consistent.
        // skipAutoSave.current = true; // REMOVED to ensure persistence

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
    }, [emitFeedEvent]);

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

    const updateWeightEntry = useCallback((id: string, weight: number, date: string, waist?: number) => {
        setWeightEntries(prev => {
            const next = prev.map(w => w.id === id ? { ...w, weight, date, waist } : w);

            // Sync via Granular API
            const updated = next.find(w => w.id === id);
            if (updated) {
                skipAutoSave.current = true;
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
        setStrengthSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s));
    }, []);

    const deleteStrengthSession = useCallback((id: string): void => {
        setStrengthSessions(prev => prev.filter(s => s.id !== id));
    }, []);

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
            strength: { low: 3, moderate: 4, high: 6, ultra: 8 },
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
                if (item.type === 'recipe') {
                    const recipe = recipes.find(r => r.id === item.referenceId);
                    if (recipe) {
                        const nutrition = calculateRecipeNutrition(recipe);
                        const perServing = recipe.servings || 1;
                        const multiplier = item.servings / perServing;
                        summary.calories += nutrition.calories * multiplier;
                        summary.protein += nutrition.protein * multiplier;
                        summary.carbs += nutrition.carbs * multiplier;
                        summary.fat += nutrition.fat * multiplier;
                        summary.fiber += (nutrition.fiber || 0) * multiplier;
                        summary.iron = (summary.iron || 0) + (nutrition.iron || 0) * multiplier;
                        summary.calcium = (summary.calcium || 0) + (nutrition.calcium || 0) * multiplier;
                        summary.zinc = (summary.zinc || 0) + (nutrition.zinc || 0) * multiplier;
                        summary.vitaminB12 = (summary.vitaminB12 || 0) + (nutrition.vitaminB12 || 0) * multiplier;
                        summary.vitaminC = (summary.vitaminC || 0) + (nutrition.vitaminC || 0) * multiplier;
                        summary.vitaminA = (summary.vitaminA || 0) + (nutrition.vitaminA || 0) * multiplier;
                        if (nutrition.proteinCategories) {
                            summary.proteinCategories = summary.proteinCategories || [];
                            nutrition.proteinCategories.forEach(cat => {
                                if (!summary.proteinCategories?.includes(cat)) {
                                    summary.proteinCategories?.push(cat);
                                }
                            });
                        }
                    }
                } else {
                    const foodItem = foodItems.find(f => f.id === item.referenceId);
                    if (foodItem) {
                        const multiplier = item.servings / 100; // servings in grams
                        summary.calories += foodItem.calories * multiplier;
                        summary.protein += foodItem.protein * multiplier;
                        summary.carbs += foodItem.carbs * multiplier;
                        summary.fat += foodItem.fat * multiplier;
                        summary.fiber += (foodItem.fiber || 0) * multiplier;
                        summary.iron = (summary.iron || 0) + (foodItem.iron || 0) * multiplier;
                        summary.calcium = (summary.calcium || 0) + (foodItem.calcium || 0) * multiplier;
                        summary.zinc = (summary.zinc || 0) + (foodItem.zinc || 0) * multiplier;
                        summary.vitaminB12 = (summary.vitaminB12 || 0) + (foodItem.vitaminB12 || 0) * multiplier;
                        summary.vitaminC = (summary.vitaminC || 0) + (foodItem.vitaminC || 0) * multiplier;
                        summary.vitaminA = (summary.vitaminA || 0) + (foodItem.vitaminA || 0) * multiplier;
                        if (foodItem.proteinCategory) {
                            summary.proteinCategories = summary.proteinCategories || [];
                            if (!summary.proteinCategories.includes(foodItem.proteinCategory)) {
                                summary.proteinCategories.push(foodItem.proteinCategory);
                            }
                        }
                    }
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
    }, [getMealEntriesForDate, recipes, foodItems, calculateRecipeNutrition, getExercisesForDate]);

    // ============================================
    // Weekly Plan CRUD
    // ============================================

    const getWeeklyPlan = useCallback((weekStartDate: string): WeeklyPlan | undefined => {
        return weeklyPlans.find(p => p.weekStartDate === weekStartDate);
    }, [weeklyPlans]);

    const saveWeeklyPlan = useCallback((weekStartDate: string, meals: WeeklyPlan['meals']): void => {
        const now = new Date().toISOString();

        setWeeklyPlans((prev: WeeklyPlan[]) => {
            const existingIndex = prev.findIndex((p: WeeklyPlan) => p.weekStartDate === weekStartDate);

            if (existingIndex >= 0) {
                // Update existing plan
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    meals,
                    updatedAt: now,
                };
                return updated;
            } else {
                // Create new plan
                return [...prev, {
                    id: generateId(),
                    weekStartDate,
                    meals,
                    createdAt: now,
                    updatedAt: now,
                }];
            }
        });
    }, []);

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

    const calculateStreak = useCallback((): number => {
        const today = getISODate();
        const yesterday = getISODate(new Date(Date.now() - 86400000));

        const isDayActive = (date: string) => {
            const meals = getMealEntriesForDate(date);
            const exercises = getExercisesForDate(date);
            const vitals = dailyVitals[date];
            const weightEntry = weightEntries.some(w => w.date === date);

            // Active if logged meals, exercises, weights, or significant vitals
            return meals.length > 0 ||
                exercises.length > 0 ||
                weightEntry ||
                (vitals && (vitals.water > 0 || (vitals.caffeine ?? 0) > 0 || (vitals.alcohol ?? 0) > 0));
        };

        let streak = 0;
        let checkDate = new Date();

        const todayActive = isDayActive(today);
        const yesterdayActive = isDayActive(yesterday);

        if (!todayActive && !yesterdayActive) return 0;
        if (!todayActive) checkDate = new Date(Date.now() - 86400000);

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

    const calculateTrainingStreak = useCallback((): number => {
        const today = getISODate();
        const yesterday = getISODate(new Date(Date.now() - 86400000));

        const isTrainingDay = (date: string) => getExercisesForDate(date).length > 0;

        let streak = 0;
        let checkDate = new Date();

        if (!isTrainingDay(today) && !isTrainingDay(yesterday)) return 0;
        if (!isTrainingDay(today)) checkDate = new Date(Date.now() - 86400000);

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

    const calculateWeeklyTrainingStreak = useCallback((): number => {
        // Count weeks where there was at least one training session
        let streak = 0;
        let checkDate = new Date();
        // Move to the beginning of current week (Monday)
        const day = checkDate.getDay();
        const diff = checkDate.getDate() - day + (day === 0 ? -6 : 1);
        checkDate.setDate(diff);

        const hasTrainingInWeek = (startDate: Date) => {
            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                if (getExercisesForDate(getISODate(d)).length > 0) return true;
                // Don't check future days if the week is current
                if (getISODate(d) === getISODate()) break;
            }
            return false;
        };

        // If current week has no training yet, check last week.
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

    const calculateCalorieGoalStreak = useCallback((): number => {
        const today = getISODate();
        const yesterday = getISODate(new Date(Date.now() - 86400000));

        const isGoalMet = (date: string) => {
            const data = calculateDailyNutrition(date);
            const target = currentUser?.settings?.dailyCalorieGoal || 2500;
            return data.calories > 0 && data.calories <= target;
        };

        let streak = 0;
        let checkDate = new Date();

        if (!isGoalMet(today) && !isGoalMet(yesterday)) return 0;
        if (!isGoalMet(today)) checkDate = new Date(Date.now() - 86400000);

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
    }, []);

    const updateBodyMeasurement = useCallback((id: string, updates: Partial<BodyMeasurementEntry>) => {
        setBodyMeasurements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }, []);

    const deleteBodyMeasurement = useCallback((id: string) => {
        setBodyMeasurements(prev => prev.filter(e => e.id !== id));
    }, []);

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
        const strengthEntries = (strengthSessions as any[]).map(w => ({
            id: w.id,
            date: w.date,
            type: 'strength' as const,
            durationMinutes: w.duration || w.durationMinutes || 60,
            intensity: 'moderate' as const,
            caloriesBurned: 0,
            distance: undefined,
            tonnage: w.totalVolume || 0,
            notes: w.name || w.title,
            source: 'strength',
            createdAt: w.createdAt || new Date().toISOString(),
            subType: undefined,
            externalId: undefined
        }));

        // Smart Merge: Combine StrengthLog with Strava data
        const stravaWeightByDate = new Map<string, typeof normalizedServer[0]>();
        normalizedServer.forEach(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength');
            if (isWeightTraining) {
                stravaWeightByDate.set(e.date.split('T')[0], e);
            }
        });

        const mergedStrengthEntries = strengthEntries.map(se => {
            const dateKey = se.date.split('T')[0];
            const stravaMatch = stravaWeightByDate.get(dateKey);

            if (stravaMatch) {
                const universalMatch = universalActivities.find(u => u.id === stravaMatch.id);
                const perf = universalMatch?.performance;
                const sw = (strengthSessions as any[]).find(s => s.id === se.id);
                return {
                    ...se,
                    source: 'merged' as const,
                    caloriesBurned: stravaMatch.caloriesBurned || se.caloriesBurned,
                    durationMinutes: stravaMatch.durationMinutes || se.durationMinutes,
                    avgHeartRate: perf?.avgHeartRate,
                    maxHeartRate: perf?.maxHeartRate,
                    subType: stravaMatch.subType,
                    _mergeData: {
                        strava: stravaMatch,
                        strength: se,
                        strengthWorkout: sw,
                        universalActivity: universalMatch,
                    }
                };
            }
            return se;
        });

        const deduplicatedServer = normalizedServer.filter(e => {
            const isWeightTraining = e.type?.toLowerCase().includes('weight') ||
                e.type?.toLowerCase().includes('styrka') ||
                e.type?.toLowerCase().includes('strength');
            if (isWeightTraining) {
                const dateKey = e.date.split('T')[0];
                if (strengthEntries.some(se => se.date.split('T')[0] === dateKey)) {
                    return false;
                }
            }
            return true;
        });

        const result = [...deduplicatedServer, ...normalizedLocal, ...mergedStrengthEntries];
        return result.sort((a, b) => b.date.localeCompare(a.date));
    }, [universalActivities, exerciseEntries, strengthSessions]);

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
        addUser,
        toggleIncompleteDay,
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
        performanceGoals,
        addGoal: useCallback((data) => {
            const newGoal: PerformanceGoal = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString()
            };
            setPerformanceGoals(prev => [...prev, newGoal]);
            // Persist Granularly
            skipAutoSave.current = true;
            storageService.saveGoal(newGoal).catch(e => console.error("Failed to save goal", e));
            return newGoal;
        }, []),
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
        }, []),
        updatePlannedActivity: useCallback((id, updates) => {
            setPlannedActivities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
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

                // Also, if we are overwriting a "draft" that was previously saved (not likely with new IDs)

                return [...filtered, ...newActivities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            });
        }, []),
        completePlannedActivity: useCallback((activityId: string, actualDist?: number, actualTime?: number, feedback?: PlannedActivity['feedback']) => {
            setPlannedActivities(prev => prev.map(a => {
                if (a.id === activityId) {
                    const completed: PlannedActivity = {
                        ...a,
                        status: 'COMPLETED',
                        feedback,
                        completedDate: getISODate(),
                        actualDistance: actualDist || a.estimatedDistance,
                        actualTimeSeconds: actualTime
                    };

                    // Automatically add to exercise log
                    addExercise({
                        date: completed.completedDate!,
                        type: 'running',
                        durationMinutes: Math.round((actualTime || (a.estimatedDistance * 300)) / 60), // fallback to 5min/km
                        intensity: feedback === 'HARD' || feedback === 'TOO_HARD' ? 'high' : 'moderate',
                        caloriesBurned: calculateExerciseCalories('running', (actualTime || (a.estimatedDistance * 300)) / 60, 'moderate'),
                        distance: actualDist || a.estimatedDistance,
                        notes: `Coached Session: ${a.title}. Feedback: ${feedback || 'None'}`
                    });

                    return completed;
                }
                return a;
            }));
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

        unifiedActivities,
        refreshData
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
