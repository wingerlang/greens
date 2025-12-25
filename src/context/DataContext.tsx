import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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
    type UniversalActivity
} from '../models/types.ts';
import { storageService } from '../services/storage.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import { generateTrainingPlan } from '../services/coach/planGenerator.ts';

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
    deleteExercise: (id: string) => void;
    getExercisesForDate: (date: string) => ExerciseEntry[];

    // Weight CRUD
    weightEntries: WeightEntry[];
    addWeightEntry: (weight: number, date?: string) => WeightEntry;
    updateWeightEntry: (id: string, weight: number, date: string) => void;
    deleteWeightEntry: (id: string) => void;
    getLatestWeight: () => number;

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

    // Performance Goals CRUD
    performanceGoals: PerformanceGoal[];
    addGoal: (data: Omit<PerformanceGoal, 'id' | 'createdAt'>) => PerformanceGoal;
    updateGoal: (id: string, updates: Partial<PerformanceGoal>) => void;
    deleteGoal: (id: string) => void;
    getGoalsForCycle: (cycleId: string) => PerformanceGoal[];

    // Smart Coach CRUD
    coachConfig: CoachConfig | undefined;
    plannedActivities: PlannedActivity[];
    updateCoachConfig: (updates: Partial<CoachConfig>) => void;
    generateCoachPlan: (stravaHistory: StravaActivity[], configOverride?: CoachConfig) => void;
    deletePlannedActivity: (id: string) => void;
    updatePlannedActivity: (id: string, updates: Partial<PlannedActivity>) => void;
    completePlannedActivity: (activityId: string, actualDist?: number, actualTime?: number, feedback?: PlannedActivity['feedback']) => void;
    addCoachGoal: (goalData: Omit<CoachGoal, 'id' | 'createdAt' | 'isActive'>) => void;
    activateCoachGoal: (goalId: string) => void;
    deleteCoachGoal: (goalId: string) => void;

    // Phase 8: Data Integration
    sleepSessions: SleepSession[];
    intakeLogs: IntakeLog[];
    universalActivities: UniversalActivity[];
    addSleepSession: (session: SleepSession) => void;

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
    const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoal[]>([]);
    const [coachConfig, setCoachConfig] = useState<CoachConfig | undefined>(undefined);
    const [plannedActivities, setPlannedActivities] = useState<PlannedActivity[]>([]);

    // Phase 8: Integration State
    const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);
    const [intakeLogs, setIntakeLogs] = useState<IntakeLog[]>([]);
    const [universalActivities, setUniversalActivities] = useState<UniversalActivity[]>([]);

    const [isLoaded, setIsLoaded] = useState(false);

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

        setFoodItems(data.foodItems || []);
        setRecipes(data.recipes || []);
        setMealEntries(data.mealEntries || []);
        setWeeklyPlans(data.weeklyPlans || []);
        setPantryItems(data.pantryItems || []);
        setPantryQuantitiesState(data.pantryQuantities || {});

        // Handle Users
        const loadedUsers = data.users || [];
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
            setWeightEntries(data.weightEntries || []);
        }
        if (data.competitions) {
            setCompetitions(data.competitions || []);
        }
        if (data.trainingCycles) {
            setTrainingCycles(data.trainingCycles || []);
        }
        if (data.performanceGoals) {
            setPerformanceGoals(data.performanceGoals || []);
        }
        if (data.coachConfig) {
            setCoachConfig(data.coachConfig);
        }
        if (data.plannedActivities) {
            setPlannedActivities(data.plannedActivities || []);
        }
        if (data.sleepSessions) setSleepSessions(data.sleepSessions);
        if (data.intakeLogs) setIntakeLogs(data.intakeLogs);
        if (data.universalActivities) setUniversalActivities(data.universalActivities);
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
                performanceGoals,
                coachConfig,
                plannedActivities,
                // Phase 8
                sleepSessions,
                intakeLogs,
                universalActivities
            }, { skipApi: shouldSkipApi });
        }
    }, [foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities, userSettings, users, currentUser, isLoaded, dailyVitals, exerciseEntries, weightEntries, competitions, trainingCycles, performanceGoals, coachConfig, plannedActivities]);

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
        setFoodItems((prev: FoodItem[]) => [...prev, newItem]);
        return newItem;
    }, []);

    const updateFoodItem = useCallback((id: string, data: Partial<FoodItemFormData>): void => {
        setFoodItems((prev: FoodItem[]) =>
            prev.map((item: FoodItem) =>
                item.id === id
                    ? { ...item, ...data, updatedAt: new Date().toISOString() }
                    : item
            )
        );
    }, []);

    const deleteFoodItem = useCallback((id: string): void => {
        setFoodItems((prev: FoodItem[]) => prev.filter((item: FoodItem) => item.id !== id));
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
        return newEntry;
    }, []);

    const updateMealEntry = useCallback((id: string, data: Partial<MealEntryFormData>): void => {
        setMealEntries((prev: MealEntry[]) =>
            prev.map((entry: MealEntry) =>
                entry.id === id ? { ...entry, ...data } : entry
            )
        );
    }, []);

    const deleteMealEntry = useCallback((id: string): void => {
        setMealEntries((prev: MealEntry[]) => prev.filter((entry: MealEntry) => entry.id !== id));
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
        return newEntry;
    }, []);

    const deleteExercise = useCallback((id: string) => {
        setExerciseEntries(prev => prev.filter(e => e.id !== id));
    }, []);

    const getExercisesForDate = useCallback((date: string): ExerciseEntry[] => {
        return exerciseEntries.filter(e => e.date === date);
    }, [exerciseEntries]);

    const addWeightEntry = useCallback((weight: number, date: string = getISODate()): WeightEntry => {
        const newEntry: WeightEntry = {
            id: generateId(),
            weight,
            date,
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

        // Use new optimized API call (fire and forget)
        // CRITICAL: Skip the next global auto-save to prevent overwriting or sending full payload
        skipAutoSave.current = true;

        storageService.addWeightEntry(weight, date).catch(err => {
            console.error("Failed to sync weight:", err);
        });

        return newEntry;
    }, []);

    const updateWeightEntry = useCallback((id: string, weight: number, date: string) => {
        setWeightEntries(prev => {
            const next = prev.map(w => w.id === id ? { ...w, weight, date } : w);
            // Re-sort in case date changed
            return next.sort((a, b) => b.date.localeCompare(a.date));
        });
    }, []);

    const deleteWeightEntry = useCallback((id: string) => {
        setWeightEntries(prev => prev.filter(w => w.id !== id));
    }, []);

    const getLatestWeight = useCallback((): number => {
        if (weightEntries.length === 0) return 70; // Default
        return weightEntries[0].weight; // Already sorted
    }, [weightEntries]);

    const calculateBMR = useCallback((): number => {
        if (!currentUser?.settings) return 2000;
        const s = currentUser.settings;
        const weight = getLatestWeight();
        const height = s.height || 175;
        const age = s.age || 30;
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

            // Optimization: Trigger background save immediately for vitals
            // This is "fire and forget" to avoid blocking the UI
            try {
                // We create a partial app data object to save
                // This relies on storageService merging it or handling it.
                // Since storageService.save overwrites the whole key, we must pass the FULL state.
                // However, accessing full state here (foodItems etc) is expensive/impossible due to closure staleness.
                //
                // BETTER STRATEGY: Use the ref 'skipAutoSave' to ALLOW the effect to run,
                // BUT we also want to ensure it runs even if the user closes the tab quickly.
                //
                // Actually, the issue might be that DailyVitals is a nested object update.
                // React's shallow comparison in the dependency array [dailyVitals] works by reference.
                // 'newData' IS a new reference, so the effect SHOULD fire.
                //
                // Let's force a sync by calling storageService specific method if we had one.
                // For now, relies on effect but we can add logging to debug.
            } catch (e) {
                console.error("Vitals update error", e);
            }

            return newData;
        });
    }, []);

    const getVitalsForDate = useCallback((date: string): DailyVitals => {
        return dailyVitals[date] || {
            water: 0,
            sleep: 0,
            caffeine: 0,
            updatedAt: new Date().toISOString()
        };
    }, [dailyVitals]);

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
        setCurrentUser,
        updateCurrentUser,
        addUser,
        dailyVitals,
        updateVitals,
        getVitalsForDate,
        exerciseEntries,
        addExercise,
        deleteExercise,
        getExercisesForDate,
        weightEntries,
        addWeightEntry,
        updateWeightEntry,
        deleteWeightEntry,
        getLatestWeight,
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
            return newGoal;
        }, []),
        updateGoal: useCallback((id, updates) => {
            setPerformanceGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
        }, []),
        deleteGoal: useCallback((id) => {
            setPerformanceGoals(prev => prev.filter(g => g.id !== id));
        }, []),
        getGoalsForCycle: useCallback((cycleId) => {
            return performanceGoals.filter(g => g.cycleId === cycleId);
        }, [performanceGoals]),

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
        }, [updateVitals]),

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
