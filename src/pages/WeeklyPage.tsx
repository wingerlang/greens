import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useCooking } from '../context/CookingModeProvider.tsx';
import {
    type Weekday,
    type MealType,
    type WeeklyPlan,
    type PlannedMeal,
    WEEKDAY_LABELS,
    WEEKDAYS,
    MEAL_TYPE_LABELS,
    MEAL_TYPE_COLORS,
    getWeekStartDate,
    getISODate,
} from '../models/types.ts';
import { RecipeSelectionModal } from '../components/RecipeSelectionModal.tsx';
import { useSmartSuggestions } from '../hooks/useSmartSuggestions.ts';
import { useShoppingList } from '../hooks/useShoppingList.ts';
import { ShoppingListView } from '../components/ShoppingListView.tsx';

// Meal abbreviations for display
const MEAL_ABBREV: Record<MealType, string> = {
    breakfast: 'F',
    lunch: 'L',
    dinner: 'M',
    snack: 'S',
    beverage: 'D',
};

export function WeeklyPage() {
    const {
        recipes,
        weeklyPlans,
        saveWeeklyPlan,
        userSettings,
        foodItems,
        pantryItems, // Global pantry state
        togglePantryItem
    } = useData();

    // State
    const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate());
    const [weekPlan, setWeekPlan] = useState<WeeklyPlan['meals']>();
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{ day: Weekday; meal: MealType } | null>(null);

    // Initial load try/catch
    useEffect(() => {
        console.log('WeeklyPage: Loading plan for', currentWeekStart);
        console.log('WeeklyPage: Available plans:', weeklyPlans);
        try {
            const plan = weeklyPlans?.find(p => p.weekStartDate === currentWeekStart);
            console.log('WeeklyPage: Found plan:', plan);

            if (plan) {
                setWeekPlan(plan.meals);
            } else {
                // New empty plan
                setWeekPlan({
                    monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}, sunday: {}
                });
            }
        } catch (e) {
            console.error('WeeklyPage: Error loading plan', e);
        }
    }, [currentWeekStart, weeklyPlans]);

    // Save on change
    useEffect(() => {
        if (weekPlan) {
            saveWeeklyPlan({
                weekStartDate: currentWeekStart,
                meals: weekPlan
            });
        }
    }, [weekPlan, currentWeekStart]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Hooks ---
    const { getSuggestions } = useSmartSuggestions(recipes, weeklyPlans);

    const visibleMeals = userSettings.visibleMeals;

    const { shoppingList, totalItems, handleCopyShoppingList } = useShoppingList(
        weekPlan || { monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}, sunday: {} }, // Safe fallback
        recipes,
        foodItems,
        pantryItems,
        visibleMeals
    );

    const { openRecipe } = useCooking();

    // --- Handlers ---

    const handleWeekChange = (offset: number) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + (offset * 7));
        setCurrentWeekStart(getISODate(d));
    };

    const handleDragStart = (e: React.DragEvent, recipeId: string) => {
        e.dataTransfer.setData('recipeId', recipeId);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDrop = (e: React.DragEvent, day: Weekday, meal: MealType) => {
        e.preventDefault();
        const recipeId = e.dataTransfer.getData('recipeId');
        if (recipeId) {
            setWeekPlan((prev: WeeklyPlan['meals'] | undefined) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    [day]: {
                        ...prev[day],
                        [meal]: { recipeId, servings: 1 }
                    }
                };
            });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const getMealForSlot = (day: Weekday, meal: MealType): PlannedMeal | undefined => {
        return weekPlan?.[day]?.[meal];
    };

    const handleSlotClick = (day: Weekday, meal: MealType) => {
        setEditingSlot({ day, meal });
        setIsPlannerOpen(true);
    };

    const handleRemoveMeal = () => {
        if (!editingSlot || !weekPlan) return;
        setWeekPlan((prev: WeeklyPlan['meals'] | undefined) => {
            if (!prev) return prev;
            return {
                ...prev,
                [editingSlot.day]: {
                    ...prev[editingSlot.day],
                    [editingSlot.meal]: undefined
                }
            };
        });
        setIsPlannerOpen(false);
        setEditingSlot(null);
    };

    const handleSaveMeal = (recipeId?: string, swaps?: Record<string, string>) => {
        if (!editingSlot || !weekPlan || !recipeId) return;

        setWeekPlan((prev: WeeklyPlan['meals'] | undefined) => {
            if (!prev) return prev;
            const existing = prev[editingSlot.day]?.[editingSlot.meal];

            // If snack and already has recipe, add as additional
            if (editingSlot.meal === 'snack' && existing?.recipeId && recipeId !== existing.recipeId) {
                return {
                    ...prev,
                    [editingSlot.day]: {
                        ...prev[editingSlot.day],
                        snack: {
                            ...existing,
                            additionalRecipeIds: [...(existing.additionalRecipeIds || []), recipeId]
                        }
                    }
                };
            }

            // Normal replace or update
            return {
                ...prev,
                [editingSlot.day]: {
                    ...prev[editingSlot.day],
                    [editingSlot.meal]: {
                        recipeId,
                        servings: 1,
                        swaps // Check if undefined is fine, types say optional
                    }
                }
            };
        });

        setIsPlannerOpen(false);
        setEditingSlot(null);
    };

    const getRecipe = (id?: string) => recipes.find(r => r.id === id);

    if (!weekPlan) return <div className="p-8 text-center text-slate-500">Laddar veckoplan...</div>;

    return (
        <div className="max-w-7xl mx-auto pb-24">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">Veckoplanering</h1>
                    <p className="text-slate-400 mt-1">Planera för vecka {getISODate(new Date(currentWeekStart)).substring(5)}</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-900/50 p-1.5 rounded-xl border border-slate-700/50">
                    <button onClick={() => handleWeekChange(-1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">◀</button>
                    <span className="font-mono font-bold text-slate-200 min-w-[100px] text-center">{currentWeekStart}</span>
                    <button onClick={() => handleWeekChange(1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">▶</button>
                </div>
            </div>

            {/* Shopping List Component */}
            <ShoppingListView
                shoppingList={shoppingList}
                pantryItems={new Set(pantryItems)}
                togglePantryItem={togglePantryItem}
                totalItems={totalItems}
                onCopy={handleCopyShoppingList}
            />

            {/* Planning Grid */}
            <div className="overflow-x-auto pb-4">
                <div className="min-w-[1000px] grid grid-cols-[100px_repeat(7,1fr)] gap-2">
                    {/* Header Row */}
                    <div className="sticky left-0 z-20"></div>
                    {WEEKDAYS.map(day => (
                        <div key={day} className="text-center p-3 bg-slate-900/80 rounded-xl border border-slate-800 backdrop-blur-sm">
                            <div className="font-bold text-slate-200 capitalize">{WEEKDAY_LABELS[day]}</div>
                        </div>
                    ))}

                    {/* Meal Rows */}
                    {visibleMeals.map(meal => (
                        <React.Fragment key={meal}>
                            <div className="sticky left-0 z-10 flex items-center justify-center bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-sm">
                                <div className="text-center">
                                    <div className="font-bold text-slate-300 text-sm">{MEAL_TYPE_LABELS[meal]}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-1 opacity-50">{MEAL_ABBREV[meal]}</div>
                                </div>
                            </div>

                            {WEEKDAYS.map(day => {
                                const planned = getMealForSlot(day, meal);
                                const recipe = getRecipe(planned?.recipeId);
                                const suggestions = !planned ? getSuggestions(day, meal) : [];

                                return (
                                    <div
                                        key={`${day}-${meal}`}
                                        className={`
                                            min-h-[140px] relative group rounded-xl border-2 transition-all p-2 flex flex-col gap-2
                                            ${planned
                                                ? 'bg-slate-800/40 border-slate-700 hover:border-emerald-500/30 hover:bg-slate-800/60'
                                                : 'bg-slate-900/20 border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-800/20'
                                            }
                                        `}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, day, meal)}
                                        onClick={() => handleSlotClick(day, meal)}
                                    >
                                        {planned ? (
                                            <>
                                                {recipe ? (
                                                    <div draggable onDragStart={(e) => handleDragStart(e, recipe.id)} className="cursor-move h-full flex flex-col">
                                                        <div className="flex-1">
                                                            <div className={`text-xs font-bold uppercase tracking-wider mb-1 px-1.5 py-0.5 rounded-md w-fit ${MEAL_TYPE_COLORS[recipe.mealType || 'dinner']}`}>
                                                                {recipe.name.length > 20 ? recipe.name.substring(0, 20) + '...' : recipe.name}
                                                            </div>
                                                            {planned.note && <div className="text-xs text-slate-400 italic mb-1">"{planned.note}"</div>}
                                                            <div className="flex items-center gap-2 mt-auto">
                                                                <span className="text-xs text-slate-500">⏳ {recipe.cookTime}m</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openRecipe(recipe.id);
                                                                }}
                                                            >
                                                                👨‍🍳 Laga
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-rose-400">Recept saknas</div>
                                                )}

                                                {/* Additional Items (Snacks) */}
                                                {planned.additionalRecipeIds?.map(aid => {
                                                    const ar = getRecipe(aid);
                                                    if (!ar) return null;
                                                    return (
                                                        <div key={aid} className="text-xs bg-slate-900/50 p-1 rounded border border-slate-700/50 text-slate-400 truncate">
                                                            + {ar.name}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            /* Empty Slot Suggestions */
                                            <div className="h-full flex flex-col justify-center">
                                                {suggestions.length > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {suggestions.slice(0, 2).map((s) => (
                                                            <div
                                                                key={s.recipe.id}
                                                                className="text-[10px] p-1.5 bg-slate-800/80 hover:bg-emerald-500/10 hover:text-emerald-300 border border-slate-700/50 rounded-lg cursor-pointer transition-colors text-slate-400 truncate text-left"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSaveMeal(s.recipe.id);
                                                                }}
                                                            >
                                                                {s.reasons[0].includes('Fredag') ? '🔥' : '✨'} {s.recipe.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-2xl opacity-20 text-slate-500">+</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Modals */}
            <RecipeSelectionModal
                isOpen={isPlannerOpen}
                onClose={() => setIsPlannerOpen(false)}
                editingSlot={editingSlot}
                currentPlannedMeal={editingSlot ? getMealForSlot(editingSlot.day, editingSlot.meal) : undefined}
                onSelectRecipe={() => { }} // Internal state in modal mostly used now
                onRemoveMeal={handleRemoveMeal}
                onSave={(id, swaps) => handleSaveMeal(id, swaps)}
                getSuggestions={getSuggestions}
            />
        </div>
    );
}

export default WeeklyPage;
