import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
    type FoodItem,
    type Recipe,
    type MealEntry,
    type WeeklyPlan,
    type User,
    type PlannedMeal,
    type MealType,
    type FoodItemFormData,
    type RecipeFormData,
    type MealEntryFormData,
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
    type StrengthWorkout,
    type BodyMeasurementEntry, // Phase Legacy+
    type TrainingPeriod,
    type QuickMeal,
    type MealItem,
    type DatabaseAction,
    type DatabaseActionType,
    type DatabaseEntityType
} from '../models/types.ts';
import { storageService } from '../services/storage.ts';
import { safeFetch } from '../utils/http.ts';

// Feature Hooks
import { useUserContext } from './features/useUserContext.ts';
import { useNutritionContext } from './features/useNutritionContext.ts';
import { useBodyContext } from './features/useBodyContext.ts';
import { useActivityContext } from './features/useActivityContext.ts';

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
    addQuickMeal: (name: string, items: MealItem[]) => QuickMeal;
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
    databaseActions: DatabaseAction[];
}

const DataContext = createContext<DataContextType | null>(null);

// ============================================
// Provider Component
// ============================================

interface DataProviderProps {
    children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
    const [selectedDate, setSelectedDate] = useState(getISODate());
    const [isLoaded, setIsLoaded] = useState(false);
    const [databaseActions, setDatabaseActions] = useState<DatabaseAction[]>([]);
    const skipAutoSave = useRef(false);
    const refreshCounterRef = useRef(0);

    // ============================================
    // Feature Hooks
    // ============================================

    // 1. User Context
    const {
        users, currentUser, userSettings, dailyVitals,
        setUsers, setCurrentUser, setUserSettings, setDailyVitals,
        setCurrentUserPublic, addUser, updateCurrentUser,
        updateVitals, getVitalsForDate, toggleIncompleteDay, toggleCompleteDay,
        emitFeedEvent
    } = useUserContext();

