import { useCallback, useMemo } from "react";
import {
  type FoodItem,
  type MealType,
  type Recipe,
  type Weekday,
  WEEKDAYS,
  type WeeklyPlan,
} from "../models/types.ts";
import {
  calculateRecipeEstimate,
  type SynergyResult,
} from "../utils/ingredientParser.ts";

/**
 * Analysis of a single day
 */
export interface DayAnalysis {
  isComplete: boolean;
  proteinCategories: string[];
  missingComplement: string | null;
  tags: string[];
  tips: string[];
  synergies: SynergyResult[];
}

/**
 * Result of plan analysis
 */
export interface PlanAnalysis {
  score: number; // 0-100
  proteinScore: number;
  varietyScore: number;
  budgetScore: number;
  seasonalityScore: number;
  tips: string[];
  criticalIssues: string[];
  dayAnalysis: Record<Weekday, DayAnalysis>;
}

export function useSmartPlanner(recipes: Recipe[], foodItems: FoodItem[]) {
  // Season detection helper
  const getCurrentSeason = useCallback(() => {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    if (month >= 8 && month <= 10) return "autumn";
    return "winter";
  }, []);

  /**
   * Analyze a weekly plan for protein quality, variety, budget and seasonality
   */
  const analyzePlan = useCallback((plan: WeeklyPlan): PlanAnalysis => {
    let totalScore = 0;
    let proteinPoints = 0;
    let varietyPoints = 0;
    let budgetPoints = 0;
    let seasonalityPoints = 0;

    const tips: string[] = [];
    const criticalIssues: string[] = [];

    const currentSeason = getCurrentSeason();
    const proteinSources = new Set<string>();
    let plannedMealCount = 0;
    let completeProteinDays = 0;
    let seasonalCount = 0;
    let budgetCount = 0;

    const dayAnalysis: Record<Weekday, DayAnalysis> = {} as any;

    WEEKDAYS.forEach((day) => {
      const dayMeals = plan.meals[day];
      const currentDayAnalysis: DayAnalysis = {
        isComplete: false,
        proteinCategories: [],
        missingComplement: null,
        tags: [],
        tips: [],
        synergies: [],
      };

      if (!dayMeals || Object.keys(dayMeals).length === 0) {
        dayAnalysis[day] = currentDayAnalysis;
        return;
      }

      const dayProteinCats = new Set<string>();

      Object.entries(dayMeals).forEach(([_, planned]) => {
        if (!planned?.recipeId) return;

        const recipe = recipes.find((r) => r.id === planned.recipeId);
        if (!recipe) return;

        plannedMealCount++;
        const estimate = calculateRecipeEstimate(
          recipe.ingredientsText || "",
          foodItems,
          planned.swaps,
        );

        // Protein quality
        if (estimate.isCompleteProtein) {
          currentDayAnalysis.isComplete = true;
          currentDayAnalysis.tags.push("complete-meal");
        }
        estimate.proteinCategories.forEach((cat) => {
          dayProteinCats.add(cat);
          proteinSources.add(cat);
        });

        // Seasonality
        if (
          recipe.seasons?.includes(currentSeason as any) ||
          estimate.tags.includes("seasonal-house")
        ) {
          seasonalCount++;
          currentDayAnalysis.tags.push("seasonal");
        }

        // Budget
        if (
          recipe.priceCategory === "budget" ||
          estimate.tags.includes("budget-win")
        ) {
          budgetCount++;
          currentDayAnalysis.tags.push("budget-win");
        }

        // Collect synergies
        estimate.synergies.forEach((syn) => {
          if (!currentDayAnalysis.synergies.some((s) => s.id === syn.id)) {
            currentDayAnalysis.synergies.push(syn);
          }
        });
      });

      // Cross-meal complementarity
      if (dayProteinCats.has("legume") && dayProteinCats.has("grain")) {
        currentDayAnalysis.isComplete = true;
        currentDayAnalysis.tags.push("complete-day");
      } else if (
        dayProteinCats.has("legume") && !dayProteinCats.has("grain") &&
        !currentDayAnalysis.isComplete
      ) {
        currentDayAnalysis.missingComplement = "grain";
        currentDayAnalysis.tips.push(
          "Lägg till ett spannmål (t.ex. ris) för att göra proteinet fullvärdigt! 🌾",
        );
      } else if (
        dayProteinCats.has("grain") && !dayProteinCats.has("legume") &&
        !currentDayAnalysis.isComplete
      ) {
        currentDayAnalysis.missingComplement = "legume";
        currentDayAnalysis.tips.push(
          "Lägg till en baljväxt (t.ex. bönor) för att göra proteinet fullvärdigt! 🥜",
        );
      }

      currentDayAnalysis.proteinCategories = Array.from(dayProteinCats);
      if (currentDayAnalysis.isComplete) {
        completeProteinDays++;
      }
      dayAnalysis[day] = currentDayAnalysis;
    });

    if (plannedMealCount === 0) {
      return {
        score: 0,
        proteinScore: 0,
        varietyScore: 0,
        budgetScore: 0,
        seasonalityScore: 0,
        tips: ["Börja med att lägga till några recept i din vecka! 🥦"],
        criticalIssues: ["Inga måltider planerade"],
        dayAnalysis: dayAnalysis,
      };
    }

    // Calculate scores
    proteinPoints = Math.min(100, (completeProteinDays / 7) * 100);
    varietyPoints = Math.min(100, (proteinSources.size / 5) * 100);
    seasonalityPoints = Math.min(100, (seasonalCount / plannedMealCount) * 100);
    budgetPoints = Math.min(100, (budgetCount / plannedMealCount) * 100);

    totalScore = Math.round(
      (proteinPoints * 0.4) +
        (varietyPoints * 0.2) +
        (seasonalityPoints * 0.2) +
        (budgetPoints * 0.2),
    );

    // Generate tips
    if (proteinPoints < 50) {
      tips.push(
        "Testa att kombinera bönor med råris eller quinoa för fullvärdigt protein. 🥜+🌾",
      );
      criticalIssues.push("Låg proteinkvalitet på flera dagar");
    }
    if (varietyPoints < 60) {
      tips.push(
        "Variera dina proteinkällor mer! Lägg till lite tofu, nötter eller frön i planen.",
      );
    }
    if (seasonalityPoints < 40) {
      tips.push(
        `Just nu är det ${currentSeason} – använd mer rotfrukter och kål för att äta i säsong! ❄️`,
      );
    }
    if (budgetPoints < 50) {
      tips.push(
        "Tips: Lägg till fler linsgrytor eller soppor för att få ner veckokostnaden. 💰",
      );
    }

    if (totalScore > 85) {
      tips.push("Wow! Din vecka är en vegansk näringsbomb. Bra jobbat! 🌟");
    }

    return {
      score: totalScore,
      proteinScore: Math.round(proteinPoints),
      varietyScore: Math.round(varietyPoints),
      budgetScore: Math.round(budgetPoints),
      seasonalityScore: Math.round(seasonalityPoints),
      tips,
      criticalIssues,
      dayAnalysis,
    };
  }, [recipes, foodItems, getCurrentSeason]);

  /**
   * Suggest an optimization for a specific day or the whole plan
   */
  const getOptimizationSuggestion = useCallback(
    (plan: WeeklyPlan, day?: Weekday, meal?: MealType) => {
      const analysis = analyzePlan(plan);
      const targetDay = day ||
        (Object.keys(analysis.dayAnalysis).find((d) =>
          !analysis.dayAnalysis[d as Weekday].isComplete
        ) as Weekday);

      if (!targetDay) {
        return null;
      }

      const da = analysis.dayAnalysis[targetDay];
      const missing = da.missingComplement;

      // Find recipes that provide the missing category
      let suitableRecipes = recipes.filter((r) => {
        const estimate = calculateRecipeEstimate(
          r.ingredientsText || "",
          foodItems,
        );
        if (missing) {
          return estimate.proteinCategories.includes(missing);
        }
        return estimate.isCompleteProtein;
      });

      // Further filter by meal type if provided
      if (meal) {
        suitableRecipes = suitableRecipes.filter((r) => r.mealType === meal);
      }

      if (suitableRecipes.length === 0) return null;

      // Sort by variety (choose one we haven't used much)
      const usedRecipeIds = new Set<string>();
      Object.values(plan.meals).forEach((dayMeals) => {
        Object.values(dayMeals).forEach((m) => {
          if (m?.recipeId) usedRecipeIds.add(m.recipeId);
        });
      });

      const unused = suitableRecipes.filter((r) => !usedRecipeIds.has(r.id));
      const pool = unused.length > 0 ? unused : suitableRecipes;

      // Return a random one from the best pool
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [recipes, foodItems, analyzePlan],
  );

  return { analyzePlan, getOptimizationSuggestion };
}
