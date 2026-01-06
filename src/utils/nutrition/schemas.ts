import { z } from "zod";

/**
 * Schema for the result of a nutrition parsing operation.
 *
 * Goal: Define a strict contract for nutrition data extracted from any source (Text, JSON-LD, Image).
 * Constraints: All numeric values are optional as they may not be present in the source.
 */
export const ParsedNutritionSchema = z.object({
  name: z.string().optional().describe("Product name extracted from the source"),
  brand: z.string().optional().describe("Brand name extracted or inferred"),
  packageWeight: z.number().optional().describe("Total weight of the package in grams"),
  calories: z.number().optional().describe("Energy content in kcal per 100g/unit"),
  protein: z.number().optional().describe("Protein content in grams per 100g/unit"),
  carbs: z.number().optional().describe("Carbohydrate content in grams per 100g/unit"),
  fat: z.number().optional().describe("Fat content in grams per 100g/unit"),
  fiber: z.number().optional().describe("Fiber content in grams per 100g/unit"),
  ingredients: z.string().optional().describe("Comma-separated list of ingredients"),
  defaultPortionGrams: z.number().optional().describe("Suggested portion size in grams")
});

export type ParsedNutrition = z.infer<typeof ParsedNutritionSchema>;

/**
 * Input schema for text parsing.
 */
export const ParseTextSchema = z.string().describe("The raw text containing nutrition information");

/**
 * Input schema for JSON-LD extraction.
 */
export const ParseJsonLdSchema = z.array(z.any()).describe("Array of JSON-LD objects extracted from HTML");

/**
 * Input schema for Product Name cleaning.
 */
export const CleanProductNameSchema = z.object({
  title: z.string().describe("The page title"),
  h1: z.string().optional().describe("The main H1 heading of the page")
});

/**
 * Input schema for Brand extraction.
 */
export const ExtractBrandSchema = z.object({
  text: z.string().describe("Text to search for brand names"),
  knownBrands: z.array(z.string()).optional().default([]).describe("List of known brands to fuzzy match against")
});
