import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type Recipe,
    type Weekday,
    type MealType,
    type PlannedMeal,
    WEEKDAY_LABELS,
    WEEKDAYS,
    MEAL_TYPE_LABELS,
    getWeekStartDate,
    getISODate,
} from '../models/types.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import './PlanningPage.css';

// ============================================
// Types
// ============================================

interface RecipeSuggestion {
    recipe: Recipe;
    score: number;
    reasons: string[];
    tags: SuggestionTag[];
}

type SuggestionTag =
    | 'friday-favorite'
    | 'long-time'
    | 'seasonal'
    | 'quick'
    | 'budget'
    | 'carb-variety'
    | 'protein-variety'
    | 'suitable';

// Meal type categories for smart filtering
const MEAL_CATEGORIES: Record<MealType, string[]> = {
    breakfast: ['breakfast', 'brunch', 'frukost', 'morgon'],
    lunch: ['lunch', 'middag', 'dinner'],
    dinner: ['lunch', 'middag', 'dinner', 'kvällsmat'],
    snack: ['snack', 'mellanmål', 'fika'],
};

// Season detection
const getCurrentSeason = (): 'winter' | 'spring' | 'summer' | 'autumn' => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
};

// Seasonal ingredients
const SEASONAL_INGREDIENTS: Record<string, string[]> = {
    winter: ['rotfrukter', 'kål', 'morot', 'palsternacka', 'äpple', 'päron'],
    spring: ['sparris', 'rädisor', 'örter', 'spenat', 'ruccola'],
    summer: ['tomat', 'gurka', 'zucchini', 'bär', 'sallad', 'dill'],
    autumn: ['svamp', 'pumpa', 'squash', 'plommon', 'äpple', 'kål'],
};

// Carb types for variety tracking
const CARB_TYPES = ['ris', 'pasta', 'potatis', 'bulgur', 'couscous', 'nudlar', 'bröd', 'quinoa'];

// Short weekday labels
const SHORT_WEEKDAY_LABELS: Record<Weekday, string> = {
    monday: 'MÅN',
    tuesday: 'TIS',
    wednesday: 'ONS',
    thursday: 'TOR',
    friday: 'FRE',
    saturday: 'LÖR',
    sunday: 'SÖN',
};

// ============================================
// Component
// ============================================

