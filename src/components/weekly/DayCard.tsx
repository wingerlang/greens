/**
 * DayCard - Individual day card in weekly view
 */

import React, { useMemo } from 'react';
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
    meals: Partial<Record<MealType, PlannedMeal>>;
    visibleMeals: MealType[];
    recipes: Recipe[];
    foodItems: FoodItem[];
    onMealClick: (meal: MealType) => void;
    onCookMeal: (meal: MealType, recipe: Recipe) => void;
    onShuffleDay?: () => void;
    onDragStart?: (e: React.DragEvent, meal: MealType, recipeId: string) => void;
    onDrop?: (e: React.DragEvent, meal: MealType) => void;
}

export function DayCard({
    day,
    dateStr,
    dateNumber,
    isToday,
    meals,
    visibleMeals,
    recipes,
    foodItems,
    onMealClick,
    onCookMeal,
    onShuffleDay,
    onDragStart,
    onDrop,
}: DayCardProps) {

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

    return (
        <div
            className={`day-card-wrapper`}
            data-date-number={dateNumber}
        >
            <div className={`day-card ${isToday ? 'today' : ''}`}>
                {/* Header */}
                <div className="day-card-header">
                    <div className="day-info">
                        <span className="day-name">{DAY_ABBREV[day]}</span>
                        <span className="day-date">{dateStr}</span>
                    </div>

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

                {/* Meal Slots */}
                <div className="day-meals">
                    {visibleMeals.map(meal => {
                        const planned = meals[meal];
                        const recipe = getRecipe(planned);
                        const protein = getProteinPerServing(recipe, planned);

                        return (
                            <MealSlot
                                key={meal}
                                meal={meal}
                                planned={planned}
                                recipe={recipe}
                                proteinPerServing={protein}
                                onSelect={() => onMealClick(meal)}
                                onCook={() => recipe && onCookMeal(meal, recipe)}
                                onDragStart={(e) => planned?.recipeId && onDragStart?.(e, meal, planned.recipeId)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => onDrop?.(e, meal)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default DayCard;
