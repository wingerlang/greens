/**
 * WeeklyPage - Veckans Meny
 * Main weekly meal planning view with day cards
 */

import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../context/DataContext.tsx";
import { useSettings } from "../context/SettingsContext.tsx";
import { useCooking } from "../context/CookingModeProvider.tsx";
import {
  getISODate,
  getWeekStartDate,
  type MealType,
  type Recipe,
  type Weekday,
  WEEKDAYS,
  type WeeklyPlan,
} from "../models/types.ts";
import { WeekHeader } from "../components/weekly/WeekHeader.tsx";
import { DayCard } from "../components/weekly/DayCard.tsx";
import { RecipeSelectionModal } from "../components/RecipeSelectionModal.tsx";
import { ShoppingListView } from "../components/ShoppingListView.tsx";
import { useShoppingList } from "../hooks/useShoppingList.ts";
import { useRandomizer } from "../hooks/useRandomizer.ts";
import { useSmartPlanner } from "../hooks/useSmartPlanner.ts";
import { CommandCenter } from "../components/weekly/CommandCenter.tsx";
import SmartAnalysisPanel from "../components/weekly/SmartAnalysisPanel.tsx";
import "./WeeklyPage.css";

// ============================================
// Helper Functions
// ============================================

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function formatDateForCard(
  weekStart: string,
  dayIndex: number,
): { dateStr: string; dateNumber: number } {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayIndex);

  const day = date.getDate();
  const month = date.toLocaleString("sv-SE", { month: "short" }).toUpperCase();

  return {
    dateStr: `${day} ${month}.`,
    dateNumber: day,
  };
}

// ============================================
// Component
// ============================================

