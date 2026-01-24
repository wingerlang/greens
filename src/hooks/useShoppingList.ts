import { useCallback, useMemo, useState } from "react";
import {
  FoodItem,
  MealType,
  Recipe,
  Weekday,
  WEEKDAYS,
  WeeklyPlan,
} from "../models/types.ts";
import {
  matchToFoodItem,
  parseIngredients,
} from "../utils/ingredientParser.ts";

export interface IngredientUsage {
  day: Weekday;
  meal: MealType;
  recipeName: string;
  quantity: number;
  unit: string;
}

export interface ShoppingItem {
  name: string;
  category: string;
  quantity: number; // Accumulated quantity
  unit: string; // Unit (st, g, dl, etc.)
  dayMeals: { day: Weekday; meal: MealType }[];
  storageType: string;
  usages: IngredientUsage[]; // Detailed usage info for modal
}

export function useShoppingList(
  weekPlan: WeeklyPlan["meals"],
  recipes: Recipe[],
  foodItems: FoodItem[],
  pantryItems: string[],
  visibleMeals: MealType[],
) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  // Generate shopping list from week's recipes with quantity accumulation
  const shoppingList = useMemo(() => {
    const items: Map<string, ShoppingItem> = new Map();

    WEEKDAYS.forEach((day) => {
      visibleMeals.forEach((meal: MealType) => {
        const planned = weekPlan[day]?.[meal];
        if (planned?.recipeId) {
          const recipe = recipes.find((r) => r.id === planned.recipeId);
          if (recipe?.ingredientsText) {
            const parsed = parseIngredients(recipe.ingredientsText);
            parsed.forEach((ingredient) => {
              let matched = matchToFoodItem(ingredient, foodItems);

              // Check for swaps
              if (matched && planned.swaps && planned.swaps[matched.id]) {
                const swapped = foodItems.find((f) =>
                  f.id === planned.swaps![matched!.id]
                );
                if (swapped) {
                  matched = swapped;
                  ingredient.name = swapped.name;
                }
              }

              const key = matched
                ? matched.name.toLowerCase()
                : ingredient.name.toLowerCase();
              const qty = ingredient.quantity || 1;
              const unit = ingredient.unit || "st";
              const usage: IngredientUsage = {
                day,
                meal,
                recipeName: recipe.name,
                quantity: qty,
                unit,
              };

              if (items.has(key)) {
                const existing = items.get(key)!;
                // Accumulate quantity
                existing.quantity += qty;
                // Add usage
                existing.usages.push(usage);
                // Add day/meal if not already tracked
                const hasDayMeal = existing.dayMeals.some(
                  (dm) => dm.day === day && dm.meal === meal,
                );
                if (!hasDayMeal) {
                  existing.dayMeals.push({ day, meal });
                }
              } else {
                items.set(key, {
                  name: matched?.name || ingredient.name,
                  category: matched?.category || "other",
                  quantity: qty,
                  unit: unit,
                  dayMeals: [{ day, meal }],
                  storageType: matched?.storageType || "pantry",
                  usages: [usage],
                });
              }
            });
          }
        }
      });
    });

    // Group by storage type
    const grouped: Record<string, ShoppingItem[]> = {
      fresh: [],
      frozen: [],
      pantry: [],
    };

    items.forEach((item) => {
      const type = item.storageType as keyof typeof grouped;
      if (grouped[type]) {
        grouped[type].push(item);
      } else {
        grouped.pantry.push(item);
      }
    });

    return grouped;
  }, [weekPlan, recipes, foodItems, visibleMeals, pantryItems]);

  // Calculate total shopping items
  const totalItems = Object.values(shoppingList).reduce(
    (acc: number, list: ShoppingItem[]) =>
      acc +
      list.filter((i: ShoppingItem) =>
        !pantryItems.includes(i.name.toLowerCase())
      ).length,
    0,
  );

  // Format quantity for display
  const formatQuantity = (item: ShoppingItem): string => {
    const qty = Math.round(item.quantity * 10) / 10;
    if (item.unit === "st" || item.unit === "") {
      return qty > 1 ? `${qty} st` : "";
    }
    return `${qty} ${item.unit}`;
  };

  // Copy shopping list to clipboard - returns promise for animation
  const handleCopyShoppingList = useCallback(async (): Promise<boolean> => {
    const lines = ["🛒 Inköpslista"];

    Object.entries(shoppingList).forEach(
      ([type, items]: [string, ShoppingItem[]]) => {
        const needed = items.filter((i: ShoppingItem) =>
          !pantryItems.includes(i.name.toLowerCase())
        );
        if (needed.length > 0) {
          const label = type === "fresh"
            ? "Frukt & Grönt"
            : type === "frozen"
            ? "Frys"
            : "Skafferi";
          lines.push(`\n${label}:`);
          needed.forEach((item) => {
            const qty = formatQuantity(item);
            lines.push(`- ${item.name}${qty ? ` (${qty})` : ""}`);
          });
        }
      },
    );

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
      return true;
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
      return false;
    }
  }, [shoppingList, pantryItems]);

  return {
    shoppingList,
    totalItems,
    handleCopyShoppingList,
    copyStatus,
    formatQuantity,
  };
}