export function PlanningPage() {
    const { recipes, foodItems, weeklyPlans, getWeeklyPlan, saveWeeklyPlan } = useData();
    const { settings } = useSettings();

    const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStartDate());
    const [selectedSlot, setSelectedSlot] = useState<{ day: Weekday; meal: MealType } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Get current week plan
    const weekPlan = useMemo(() => {
        const plan = getWeeklyPlan(currentWeekStart);
        return plan?.meals || {};
    }, [currentWeekStart, getWeeklyPlan]);

    // Calculate week number
    const weekNumber = useMemo(() => {
        const date = new Date(currentWeekStart);
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }, [currentWeekStart]);

    // Navigate weeks
    const navigateWeek = (direction: number) => {
        const newDate = new Date(currentWeekStart);
        newDate.setDate(newDate.getDate() + (direction * 7));
        setCurrentWeekStart(getISODate(newDate));
    };

    // Get meal history for patterns
    const getMealHistory = useCallback(() => {
        const history: { recipeId: string; day: Weekday; meal: MealType; date: string }[] = [];

        weeklyPlans.forEach(plan => {
            WEEKDAYS.forEach(day => {
                const dayMeals = plan.meals[day];
                if (dayMeals) {
                    Object.entries(dayMeals).forEach(([meal, planned]) => {
                        if (planned?.recipeId) {
                            history.push({
                                recipeId: planned.recipeId,
                                day,
                                meal: meal as MealType,
                                date: plan.weekStartDate,
                            });
                        }
                    });
                }
            });
        });

        return history;
    }, [weeklyPlans]);

    // Check if recipe is suitable for meal type
    const isSuitableForMealType = (recipe: Recipe, mealType: MealType): boolean => {
        const recipeMealType = recipe.mealType?.toLowerCase() || '';
        const categories = MEAL_CATEGORIES[mealType];

        // If recipe has a meal type, check if it matches
        if (recipeMealType) {
            // Snacks should not include main meals
            if (mealType === 'snack') {
                return recipeMealType.includes('snack') ||
                    recipeMealType.includes('mellanmål') ||
                    recipeMealType.includes('fika');
            }
            return categories.some(cat => recipeMealType.includes(cat));
        }

        // For snacks without explicit type, filter by prep time and name
        if (mealType === 'snack') {
            const quickSnack = (recipe.cookTime || 60) <= 15;
            const nameHints = ['snack', 'smoothie', 'yoghurt', 'frukt', 'nötter', 'bars'];
            return quickSnack || nameHints.some(hint => recipe.name.toLowerCase().includes(hint));
        }

        return true; // Default: suitable for main meals
    };

    // Generate smart suggestions for a slot
    const getSuggestions = useCallback((day: Weekday, mealType: MealType): RecipeSuggestion[] => {
        const history = getMealHistory();
        const season = getCurrentSeason();
        const suggestions: RecipeSuggestion[] = [];

        recipes.forEach(recipe => {
            const reasons: string[] = [];
            const tags: SuggestionTag[] = [];
            let score = 0;

            // 1. Meal type suitability (CRITICAL for snacks)
            if (!isSuitableForMealType(recipe, mealType)) {
                return; // Skip unsuitable recipes
            }
            tags.push('suitable');

            // 2. Friday pattern (people often eat special food on Fridays)
            if (day === 'friday') {
                const fridayHistory = history.filter(h => h.day === 'friday');
                const recipeFrequency = fridayHistory.filter(h => h.recipeId === recipe.id).length;
                if (recipeFrequency >= 2) {
                    score += 30;
                    reasons.push('🔥 Fredagsfavorit');
                    tags.push('friday-favorite');
                }
            }

            // 3. Long time since last eaten
            const recipeHistory = history.filter(h => h.recipeId === recipe.id);
            const lastEaten = recipeHistory.length > 0
                ? Math.max(...recipeHistory.map(h => new Date(h.date).getTime()))
                : 0;
            const daysSinceEaten = lastEaten
                ? Math.floor((Date.now() - lastEaten) / (1000 * 60 * 60 * 24))
                : 999;

            if (daysSinceEaten >= 30 && recipeHistory.length > 0) {
                score += 25;
                reasons.push(`⏰ ${daysSinceEaten} dagar sedan`);
                tags.push('long-time');
            } else if (daysSinceEaten >= 14) {
                score += 10;
            }

            // 4. Seasonal ingredients
            const seasonalIngredients = SEASONAL_INGREDIENTS[season];
            const ingredientsText = (recipe.ingredientsText || '').toLowerCase();
            const seasonalMatches = seasonalIngredients.filter(ing => ingredientsText.includes(ing));
            if (seasonalMatches.length > 0) {
                score += 15 * seasonalMatches.length;
                reasons.push(`🥬 Säsong: ${seasonalMatches.join(', ')}`);
                tags.push('seasonal');
            }

            // 5. Quick meals for weekdays
            const isWeekday = ['monday', 'tuesday', 'wednesday', 'thursday'].includes(day);
            if (isWeekday && (recipe.cookTime || 60) <= 30) {
                score += 15;
                reasons.push(`⏱️ Snabbt (${recipe.cookTime || '?'} min)`);
                tags.push('quick');
            }

            // 6. Carb variety (avoid too much rice/pasta in a row)
            const plannedThisWeek = Object.values(weekPlan).flatMap(dayMeals =>
                Object.values(dayMeals || {}).map(m => m?.recipeId)
            ).filter(Boolean);

            const recipeCarbs = CARB_TYPES.filter(carb => ingredientsText.includes(carb));
            const weekCarbs = plannedThisWeek.map(id => {
                const r = recipes.find(rec => rec.id === id);
                return CARB_TYPES.filter(carb => (r?.ingredientsText || '').toLowerCase().includes(carb));
            }).flat();

            const carbOverlap = recipeCarbs.filter(c => weekCarbs.includes(c)).length;
            if (recipeCarbs.length > 0 && carbOverlap === 0) {
                score += 10;
                reasons.push(`🍚 Kolhydratvariation: ${recipeCarbs.join(', ')}`);
                tags.push('carb-variety');
            }

            // 7. Base score for recipes with nutrition data
            if (recipe.ingredientsText) {
                const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems);
                if (estimate.calories > 0) {
                    score += 5; // Bonus for complete nutrition data
                }
            }

            // Only include if has some score
            if (score > 0 || reasons.length > 0) {
                suggestions.push({ recipe, score, reasons, tags });
            }
        });

        // Sort by score descending
        return suggestions.sort((a, b) => b.score - a.score).slice(0, 8);
    }, [recipes, foodItems, weekPlan, getMealHistory]);

    // Get filtered recipes for search
    const filteredRecipes = useMemo(() => {
        if (!selectedSlot) return [];

        let filtered = recipes.filter(r => isSuitableForMealType(r, selectedSlot.meal));

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.name.toLowerCase().includes(query) ||
                (r.description || '').toLowerCase().includes(query) ||
                (r.ingredientsText || '').toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [recipes, selectedSlot, searchQuery]);

    // Handle selecting a recipe
    const handleSelectRecipe = (recipeId: string) => {
        if (!selectedSlot) return;

        const newPlan = {
            ...weekPlan,
            [selectedSlot.day]: {
                ...weekPlan[selectedSlot.day],
                [selectedSlot.meal]: { recipeId } as PlannedMeal,
            },
        };

        saveWeeklyPlan(currentWeekStart, newPlan);
        setSelectedSlot(null);
        setSearchQuery('');
    };

    // Handle removing a meal
    const handleRemoveMeal = (day: Weekday, meal: MealType) => {
        const dayPlan = { ...weekPlan[day] };
        delete dayPlan[meal];

        saveWeeklyPlan(currentWeekStart, {
            ...weekPlan,
            [day]: dayPlan,
        });
    };

    // Get recipe name
    const getRecipeName = (recipeId: string): string => {
        return recipes.find(r => r.id === recipeId)?.name || 'Okänt';
    };

    // Get suggestions for selected slot
    const suggestions = useMemo(() => {
        if (!selectedSlot) return [];
        return getSuggestions(selectedSlot.day, selectedSlot.meal);
    }, [selectedSlot, getSuggestions]);

    return (
        <div className="planning-page">
            {/* Header */}
            <header className="planning-header">
                <div className="week-nav">
                    <button className="nav-btn" onClick={() => navigateWeek(-1)}>←</button>
                    <h1>✨ Planera Vecka {weekNumber}</h1>
                    <button className="nav-btn" onClick={() => navigateWeek(1)}>→</button>
                </div>
                <p className="planning-subtitle">Smarta förslag baserat på dina mönster</p>
            </header>

            {/* Week Grid - Compact View */}
            <div className="week-grid">
                {WEEKDAYS.map(day => (
                    <div key={day} className="day-column">
                        <div className="day-header">
                            <span className="day-short">{SHORT_WEEKDAY_LABELS[day]}</span>
                        </div>
                        <div className="day-meals">
                            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(meal => {
                                const planned = weekPlan[day]?.[meal];
                                const isSelected = selectedSlot?.day === day && selectedSlot?.meal === meal;

                                return (
                                    <div
                                        key={meal}
                                        className={`meal-cell ${planned ? 'has-meal' : 'empty'} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => setSelectedSlot({ day, meal })}
                                    >
                                        {planned?.recipeId ? (
                                            <div className="meal-content">
                                                <span className="meal-icon">{
                                                    meal === 'breakfast' ? '🌅' :
                                                        meal === 'lunch' ? '☀️' :
                                                            meal === 'dinner' ? '🌙' : '🍎'
                                                }</span>
                                                <span className="meal-name">{getRecipeName(planned.recipeId)}</span>
                                                <button
                                                    className="remove-btn"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveMeal(day, meal); }}
                                                >×</button>
                                            </div>
                                        ) : (
                                            <span className="add-icon">+</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Suggestion Panel */}
            {selectedSlot && (
                <div className="suggestion-panel">
                    <div className="panel-header">
                        <h2>
                            {WEEKDAY_LABELS[selectedSlot.day]} - {MEAL_TYPE_LABELS[selectedSlot.meal]}
                        </h2>
                        <button className="close-btn" onClick={() => setSelectedSlot(null)}>×</button>
                    </div>

                    {/* Search */}
                    <input
                        type="text"
                        className="recipe-search"
                        placeholder="🔍 Sök recept..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    {/* Smart Suggestions */}
                    {!searchQuery && suggestions.length > 0 && (
                        <div className="suggestions-section">
                            <h3>✨ Förslag för dig</h3>
                            <div className="suggestion-cards">
                                {suggestions.map(({ recipe, reasons, tags }) => (
                                    <div
                                        key={recipe.id}
                                        className={`suggestion-card ${tags.includes('friday-favorite') ? 'highlight' : ''}`}
                                        onClick={() => handleSelectRecipe(recipe.id)}
                                    >
                                        <div className="suggestion-name">{recipe.name}</div>
                                        <div className="suggestion-reasons">
                                            {reasons.slice(0, 2).map((reason, i) => (
                                                <span key={i} className="reason-tag">{reason}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Recipes */}
                    <div className="all-recipes-section">
                        <h3>{searchQuery ? 'Sökresultat' : 'Alla recept'}</h3>
                        <div className="recipe-list">
                            {filteredRecipes.map(recipe => (
                                <div
                                    key={recipe.id}
                                    className="recipe-item"
                                    onClick={() => handleSelectRecipe(recipe.id)}
                                >
                                    <span className="recipe-name">{recipe.name}</span>
                                    {recipe.cookTime && (
                                        <span className="recipe-time">⏱️ {recipe.cookTime} min</span>
                                    )}
                                </div>
                            ))}
                            {filteredRecipes.length === 0 && (
                                <p className="no-recipes">Inga recept hittades för denna måltidstyp.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
