/**
 * MealSlot - Individual meal slot within a day card
 */

import React from 'react';
import { type MealType, type PlannedMeal, type Recipe, MEAL_TYPE_LABELS, MEAL_TYPE_COLORS } from '../../models/types.ts';

interface MealSlotProps {
    meal: MealType;
    planned: PlannedMeal | undefined;
    recipe: Recipe | undefined;
    proteinPerServing?: number;
    onSelect: () => void;
    onCook: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
}

export function MealSlot({
    meal,
    planned,
    recipe,
    proteinPerServing,
    onSelect,
    onCook,
    onDragStart,
    onDragOver,
    onDrop,
}: MealSlotProps) {
    const hasRecipe = !!planned?.recipeId && !!recipe;
    const isCooked = !!planned?.cookedAt;

    const colorClass = MEAL_TYPE_COLORS[meal] || 'text-slate-400 bg-slate-500/10';

    const handleClick = () => {
        if (hasRecipe) {
            onCook();
        } else {
            onSelect();
        }
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (hasRecipe && onDragStart) {
            e.dataTransfer.setData('text/plain', recipe!.id);
            e.dataTransfer.effectAllowed = 'move';
            onDragStart(e);
        }
    };

    return (
        <div
            className={`meal-slot ${meal} ${hasRecipe ? 'has-recipe' : 'empty'} ${isCooked ? 'cooked' : ''}`}
            onClick={handleClick}
            draggable={hasRecipe}
            onDragStart={handleDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <span className={`meal-type ${colorClass}`}>
                {MEAL_TYPE_LABELS[meal]}
            </span>

            {hasRecipe ? (
                <>
                    <div className="recipe-row">
                        <span className="recipe-name">
                            {recipe!.name.length > 25 ? recipe!.name.substring(0, 25) + '...' : recipe!.name}
                        </span>
                        {isCooked && <span className="cooked-badge">✓</span>}
                    </div>

                    <div className="recipe-meta">
                        <span>⏱ {recipe!.cookTime || 0}m</span>
                        <span>🍽 {planned?.servings || recipe!.servings || 4}</span>
                        {proteinPerServing && <span>🥩 {proteinPerServing}g</span>}
                    </div>

                    {planned?.swaps && Object.keys(planned.swaps).length > 0 && (
                        <div className="swap-indicator">🌱</div>
                    )}
                </>
            ) : (
                <span className="empty-text">Lägg till recept</span>
            )}
        </div>
    );
}

export default MealSlot;
