import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type Weekday,
    type MealType,
    type PlannedMeal,
    type WeeklyPlan,
    WEEKDAY_LABELS,
    WEEKDAYS,
    MEAL_TYPE_LABELS,
    getWeekStartDate,
    getISODate,
} from '../models/types.ts';
import { parseIngredients, matchToFoodItem, calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import './WeeklyPage.css';

// Short weekday labels for compact display
const SHORT_WEEKDAY_LABELS: Record<Weekday, string> = {
    monday: 'MÅN',
    tuesday: 'TIS',
    wednesday: 'ONS',
    thursday: 'TOR',
    friday: 'FRE',
    saturday: 'LÖR',
    sunday: 'SÖN',
};

// Types for local state
interface WeekPlan {
    [key: string]: {  // weekday
        [key: string]: PlannedMeal;  // mealType
    };
}

// All meal types for nutrition calculations
const ALL_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// Shopping list item with day/meal references
interface ShoppingItem {
    name: string;
    category: string;
    dayMeals: { day: Weekday; meal: MealType }[];  // Track which days/meals need this
    storageType: string;
}

// Meal abbreviations for display
const MEAL_ABBREV: Record<MealType, string> = {
    breakfast: 'F',
    lunch: 'L',
    dinner: 'M',
    snack: 'S',
};

export function WeeklyPage() {
    const { recipes, foodItems, getWeeklyPlan, saveWeeklyPlan } = useData();
    const { settings } = useSettings();

    const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStartDate());
    const [weekPlan, setWeekPlan] = useState<WeekPlan>({});
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{ day: Weekday; meal: MealType } | null>(null);
    const [selectedRecipeId, setSelectedRecipeId] = useState('');

    // Load week plan from storage when week changes
    useEffect(() => {
        const savedPlan = getWeeklyPlan(currentWeekStart);
        if (savedPlan) {
            setWeekPlan(savedPlan.meals as WeekPlan);
        } else {
            setWeekPlan({});
        }
    }, [currentWeekStart, getWeeklyPlan]);

    // Save week plan when it changes
    useEffect(() => {
        if (Object.keys(weekPlan).length > 0) {
            saveWeeklyPlan(currentWeekStart, weekPlan as WeeklyPlan['meals']);
        }
    }, [weekPlan, currentWeekStart, saveWeeklyPlan]);

    // Calculate week number
    const weekNumber = useMemo(() => {
        const date = new Date(currentWeekStart);
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }, [currentWeekStart]);

    // Get date for a specific weekday
    const getDateForWeekday = (day: Weekday): Date => {
        const dayIndex = WEEKDAYS.indexOf(day);
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + dayIndex);
        return date;
    };

    // Format date for display (e.g., "8 DEC.")
    const formatDayDate = (day: Weekday): string => {
        const date = getDateForWeekday(day);
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
        return `${date.getDate()} ${months[date.getMonth()]}.`;
    };

    // Check if a day is today
    const isToday = (day: Weekday): boolean => {
        const dayDate = getDateForWeekday(day);
        const today = new Date();
        return dayDate.toDateString() === today.toDateString();
    };

    // Navigate weeks
    const navigateWeek = (direction: number) => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (direction * 7));
        setCurrentWeekStart(getISODate(newDate));
    };

    // Get meal for a slot
    const getMealForSlot = (day: Weekday, meal: MealType): PlannedMeal | undefined => {
        return weekPlan[day]?.[meal];
    };

    // Get recipe name
    const getRecipeName = (recipeId: string): string => {
        const recipe = recipes.find(r => r.id === recipeId);
        return recipe?.name || 'Okänt recept';
    };

    // Get recipe object
    const getRecipe = (recipeId: string) => {
        return recipes.find(r => r.id === recipeId);
    };

    // Handle save meal
    const handleSaveMeal = () => {
        if (!editingSlot) return;

        setWeekPlan((prev: WeekPlan) => ({
            ...prev,
            [editingSlot.day]: {
                ...prev[editingSlot.day],
                [editingSlot.meal]: selectedRecipeId ? {
                    recipeId: selectedRecipeId,
                    servings: 1,
                } : undefined,
            },
        }));

        setIsPlannerOpen(false);
        setEditingSlot(null);
        setSelectedRecipeId('');
    };

    // Handle remove meal
    const handleRemoveMeal = () => {
        if (!editingSlot) return;

        setWeekPlan((prev: WeekPlan) => {
            const dayPlan = { ...prev[editingSlot.day] };
            delete dayPlan[editingSlot.meal];
            return {
                ...prev,
                [editingSlot.day]: dayPlan,
            };
        });

        setIsPlannerOpen(false);
        setEditingSlot(null);
    };

    // Generate shopping list from week's recipes
    const shoppingList = useMemo(() => {
        const items: Map<string, ShoppingItem> = new Map();

        WEEKDAYS.forEach(day => {
            ALL_MEAL_TYPES.forEach((meal: MealType) => {
                const planned = weekPlan[day]?.[meal];
                if (planned?.recipeId) {
                    const recipe = getRecipe(planned.recipeId);
                    if (recipe?.ingredientsText) {
                        const parsed = parseIngredients(recipe.ingredientsText);
                        parsed.forEach(ingredient => {
                            const matched = matchToFoodItem(ingredient, foodItems);
                            const key = ingredient.name.toLowerCase();

                            if (items.has(key)) {
                                const existing = items.get(key)!;
                                // Add day/meal if not already tracked
                                const hasDayMeal = existing.dayMeals.some(
                                    dm => dm.day === day && dm.meal === meal
                                );
                                if (!hasDayMeal) {
                                    existing.dayMeals.push({ day, meal });
                                }
                            } else {
                                items.set(key, {
                                    name: ingredient.name,
                                    category: matched?.category || 'other',
                                    dayMeals: [{ day, meal }],
                                    storageType: matched?.storageType || 'pantry',
                                });
                            }
                        });
                    }
                }
            });
        });

        // Group by storage type
        const grouped: Record<string, ShoppingItem[]> = {
            fresh: [],
            frozen: [],
            pantry: [],
        };

        items.forEach(item => {
            const type = item.storageType as keyof typeof grouped;
            if (grouped[type]) {
                grouped[type].push(item);
            } else {
                grouped.pantry.push(item);
            }
        });

        return grouped;
    }, [weekPlan, recipes, foodItems]);

    // Format day/meal labels for an item
    const formatDayMeals = (dayMeals: { day: Weekday; meal: MealType }[]): string => {
        return dayMeals
            .map(dm => `${SHORT_WEEKDAY_LABELS[dm.day]} ${MEAL_ABBREV[dm.meal]}`)
            .join(', ');
    };

    // Copy shopping list to clipboard
    const handleCopyShoppingList = () => {
        const lines: string[] = [];

        Object.entries(shoppingList).forEach(([storageType, items]) => {
            if (items.length > 0) {
                lines.push(storageLables[storageType]);
                items.forEach(item => {
                    const dayLabels = formatDayMeals(item.dayMeals);
                    lines.push(`☐ ${item.name} — ${dayLabels}`);
                });
                lines.push('');
            }
        });

        navigator.clipboard.writeText(lines.join('\n'));
        // Could add toast notification here
    };

    // Category labels for shopping list
    const storageLables: Record<string, string> = {
        fresh: '🥬 Färskvaror',
        frozen: '❄️ Frysvaror',
        pantry: '🏠 Skafferi',
    };

    // Count items for price estimate
    const totalItems = useMemo(() => {
        return Object.values(shoppingList).flat().length;
    }, [shoppingList]);

    return (
        <div className="weekly-page">
            {/* Header with week navigation */}
            <header className="weekly-header">
                <h1>Veckans Meny</h1>
                <div className="week-nav">
                    <button className="nav-btn" onClick={() => navigateWeek(-1)}>‹</button>
                    <div className="week-display">
                        <span className="week-label">VECKA</span>
                        <span className="week-number">{weekNumber}</span>
                    </div>
                    <button className="nav-btn" onClick={() => navigateWeek(1)}>›</button>
                </div>
            </header>

            {/* Day cards grid */}
            <div className="days-grid">
                {WEEKDAYS.map(day => {
                    const dayMeals = settings.visibleMeals.filter(meal => getMealForSlot(day, meal)?.recipeId);
                    const today = isToday(day);

                    return (
                        <div key={day} className={`day-card ${today ? 'today' : ''}`}>
                            <div className="day-card-header">
                                <div className="day-info">
                                    <span className="day-name">{SHORT_WEEKDAY_LABELS[day]}</span>
                                    <span className="day-date">{formatDayDate(day)}</span>
                                </div>
                                <button className="add-btn" title="Lägg till måltid">⇆</button>
                            </div>

                            {/* Date watermark */}
                            <div className="date-watermark">
                                {getDateForWeekday(day).getDate()} {['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'][getDateForWeekday(day).getMonth()]}.
                            </div>

                            {/* Meal slots */}
                            <div className="day-meals">
                                {settings.visibleMeals.map(meal => {
                                    const planned = getMealForSlot(day, meal);
                                    const hasRecipe = !!planned?.recipeId;
                                    const recipe = hasRecipe ? getRecipe(planned.recipeId!) : null;

                                    return (
                                        <div
                                            key={meal}
                                            className={`meal-slot ${hasRecipe ? 'has-recipe' : 'empty'}`}
                                            onClick={() => {
                                                setEditingSlot({ day, meal });
                                                setSelectedRecipeId(planned?.recipeId || '');
                                                setIsPlannerOpen(true);
                                            }}
                                        >
                                            <span className="meal-type">{MEAL_TYPE_LABELS[meal].toUpperCase()}</span>
                                            {hasRecipe ? (
                                                <>
                                                    <span className="recipe-name">{getRecipeName(planned.recipeId!)}</span>
                                                    {recipe && (
                                                        <div className="recipe-meta">
                                                            <span>⏱️ {(recipe.prepTime || 0) + (recipe.cookTime || 0)}m</span>
                                                            <span>🍽️ {recipe.servings}</span>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="empty-text">+ Lägg till</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Shopping List */}
            {totalItems > 0 && (
                <section className="shopping-section">
                    <div className="shopping-header">
                        <h2>🛒 Att Handla</h2>
                        <button
                            className="btn btn-secondary btn-sm copy-btn"
                            onClick={handleCopyShoppingList}
                            title="Kopiera listan"
                        >
                            📋 Kopiera
                        </button>
                    </div>
                    <p className="shopping-hint">
                        Format: vara — dag/måltid (F=frukost, L=lunch, M=middag, S=snacks)
                    </p>

                    <div className="shopping-list">
                        {Object.entries(shoppingList).map(([storageType, items]) => (
                            (items as ShoppingItem[]).length > 0 && (
                                <div key={storageType} className="shopping-category">
                                    <h3 className="category-title">{storageLables[storageType]}</h3>
                                    <div className="shopping-items">
                                        {(items as ShoppingItem[]).map((item, idx) => (
                                            <label key={idx} className="shopping-item">
                                                <input type="checkbox" />
                                                <div className="item-content">
                                                    <span className="item-name">{item.name}</span>
                                                    <span className="item-days">
                                                        {formatDayMeals(item.dayMeals)}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </section>
            )}

            {/* Planner Modal */}
            {isPlannerOpen && editingSlot && (
                <div className="modal-overlay" onClick={() => setIsPlannerOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>
                                {WEEKDAY_LABELS[editingSlot.day]} - {MEAL_TYPE_LABELS[editingSlot.meal]}
                            </h2>
                            <button className="close-btn" onClick={() => setIsPlannerOpen(false)}>×</button>
                        </div>

                        <div className="form-group">
                            <label>Välj recept</label>
                            <select
                                value={selectedRecipeId}
                                onChange={(e) => setSelectedRecipeId(e.target.value)}
                            >
                                <option value="">-- Inget recept --</option>
                                {recipes.map(recipe => (
                                    <option key={recipe.id} value={recipe.id}>
                                        {recipe.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedRecipeId && (
                            <div className="recipe-preview">
                                {(() => {
                                    const recipe = getRecipe(selectedRecipeId);
                                    if (!recipe) return null;
                                    // Use calculateRecipeEstimate for accurate nutrition from ingredientsText
                                    const estimate = recipe.ingredientsText
                                        ? calculateRecipeEstimate(recipe.ingredientsText, foodItems)
                                        : null;
                                    const perServing = estimate ? {
                                        calories: Math.round(estimate.calories / recipe.servings),
                                        protein: Math.round(estimate.protein / recipe.servings),
                                    } : null;
                                    return (
                                        <>
                                            <p className="preview-desc">{recipe.description}</p>
                                            {perServing && perServing.calories > 0 && (
                                                <div className="preview-stats">
                                                    <span>🔥 {perServing.calories} kcal</span>
                                                    <span>💪 {perServing.protein}g protein</span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        <div className="form-actions">
                            {getMealForSlot(editingSlot.day, editingSlot.meal)?.recipeId && (
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={handleRemoveMeal}
                                >
                                    Ta bort
                                </button>
                            )}
                            <button type="button" className="btn btn-secondary" onClick={() => setIsPlannerOpen(false)}>
                                Avbryt
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleSaveMeal}>
                                Spara
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
