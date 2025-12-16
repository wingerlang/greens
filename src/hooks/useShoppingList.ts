import { useMemo } from 'react';
import { Weekday, MealType, WeeklyPlan, FoodItem, Recipe, WEEKDAYS } from '../models/types.ts';
import { parseIngredients, matchToFoodItem } from '../utils/ingredientParser.ts';

export interface ShoppingItem {
    name: string;
    category: string;
    dayMeals: { day: Weekday; meal: MealType }[];  // Track which days/meals need this
    storageType: string;
}

export function useShoppingList(
    weekPlan: WeeklyPlan['meals'],
    recipes: Recipe[],
    foodItems: FoodItem[],
    pantryItems: string[],
    visibleMeals: MealType[]
) {

    // Generate shopping list from week's recipes
    const shoppingList = useMemo(() => {
        const items: Map<string, ShoppingItem> = new Map();

        WEEKDAYS.forEach(day => {
            // Only generate shopping list from visible meals
            visibleMeals.forEach((meal: MealType) => {
                const planned = weekPlan[day]?.[meal];
                if (planned?.recipeId) {
                    const recipe = recipes.find(r => r.id === planned.recipeId);
                    if (recipe?.ingredientsText) {
                        const parsed = parseIngredients(recipe.ingredientsText);
                        parsed.forEach(ingredient => {
                            let matched = matchToFoodItem(ingredient, foodItems);

                            // Check for swaps
                            if (matched && planned.swaps && planned.swaps[matched.id]) {
                                const swapped = foodItems.find(f => f.id === planned.swaps![matched!.id]);
                                if (swapped) {
                                    matched = swapped;
                                    // Use swapped name for the list
                                    ingredient.name = swapped.name;
                                }
                            }

                            const key = matched ? matched.name.toLowerCase() : ingredient.name.toLowerCase();

                            if (items.has(key)) {
                                const existing = items.get(key)!;
                                // Add day/meal if not already tracked
                                const hasDayMeal = existing.dayMeals.some(
                                    dm => dm.day === day && dm.meal === meal
                                );
                                if (!hasDayMeal) {
                                    existing.dayMeals.push({ day, meal });
                                }
                            } else {
                                items.set(key, {
                                    name: matched?.name || ingredient.name,
                                    category: matched?.category || 'other',
                                    dayMeals: [{ day, meal }],
                                    storageType: matched?.storageType || 'pantry',
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

        items.forEach(item => {
            const type = item.storageType as keyof typeof grouped;
            if (grouped[type]) {
                grouped[type].push(item);
            } else {
                grouped.pantry.push(item);
            }
        });

        return grouped;
    }, [weekPlan, recipes, foodItems, visibleMeals, pantryItems]); // Swaps support to come later

    // Calculate total shopping items
    const totalItems = Object.values(shoppingList).reduce(
        (acc: number, list: ShoppingItem[]) => acc + list.filter((i: ShoppingItem) => !pantryItems.includes(i.name.toLowerCase())).length,
        0
    );

    // Copy shopping list to clipboard
    const handleCopyShoppingList = () => {
        const lines = ['🛒 Inköpslista'];

        Object.entries(shoppingList).forEach(([type, items]: [string, ShoppingItem[]]) => {
            const needed = items.filter((i: ShoppingItem) => !pantryItems.includes(i.name.toLowerCase()));
            if (needed.length > 0) {
                const label = type === 'fresh' ? 'Frukt & Grönt' : type === 'frozen' ? 'Frys' : 'Skafferi';
                lines.push(`\n${label}:`);
                needed.forEach(item => lines.push(`- ${item.name}`));
            }
        });

        navigator.clipboard.writeText(lines.join('\n'))
            .then(() => alert('Inköpslistan kopierad!'))
            .catch(() => alert('Kunde inte kopiera listan'));
    };

    return { shoppingList, totalItems, handleCopyShoppingList };
}
