/**
 * MealSlot - Individual meal slot within a day card
 */

import React, { useState } from 'react';
import { type MealType, type PlannedMeal, type Recipe, MEAL_TYPE_LABELS, MEAL_TYPE_COLORS } from '../../models/types.ts';

interface MealSlotProps {
    meal: MealType;
    planned: PlannedMeal | undefined;
    recipe: Recipe | undefined;
    proteinPerServing?: number;
    suggestions?: Recipe[];
    onSelect: () => void;
    onCook: () => void;
    onRemove?: () => void;
    onQuickSelect?: (recipeId: string) => void;
    onShuffleMeal?: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
}

export function MealSlot({
    meal,
    planned,
    recipe,
    proteinPerServing,
    suggestions = [],
    onSelect,
    onCook,
    onRemove,
    onQuickSelect,
    onShuffleMeal,
    onDragStart,
    onDragOver,
    onDrop,
}: MealSlotProps) {
    const [isHovered, setIsHovered] = useState(false);
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

    const slotClasses = [
        'meal-slot',
        meal,
        hasRecipe ? 'has-recipe' : 'empty',
        isCooked && 'cooked',
        isHovered && 'hovered',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={slotClasses}
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            draggable={hasRecipe}
            onDragStart={handleDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div className="meal-slot-header">
                <span className={`meal-type ${colorClass}`}>
                    {MEAL_TYPE_LABELS[meal]}
                </span>
                <div className="slot-actions">
                    {hasRecipe && onRemove && (
                        <button
                            className="meal-remove-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            title="Ta bort recept"
                        >
                            ✕
                        </button>
                    )}
                    {!hasRecipe && onShuffleMeal && (
                        <button
                            className="meal-shuffle-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShuffleMeal();
                            }}
                            title="Slumpa måltid"
                        >
                            🎲
                        </button>
                    )}
                </div>
            </div>

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
                        <span>👥 {planned?.servings || recipe!.servings || 4}</span>
                        {proteinPerServing && <span>🌱 {proteinPerServing}g</span>}
                    </div>

                    {planned?.swaps && Object.keys(planned.swaps).length > 0 && (
                        <div className="swap-indicator">♻️ Byten</div>
                    )}
                </>
            ) : (
                <div className="empty-content">
                    <span className="empty-text">Lägg till recept</span>

                    {/* Hover suggestions */}
                    {isHovered && suggestions.length > 0 && (
                        <div className="hover-suggestions">
                            {suggestions.slice(0, 3).map(s => (
                                <button
                                    key={s.id}
                                    className="suggestion-chip"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onQuickSelect?.(s.id);
                                    }}
                                >
                                    {s.name.length > 18 ? s.name.substring(0, 18) + '...' : s.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MealSlot;


