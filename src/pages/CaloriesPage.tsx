import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type MealType,
    type MealItem,
    type MealEntry,
    type PlannedMeal,
    getISODate,
} from '../models/types.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import { MacroSummary } from '../components/calories/MacroSummary.tsx';
import { MealTimeline } from '../components/calories/MealTimeline.tsx';
import { QuickAddModal } from '../components/calories/QuickAddModal.tsx';
import { NutritionBreakdownModal } from '../components/calories/NutritionBreakdownModal.tsx';
import './CaloriesPage.css';

export function CaloriesPage() {
    const {
        foodItems,
        recipes,
        mealEntries,
        addMealEntry,
        updateMealEntry,
        deleteMealEntry,
        getMealEntriesForDate,
        calculateDailyNutrition,
        getRecipeWithNutrition,
        getFoodItem,
        getPlannedMealsForDate,
    } = useData();

    const { settings } = useSettings();

    const [selectedDate, setSelectedDate] = useState(getISODate());
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Smart meal type default based on time of day
    const getDefaultMealType = (): MealType => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 10) return 'breakfast';
        if (hour >= 10 && hour < 14) return 'lunch';
        if (hour >= 14 && hour < 20) return 'dinner';
        return 'snack';
    };

    const [mealType, setMealType] = useState<MealType>(getDefaultMealType());
    const [viewMode, setViewMode] = useState<'normal' | 'compact'>('compact');

    // Quick-add state
    const [searchQuery, setSearchQuery] = useState('');
    const [quickAddServings, setQuickAddServings] = useState(1);
    const [portionMode] = useState<'portions' | 'st' | 'grams'>('portions');

    // Nutrition breakdown modal state
    const [breakdownItem, setBreakdownItem] = useState<MealItem | null>(null);

    const dailyEntries = useMemo(
        () => getMealEntriesForDate(selectedDate),
        [getMealEntriesForDate, selectedDate]
    );

    const dailyNutrition = useMemo(
        () => calculateDailyNutrition(selectedDate),
        [calculateDailyNutrition, selectedDate]
    );

    const entriesByMeal = useMemo(() => {
        const grouped: Record<MealType, MealEntry[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
            beverage: [],
        };
        dailyEntries.forEach((entry: MealEntry) => {
            grouped[entry.mealType].push(entry);
        });
        return grouped;
    }, [dailyEntries]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();

        const recipeResults = recipes
            .filter(r => r.name.toLowerCase().includes(query))
            .slice(0, 5)
            .map(r => ({ type: 'recipe' as const, id: r.id, name: r.name, subtitle: `${r.servings} portioner` }));

        const foodResults = foodItems
            .filter(f => f.name.toLowerCase().includes(query))
            .slice(0, 5)
            .map(f => ({
                type: 'foodItem' as const,
                id: f.id,
                name: f.name,
                subtitle: `${f.calories} kcal/100g`,
                defaultPortion: f.defaultPortionGrams
            }));

        return [...recipeResults, ...foodResults].slice(0, 8);
    }, [searchQuery, recipes, foodItems]);

    const handleQuickAdd = (type: 'recipe' | 'foodItem', id: string, defaultPortion?: number) => {
        let servingsValue = quickAddServings;

        if (type === 'foodItem' && portionMode === 'st' && defaultPortion) {
            servingsValue = defaultPortion * quickAddServings;
        } else if (type === 'foodItem' && portionMode === 'grams') {
            servingsValue = quickAddServings;
        }

        addMealEntry({
            date: selectedDate,
            mealType,
            items: [{
                type,
                referenceId: id,
                servings: servingsValue,
            }],
        });

        setSearchQuery('');
        setQuickAddServings(1);
    };

    const handleDeleteEntry = (id: string) => {
        if (confirm('Ta bort denna måltid?')) {
            deleteMealEntry(id);
        }
    };

    const getItemName = (item: MealItem): string => {
        if (item.type === 'recipe') {
            const recipe = recipes.find(r => r.id === item.referenceId);
            return recipe?.name || 'Okänt recept';
        } else {
            const food = foodItems.find(f => f.id === item.referenceId);
            return food?.name || 'Okänd råvara';
        }
    };

    const getItemCalories = (item: MealItem): number => {
        if (item.type === 'recipe') {
            const recipe = recipes.find(r => r.id === item.referenceId);
            if (recipe?.ingredientsText) {
                const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems);
                return Math.round((estimate.calories / recipe.servings) * item.servings);
            }
            const recipeWithNutrition = getRecipeWithNutrition(item.referenceId);
            if (recipeWithNutrition) {
                return Math.round(recipeWithNutrition.nutritionPerServing.calories * item.servings);
            }
        } else {
            const food = getFoodItem(item.referenceId);
            if (food) {
                return Math.round(food.calories * (item.servings / 100));
            }
        }
        return 0;
    };

    const navigateDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(getISODate(date));
    };

    const isToday = selectedDate === getISODate();

    const plannedMeals = useMemo(
        () => getPlannedMealsForDate(selectedDate),
        [getPlannedMealsForDate, selectedDate]
    );

    const unloggedPlannedMeals = useMemo(() => {
        return plannedMeals.filter((pm: { mealType: MealType, meal: PlannedMeal }) => {
            const alreadyLogged = dailyEntries.some((entry: MealEntry) =>
                entry.mealType === pm.mealType &&
                entry.items.some((item: MealItem) => item.referenceId === pm.meal.recipeId)
            );
            return !alreadyLogged;
        });
    }, [plannedMeals, dailyEntries]);

    const handleLogPlannedMeal = (mType: MealType, recipeId: string) => {
        addMealEntry({
            date: selectedDate,
            mealType: mType,
            items: [{
                type: 'recipe',
                referenceId: recipeId,
                servings: 1,
            }],
        });
    };

    const handleLogAllPlanned = () => {
        unloggedPlannedMeals.forEach((pm: { mealType: MealType, meal: PlannedMeal }) => {
            handleLogPlannedMeal(pm.mealType, pm.meal.recipeId!);
        });
    };

    const goals = {
        calories: settings.dailyCalorieGoal,
        protein: settings.dailyProteinGoal,
        carbs: settings.dailyCarbsGoal,
        fat: settings.dailyFatGoal,
    };

    return (
        <div className="calories-page">
            <header className="page-header">
                <div>
                    <h1>Kalorier</h1>
                    <p className="page-subtitle">Logga måltider och följ dina makron</p>
                </div>
                <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
                    + Logga måltid
                </button>
            </header>

            <div className="flex justify-center gap-2 mb-4">
                <button
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'compact' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                    onClick={() => setViewMode('compact')}
                >
                    📊 Kompakt
                </button>
                <button
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'normal' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                    onClick={() => setViewMode('normal')}
                >
                    📋 Detaljerad
                </button>
            </div>

            <div className="date-nav">
                <button className="btn btn-ghost" onClick={() => navigateDate(-1)}>
                    ← Föregående
                </button>
                <div className="current-date">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                    {isToday && <span className="today-badge">Idag</span>}
                </div>
                <button className="btn btn-ghost" onClick={() => navigateDate(1)}>
                    Nästa →
                </button>
            </div>

            {unloggedPlannedMeals.length > 0 && (
                <div className="planned-meals-banner">
                    <div className="banner-content">
                        <span className="banner-icon">📅</span>
                        <div className="banner-text">
                            <strong>{unloggedPlannedMeals.length} planerade måltid{unloggedPlannedMeals.length > 1 ? 'er' : ''}</strong>
                            <span className="banner-subtitle">
                                {unloggedPlannedMeals.map((pm: { mealType: MealType, meal: PlannedMeal }) => {
                                    const recipe = recipes.find(r => r.id === pm.meal.recipeId);
                                    return recipe?.name || 'Okänt recept';
                                }).join(', ')}
                            </span>
                        </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleLogAllPlanned}>
                        ✓ Logga alla
                    </button>
                </div>
            )}

            <MacroSummary nutrition={dailyNutrition} goals={goals} viewMode={viewMode} />

            <MealTimeline
                viewMode={viewMode}
                dailyEntries={dailyEntries}
                entriesByMeal={entriesByMeal}
                getItemName={getItemName}
                getItemCalories={getItemCalories}
                updateMealEntry={updateMealEntry}
                handleDeleteEntry={handleDeleteEntry}
                setIsFormOpen={setIsFormOpen}
                setMealType={setMealType}
                setBreakdownItem={setBreakdownItem}
            />

            <QuickAddModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                mealType={mealType}
                setMealType={setMealType}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                quickAddServings={quickAddServings}
                setQuickAddServings={setQuickAddServings}
                handleQuickAdd={handleQuickAdd}
            />

            <NutritionBreakdownModal
                item={breakdownItem}
                onClose={() => setBreakdownItem(null)}
                recipes={recipes}
                foodItems={foodItems}
                getFoodItem={getFoodItem}
            />
        </div>
    );
}
