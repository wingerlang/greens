import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type MealEntryFormData,
    type MealType,
    type MealItem,
    MEAL_TYPE_LABELS,
    getISODate,
} from '../models/types.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import './CaloriesPage.css';

export function CaloriesPage() {
    const {
        foodItems,
        recipes,
        mealEntries,
        addMealEntry,
        deleteMealEntry,
        getMealEntriesForDate,
        calculateDailyNutrition,
        getRecipeWithNutrition,
        getFoodItem,
    } = useData();

    const { settings } = useSettings();

    const [selectedDate, setSelectedDate] = useState(getISODate());
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [mealType, setMealType] = useState<MealType>('breakfast');
    const [itemType, setItemType] = useState<'recipe' | 'foodItem'>('recipe');
    const [selectedItemId, setSelectedItemId] = useState('');
    const [servings, setServings] = useState(1);

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
        };
        dailyEntries.forEach(entry => {
            grouped[entry.mealType].push(entry);
        });
        return grouped;
    }, [dailyEntries]);

    const handleAddMeal = () => {
        if (!selectedItemId) return;

        const newEntry: MealEntryFormData = {
            date: selectedDate,
            mealType,
            items: [{
                type: itemType,
                referenceId: selectedItemId,
                servings,
            }],
        };

        addMealEntry(newEntry);
        setIsFormOpen(false);
        setSelectedItemId('');
        setServings(1);
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

            {/* Daily Summary */}
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

            {/* Meals Timeline */}
            <div className="meals-timeline">
                {(Object.entries(entriesByMeal) as [MealType, typeof dailyEntries][]).map(([mealTypeKey, entries]) => (
                    <div key={mealTypeKey} className="meal-section">
                        <h3 className="meal-title">
                            <span className="meal-icon">
                                {mealTypeKey === 'breakfast' && '🌅'}
                                {mealTypeKey === 'lunch' && '☀️'}
                                {mealTypeKey === 'dinner' && '🌙'}
                                {mealTypeKey === 'snack' && '🍎'}
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
                                {entries.map(entry => (
                                    <div key={entry.id} className="meal-entry">
                                        {entry.items.map((item, idx) => (
                                            <div key={idx} className="entry-item">
                                                <div className="entry-info">
                                                    <span className="entry-name">{getItemName(item)}</span>
                                                    <span className="entry-servings">
                                                        {item.type === 'recipe'
                                                            ? `${item.servings} portion${item.servings > 1 ? 'er' : ''}`
                                                            : `${item.servings}g`}
                                                    </span>
                                                </div>
                                                <span className="entry-calories">{getItemCalories(item)} kcal</span>
                                            </div>
                                        ))}
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

            {/* Add Meal Modal */}
            {isFormOpen && (
                <div className="modal-overlay" onClick={() => setIsFormOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Logga måltid</h2>
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
                        <div className="form-group">
                            <label>Typ</label>
                            <div className="item-type-selector">
                                <button
                                    type="button"
                                    className={`btn ${itemType === 'recipe' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setItemType('recipe')}
                                >
                                    Recept
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${itemType === 'foodItem' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setItemType('foodItem')}
                                >
                                    Råvara
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Välj {itemType === 'recipe' ? 'recept' : 'råvara'}</label>
                            <select
                                value={selectedItemId}
                                onChange={(e) => setSelectedItemId(e.target.value)}
                            >
                                <option value="">Välj...</option>
                                {itemType === 'recipe'
                                    ? recipes.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))
                                    : foodItems.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))
                                }
                            </select>
                        </div>
                        <div className="form-group">
                            <label>{itemType === 'recipe' ? 'Portioner' : 'Mängd (g)'}</label>
                            <input
                                type="number"
                                min="1"
                                value={servings}
                                onChange={(e) => setServings(Number(e.target.value))}
                            />
                        </div>
                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                                Avbryt
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleAddMeal}
                                disabled={!selectedItemId}
                            >
                                Lägg till
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
