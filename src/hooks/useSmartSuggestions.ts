import { useCallback } from "react";
import {
  MealType,
  Recipe,
  Weekday,
  WEEKDAYS,
  WeeklyPlan,
} from "../models/types.ts";

export interface RecipeSuggestion {
  recipe: Recipe;
  score: number;
  reasons: string[];
  tags: SuggestionTag[];
}

export type SuggestionTag =
  | "friday-favorite"
  | "long-time"
  | "seasonal"
  | "quick"
  | "budget"
  | "carb-variety"
  | "protein-variety"
  | "suitable"
  | "frequent"
  | "recent";

// Meal type categories for smart filtering
const MEAL_CATEGORIES: Record<MealType, string[]> = {
  breakfast: ["breakfast", "brunch", "frukost", "morgon"],
  lunch: ["lunch", "middag", "dinner"],
  dinner: ["lunch", "middag", "dinner", "kvällsmat"],
  snack: ["snack", "mellanmål", "fika"],
  beverage: ["dryck", "drink", "smoothie", "juice"],
};

// Seasonal ingredients
const SEASONAL_INGREDIENTS: Record<string, string[]> = {
  winter: ["rotfrukter", "kål", "morot", "palsternacka", "äpple", "päron"],
  spring: ["sparris", "rädisor", "örter", "spenat", "ruccola"],
  summer: ["tomat", "gurka", "zucchini", "bär", "sallad", "dill"],
  autumn: ["svamp", "pumpa", "squash", "plommon", "äpple", "kål"],
};

export function useSmartSuggestions(
  recipes: Recipe[],
  weeklyPlans: WeeklyPlan[],
) {
  // Season detection
  const getCurrentSeason = (): "winter" | "spring" | "summer" | "autumn" => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    if (month >= 8 && month <= 10) return "autumn";
    return "winter";
  };

  // Get meal history for suggestions
  interface HistoryItem {
    recipeId: string;
    day: Weekday;
    meal: MealType;
    date: string;
  }

  const getMealHistory = useCallback((): HistoryItem[] => {
    const history: HistoryItem[] = [];
    weeklyPlans.forEach((plan) => {
      WEEKDAYS.forEach((day) => {
        const dayMeals = plan.meals?.[day];
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
  const isSuitableForMealType = useCallback(
    (recipe: Recipe, mealType: MealType): boolean => {
      const recipeMealType = recipe.mealType?.toLowerCase() || "";
      const categories = MEAL_CATEGORIES[mealType];

      // For snacks, be very permissive - show all recipes
      if (mealType === "snack") {
        return true;
      }

      if (recipeMealType) {
        return categories.some((cat) => recipeMealType.includes(cat));
      }

      // Default: suitable for lunch/dinner
      return true;
    },
    [],
  );

  // Generate smart suggestions
  const getSuggestions = useCallback(
    (day: Weekday, mealType: MealType): RecipeSuggestion[] => {
      const history = getMealHistory();
      const season = getCurrentSeason();
      const suggestions: RecipeSuggestion[] = [];

      recipes.forEach((recipe) => {
        if (!isSuitableForMealType(recipe, mealType)) return;

        const reasons: string[] = [];
        const tags: SuggestionTag[] = [];
        let score = 0;

        tags.push("suitable");

        // Friday favorite pattern
        if (day === "friday") {
          const fridayHistory = history.filter((h: HistoryItem) =>
            h.day === "friday"
          );
          const recipeFrequency = fridayHistory.filter((h: HistoryItem) =>
            h.recipeId === recipe.id
          ).length;
          if (recipeFrequency >= 2) {
            score += 30;
            reasons.push("🔥 Fredagsfavorit");
            tags.push("friday-favorite");
          }
        }

        // Analyze recipe history
        const recipeHistory = history.filter((h: HistoryItem) =>
          h.recipeId === recipe.id
        );
        const lastEaten = recipeHistory.length > 0
          ? Math.max(
            ...recipeHistory.map((h: HistoryItem) =>
              new Date(h.date).getTime()
            ),
          )
          : 0;
        const daysSinceEaten = lastEaten
          ? Math.floor((Date.now() - lastEaten) / (1000 * 60 * 60 * 24))
          : 999;

        // "Vanligen" - Frequently eaten (user favorite)
        if (recipeHistory.length >= 3) {
          score += 25;
          reasons.push("⭐ Vanlig favorit");
          tags.push("frequent");
        }

        // Time-based scoring
        if (daysSinceEaten > 30) {
          score += 15;
          reasons.push("📅 Länge sedan sist");
          tags.push("long-time");
        } else if (daysSinceEaten >= 7 && daysSinceEaten <= 14) {
          // "Nyligen" - Eaten recently but not too recently (1-2 weeks = good repeat window)
          score += 10;
          reasons.push("🔄 Nyligen - dags igen?");
          tags.push("recent");
        } else if (daysSinceEaten < 7) {
          // Too recent - penalize unless it's a favorite
          if (recipeHistory.length < 3) {
            score -= 50;
          }
        }

        // Seasonal ingredients
        const seasonalIngs = SEASONAL_INGREDIENTS[season];
        const hasSeasonal = seasonalIngs.some((ing) =>
          (recipe.ingredientsText || "").toLowerCase().includes(ing)
        );
        if (hasSeasonal) {
          score += 20;
          reasons.push("✨ Säsongens råvaror");
          tags.push("seasonal");
        }

        // Quick meals bonus
        if ((recipe.cookTime || 60) <= 15) {
          score += 10;
          tags.push("quick");
        }

        if (score > 0) {
          suggestions.push({ recipe, score, reasons, tags });
        }
      });

      return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
    },
    [recipes, getMealHistory, isSuitableForMealType],
  );

  return { getSuggestions };
}
