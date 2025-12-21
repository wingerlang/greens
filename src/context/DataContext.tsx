import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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
} from '../models/types.ts';
import { storageService } from '../services/storage.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';

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
    deleteWeightEntry: (id: string) => void;
    getLatestWeight: () => number;
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
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from storage on mount
    useEffect(() => {
        const loadData = async () => {
            const data = await storageService.load();
            setFoodItems(data.foodItems);
            setRecipes(data.recipes);
            setMealEntries(data.mealEntries);
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
                setWeightEntries(data.weightEntries);
            }
            setIsLoaded(true);
        };
        loadData();
    }, []);

    // Save to storage on changes
    useEffect(() => {
        if (isLoaded) {
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
                weightEntries
            });
        }
    }, [foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities, userSettings, users, currentUser, isLoaded, dailyVitals, exerciseEntries, weightEntries]);

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
        setWeightEntries(prev => {
            const next = [...prev, newEntry];
            return next.sort((a, b) => b.date.localeCompare(a.date)); // Sort descending
        });
        return newEntry;
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

        // Subtract exercise calories
        const exercises = getExercisesForDate(date);
        for (const ex of exercises) {
            summary.calories -= ex.caloriesBurned;
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
            return {
                ...prev,
                [date]: {
                    ...existing,
                    ...updates,
                    updatedAt: new Date().toISOString()
                }
            };
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
        deleteWeightEntry,
        getLatestWeight,
        calculateBMR,
        calculateExerciseCalories,
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
