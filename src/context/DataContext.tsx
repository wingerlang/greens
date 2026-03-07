import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { DataContext, type DataContextType, useData } from './DataShared.ts';
export { DataContext, type DataContextType, useData };
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
    type SleepSession,
    type IntakeLog,
    type UniversalActivity,
    type InjuryLog,
    type RecoveryMetric,
    type StrengthSession,
    type StrengthWorkout,
    type BodyMeasurementEntry,
    type TrainingPeriod,
    type QuickMeal,
    type MealItem,
    type DatabaseAction,
    type DatabaseActionType,
    type DatabaseEntityType,
    type RaceDefinition,
    type RaceIgnoreRule,
    type ExerciseDefinition,
    type PermissionConfig,
    DEFAULT_PERMISSION_CONFIG
} from '../models/types.ts';
import { storageService } from '../services/storage.ts';
import { safeFetch } from '../utils/http.ts';
import {
    calculateBMR as calculateBMRUtil,
    calculateStreak as calculateStreakUtil,
    calculateTrainingStreak as calculateTrainingStreakUtil,
    calculateWeeklyTrainingStreak as calculateWeeklyTrainingStreakUtil,
    calculateCalorieGoalStreak as calculateCalorieGoalStreakUtil,
    calculateExerciseCalories as calculateExerciseCaloriesUtil
} from '../utils/analytics.ts';

// Feature Hooks
import { useUserContext } from './features/useUserContext.ts';
import { useNutritionContext } from './features/useNutritionContext.ts';
import { useBodyContext } from './features/useBodyContext.ts';
import { useActivityContext } from './features/useActivityContext.ts';

// ============================================
// Context Types
// ============================================