export function WeeklyPage() {
  // Context
  const {
    recipes,
    weeklyPlans,
    saveWeeklyPlan,
    foodItems,
    pantryItems,
    pantryQuantities,
    togglePantryItem,
    setPantryQuantity,
    updateVitals,
    getVitalsForDate,
    exerciseEntries,
  } = useData();

  const { settings } = useSettings();
  const { openRecipe } = useCooking();

  // State
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate());
  const [weekPlan, setWeekPlan] = useState<WeeklyPlan["meals"]>();
  const [editingSlot, setEditingSlot] = useState<
    { day: Weekday; meal: MealType } | null
  >(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showSmartAnalysis, setShowSmartAnalysis] = useState(() => {
    const saved = localStorage.getItem("greens-show-analysis");
    return saved === null ? true : saved === "true";
  });

  // Ref to track if we're currently loading (to prevent save during load)
  const isLoadingRef = React.useRef(false);
  // Ref to store the last saved plan to avoid redundant saves
  const lastSavedRef = React.useRef<string>("");

  // Load week plan
  useEffect(() => {
    isLoadingRef.current = true; // Mark as loading
    const plan = weeklyPlans?.find((p) => p.weekStartDate === currentWeekStart);
    if (plan) {
      setWeekPlan(plan.meals);
    } else {
      setWeekPlan({
        monday: {},
        tuesday: {},
        wednesday: {},
        thursday: {},
        friday: {},
        saturday: {},
        sunday: {},
      });
    }
    // Mark as loaded after first data fetch - weeklyPlans is array so check !== undefined
    if (weeklyPlans !== undefined) {
      setHasLoaded(true);
    }
    // Use timeout to allow state to settle before enabling saves
    setTimeout(() => {
      isLoadingRef.current = false;
    }, 100);
  }, [currentWeekStart, weeklyPlans]);

  // Persist analysis toggle
  useEffect(() => {
    localStorage.setItem("greens-show-analysis", String(showSmartAnalysis));
  }, [showSmartAnalysis]);

  // Save on change - only after initial load and not during loading
  useEffect(() => {
    if (weekPlan && hasLoaded && !isLoadingRef.current) {
      // Avoid redundant saves by comparing serialized plan
      const planKey = JSON.stringify(weekPlan);
      if (planKey !== lastSavedRef.current) {
        lastSavedRef.current = planKey;
        console.log(
          "[WeeklyPage] Saving weekPlan to context:",
          currentWeekStart,
        );
        saveWeeklyPlan(currentWeekStart, weekPlan);
      }
    }
  }, [weekPlan, currentWeekStart, hasLoaded, saveWeeklyPlan]);

  // Hooks - Use settings.visibleMeals from SettingsContext for user preferences
  const visibleMeals = settings.visibleMeals;

  const {
    shoppingList,
    totalItems,
    handleCopyShoppingList,
    copyStatus,
    formatQuantity,
  } = useShoppingList(
    weekPlan ||
      {
        monday: {},
        tuesday: {},
        wednesday: {},
        thursday: {},
        friday: {},
        saturday: {},
        sunday: {},
      },
    recipes,
    foodItems,
    pantryItems,
    visibleMeals as MealType[],
  );

  const { getRandomRecipe, getSuggestions, randomizeDay } = useRandomizer(
    recipes,
    weekPlan,
  );

  const { analyzePlan, getOptimizationSuggestion } = useSmartPlanner(
    recipes,
    foodItems,
  );

  const planAnalysis = useMemo(() => {
    if (!weekPlan) return null;

    // Convert weekPlan state to the full WeeklyPlan model for analysis
    const fullPlan: WeeklyPlan = {
      id: "current",
      weekStartDate: currentWeekStart,
      meals: weekPlan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return analyzePlan(fullPlan);
  }, [weekPlan, analyzePlan, currentWeekStart]);

  // Derived values
  const weekNumber = getWeekNumber(currentWeekStart);

  // Handlers
  const handleWeekChange = (offset: number) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + (offset * 7));
    setCurrentWeekStart(getISODate(d));
  };

  const handleMealClick = (day: Weekday, meal: MealType) => {
    setEditingSlot({ day, meal });
    setIsModalOpen(true);
  };

  const handleCookMeal = (day: Weekday, meal: MealType, recipe: Recipe) => {
    openRecipe(recipe);
  };

  const handleSaveMeal = (
    recipeId?: string,
    swaps?: Record<string, string>,
  ) => {
    if (!editingSlot || !weekPlan || !recipeId) return;

    const recipe = recipes.find((r) => r.id === recipeId);

    setWeekPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [editingSlot.day]: {
          ...prev[editingSlot.day],
          [editingSlot.meal]: {
            recipeId,
            servings: recipe?.servings || 4,
            swaps,
          },
        },
      };
    });

    setIsModalOpen(false);
    setEditingSlot(null);
  };

  const handleRemoveMeal = () => {
    if (!editingSlot || !weekPlan) return;

    setWeekPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [editingSlot.day]: {
          ...prev[editingSlot.day],
          [editingSlot.meal]: undefined,
        },
      };
    });

    setIsModalOpen(false);
    setEditingSlot(null);
  };

  const handleShuffleDay = (day: Weekday) => {
    if (!weekPlan) return;

    const newMeals = randomizeDay(day, visibleMeals as MealType[], weekPlan);

    setWeekPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          ...newMeals,
        },
      };
    });
  };

  const handleRandomizeWeek = () => {
    if (!weekPlan) return;

    WEEKDAYS.forEach((day) => {
      const newMeals = randomizeDay(day, visibleMeals as MealType[], weekPlan);
      setWeekPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [day]: {
            ...prev[day],
            ...newMeals,
          },
        };
      });
    });
  };

  const handleMagicWand = (day: Weekday, meal: MealType) => {
    if (!weekPlan) return;

    // Create full plan for analysis
    const fullPlan: WeeklyPlan = {
      id: "current",
      weekStartDate: currentWeekStart,
      meals: weekPlan,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const suggestion = getOptimizationSuggestion(fullPlan, day, meal);
    if (suggestion) {
      setWeekPlan((prev) => ({
        ...prev!,
        [day]: {
          ...prev![day],
          [meal]: {
            recipeId: suggestion.id,
            servings: suggestion.servings || 4,
          },
        },
      }));
    }
  };

  const handleDragStart = (
    e: React.DragEvent,
    day: Weekday,
    meal: MealType,
    recipeId: string,
  ) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ day, meal, recipeId }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (
    e: React.DragEvent,
    targetDay: Weekday,
    targetMeal: MealType,
  ) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data || !weekPlan) return;

    const { day: sourceDay, meal: sourceMeal, recipeId } = JSON.parse(data);

    // Get source planned meal
    const sourcePlanned = weekPlan[sourceDay as Weekday]
      ?.[sourceMeal as MealType];
    if (!sourcePlanned) return;

    setWeekPlan((prev) => {
      if (!prev) return prev;

      // Move the recipe
      const updated = { ...prev };

      // Set target
      updated[targetDay] = {
        ...updated[targetDay],
        [targetMeal]: { ...sourcePlanned },
      };

      // Clear source if different slot
      if (sourceDay !== targetDay || sourceMeal !== targetMeal) {
        updated[sourceDay as Weekday] = {
          ...updated[sourceDay as Weekday],
          [sourceMeal as MealType]: undefined,
        };
      }

      return updated;
    });
  };

  // Loading state
  if (!weekPlan) {
    return <div className="weekly-page loading">Laddar veckoplan...</div>;
  }

  // Get suggestions for modal
  const getSuggestionsForSlot = () => {
    // This integrates with existing suggestion logic
    return [];
  };

  return (
    <div className="weekly-page">
      <WeekHeader
        weekNumber={weekNumber}
        weekStartDate={currentWeekStart}
        onPrevWeek={() => handleWeekChange(-1)}
        onNextWeek={() => handleWeekChange(1)}
        onRandomizeWeek={handleRandomizeWeek}
      />

      <CommandCenter />

      {/* Smart Analysis Panel Toggle */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowSmartAnalysis(!showSmartAnalysis)}
          className="text-[10px] uppercase tracking-widest font-bold text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
        >
          {showSmartAnalysis ? "🙈 Dölj Analys" : "👁️ Visa Analys"}
        </button>
      </div>

      {/* Smart Analysis Panel */}
      {planAnalysis && showSmartAnalysis && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
          <SmartAnalysisPanel
            analysis={planAnalysis}
            onOptimize={() => {
              console.log("Optimizing plan...");
              // Optimization logic will be added here
            }}
          />
        </div>
      )}

      {/* Days Grid */}
      <div className="days-grid">
        {WEEKDAYS.map((day, index) => {
          const { dateStr, dateNumber } = formatDateForCard(
            currentWeekStart,
            index,
          );
          const dayDate = new Date(currentWeekStart);
          dayDate.setDate(dayDate.getDate() + index);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dayDate.setHours(0, 0, 0, 0);

          const isTodayCheck = dayDate.getTime() === today.getTime();
          const isPast = dayDate < today;
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday = dayDate.getTime() === yesterday.getTime();

          return (
            <DayCard
              key={day}
              day={day}
              dateStr={dateStr}
              dateNumber={dateNumber}
              isToday={isTodayCheck}
              isPast={isPast}
              isYesterday={isYesterday}
              meals={weekPlan[day] || {}}
              dayAnalysis={planAnalysis?.dayAnalysis?.[day]}
              visibleMeals={visibleMeals as MealType[]}
              recipes={recipes}
              foodItems={foodItems}
              getSuggestions={(meal) => getSuggestions(meal)}
              onMealClick={(meal) => handleMealClick(day, meal)}
              onCookMeal={(meal, recipe) => handleCookMeal(day, meal, recipe)}
              onRemoveMeal={(meal) => {
                setWeekPlan((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    [day]: {
                      ...prev[day],
                      [meal]: undefined,
                    },
                  };
                });
              }}
              onShuffleDay={() => handleShuffleDay(day)}
              onShuffleMeal={(meal) => {
                const recipe = getRandomRecipe(meal);
                if (recipe) {
                  setWeekPlan((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      [day]: {
                        ...prev[day],
                        [meal]: {
                          recipeId: recipe.id,
                          servings: recipe.servings || 4,
                        },
                      },
                    };
                  });
                }
              }}
              onQuickSelect={(meal, recipeId) => {
                const recipe = recipes.find((r) => r.id === recipeId);
                if (recipe) {
                  setWeekPlan((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      [day]: {
                        ...prev[day],
                        [meal]: { recipeId, servings: recipe.servings || 4 },
                      },
                    };
                  });
                }
              }}
              onDragStart={(e, meal, recipeId) =>
                handleDragStart(e, day, meal, recipeId)}
              onDrop={(e, meal) => handleDrop(e, day, meal)}
              onMagicWand={(meal) => handleMagicWand(day, meal)}
              vitals={getVitalsForDate(getISODate(dayDate))}
              onUpdateVitals={(updates) =>
                updateVitals(getISODate(dayDate), updates)}
              exercises={exerciseEntries.filter((ex) =>
                ex.date === getISODate(dayDate)
              )}
            />
          );
        })}
      </div>

      {/* Shopping List */}
      <ShoppingListView
        shoppingList={shoppingList}
        pantryItems={new Set(pantryItems)}
        pantryQuantities={pantryQuantities}
        togglePantryItem={togglePantryItem}
        setPantryQuantity={setPantryQuantity}
        totalItems={totalItems}
        onCopy={handleCopyShoppingList}
        copyStatus={copyStatus}
        formatQuantity={formatQuantity}
      />

      {/* Recipe Selection Modal */}
      <RecipeSelectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingSlot={editingSlot}
        currentPlannedMeal={editingSlot
          ? weekPlan[editingSlot.day]?.[editingSlot.meal]
          : undefined}
        onSelectRecipe={() => {}}
        onRemoveMeal={handleRemoveMeal}
        onSave={handleSaveMeal}
        getSuggestions={getSuggestionsForSlot}
      />
    </div>
  );
}

export default WeeklyPage;
