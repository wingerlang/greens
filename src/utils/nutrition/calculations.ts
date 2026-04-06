import {
    type FoodItem,
    type Recipe,
    type MealItem,
    type NutritionSummary,
    type RecipeWithNutrition,
    type FoodVariant,
    type QuickMeal
} from '../../models/types.ts';
import { calculateRecipeEstimate } from '../ingredientParser.ts';

// Helper to get effective nutrition from an item, considering variants and cooking status
export function calculateItemNutrition(
    foodItem: FoodItem,
    amountGrams: number,
    isCooked: boolean,
    effectiveYieldFactor?: number,
    variantId?: string
): { nutrition: NutritionSummary; caffeine?: number; alcohol?: number } {

    let base = {
        calories: foodItem.calories,
        protein: foodItem.protein,
        carbs: foodItem.carbs,
        fat: foodItem.fat,
        fiber: foodItem.fiber || 0,
        iron: foodItem.iron || 0,
        calcium: foodItem.calcium || 0,
        zinc: foodItem.zinc || 0,
        vitaminB12: foodItem.vitaminB12 || 0,
        vitaminC: foodItem.vitaminC || 0,
        vitaminA: foodItem.vitaminA || 0,
        proteinCategories: foodItem.proteinCategory ? [foodItem.proteinCategory] : []
    };

    let caffeine = foodItem.extendedDetails?.caffeine || 0;
    let alcohol = foodItem.extendedDetails?.alcohol || 0;

    // Apply Variant Overrides
    if (variantId && foodItem.variants) {
        const variant = foodItem.variants.find(v => v.id === variantId);
        if (variant) {
            if (variant.nutrition) {
                base = { ...base, ...variant.nutrition } as any;
            }
            if (variant.caffeine !== undefined) caffeine = variant.caffeine;
            if (variant.alcohol !== undefined) alcohol = variant.alcohol;
        }
    }

    // Adjust for cooking
    let multiplier = amountGrams / 100;
    if (isCooked) {
        const yieldFactor = effectiveYieldFactor || foodItem.yieldFactor || 1;
        if (yieldFactor > 1) {
            multiplier = multiplier / yieldFactor;
        }
    }

    const result: NutritionSummary = {
        calories: Math.round(base.calories * multiplier),
        protein: base.protein * multiplier,
        carbs: base.carbs * multiplier,
        fat: base.fat * multiplier,
        fiber: base.fiber * multiplier,
        iron: base.iron * multiplier,
        calcium: base.calcium * multiplier,
        zinc: base.zinc * multiplier,
        vitaminB12: base.vitaminB12 * multiplier,
        vitaminC: base.vitaminC * multiplier,
        vitaminA: base.vitaminA * multiplier,
        proteinCategories: base.proteinCategories
    };

    return {
        nutrition: result,
        caffeine: caffeine ? caffeine * (amountGrams / 100) : 0,
        alcohol: alcohol ? alcohol * (amountGrams / 100) : 0
    };
}

// Re-implement the Recipe Calculation logic here to allow reuse
export function calculateRecipeNutrition(
    recipe: Recipe,
    foodItems: FoodItem[]
): NutritionSummary {
    if (recipe.ingredientsText && recipe.ingredientsText.trim()) {
        const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems);
        return {
            calories: Math.round(estimate.calories),
            protein: estimate.protein,
            carbs: estimate.carbs,
            fat: estimate.fat,
            fiber: estimate.fiber,
            iron: estimate.iron,
            calcium: estimate.calcium,
            zinc: estimate.zinc,
            vitaminB12: estimate.vitaminB12,
            vitaminC: estimate.vitaminC,
            vitaminA: estimate.vitaminA,
            proteinCategories: estimate.proteinCategories,
        };
    }

    const summary: NutritionSummary = {
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0
    };

    for (const ingredient of recipe.ingredients) {
        const foodItem = foodItems.find(f => f.id === ingredient.foodItemId);
        if (foodItem) {
            const multiplier = ingredient.quantity / 100;
            summary.calories += foodItem.calories * multiplier;
            summary.protein += foodItem.protein * multiplier;
            summary.carbs += foodItem.carbs * multiplier;
            summary.fat += foodItem.fat * multiplier;
            summary.fiber += (foodItem.fiber || 0) * multiplier;

            // Micronutrients
            summary.iron = (summary.iron || 0) + (foodItem.iron || 0) * multiplier;
            summary.calcium = (summary.calcium || 0) + (foodItem.calcium || 0) * multiplier;
            summary.zinc = (summary.zinc || 0) + (foodItem.zinc || 0) * multiplier;
            summary.vitaminB12 = (summary.vitaminB12 || 0) + (foodItem.vitaminB12 || 0) * multiplier;
            summary.vitaminC = (summary.vitaminC || 0) + (foodItem.vitaminC || 0) * multiplier;
            summary.vitaminA = (summary.vitaminA || 0) + (foodItem.vitaminA || 0) * multiplier;

            if (foodItem.proteinCategory) {
                summary.proteinCategories = summary.proteinCategories || [];
                if (!summary.proteinCategories.includes(foodItem.proteinCategory)) {
                    summary.proteinCategories.push(foodItem.proteinCategory);
                }
            }
        }
    }

    return {
        calories: Math.round(summary.calories),
        protein: summary.protein,
        carbs: summary.carbs,
        fat: summary.fat,
        fiber: summary.fiber,
        iron: summary.iron,
        calcium: summary.calcium,
        zinc: summary.zinc,
        vitaminB12: summary.vitaminB12,
        vitaminC: summary.vitaminC,
        vitaminA: summary.vitaminA,
        proteinCategories: summary.proteinCategories
    };
}