// Context moved to DataShared.ts

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
    const [exercises, setExercises] = useState<ExerciseDefinition[]>([]);
    const [permissionConfig, setPermissionConfig] = useState<PermissionConfig>(DEFAULT_PERMISSION_CONFIG);
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
        foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities, quickMeals: storedQuickMeals, foodAliases,
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
        addCoachGoal, activateCoachGoal, deleteCoachGoal,
        // Race Defs
        raceDefinitions, addRaceDefinition, updateRaceDefinition, deleteRaceDefinition,
        raceIgnoreRules, addRaceIgnoreRule, deleteRaceIgnoreRule
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

        // Online Sync - Proceed if we have a token OR to check for session cookies
        const token = localStorage.getItem('auth_token');
        const abortController = new AbortController();
        const signal = abortController.signal;

        try {
            console.log('[DataContext] Starting parallel sync...');
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // execute all independent fetches in parallel
            const [userPayload, mePayload, planData, strengthData, quickMealsData, exerciseData, permissionData] = await Promise.all([
                safeFetch<{ users: User[] }>('/api/users', { headers, signal }),
                safeFetch<{ user: User }>('/api/auth/me', { headers, signal }),
                safeFetch<{ activities: PlannedActivity[] }>('/api/planned-activities', { headers }),
                safeFetch<{ workouts: StrengthWorkout[] }>('/api/strength/workouts', { headers }),
                safeFetch<QuickMeal[]>('/api/quick-meals', { headers }),
                safeFetch<ExerciseDefinition[]>('/api/exercises', { headers }),
                safeFetch<{ config: PermissionConfig }>('/api/admin/permissions', { headers })
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

            // 6. Handle Exercises
            if (exerciseData && Array.isArray(exerciseData)) {
                console.log('[DataContext] Loaded exercises:', exerciseData.length);
                data.exercises = exerciseData;
                setExercises(exerciseData);
            }

            // 7. Handle Permissions
            if (permissionData && permissionData.config) {
                setPermissionConfig(permissionData.config);
            }

        } catch (e: unknown) {
            if (e instanceof Error && e.name === 'AbortError') {
                console.log('[DataContext] Request aborted (expected during re-renders)');
            } else {
                console.error('[DataContext] Exception during parallel sync:', e);
            }
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
                sleepSessions,
                intakeLogs,
                universalActivities,
                injuryLogs,
                recoveryMetrics,
                bodyMeasurements,
                quickMeals: storedQuickMeals,
                foodAliases,
                exercises
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
        storedQuickMeals, foodAliases, exercises
    ]);

    // ============================================
    // Derived Analytics (Cross-Domain)
    // ============================================

    const calculateBMR = useCallback((): number => {
        return calculateBMRUtil(getLatestWeight(), currentUser?.settings);
    }, [currentUser, getLatestWeight]);

    const calculateStreak = useCallback((referenceDate?: string): number => {
        return calculateStreakUtil(
            mealEntries,
            exerciseEntries,
            dailyVitals,
            weightEntries,
            referenceDate
        );
    }, [mealEntries, exerciseEntries, dailyVitals, weightEntries]);

    const calculateTrainingStreak = useCallback((referenceDate?: string, type?: string): number => {
        return calculateTrainingStreakUtil(exerciseEntries, referenceDate, type);
    }, [exerciseEntries]);

    const calculateWeeklyTrainingStreak = useCallback((referenceDate?: string): number => {
        return calculateWeeklyTrainingStreakUtil(exerciseEntries, referenceDate);
    }, [exerciseEntries]);

    const calculateCalorieGoalStreak = useCallback((referenceDate?: string): number => {
        if (!currentUser?.settings) return 0;
        return calculateCalorieGoalStreakUtil(calculateDailyNutrition, currentUser.settings, referenceDate);
    }, [calculateDailyNutrition, currentUser]);


    // ============================================
    // Derived Quick Meals (Estimates from History)
    // ============================================
    const derivedEstimates = React.useMemo(() => {
        const estimatesMap = new Map<string, QuickMeal>();

        // Iterate backwards to prefer recent entries
        for (let i = mealEntries.length - 1; i >= 0; i--) {
            const entry = mealEntries[i];
            for (const item of entry.items) {
                // Check if it looks like an estimate (has details), even if type might be mis-logged
                if (item.estimateDetails) {
                    const name = item.estimateDetails.name;
                    if (!name) continue;

                    // Key by lower case name to avoid "Lunch" and "lunch" duplicates
                    const key = name.toLowerCase().trim();

                    if (!estimatesMap.has(key)) {
                        estimatesMap.set(key, {
                            id: `derived_est_${key}_${entry.id}`, // Unique ID
                            userId: currentUser?.id || 'unknown',
                            name: item.estimateDetails.name,
                            items: [{ ...item, type: 'estimate' }], // Force type to 'estimate' to ensure Omnibox categorization
                            createdAt: entry.date // Use entry date as creation date
                        });
                    }
                }
            }
        }
        return Array.from(estimatesMap.values());
    }, [mealEntries, currentUser?.id]);

    const effectiveQuickMeals = React.useMemo(() => {
        const explicitNames = new Set(storedQuickMeals.map(qm => qm.name.toLowerCase().trim()));
        const uniqueDerived = derivedEstimates.filter(qm => !explicitNames.has(qm.name.toLowerCase().trim()));
        return [...storedQuickMeals, ...uniqueDerived];
    }, [storedQuickMeals, derivedEstimates]);




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
        quickMeals: effectiveQuickMeals,
        addQuickMeal,
        updateQuickMeal,
        deleteQuickMeal,
        foodAliases,
        updateFoodAlias,
        unifiedActivities,

        refreshData,
        isLoading: !isLoaded,
        databaseActions,

        // Race Defs
        raceDefinitions,
        addRaceDefinition,
        updateRaceDefinition,
        deleteRaceDefinition,
        raceIgnoreRules,
        addRaceIgnoreRule,
        deleteRaceIgnoreRule,
        exercises,
        permissionConfig
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

// Context and hook moved to DataShared.ts
