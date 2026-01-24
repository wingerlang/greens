import { useState, useCallback, type MutableRefObject } from 'react';
import {
    type FoodItem,
    type Recipe,
    type MealEntry,
    type WeeklyPlan,
    type PlannedMeal,
    type MealType,
    type FoodItemFormData,
    type RecipeFormData,
    type MealEntryFormData,
    type NutritionSummary,
    type RecipeWithNutrition,
    type QuickMeal,
    type MealItem,
    type User,
    type DatabaseActionType,
    type DatabaseEntityType,
    type DailyVitals,
    generateId,
    getWeekStartDate,
    getWeekdayFromDate
} from '../../models/types.ts';
import { storageService } from '../../services/storage.ts';
import type { FeedEventType } from '../../models/feedTypes.ts';
import { calculateRecipeNutrition as calculateRecipeNutritionUtil, calculateMealItemNutrition } from '../../utils/nutrition/calculations.ts';

interface UseNutritionContextProps {
    currentUser: User | null;
    logAction: (
        actionType: DatabaseActionType,
        entityType: DatabaseEntityType,
        entityId: string,
        entityName?: string,
        metadata?: Record<string, any>
    ) => void;
    emitFeedEvent: (type: FeedEventType, title: string, payload: any, metrics?: any[], summary?: string) => void;
    skipAutoSave: MutableRefObject<boolean>;
    updateVitals: (date: string, updates: Partial<DailyVitals>) => void;
    getVitalsForDate: (date: string) => DailyVitals;
}

