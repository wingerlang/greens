/**
 * DayCard - Individual day card in weekly view
 */

import React, { useState, useMemo } from 'react';
import {
    type Weekday,
    type MealType,
    type PlannedMeal,
    type Recipe,
    type FoodItem,
    WEEKDAY_LABELS
} from '../../models/types.ts';
import { MealSlot } from './MealSlot.tsx';
import { calculateRecipeEstimate } from '../../utils/ingredientParser.ts';

// Swedish day abbreviations matching reference design
const DAY_ABBREV: Record<Weekday, string> = {
    monday: 'MÅN',
    tuesday: 'TIS',
    wednesday: 'ONS',
    thursday: 'TOR',
    friday: 'FRE',
    saturday: 'LÖR',
    sunday: 'SÖN',
};

interface DayCardProps {
    day: Weekday;
    dateStr: string;          // "8 DEC."
    dateNumber: number;       // 8 (for watermark)
    isToday: boolean;
    isPast: boolean;          // Days before today
    isYesterday: boolean;     // Special styling for yesterday
    meals: Partial<Record<MealType, PlannedMeal>>;
    visibleMeals: MealType[];
    recipes: Recipe[];
    foodItems: FoodItem[];
    getSuggestions?: (meal: MealType) => Recipe[];
    onMealClick: (meal: MealType) => void;
    onCookMeal: (meal: MealType, recipe: Recipe) => void;
    onRemoveMeal?: (meal: MealType) => void;
    onShuffleDay?: () => void;
    onShuffleMeal?: (meal: MealType) => void;
    onQuickSelect?: (meal: MealType, recipeId: string) => void;
    onDragStart?: (e: React.DragEvent, meal: MealType, recipeId: string) => void;
    onDrop?: (e: React.DragEvent, meal: MealType) => void;
}

export function DayCard({
    day,
    dateStr,
    dateNumber,
    isToday,
    isPast,
    isYesterday,
    meals,
    visibleMeals,
    recipes,
    foodItems,
    getSuggestions,
    onMealClick,
    onCookMeal,
    onRemoveMeal,
    onShuffleDay,
    onShuffleMeal,
    onQuickSelect,
    onDragStart,
    onDrop,
}: DayCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    // Get recipe for a planned meal
    const getRecipe = (planned: PlannedMeal | undefined): Recipe | undefined => {
        if (!planned?.recipeId) return undefined;
        return recipes.find(r => r.id === planned.recipeId);
    };

    // Calculate protein per serving for a recipe
    const getProteinPerServing = (recipe: Recipe | undefined, planned: PlannedMeal | undefined): number | undefined => {
        if (!recipe?.ingredientsText) return undefined;
        const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems, planned?.swaps);
        const servings = planned?.servings || recipe.servings || 4;
        return Math.round(estimate.protein / servings);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // Calculate daily totals for calories and protein
    const dailyTotals = useMemo(() => {
        let calories = 0;
        let protein = 0;

        visibleMeals.forEach(meal => {
            const planned = meals[meal];
            const recipe = getRecipe(planned);
            if (recipe?.ingredientsText && planned) {
                const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems, planned.swaps);
                const servings = planned.servings || recipe.servings || 4;
                // Assume 1 serving per person
                calories += Math.round(estimate.calories / servings);
                protein += Math.round(estimate.protein / servings);
            }
        });

        return { calories, protein };
    }, [meals, visibleMeals, recipes, foodItems]);

    // Build class names
    const wrapperClasses = [
        'day-card-wrapper',
        isFlipped && 'is-flipped',
    ].filter(Boolean).join(' ');

    const cardClasses = [
        'day-card',
        isToday && 'today',
        isPast && 'past',
        isYesterday && 'yesterday',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={wrapperClasses}
            data-date-number={dateNumber}
        >
            {/* Front of card */}
            <div className={`day-card-front ${cardClasses}`}>
                {/* Date Watermark */}
                <span className="date-watermark">{dateNumber}</span>

                {/* Header */}
                <div className="day-card-header">
                    <div className="day-info">
                        <span className="day-name">{DAY_ABBREV[day]}</span>
                        <span className="day-date">{dateStr}</span>
                    </div>

                    <div className="day-actions">
                        <button
                            className="flip-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsFlipped(true);
                            }}
                            title="Vänd kortet"
                        >
                            🔄
                        </button>
                        {onShuffleDay && (
                            <button
                                className="shuffle-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onShuffleDay();
                                }}
                                title="Slumpa denna dag"
                            >
                                🔀
                            </button>
                        )}
                    </div>
                </div>

                {/* Daily Totals - only show if meals are planned */}
                {dailyTotals.calories > 0 && (
                    <div className="day-totals">
                        <span className="total-item">🔥 {dailyTotals.calories} kcal</span>
                        <span className="total-item">🌱 {dailyTotals.protein}g</span>
                    </div>
                )}

                {/* Meal Slots */}
                <div className="day-meals">
                    {visibleMeals.map(meal => {
                        const planned = meals[meal];
                        const recipe = getRecipe(planned);
                        const protein = getProteinPerServing(recipe, planned);
                        const suggestions = getSuggestions?.(meal) || [];

                        return (
                            <MealSlot
                                key={meal}
                                meal={meal}
                                planned={planned}
                                recipe={recipe}
                                proteinPerServing={protein}
                                suggestions={suggestions}
                                onSelect={() => onMealClick(meal)}
                                onCook={() => recipe && onCookMeal(meal, recipe)}
                                onRemove={() => onRemoveMeal?.(meal)}
                                onQuickSelect={(id) => onQuickSelect?.(meal, id)}
                                onShuffleMeal={() => onShuffleMeal?.(meal)}
                                onDragStart={(e) => planned?.recipeId && onDragStart?.(e, meal, planned.recipeId)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => onDrop?.(e, meal)}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Back of card - flipped state */}
            <div className="day-card-back">
                <div className="back-content">
                    <h3 className="back-title">{DAY_ABBREV[day]} - Ignorerad</h3>
                    <p className="back-text">Denna dag är vänd/ignorerad</p>
                    <button
                        className="unflip-btn"
                        onClick={() => setIsFlipped(false)}
                    >
                        Återställ ↩
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DayCard;