export function calculateMealItemNutrition(
    item: MealItem,
    recipes: Recipe[],
    foodItems: FoodItem[],
    quickMeals: QuickMeal[] = []
): { nutrition: NutritionSummary; caffeine?: number; alcoholUnits?: number } {

    if ((item as any).type === 'quickMeal') {
        const qm = quickMeals.find(q => q.id === item.referenceId);
        if (qm) {
            const summary: NutritionSummary = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
            let totalCaffeine = 0;
            let totalAlcoholUnits = 0;

            qm.items.forEach(childItem => {
                const { nutrition, caffeine, alcoholUnits } = calculateMealItemNutrition(childItem, recipes, foodItems, quickMeals);
                summary.calories += nutrition.calories;
                summary.protein += nutrition.protein;
                summary.carbs += nutrition.carbs;
                summary.fat += nutrition.fat;
                summary.fiber += (nutrition.fiber || 0);

                if (caffeine) totalCaffeine += caffeine;
                if (alcoholUnits) totalAlcoholUnits += alcoholUnits;
            });

            return {
                nutrition: summary,
                caffeine: totalCaffeine,
                alcoholUnits: totalAlcoholUnits
            };
        }
    }

    if (item.type === 'estimate' && item.estimateDetails) {
        const est = item.estimateDetails;
        return {
            nutrition: {
                calories: est.caloriesAvg,
                protein: est.protein || 0,
                carbs: est.carbs || 0,
                fat: est.fat || 0,
                fiber: 0,
                iron: 0,
                calcium: 0,
                zinc: 0,
                vitaminB12: 0,
                vitaminC: 0,
                vitaminA: 0,
                proteinCategories: [] as any[]
            }
        };
    }

    if (item.type === 'recipe') {
        const recipe = recipes.find(r => r.id === item.referenceId);
        if (recipe) {
            const recipeNutrition = calculateRecipeNutrition(recipe, foodItems);
            const perServing = recipe.servings || 1;
            const multiplier = item.servings / perServing;

            return {
                nutrition: {
                    calories: Math.round(recipeNutrition.calories * multiplier),
                    protein: recipeNutrition.protein * multiplier,
                    carbs: recipeNutrition.carbs * multiplier,
                    fat: recipeNutrition.fat * multiplier,
                    fiber: recipeNutrition.fiber * multiplier,
                    iron: (recipeNutrition.iron || 0) * multiplier,
                    calcium: (recipeNutrition.calcium || 0) * multiplier,
                    zinc: (recipeNutrition.zinc || 0) * multiplier,
                    vitaminB12: (recipeNutrition.vitaminB12 || 0) * multiplier,
                    vitaminC: (recipeNutrition.vitaminC || 0) * multiplier,
                    vitaminA: (recipeNutrition.vitaminA || 0) * multiplier,
                    proteinCategories: recipeNutrition.proteinCategories
                }
            };
        }
    } else {
        const foodItem = foodItems.find(f => f.id === item.referenceId);
        if (foodItem) {
            const amountGrams = item.servings;
            const { nutrition, caffeine, alcohol } = calculateItemNutrition(
                foodItem,
                amountGrams,
                item.loggedAsCooked || false,
                item.effectiveYieldFactor,
                item.variantId
            );
            const units = alcohol ? alcohol / 10 : 0;
            return {
                nutrition,
                caffeine,
                alcoholUnits: units
            };
        }
    }

    return { nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } };
}
