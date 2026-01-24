import React, { useMemo } from "react";
import {
  FoodItem,
  MEAL_TYPE_LABELS,
  MealEntry,
  MealType,
  Recipe,
} from "../../models/types.ts";
import { calculateRecipeEstimate } from "../../utils/ingredientParser.ts";

interface MacroDistributionProps {
  entries: MealEntry[];
  foodItems: FoodItem[];
  recipes: Recipe[];
}

export function MacroDistribution(
  { entries, foodItems, recipes }: MacroDistributionProps,
) {
  const distribution = useMemo(() => {
    const stats: Record<
      MealType,
      { calories: number; protein: number; carbs: number; fat: number }
    > = {
      breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      lunch: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      dinner: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      snack: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      beverage: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      estimate: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    };

    entries.forEach((entry) => {
      const mType = entry.mealType;
      entry.items.forEach((item) => {
        let nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };

        if (item.type === "foodItem") {
          const food = foodItems.find((f) => f.id === item.referenceId);
          if (food) {
            const factor = item.servings / 100;
            nutrition = {
              calories: food.calories * factor,
              protein: food.protein * factor,
              carbs: food.carbs * factor,
              fat: food.fat * factor,
            };
          }
        } else if (item.type === "estimate" && item.estimateDetails) {
          nutrition = {
            calories: item.estimateDetails.caloriesAvg,
            protein: item.estimateDetails.protein || 0,
            carbs: item.estimateDetails.carbs || 0,
            fat: item.estimateDetails.fat || 0,
          };
        } else {
          const recipe = recipes.find((r) => r.id === item.referenceId);
          if (recipe && recipe.ingredientsText) {
            const estimate = calculateRecipeEstimate(
              recipe.ingredientsText,
              foodItems,
            );
            const factor = item.servings / recipe.servings;
            nutrition = {
              calories: estimate.calories * factor,
              protein: estimate.protein * factor,
              carbs: estimate.carbs * factor,
              fat: estimate.fat * factor,
            };
          }
        }

        stats[mType].calories += nutrition.calories;
        stats[mType].protein += nutrition.protein;
        stats[mType].carbs += nutrition.carbs;
        stats[mType].fat += nutrition.fat;
      });
    });

    return stats;
  }, [entries, foodItems, recipes]);

  const totalProtein = Object.values(distribution).reduce(
    (sum, s) => sum + s.protein,
    0,
  );
  const morningProtein = distribution.breakfast.protein;
  const proteinTimingScore = totalProtein > 0
    ? (morningProtein / totalProtein) * 100
    : 0;

  const maxMacros = Math.max(
    ...Object.values(distribution).map((s) => s.calories),
    1,
  );

  return (
    <div className="macro-distribution h-full">
      <div className="grid grid-cols-1 gap-4">
        {(Object.entries(distribution) as [MealType, any][]).map(
          ([mType, data]) => {
            const calories = Math.round(data.calories);
            if (calories === 0) return null;

            const pWidth = (data.protein * 4 / calories) * 100;
            const cWidth = (data.carbs * 4 / calories) * 100;
            const fWidth = (data.fat * 9 / calories) * 100;

            return (
              <div key={mType} className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">
                    {MEAL_TYPE_LABELS[mType]}
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    {calories}{" "}
                    <span className="text-[10px] font-normal text-slate-500">
                      kcal
                    </span>
                  </span>
                </div>
                <div className="h-4 bg-slate-800/50 rounded-lg overflow-hidden flex border border-white/5">
                  <div
                    className="h-full bg-violet-500/80 transition-all duration-1000"
                    style={{ width: `${pWidth}%` }}
                    title={`Protein: ${Math.round(data.protein)}g`}
                  />
                  <div
                    className="h-full bg-amber-500/80 transition-all duration-1000"
                    style={{ width: `${cWidth}%` }}
                    title={`Kolhydrater: ${Math.round(data.carbs)}g`}
                  />
                  <div
                    className="h-full bg-rose-500/80 transition-all duration-1000"
                    style={{ width: `${fWidth}%` }}
                    title={`Fett: ${Math.round(data.fat)}g`}
                  />
                </div>
              </div>
            );
          },
        )}
      </div>

      {totalProtein > 0 && proteinTimingScore < 20 && (
        <div className="mt-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-center">
          <span className="text-xl">💡</span>
          <p className="text-[11px] text-amber-200/80 leading-snug">
            Sikta på minst <span className="text-amber-400 font-bold">20%</span>
            {" "}
            av ditt protein vid frukost för att maximera muskelproteinsyntesen
            efter nattens fasta.
          </p>
        </div>
      )}
    </div>
  );
}
