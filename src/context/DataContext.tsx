import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
    type FoodItem,
    type Recipe,
    type MealEntry,
    type WeeklyPlan,
    type AppData,
    type FoodItemFormData,
    type RecipeFormData,
    type MealEntryFormData,
    type WeeklyPlanFormData,
    type NutritionSummary,
    type RecipeWithNutrition,
    generateId,
} from '../models/types.ts';
import { storageService } from '../services/storage.ts';

// ============================================
// Context Types
// ============================================

interface DataContextType {
    // State
    foodItems: FoodItem[];
    recipes: Recipe[];
    mealEntries: MealEntry[];
    weeklyPlans: WeeklyPlan[];

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
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from storage on mount
    useEffect(() => {
        const loadData = async () => {
            const data = await storageService.load();
            setFoodItems(data.foodItems);
            setRecipes(data.recipes);
            setMealEntries(data.mealEntries);
            setWeeklyPlans(data.weeklyPlans || []);
            setIsLoaded(true);
        };
        loadData();
    }, []);

    // Save to storage on changes
    useEffect(() => {
        if (isLoaded) {
            storageService.save({ foodItems, recipes, mealEntries, weeklyPlans });
        }
    }, [foodItems, recipes, mealEntries, weeklyPlans, isLoaded]);


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
        setFoodItems(prev => [...prev, newItem]);
        return newItem;
    }, []);

    const updateFoodItem = useCallback((id: string, data: Partial<FoodItemFormData>): void => {
        setFoodItems(prev =>
            prev.map(item =>
                item.id === id
                    ? { ...item, ...data, updatedAt: new Date().toISOString() }
                    : item
            )
        );
    }, []);

    const deleteFoodItem = useCallback((id: string): void => {
        setFoodItems(prev => prev.filter(item => item.id !== id));
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
        setRecipes(prev => [...prev, newRecipe]);
        return newRecipe;
    }, []);

    const updateRecipe = useCallback((id: string, data: Partial<RecipeFormData>): void => {
        setRecipes(prev =>
            prev.map(recipe =>
                recipe.id === id
                    ? { ...recipe, ...data, updatedAt: new Date().toISOString() }
                    : recipe
            )
        );
    }, []);

    const deleteRecipe = useCallback((id: string): void => {
        setRecipes(prev => prev.filter(recipe => recipe.id !== id));
    }, []);

    const getRecipe = useCallback((id: string): Recipe | undefined => {
        return recipes.find(recipe => recipe.id === id);
    }, [recipes]);

    // ============================================
    // Nutrition Calculations
    // ============================================

    const calculateRecipeNutrition = useCallback((recipe: Recipe): NutritionSummary => {
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
        setMealEntries(prev => [...prev, newEntry]);
        return newEntry;
    }, []);

    const updateMealEntry = useCallback((id: string, data: Partial<MealEntryFormData>): void => {
        setMealEntries(prev =>
            prev.map(entry =>
                entry.id === id ? { ...entry, ...data } : entry
            )
        );
    }, []);

    const deleteMealEntry = useCallback((id: string): void => {
        setMealEntries(prev => prev.filter(entry => entry.id !== id));
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

        setWeeklyPlans(prev => {
            const existingIndex = prev.findIndex(p => p.weekStartDate === weekStartDate);

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

    // ============================================
    // Context Value
    // ============================================

    const value: DataContextType = {
        foodItems,
        recipes,
        mealEntries,
        weeklyPlans,
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
