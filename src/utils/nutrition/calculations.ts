import {
    type FoodItem,
    type Recipe,
    type MealItem,
    type NutritionSummary,
    type RecipeWithNutrition,
    type FoodVariant
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
                base = { ...base, ...variant.nutrition };
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
        caffeine: caffeine ? caffeine * (amountGrams / 100) : 0, // Assuming caffeine is per 100g in DB? Or per unit?
                                                                 // The DB standard is per 100g/ml for everything.
                                                                 // However, for single unit items (Nocco), users often think "per can".
                                                                 // But the system stores items as food items.
                                                                 // If a Nocco is 330ml, and user logs 1 pcs (330g),
                                                                 // the DB entry for Nocco should likely be per 100ml.
                                                                 // Nocco: 55mg/100ml -> 180mg/330ml.
                                                                 // If the variant override says "180", is that per 100g or per unit?
                                                                 // To be consistent with the system, it MUST be per 100g.
                                                                 // Wait, "Nocco (180mg)" usually implies total content.
                                                                 // If I override caffeine to 180, and user logs 330g, they get 180 * 3.3 = 594mg!
                                                                 // REQUIREMENT CLARIFICATION:
                                                                 // "T.ex. har en dansk nocco 105mg koffein vs 180 standard."
                                                                 // This likely refers to the *can* content.
                                                                 // But the system works in grams/units.
                                                                 // If the user logs "1 st Nocco", and "1 st" = 330g.
                                                                 // The base item caffeine should be stored as ~55mg (per 100g).
                                                                 // If the variant override is used, the user probably enters "105" thinking "per can".
                                                                 // Ideally, overrides should follow the "per 100g" rule OR we handle "per unit" logic if the item has a default weight.
                                                                 // BUT, `FoodVariant` struct `nutrition` is `Partial<NutritionSummary>`, which is absolute values? No, NutritionSummary is just values.
                                                                 // In `calculateItemNutrition`, we treat base values as "per 100g".
                                                                 // So if `variant.caffeine` is 105, we treat it as 105mg/100g.
                                                                 // This might be confusing for the user entering data.
                                                                 // However, for simplicity and consistency, we MUST assume ALL stored data is per 100g/ml.
                                                                 // So if Danish Nocco is 105mg/330ml, user must enter 105/3.3 = 31.8mg/100ml.
                                                                 // I will assume standard system behavior (per 100g) for now.
        alcohol: alcohol ? alcohol * (amountGrams / 100) : 0 // Alcohol % * amount = volume of alcohol?
                                                             // Wait. Alcohol is %.
                                                             // If 5% vol.
                                                             // 100g (approx 100ml) * 5% = 5ml Alcohol.
                                                             // Formula: (Amount * Percent / 100).
                                                             // Note: Logic in DataContext was: (grams * alcoholPercent) / 1000 => Units.
                                                             // Let's return the raw amount (ml/g of alcohol) or just the params?
                                                             // Let's return the calculated totals.
                                                             // Alcohol % * Amount = Raw Alcohol Volume.
                                                             // e.g. 5.0 * 500ml / 100 = 25ml.
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

    // Rounding
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
    foodItems: FoodItem[]
): { nutrition: NutritionSummary; caffeine?: number; alcoholUnits?: number } {

    if (item.type === 'recipe') {
        const recipe = recipes.find(r => r.id === item.referenceId);
        if (recipe) {
            const recipeNutrition = calculateRecipeNutrition(recipe, foodItems);
            const perServing = recipe.servings || 1;
            const multiplier = item.servings / perServing;

            // Recipes don't support variants override logic yet (complex),
            // and usually don't have caffeine/alcohol unless ingredients do.
            // For now, we scale nutrition.
            // Ideally we'd sum caffeine/alcohol from ingredients, but `calculateRecipeNutrition` returns `NutritionSummary` which doesn't strictly have alcohol/caffeine fields in the interface (they are in ExtendedDetails).
            // Let's stick to macros for recipes.

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
            // FoodItem calculation with Variants
            const amountGrams = item.servings; // item.servings IS grams for foodItems usually, unless unit conversion logic is applied elsewhere.
                                               // In DataContext `addMealEntry`: "const mult = item.servings / 100".
                                               // `item.servings` is the raw quantity input (e.g. 150g).

            const { nutrition, caffeine, alcohol } = calculateItemNutrition(
                foodItem,
                amountGrams,
                item.loggedAsCooked || false,
                item.effectiveYieldFactor,
                item.variantId
            );

            // Calculate Alcohol Units
            // Formula: (ml * %) / 1000 approx?
            // `alcohol` returned from `calculateItemNutrition` is (Grams * Percent / 100).
            // e.g. 500g beer * 5% = 25 "ml-equivalents" of alcohol.
            // Units = 25 / 10? Standard unit is ~12g alcohol?
            // DataContext previously: `(grams * alcoholPercent) / 1000`.
            // If grams=500, percent=5. Result = 2500 / 1000 = 2.5 units.
            // My `alcohol` result is `grams * percent / 100`. = 25.
            // So Units = `alcohol / 10`.
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
