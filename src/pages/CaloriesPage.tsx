import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type MealEntryFormData,
    type MealType,
    type MealItem,
    type MealEntry,
    type PlannedMeal,
    MEAL_TYPE_LABELS,
    getISODate,
} from '../models/types.ts';
import { calculateRecipeEstimate, parseIngredients, matchToFoodItem } from '../utils/ingredientParser.ts';
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
    const [showUnifiedView, setShowUnifiedView] = useState(false);
    const [viewMode, setViewMode] = useState<'normal' | 'compact'>('compact'); // Default to compact

    // Quick-add state
    const [searchQuery, setSearchQuery] = useState('');
    const [quickAddServings, setQuickAddServings] = useState(1);
    const [portionMode, setPortionMode] = useState<'portions' | 'st' | 'grams'>('portions');

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

    // Group entries by meal type
    const entriesByMeal = useMemo(() => {
        const grouped: Record<MealType, typeof dailyEntries> = {
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

    // Unified search across recipes and food items
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

    // Quick add item
    const handleQuickAdd = (type: 'recipe' | 'foodItem', id: string, defaultPortion?: number) => {
        let servingsValue = quickAddServings;

        // For foodItems with "st" mode and default portion
        if (type === 'foodItem' && portionMode === 'st' && defaultPortion) {
            servingsValue = defaultPortion * quickAddServings; // grams
        } else if (type === 'foodItem' && portionMode === 'grams') {
            servingsValue = quickAddServings; // already in grams
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

    // Move meal to different meal type
    const handleMoveMeal = (entryId: string, newMealType: MealType) => {
        updateMealEntry(entryId, { mealType: newMealType });
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

    // Get planned meals for selected date
    const plannedMeals = useMemo(
        () => getPlannedMealsForDate(selectedDate),
        [getPlannedMealsForDate, selectedDate]
    );

    // Check which planned meals are not yet logged
    const unloggedPlannedMeals = useMemo(() => {
        return plannedMeals.filter((pm: { mealType: MealType, meal: PlannedMeal }) => {
            // Check if already logged
            const alreadyLogged = dailyEntries.some((entry: MealEntry) =>
                entry.mealType === pm.mealType &&
                entry.items.some((item: MealItem) => item.referenceId === pm.meal.recipeId)
            );
            return !alreadyLogged;
        });
    }, [plannedMeals, dailyEntries]);

    // Auto-log planned meal
    const handleLogPlannedMeal = (mealType: MealType, recipeId: string) => {
        addMealEntry({
            date: selectedDate,
            mealType,
            items: [{
                type: 'recipe',
                referenceId: recipeId,
                servings: 1,
            }],
        });
    };

    // Log all unlogged planned meals
    const handleLogAllPlanned = () => {
        unloggedPlannedMeals.forEach((pm: { mealType: MealType, meal: PlannedMeal }) => {
            handleLogPlannedMeal(pm.mealType, pm.meal.recipeId!);
        });
    };

    // Use goals from settings
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

            {/* View Mode Toggle */}
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

            {/* Date Navigation */}
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

            {/* Planned Meals Banner */}
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

            {/* Daily Summary */}
            {viewMode === 'compact' ? (
                /* Compact Summary - Single row */
                <div className="flex items-center justify-between gap-4 p-3 mb-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-emerald-400">{dailyNutrition.calories}</span>
                        <span className="text-sm text-slate-400">kcal</span>
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min((dailyNutrition.calories / goals.calories) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-violet-400">{dailyNutrition.protein}g P</span>
                        <span className="text-amber-400">{dailyNutrition.carbs}g K</span>
                        <span className="text-rose-400">{dailyNutrition.fat}g F</span>
                    </div>
                </div>
            ) : (
                /* Normal Summary - Cards */
                <div className="daily-summary">
                    <div className="summary-card calories-card">
                        <div className="summary-main">
                            <span className="summary-value">{dailyNutrition.calories}</span>
                            <span className="summary-label">kalorier</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${Math.min((dailyNutrition.calories / goals.calories) * 100, 100)}%` }}
                            />
                        </div>
                        <span className="goal-text">mål: {goals.calories}</span>
                    </div>
                    <div className="macro-cards">
                        <div className="macro-card protein">
                            <span className="macro-value">{dailyNutrition.protein}g</span>
                            <span className="macro-percent">{Math.round((dailyNutrition.protein / goals.protein) * 100)}%</span>
                            <span className="macro-label">Protein</span>
                            <div className="macro-progress">
                                <div
                                    className="macro-fill"
                                    style={{ width: `${Math.min((dailyNutrition.protein / goals.protein) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                        <div className="macro-card carbs">
                            <span className="macro-value">{dailyNutrition.carbs}g</span>
                            <span className="macro-percent">{Math.round((dailyNutrition.carbs / goals.carbs) * 100)}%</span>
                            <span className="macro-label">Kolhydrater</span>
                            <div className="macro-progress">
                                <div
                                    className="macro-fill"
                                    style={{ width: `${Math.min((dailyNutrition.carbs / goals.carbs) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                        <div className="macro-card fat">
                            <span className="macro-value">{dailyNutrition.fat}g</span>
                            <span className="macro-percent">{Math.round((dailyNutrition.fat / goals.fat) * 100)}%</span>
                            <span className="macro-label">Fett</span>
                            <div className="macro-progress">
                                <div
                                    className="macro-fill"
                                    style={{ width: `${Math.min((dailyNutrition.fat / goals.fat) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Meals Timeline */}
            {viewMode === 'compact' ? (
                /* Compact - Unified list with subtle prefix */
                <div className="flex flex-col gap-1.5 bg-slate-800/30 rounded-xl p-3 border border-slate-700/50">
                    {dailyEntries.length === 0 ? (
                        <div className="text-center text-slate-500 py-4">
                            <span>Inga måltider loggade</span>
                            <button
                                className="ml-3 text-emerald-400 hover:text-emerald-300"
                                onClick={() => setIsFormOpen(true)}
                            >
                                + Lägg till
                            </button>
                        </div>
                    ) : (
                        <>
                            {dailyEntries.map((entry: MealEntry) => (
                                <div
                                    key={entry.id}
                                    className="group flex items-center justify-between py-2 px-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-all"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-[10px] uppercase text-slate-500 w-16 shrink-0">
                                            {MEAL_TYPE_LABELS[entry.mealType]}
                                        </span>
                                        <span className="text-sm text-slate-200 truncate">
                                            {entry.items.map((item: MealItem) => getItemName(item)).join(', ')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Inline portion editor with gram display */}
                                        {entry.items.map((item: MealItem, idx: number) => {
                                            // For recipes, calculate approximate grams (assume ~300g per portion)
                                            const gramsPerPortion = item.type === 'recipe' ? 300 : 1;
                                            const currentGrams = Math.round(item.servings * gramsPerPortion);

                                            return (
                                                <div key={idx} className="flex flex-col items-center gap-0.5">
                                                    {/* Main portion/gram controls */}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200 text-xs"
                                                            onClick={() => {
                                                                const step = item.type === 'recipe' ? 0.25 : 25;
                                                                const newServings = Math.max(step, item.servings - step);
                                                                updateMealEntry(entry.id, {
                                                                    items: entry.items.map((it: MealItem, i: number) =>
                                                                        i === idx ? { ...it, servings: newServings } : it
                                                                    )
                                                                });
                                                            }}
                                                        >
                                                            −
                                                        </button>
                                                        <div className="flex flex-col items-center min-w-[50px]">
                                                            <span className="text-xs text-slate-300 font-medium">
                                                                {item.type === 'recipe' ? `${item.servings} port` : `${item.servings}g`}
                                                            </span>
                                                            {item.type === 'recipe' && (
                                                                <span className="text-[9px] text-slate-500">
                                                                    ≈{currentGrams}g
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200 text-xs"
                                                            onClick={() => {
                                                                const step = item.type === 'recipe' ? 0.25 : 25;
                                                                const newServings = item.servings + step;
                                                                updateMealEntry(entry.id, {
                                                                    items: entry.items.map((it: MealItem, i: number) =>
                                                                        i === idx ? { ...it, servings: newServings } : it
                                                                    )
                                                                });
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {entry.items.length > 0 && (
                                            <button
                                                className="text-sm font-medium text-emerald-400 ml-2 hover:text-emerald-300 hover:underline cursor-pointer transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setBreakdownItem(entry.items[0]);
                                                }}
                                            >
                                                {entry.items.reduce((sum: number, item: MealItem) => sum + getItemCalories(item), 0)} kcal
                                            </button>
                                        )}
                                        <button
                                            className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDeleteEntry(entry.id)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <div className="flex items-center justify-center gap-3 mt-2">
                                <button
                                    className="flex items-center justify-center gap-2 py-2 px-4 text-sm bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
                                    onClick={() => setIsFormOpen(true)}
                                >
                                    + Lägg till måltid
                                </button>
                                <button
                                    className="flex items-center justify-center gap-2 py-2 px-4 text-sm bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition-all"
                                    onClick={() => alert('Synka mellanmål till veckoplanering - kommer snart!')}
                                    title="Spara dagens mellanmål till veckovyn"
                                >
                                    📅 Spara mellanmål
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                /* Normal - Separate sections per meal type */
                <div className="meals-timeline">
                    {(Object.entries(entriesByMeal) as [MealType, typeof dailyEntries][]).map(([mealTypeKey, entries]) => (
                        <div key={mealTypeKey} className="meal-section">
                            <h3 className="meal-title">
                                <span className="meal-icon">
                                    {mealTypeKey === 'breakfast' && '🌅'}
                                    {mealTypeKey === 'lunch' && '☀️'}
                                    {mealTypeKey === 'dinner' && '🌙'}
                                    {mealTypeKey === 'snack' && '🍎'}
                                    {mealTypeKey === 'beverage' && '🥤'}
                                </span>
                                {MEAL_TYPE_LABELS[mealTypeKey]}
                            </h3>
                            {entries.length === 0 ? (
                                <div className="meal-empty">
                                    <span>Inga måltider</span>
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => {
                                            setMealType(mealTypeKey);
                                            setIsFormOpen(true);
                                        }}
                                    >
                                        + Lägg till
                                    </button>
                                </div>
                            ) : (
                                <div className="meal-entries">
                                    {entries.map((entry: MealEntry) => (
                                        <div key={entry.id} className="meal-entry">
                                            {entry.items.map((item: MealItem, idx: number) => {
                                                const gramsPerPortion = item.type === 'recipe' ? 300 : 1;
                                                const currentGrams = Math.round(item.servings * gramsPerPortion);

                                                return (
                                                    <div key={idx} className="entry-item">
                                                        <div className="entry-info">
                                                            <span className="entry-name">{getItemName(item)}</span>
                                                        </div>
                                                        {/* Inline portion controls */}
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200 text-sm"
                                                                onClick={() => {
                                                                    const step = item.type === 'recipe' ? 0.25 : 25;
                                                                    const newServings = Math.max(step, item.servings - step);
                                                                    updateMealEntry(entry.id, {
                                                                        items: entry.items.map((it: MealItem, i: number) =>
                                                                            i === idx ? { ...it, servings: newServings } : it
                                                                        )
                                                                    });
                                                                }}
                                                            >
                                                                −
                                                            </button>
                                                            <div className="flex flex-col items-center min-w-[60px]">
                                                                <span className="text-sm text-slate-200 font-medium">
                                                                    {item.type === 'recipe' ? `${item.servings} port` : `${item.servings}g`}
                                                                </span>
                                                                {item.type === 'recipe' && (
                                                                    <span className="text-[10px] text-slate-500">≈{currentGrams}g</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                className="w-6 h-6 flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200 text-sm"
                                                                onClick={() => {
                                                                    const step = item.type === 'recipe' ? 0.25 : 25;
                                                                    const newServings = item.servings + step;
                                                                    updateMealEntry(entry.id, {
                                                                        items: entry.items.map((it: MealItem, i: number) =>
                                                                            i === idx ? { ...it, servings: newServings } : it
                                                                        )
                                                                    });
                                                                }}
                                                            >
                                                                +
                                                            </button>
                                                            <button
                                                                className="entry-calories ml-2 hover:text-emerald-300 hover:underline cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBreakdownItem(item);
                                                                }}
                                                            >
                                                                {getItemCalories(item)} kcal
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDeleteEntry(entry.id)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add Meal Modal - Now Quick-Add Bar */}
            {isFormOpen && (
                <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
                    <div className="modal quick-add-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>🔍 Sök och lägg till</h2>

                        {/* Meal Type Selector */}
                        <div className="form-group">
                            <label>Måltidstyp</label>
                            <div className="meal-type-selector">
                                {(Object.entries(MEAL_TYPE_LABELS) as [MealType, string][]).map(([key, label]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={`meal-type-btn ${mealType === key ? 'active' : ''}`}
                                        onClick={() => setMealType(key)}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Unified Search */}
                        <div className="form-group">
                            <label>Sök recept eller råvara</label>
                            <input
                                type="text"
                                placeholder="Skriv för att söka..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div className="search-results">
                                {searchResults.map((result: any) => (
                                    <div
                                        key={`${result.type}-${result.id}`}
                                        className="search-result-item"
                                    >
                                        <div className="result-info">
                                            <span className="result-type">{result.type === 'recipe' ? '🍳' : '🥕'}</span>
                                            <div>
                                                <strong>{result.name}</strong>
                                                <small>{result.subtitle}</small>
                                            </div>
                                        </div>
                                        <div className="result-actions">
                                            {/* Portion Controls */}
                                            <div className="portion-control">
                                                <button
                                                    className="btn-portion"
                                                    onClick={() => setQuickAddServings(Math.max(0.25, quickAddServings - 0.25))}
                                                >−</button>
                                                <span className="portion-value">{quickAddServings}</span>
                                                <button
                                                    className="btn-portion"
                                                    onClick={() => setQuickAddServings(quickAddServings + 0.25)}
                                                >+</button>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleQuickAdd(result.type, result.id, (result as any).defaultPortion)}
                                            >
                                                + Lägg till
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {searchQuery && searchResults.length === 0 && (
                            <p className="no-results">Inga resultat för "{searchQuery}"</p>
                        )}

                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                                Stäng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Nutrition Breakdown Modal */}
            {breakdownItem && (() => {
                // Get recipe or food item details
                const isRecipe = breakdownItem.type === 'recipe';
                const recipe = isRecipe ? recipes.find(r => r.id === breakdownItem.referenceId) : null;
                const foodItem = !isRecipe ? getFoodItem(breakdownItem.referenceId) : null;
                const itemName = isRecipe ? recipe?.name : foodItem?.name;
                const servings = breakdownItem.servings;

                // Calculate ingredient breakdown for recipes
                const UNIT_TO_GRAMS: Record<string, number> = {
                    'g': 1, 'kg': 1000, 'ml': 1, 'dl': 100, 'l': 1000,
                    'msk': 15, 'tsk': 5, 'portion': 200, 'pcs': 100,
                };
                const ingredients = isRecipe && recipe?.ingredientsText
                    ? parseIngredients(recipe.ingredientsText).map(ing => {
                        const matched = matchToFoodItem(ing, foodItems);
                        const unitGrams = UNIT_TO_GRAMS[ing.unit] || 100;
                        const totalGrams = ing.quantity * unitGrams;
                        const scaledGrams = (totalGrams / (recipe.servings || 1)) * servings;
                        return {
                            name: ing.name,
                            amount: Math.round(scaledGrams),
                            unit: 'g',
                            calories: matched ? Math.round((matched.calories / 100) * scaledGrams) : 0,
                            protein: matched ? Math.round((matched.protein / 100) * scaledGrams * 10) / 10 : 0,
                            carbs: matched ? Math.round((matched.carbs / 100) * scaledGrams * 10) / 10 : 0,
                            fat: matched ? Math.round((matched.fat / 100) * scaledGrams * 10) / 10 : 0,
                        };
                    })
                    : [];

                // For food items, create single-item breakdown
                const foodBreakdown = !isRecipe && foodItem ? [{
                    name: foodItem.name,
                    amount: servings,
                    unit: 'g',
                    calories: Math.round((foodItem.calories / 100) * servings),
                    protein: Math.round((foodItem.protein / 100) * servings * 10) / 10,
                    carbs: Math.round((foodItem.carbs / 100) * servings * 10) / 10,
                    fat: Math.round((foodItem.fat / 100) * servings * 10) / 10,
                }] : [];

                const breakdown = isRecipe ? ingredients : foodBreakdown;
                const totals = breakdown.reduce((acc, item) => ({
                    calories: acc.calories + item.calories,
                    protein: acc.protein + item.protein,
                    carbs: acc.carbs + item.carbs,
                    fat: acc.fat + item.fat,
                }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

                return (
                    <div className="modal-overlay" onClick={() => setBreakdownItem(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-100">{itemName}</h2>
                                    <span className="text-sm text-slate-400">
                                        {isRecipe ? `${servings} portion${servings !== 1 ? 'er' : ''}` : `${servings}g`}
                                    </span>
                                </div>
                                <button
                                    className="text-slate-400 hover:text-slate-200 text-xl"
                                    onClick={() => setBreakdownItem(null)}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Summary Macros */}
                            <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-slate-800/50 rounded-lg">
                                <div className="text-center">
                                    <span className="block text-lg font-bold text-emerald-400">{Math.round(totals.calories)}</span>
                                    <span className="text-xs text-slate-500">kcal</span>
                                </div>
                                <div className="text-center">
                                    <span className="block text-lg font-bold text-violet-400">{totals.protein.toFixed(1)}g</span>
                                    <span className="text-xs text-slate-500">protein</span>
                                </div>
                                <div className="text-center">
                                    <span className="block text-lg font-bold text-amber-400">{totals.carbs.toFixed(1)}g</span>
                                    <span className="text-xs text-slate-500">kolhydrat</span>
                                </div>
                                <div className="text-center">
                                    <span className="block text-lg font-bold text-rose-400">{totals.fat.toFixed(1)}g</span>
                                    <span className="text-xs text-slate-500">fett</span>
                                </div>
                            </div>

                            {/* Ingredient List */}
                            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-[10px] text-slate-500 uppercase font-bold px-2 pb-1 border-b border-slate-700">
                                    <span>Ingrediens</span>
                                    <span className="w-14 text-right">Mängd</span>
                                    <span className="w-12 text-right">Kcal</span>
                                    <span className="w-10 text-right">P</span>
                                    <span className="w-10 text-right">F</span>
                                </div>
                                {breakdown.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-sm py-1.5 px-2 hover:bg-slate-800/50 rounded">
                                        <span className="text-slate-300 truncate">{item.name}</span>
                                        <span className="w-14 text-right text-slate-400">{item.amount}{item.unit}</span>
                                        <span className="w-12 text-right text-emerald-400">{item.calories}</span>
                                        <span className="w-10 text-right text-violet-400">{item.protein}</span>
                                        <span className="w-10 text-right text-rose-400">{item.fat}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                                onClick={() => setBreakdownItem(null)}
                            >
                                Stäng
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