export function useNutritionContext({ currentUser, logAction, emitFeedEvent, skipAutoSave, updateVitals, getVitalsForDate }: UseNutritionContextProps) {
    const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
    const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
    const [pantryItems, setPantryItems] = useState<string[]>([]);
    const [pantryQuantities, setPantryQuantitiesState] = useState<Record<string, { quantity: number; unit: string }>>({});
    const [quickMeals, setQuickMeals] = useState<QuickMeal[]>([]);
    const [foodAliases, setFoodAliases] = useState<Record<string, string>>({});

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
            createdBy: currentUser?.id,
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

        logAction('CREATE', 'food_item', newItem.id, newItem.name);

        return newItem;
    }, [currentUser, logAction, skipAutoSave]);

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
                logAction('UPDATE', 'food_item', id, updatedItem.name);
            }

            return next;
        });
    }, [logAction, skipAutoSave]);

    const deleteFoodItem = useCallback((id: string): void => {
        const item = foodItems.find(f => f.id === id);
        setFoodItems((prev: FoodItem[]) => prev.filter((item: FoodItem) => item.id !== id));
        skipAutoSave.current = true;
        storageService.deleteFoodItem(id).catch(e => console.error("Failed to delete food:", e));
        logAction('DELETE', 'food_item', id, item?.name);
    }, [foodItems, logAction, skipAutoSave]);

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

        logAction('CREATE', 'recipe', newRecipe.id, newRecipe.name);

        return newRecipe;
    }, [logAction, skipAutoSave]);

    const updateRecipe = useCallback((id: string, data: Partial<RecipeFormData>): void => {
        const existing = recipes.find(r => r.id === id);
        if (!existing) return;

        const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };

        setRecipes((prev: Recipe[]) => prev.map(r => r.id === id ? updated : r));

        skipAutoSave.current = true;
        storageService.saveRecipe(updated).catch(e => console.error("Failed to update recipe", e));
        logAction('UPDATE', 'recipe', id, updated.name);
    }, [recipes, logAction, skipAutoSave]);

    const deleteRecipe = useCallback((id: string): void => {
        const recipe = recipes.find(r => r.id === id);
        setRecipes((prev: Recipe[]) => prev.filter((recipe: Recipe) => recipe.id !== id));
        skipAutoSave.current = true;
        storageService.deleteRecipe(id).catch(e => console.error("Failed to delete recipe", e));
        logAction('DELETE', 'recipe', id, recipe?.name);
    }, [recipes, logAction, skipAutoSave]);

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
            // Fetch current to increment
            const currentVitals = getVitalsForDate(date);
            const newAlcohol = (currentVitals.alcohol || 0) + Math.round(totalAlcoholUnits * 10) / 10;
            const newCaffeine = (currentVitals.caffeine || 0) + Math.round(totalCaffeine);

            updateVitals(date, {
                alcohol: totalAlcoholUnits > 0 ? newAlcohol : currentVitals.alcohol,
                caffeine: totalCaffeine > 0 ? newCaffeine : currentVitals.caffeine
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

        logAction('CREATE', 'meal_entry', newEntry.id, undefined, { mealType: newEntry.mealType, date: newEntry.date });

        return newEntry;
    }, [foodItems, recipes, calculateRecipeNutrition, emitFeedEvent, logAction, skipAutoSave]);

    const updateMealEntry = useCallback((id: string, data: Partial<MealEntry>): void => {
        let entryToUpdate: MealEntry | undefined;
        let hasChanges = false;

        setMealEntries((prev: MealEntry[]) => {
            const next = prev.map((entry: MealEntry) => {
                if (entry.id === id) {
                    // Check if anything actually changed before triggering API
                    const isDifferent = Object.entries(data).some(([key, value]) => {
                        // For items, we do a shallow compare of the array (since they are usually new objects if changed)
                        if (key === 'items') return JSON.stringify(entry.items) !== JSON.stringify(value);
                        return (entry as any)[key] !== value;
                    });

                    if (!isDifferent) {
                        return entry;
                    }

                    hasChanges = true;
                    const updated = { ...entry, ...data };
                    entryToUpdate = updated;
                    return updated;
                }
                return entry;
            });
            return next;
        });

        // Sync via Granular API outside of state updater
        if (entryToUpdate && hasChanges) {
            skipAutoSave.current = true;
            storageService.updateMealEntry(entryToUpdate).catch(e => console.error("Failed to update meal", e));
            logAction('UPDATE', 'meal_entry', id, undefined, { date: (entryToUpdate as MealEntry).date });
        }
    }, [logAction, skipAutoSave]);

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
            logAction('DELETE', 'meal_entry', id, undefined, { date: entryToDelete.date });
        }
    }, [logAction, skipAutoSave]);

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
    }, [getMealEntriesForDate, recipes, foodItems]);


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
    }, [weeklyPlans, skipAutoSave]);

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
        logAction('CREATE', 'quick_meal', newMeal.id, newMeal.name);
        return newMeal;
    }, [currentUser, logAction, skipAutoSave]);

    const deleteQuickMeal = useCallback((id: string) => {
        setQuickMeals(prev => prev.filter(m => m.id !== id));
        skipAutoSave.current = true;
        storageService.deleteQuickMeal(id).catch(console.error);
        logAction('DELETE', 'quick_meal', id);
    }, [logAction, skipAutoSave]);

    const updateQuickMeal = useCallback((id: string, updates: Partial<Omit<QuickMeal, 'id' | 'userId' | 'createdAt'>>) => {
        setQuickMeals(prev => prev.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, ...updates };
            // Save to storage
            storageService.saveQuickMeal(updated).catch(console.error);
            logAction('UPDATE', 'quick_meal', id, updated.name);
            return updated;
        }));
        skipAutoSave.current = true;
    }, [logAction, skipAutoSave]);

    const updateFoodAlias = useCallback((foodId: string, alias: string) => {
        setFoodAliases(prev => {
            const next = { ...prev };
            if (alias && alias.trim()) next[foodId] = alias.trim();
            else delete next[foodId];
            return next;
        });
    }, []);

    return {
        // State
        foodItems,
        recipes,
        mealEntries,
        weeklyPlans,
        pantryItems,
        pantryQuantities,
        quickMeals,
        foodAliases,

        // Setters
        setFoodItems,
        setRecipes,
        setMealEntries,
        setWeeklyPlans,
        setPantryItems,
        setPantryQuantitiesState,
        setQuickMeals,
        setFoodAliases,

        // Actions
        togglePantryItem,
        setPantryQuantity,
        getPantryQuantity,
        addFoodItem,
        updateFoodItem,
        deleteFoodItem,
        getFoodItem,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        getRecipe,
        calculateRecipeNutrition,
        getRecipeWithNutrition,
        addMealEntry,
        updateMealEntry,
        deleteMealEntry,
        getMealEntriesForDate,
        calculateDailyNutrition,
        getWeeklyPlan,
        saveWeeklyPlan,
        getPlannedMealsForDate,
        addQuickMeal,
        deleteQuickMeal,
        updateQuickMeal,
        updateFoodAlias
    };
}
