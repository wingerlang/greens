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
import { type DayAnalysis } from '../../hooks/useSmartPlanner.ts';
import { DailyVitalsModule } from './DailyVitalsModule.tsx';
import { type DailyVitals, type ExerciseEntry } from '../../models/types.ts';
import { useSettings } from '../../context/SettingsContext.tsx';
import { calculateDailyScore } from '../../utils/scoreEngine.ts';

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
    dayAnalysis?: DayAnalysis;
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
    onMagicWand?: (meal: MealType) => void;
    vitals?: DailyVitals;
    onUpdateVitals?: (updates: Partial<DailyVitals>) => void;
    exercises?: ExerciseEntry[];
}

export function DayCard({
    day,
    dateStr,
    dateNumber,
    isToday,
    isPast,
    isYesterday,
    meals,
    dayAnalysis,
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
    onMagicWand,
    vitals,
    onUpdateVitals,
    exercises = [],
}: DayCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const { settings } = useSettings();
    const [showScoreModal, setShowScoreModal] = useState(false);

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
        let carbs = 0;
        let fat = 0;

        visibleMeals.forEach(meal => {
            const planned = meals[meal];
            const recipe = getRecipe(planned);
            if (recipe?.ingredientsText && planned) {
                const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems, planned.swaps);
                const servings = planned.servings || recipe.servings || 4;
                calories += Math.round(estimate.calories / servings);
                protein += Math.round(estimate.protein / servings);
                carbs += Math.round(estimate.carbs / servings);
                fat += Math.round(estimate.fat / servings);
            }
        });

        return { calories, protein, carbs, fat, fiber: 0 };
    }, [meals, visibleMeals, recipes, foodItems]);

    // Daily Score calculation
    const score = useMemo(() => {
        if (!vitals) return null;
        return calculateDailyScore(dailyTotals, vitals, exercises, settings);
    }, [dailyTotals, vitals, exercises, settings]);

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

                        {/* Daily Score Badge */}
                        {score && (
                            <div
                                className="daily-score-badge ml-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowScoreModal(true);
                                }}
                            >
                                <span className="score-label">Synergy</span>
                                <span className="score-value">{score.total}</span>
                            </div>
                        )}
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
                    </div>
                </div>

                {/* Evaluation Modal (Premium) */}
                {showScoreModal && score && (
                    <div className="score-modal-overlay" onClick={() => setShowScoreModal(false)}>
                        <div className="score-modal p-6 space-y-4" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Dagens Analys</h3>
                                <div className="text-2xl font-black text-white">{score.total}<span className="text-[10px] text-emerald-500">/100</span></div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span>Näring</span>
                                        <span className="text-white">{score.nutrition}/40</span>
                                    </div>
                                    <div className="score-progress-bar">
                                        <div className="score-progress-fill bg-emerald-500" style={{ width: `${(score.nutrition / 40) * 100}%` }} />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span>Träning</span>
                                        <span className="text-white">{score.activity}/30</span>
                                    </div>
                                    <div className="score-progress-bar">
                                        <div className="score-progress-fill bg-sky-500" style={{ width: `${(score.activity / 30) * 100}%` }} />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <span>Vitals</span>
                                        <span className="text-white">{score.vitals}/30</span>
                                    </div>
                                    <div className="score-progress-bar">
                                        <div className="score-progress-fill bg-indigo-500" style={{ width: `${(score.vitals / 30) * 100}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 mt-6 pt-4 border-t border-white/5">
                                {score.messages.map((m, i) => (
                                    <div key={i} className="text-[11px] text-slate-300 flex items-start gap-2 leading-relaxed">
                                        <span className="text-emerald-500 mt-1">•</span>
                                        <span>{m}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowScoreModal(false)}
                                className="w-full mt-4 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5 active:scale-95"
                            >
                                Stäng
                            </button>
                        </div>
                    </div>
                )}

                {/* Daily Totals */}
                {dailyTotals.calories > 0 && (
                    <div className="day-totals">
                        <span className="total-item">🔥 {dailyTotals.calories} kcal</span>
                        <span className="total-item">🌱 {dailyTotals.protein}g</span>
                    </div>
                )}

                {/* Meal Slots */}
                <div className="day-meals space-y-4">
                    {/* Main Meals */}
                    <div className="main-meals">
                        {visibleMeals.filter(m => m !== 'snack' && m !== 'beverage').map(meal => {
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
                                    foodItems={foodItems}
                                    suggestions={suggestions}
                                    onSelect={() => onMealClick(meal)}
                                    onCook={() => recipe && onCookMeal(meal, recipe)}
                                    onRemove={() => onRemoveMeal?.(meal)}
                                    onQuickSelect={(id) => onQuickSelect?.(meal, id)}
                                    onShuffleMeal={() => onShuffleMeal?.(meal)}
                                    onDragStart={(e) => planned?.recipeId && onDragStart?.(e, meal, planned.recipeId)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => onDrop?.(e, meal)}
                                    onMagicWand={() => onMagicWand?.(meal)}
                                />
                            );
                        })}
                    </div>

                    {/* Extra / Snacks */}
                    {(visibleMeals.includes('snack') || visibleMeals.includes('beverage')) && (
                        <div className="extra-meals mt-6 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Övrigt</span>
                                <div className="h-[1px] flex-1 bg-white/5" />
                            </div>
                            <div className="space-y-2">
                                {visibleMeals.filter(m => m === 'snack' || m === 'beverage').map(meal => {
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
                                            foodItems={foodItems}
                                            suggestions={suggestions}
                                            onSelect={() => onMealClick(meal)}
                                            onCook={() => recipe && onCookMeal(meal, recipe)}
                                            onRemove={() => onRemoveMeal?.(meal)}
                                            onQuickSelect={(id) => onQuickSelect?.(meal, id)}
                                            onShuffleMeal={() => onShuffleMeal?.(meal)}
                                            onDragStart={(e) => planned?.recipeId && onDragStart?.(e, meal, planned.recipeId)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => onDrop?.(e, meal)}
                                            onMagicWand={() => onMagicWand?.(meal)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Daily Vitals */}
                {vitals && onUpdateVitals && (
                    <DailyVitalsModule
                        vitals={vitals}
                        onUpdate={onUpdateVitals}
                    />
                )}
            </div>

            {/* Back of card */}
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
