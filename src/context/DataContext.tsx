import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
    type FoodItem,
    type Recipe,
    type MealEntry,
    type WeeklyPlan,
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
            if (data.userSettings) {
                setUserSettings(data.userSettings);
            }
            setIsLoaded(true);
        };
        loadData();
    }, []);

    // Save to storage on changes
    useEffect(() => {
        if (isLoaded) {
            storageService.save({ foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities, userSettings });
        }
    }, [foodItems, recipes, mealEntries, weeklyPlans, pantryItems, pantryQuantities, userSettings, isLoaded]);

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
            }
        }

        return {
            calories: Math.round(summary.calories),
            protein: Math.round(summary.protein * 10) / 10,
            carbs: Math.round(summary.carbs * 10) / 10,
            fat: Math.round(summary.fat * 10) / 10,
            fiber: Math.round(summary.fiber * 10) / 10,
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
                        summary.fiber += nutrition.fiber * multiplier;
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
        };
    }, [getMealEntriesForDate, recipes, foodItems, calculateRecipeNutrition]);

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
