/**
 * MealSlot - Individual meal slot within a day card
 */

import React, { useMemo, useState } from "react";
import {
  type FoodItem,
  MEAL_TYPE_COLORS,
  MEAL_TYPE_LABELS,
  type MealType,
  type PlannedMeal,
  type Recipe,
} from "../../models/types.ts";

interface MealSlotProps {
  meal: MealType;
  planned: PlannedMeal | undefined;
  recipe: Recipe | undefined;
  proteinPerServing?: number;
  foodItems?: FoodItem[]; // For looking up swap details
  suggestions?: Recipe[];
  onSelect: () => void;
  onCook: () => void;
  onRemove?: () => void;
  onQuickSelect?: (recipeId: string) => void;
  onShuffleMeal?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onMagicWand?: () => void;
}

export function MealSlot({
  meal,
  planned,
  recipe,
  proteinPerServing,
  foodItems = [],
  suggestions = [],
  onSelect,
  onCook,
  onRemove,
  onQuickSelect,
  onShuffleMeal,
  onDragStart,
  onDragOver,
  onDrop,
  onMagicWand,
}: MealSlotProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hasRecipe = !!planned?.recipeId && !!recipe;
  const isCooked = !!planned?.cookedAt;
  const hasSwaps = !!(planned?.swaps && Object.keys(planned.swaps).length > 0);

  const colorClass = MEAL_TYPE_COLORS[meal] || "text-slate-400 bg-slate-500/10";

  // Build swap tooltip text
  const swapTooltip = useMemo(() => {
    if (!hasSwaps || !planned?.swaps) return "";
    const lines: string[] = [];
    Object.entries(planned.swaps).forEach(([originalId, newId]) => {
      const original = foodItems.find((f) => f.id === originalId);
      const replacement = foodItems.find((f) => f.id === newId);
      if (original && replacement) {
        lines.push(`${replacement.name} (istf ${original.name})`);
      }
    });
    return lines.join("\n");
  }, [hasSwaps, planned?.swaps, foodItems]);

  const handleClick = () => {
    if (hasRecipe) {
      onCook();
    } else {
      onSelect();
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (hasRecipe && onDragStart) {
      e.dataTransfer.setData("text/plain", recipe!.id);
      e.dataTransfer.effectAllowed = "move";
      onDragStart(e);
    }
  };

  const slotClasses = [
    "meal-slot",
    meal,
    hasRecipe ? "has-recipe" : "empty",
    isCooked && "cooked",
    isHovered && "hovered",
  ].filter(Boolean).join(" ");

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
        <div className="meal-type-row">
          <span className={`meal-type ${colorClass}`}>
            {MEAL_TYPE_LABELS[meal]}
          </span>
          {hasRecipe && (
            <div className="header-meta">
              <span>⏱{recipe!.cookTime || 0}'</span>
              <span>👥{planned?.servings || recipe!.servings || 4}</span>
              {proteinPerServing && (
                <span className="protein-inline">🌱{proteinPerServing}g</span>
              )}
              {recipe!.seasons?.includes(
                new Date().getMonth() >= 2 && new Date().getMonth() <= 4
                  ? "spring"
                  : new Date().getMonth() >= 5 && new Date().getMonth() <= 7
                  ? "summer"
                  : new Date().getMonth() >= 8 && new Date().getMonth() <= 10
                  ? "autumn"
                  : "winter",
              ) && (
                <span className="health-status-icon-sm" title="I säsong">
                  ☀️
                </span>
              )}
              {recipe!.priceCategory === "budget" && (
                <span className="health-status-icon-sm" title="Budgetpris">
                  💰
                </span>
              )}
            </div>
          )}
        </div>
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
          {!hasRecipe && onMagicWand && (
            <button
              className="meal-magic-btn"
              onClick={(e) => {
                e.stopPropagation();
                onMagicWand();
              }}
              title="Fyll med smart val"
            >
              🪄
            </button>
          )}
        </div>
      </div>

      {hasRecipe
        ? (
          <>
            <div className="recipe-row">
              <span className="recipe-name">
                {recipe!.name.length > 25
                  ? recipe!.name.substring(0, 25) + "..."
                  : recipe!.name}
              </span>
              {isCooked && <span className="cooked-badge">✓</span>}
            </div>

            {hasSwaps && (
              <div className="swap-indicator" title={swapTooltip}>
                <span className="swap-badge">🌍 Modifierat</span>
                <span className="swap-count">
                  {Object.keys(planned!.swaps!).length}{" "}
                  byte{Object.keys(planned!.swaps!).length > 1 ? "n" : ""}
                </span>
              </div>
            )}
          </>
        )
        : (
          <div className="empty-content">
            <span className="empty-text">Lägg till recept</span>

            {/* Hover suggestions */}
            {isHovered && suggestions.length > 0 && (
              <div className="hover-suggestions">
                {suggestions.slice(0, 3).map((s) => (
                  <button
                    key={s.id}
                    className="suggestion-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickSelect?.(s.id);
                    }}
                  >
                    {s.name.length > 18
                      ? s.name.substring(0, 18) + "..."
                      : s.name}
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