    // Helper: Log a database action
    const logAction = useCallback((
        actionType: DatabaseActionType,
        entityType: DatabaseEntityType,
        entityId: string,
        entityName?: string,
        metadata?: Record<string, any>
    ) => {
        const action: DatabaseAction = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            userId: currentUser?.id,
            actionType,
            entityType,
            entityId,
            entityName,
            metadata
        };
        setDatabaseActions(prev => [action, ...prev].slice(0, 500)); // Keep last 500 actions
    }, [currentUser]);

    // 2. Body Context
    const {
        weightEntries, sleepSessions, intakeLogs, injuryLogs, recoveryMetrics, bodyMeasurements,
        setWeightEntries, setSleepSessions, setIntakeLogs, setInjuryLogs, setRecoveryMetrics, setBodyMeasurements,
        addWeightEntry, bulkAddWeightEntries, updateWeightEntry, deleteWeightEntry,
        getLatestWeight, getLatestWaist, addSleepSession,
        addInjuryLog, updateInjuryLog, deleteInjuryLog, addRecoveryMetric,
        addBodyMeasurement, updateBodyMeasurement, deleteBodyMeasurement
    } = useBodyContext({ currentUser, logAction, emitFeedEvent, skipAutoSave });

    // 3. Nutrition Context
    const {
        foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities, quickMeals, foodAliases,
        setFoodItems, setRecipes, setMealEntries, setWeeklyPlans, setPantryItems, setPantryQuantitiesState, setQuickMeals, setFoodAliases,
        togglePantryItem, setPantryQuantity, getPantryQuantity,
        addFoodItem, updateFoodItem, deleteFoodItem, getFoodItem,
        addRecipe, updateRecipe, deleteRecipe, getRecipe, calculateRecipeNutrition, getRecipeWithNutrition,
        addMealEntry, updateMealEntry, deleteMealEntry, getMealEntriesForDate, calculateDailyNutrition,
        getWeeklyPlan, saveWeeklyPlan, getPlannedMealsForDate,
        addQuickMeal, deleteQuickMeal, updateQuickMeal, updateFoodAlias
    } = useNutritionContext({ currentUser, logAction, emitFeedEvent, skipAutoSave, updateVitals, getVitalsForDate });

    // 4. Activity Context
    const {
        exerciseEntries, strengthSessions, competitions, trainingCycles, performanceGoals, trainingPeriods, coachConfig, plannedActivities, universalActivities, unifiedActivities,
        setExerciseEntries, setStrengthSessions, setCompetitions, setTrainingCycles, setPerformanceGoals, setTrainingPeriods, setCoachConfig, setPlannedActivities, setUniversalActivities,
        addStrengthSession, updateStrengthSession, deleteStrengthSession,
        addExercise, updateExercise, deleteExercise, calculateExerciseCalories, getExercisesForDate,
        addCompetition, updateCompetition, deleteCompetition, calculateParticipantPoints,
        addTrainingCycle, updateTrainingCycle, deleteTrainingCycle,
        addGoal, updateGoal, deleteGoal, getGoalsForCycle,
        addTrainingPeriod, updateTrainingPeriod, deleteTrainingPeriod,
        updateCoachConfig, generateCoachPlan,
        deletePlannedActivity, updatePlannedActivity, savePlannedActivities, completePlannedActivity,
        addCoachGoal, activateCoachGoal, deleteCoachGoal
    } = useActivityContext({ currentUser, logAction, emitFeedEvent, skipAutoSave, getLatestWeight, isLoaded });

    // ============================================
    // Global Logic (Refresh & Persistence)
    // ============================================

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

        const deDuplicate = <T extends { id: string }>(items: T[]): T[] => {
            const seen = new Set();
            return items.filter(item => {
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
        };

        skipAutoSave.current = true;

        // Nutrition
        setFoodItems(deDuplicate(data.foodItems || []));
        setRecipes(deDuplicate(data.recipes || []));
        setMealEntries(deDuplicate(data.mealEntries || []));
        setWeeklyPlans(data.weeklyPlans || []);
        setPantryItems(data.pantryItems || []);
        setPantryQuantitiesState(data.pantryQuantities || {});
        setQuickMeals(data.quickMeals || []);
        setFoodAliases(data.foodAliases || {});

        // User
        let loadedUsers = data.users || [];

        // Online Sync
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
            if (current) setCurrentUser(current);
        } else if (loadedUsers.length > 0) {
            setCurrentUser(loadedUsers[0]);
        }

        if (data.userSettings) setUserSettings(data.userSettings);
        if (data.dailyVitals) setDailyVitals(data.dailyVitals);

        // Activity
        if (data.exerciseEntries) setExerciseEntries(data.exerciseEntries);
        if (data.competitions) setCompetitions(data.competitions || []);
        if (data.trainingCycles) setTrainingCycles(data.trainingCycles || []);
        if (data.strengthSessions) setStrengthSessions(data.strengthSessions || []);
        if (data.performanceGoals) {
            const migrated = (data.performanceGoals || []).map((g: PerformanceGoal) => ({
                ...g,
                userId: g.userId || data.currentUserId || 'unknown'
            }));
            setPerformanceGoals(migrated);
        }
        if ((data as any).trainingPeriods) setTrainingPeriods((data as any).trainingPeriods || []);
        if (data.coachConfig) setCoachConfig(data.coachConfig);
        if (data.plannedActivities) setPlannedActivities(data.plannedActivities || []);
        if (data.universalActivities) setUniversalActivities(data.universalActivities || []);

        // Body
        if (data.weightEntries) {
            const normalizedWeights = (data.weightEntries || []).map((w: any) => {
                let date = w.date;
                if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    // Date normalization logic...
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
        if (data.sleepSessions) setSleepSessions(data.sleepSessions || []);
        if (data.intakeLogs) setIntakeLogs(data.intakeLogs || []);
        if (data.injuryLogs) setInjuryLogs(data.injuryLogs || []);
        if (data.recoveryMetrics) setRecoveryMetrics(data.recoveryMetrics || []);
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
                bodyMeasurements,
                quickMeals,
                foodAliases
            }, { skipApi: true });
        }
    }, [
        foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities,
        userSettings, users, currentUser, isLoaded, dailyVitals, exerciseEntries,
        weightEntries, competitions, trainingCycles, strengthSessions, performanceGoals,
        coachConfig, plannedActivities,
        sleepSessions, intakeLogs, universalActivities,
        injuryLogs, recoveryMetrics,
        bodyMeasurements,
        quickMeals, foodAliases
    ]);

    // ============================================
    // Derived Analytics (Cross-Domain)
    // ============================================

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
    }, [dailyVitals, getMealEntriesForDate, getExercisesForDate, weightEntries]);

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
    }, [calculateDailyNutrition, currentUser]);


    // ============================================
    // Context Value
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
        setCurrentUser: setCurrentUserPublic,
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
        addCompetition,
        updateCompetition,
        deleteCompetition,
        calculateParticipantPoints,
        trainingCycles,
        addTrainingCycle,
        updateTrainingCycle,
        deleteTrainingCycle,
        performanceGoals,
        addGoal,
        updateGoal,
        deleteGoal,
        getGoalsForCycle,
        trainingPeriods,
        addTrainingPeriod,
        updateTrainingPeriod,
        deleteTrainingPeriod,
        coachConfig,
        plannedActivities,
        updateCoachConfig,
        generateCoachPlan,
        deletePlannedActivity,
        updatePlannedActivity,
        savePlannedActivities,
        completePlannedActivity,
        addCoachGoal,
        activateCoachGoal,
        deleteCoachGoal,
        strengthSessions,
        addStrengthSession,
        updateStrengthSession,
        deleteStrengthSession,
        sleepSessions,
        intakeLogs,
        universalActivities,
        addSleepSession,
        injuryLogs,
        recoveryMetrics,
        addInjuryLog,
        updateInjuryLog,
        deleteInjuryLog,
        addRecoveryMetric,
        bodyMeasurements,
        addBodyMeasurement,
        updateBodyMeasurement,
        deleteBodyMeasurement,
        quickMeals,
        addQuickMeal,
        updateQuickMeal,
        deleteQuickMeal,
        foodAliases,
        updateFoodAlias,
        unifiedActivities,
        refreshData,
        isLoading: !isLoaded,
        databaseActions
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
