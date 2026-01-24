import { z } from "zod";
import {
  type ParsedNutrition,
  ParsedNutritionSchema,
  ParseJsonLdSchema,
} from "../schemas.ts";

/**
 * Extracts values from Schema.org JSON-LD data.
 *
 * Goal: Traverse JSON-LD objects to find standard nutrition schemas (Schema.org/NutritionInformation).
 * Constraints: Expects standard Schema.org structure; may miss non-standard nesting.
 * Dependencies: Zod for validation.
 *
 * @param jsonLds - Array of JSON-LD objects.
 * @returns ParsedNutrition object with extracted values.
 */
export const extractFromJSONLD = (jsonLds: any[]): ParsedNutrition => {
  // 1. Validate Input
  const validJsonLds = ParseJsonLdSchema.parse(jsonLds);

  const result: ParsedNutrition = {};

  const findNutritionInObject = (obj: any) => {
    if (!obj || typeof obj !== "object") return;

    // Common schema.org paths
    const nutrition = obj.nutrition || obj;
    if (nutrition) {
      if (nutrition.calories) result.calories = parseFloat(nutrition.calories);
      if (nutrition.proteinContent) {
        result.protein = parseFloat(nutrition.proteinContent);
      }
      if (nutrition.fatContent) result.fat = parseFloat(nutrition.fatContent);
      if (nutrition.carbohydrateContent) {
        result.carbs = parseFloat(nutrition.carbohydrateContent);
      }
      if (nutrition.fiberContent) {
        result.fiber = parseFloat(nutrition.fiberContent);
      }
    }

    if (obj.name && !result.name) result.name = obj.name;
    if (obj.brand && !result.brand) {
      result.brand = typeof obj.brand === "string" ? obj.brand : obj.brand.name;
    }

    // Ingredients in JSON-LD
    if ((obj.recipeIngredient || obj.ingredients) && !result.ingredients) {
      const ingredients = obj.recipeIngredient || obj.ingredients;
      result.ingredients = Array.isArray(ingredients)
        ? ingredients.join(", ")
        : ingredients;
    }

    // Recursive search for deeper objects
    for (const key in obj) {
      if (typeof obj[key] === "object") findNutritionInObject(obj[key]);
    }
  };

  validJsonLds.forEach(findNutritionInObject);

  // 2. Validate Output
  return ParsedNutritionSchema.parse(result);
};
