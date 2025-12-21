/**
 * Ingredient Parser Utility
 * Parses free-form ingredient text into structured data
 * @module utils/ingredientParser
 */

import { type FoodItem, type Unit, type NutritionSummary } from '../models/types.ts';

// ============================================
// Types
// ============================================

export interface ParsedIngredient {
    quantity: number;
    unit: string;
    name: string;
    originalText: string;
}

export interface MatchedIngredient extends ParsedIngredient {
    foodItem?: FoodItem;
    nutrition?: NutritionSummary;
    price?: number;
    co2?: number;
}

export interface SynergyResult {
    id: string;
    name: string;
    description: string;
    icon: string;
    impact: 'absorption' | 'efficiency' | 'unlock';
}

export interface RecipeEstimate {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    price: number;
    co2: number;
    matchedCount: number;
    totalCount: number;
    proteinCategories: string[]; // e.g. ['legume', 'grain']
    isCompleteProtein: boolean;
    tags: string[];           // e.g. ['seasonal-powerhouse', 'budget-win']
    synergies: SynergyResult[];
}

// ============================================
// Parsing Patterns
// ============================================

// Common Swedish measurement words
const UNIT_PATTERNS: Record<string, string> = {
    'g': 'g',
    'gram': 'g',
    'kg': 'kg',
    'kilo': 'kg',
    'ml': 'ml',
    'dl': 'dl',
    'l': 'l',
    'liter': 'l',
    'st': 'pcs',
    'styck': 'pcs',
    'stycken': 'pcs',
    'port': 'portion',
    'portion': 'portion',
    'portioner': 'portion',
    'msk': 'msk',
    'matsked': 'msk',
    'tsk': 'tsk',
    'tesked': 'tsk',
    'påse': 'pcs',
    'burk': 'pcs',
    'förpackning': 'pcs',
    'klyfta': 'pcs',
    'klyftor': 'pcs',
};

// Conversion to grams for calculation
const UNIT_TO_GRAMS: Record<string, number> = {
    'g': 1,
    'kg': 1000,
    'ml': 1,  // Approximate for liquids
    'dl': 100,
    'l': 1000,
    'msk': 15,
    'tsk': 5,
    'portion': 200,  // Default portion size
    'pcs': 100,  // Default piece weight
};

// Main parsing regex: captures quantity, unit, and name
// Examples: "400g tofu", "4 port ris", "1 påse grönsaker", "Soja" (no quantity)
const INGREDIENT_REGEX = /^(\d+(?:[.,]\d+)?)\s*([a-zåäö]+)?\s+(.+)$/i;
const SIMPLE_REGEX = /^(.+)$/;  // Just the ingredient name

// ============================================
// Parsing Functions
// ============================================

/**
 * Parse a single ingredient line
 */
export function parseIngredientLine(line: string): ParsedIngredient | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const match = trimmed.match(INGREDIENT_REGEX);

    if (match) {
        const [, quantityStr, unitStr, name] = match;
        const quantity = parseFloat(quantityStr.replace(',', '.'));
        const unit = unitStr ? (UNIT_PATTERNS[unitStr.toLowerCase()] || unitStr) : 'pcs';

        return {
            quantity,
            unit,
            name: name.trim(),
            originalText: trimmed,
        };
    }

    // No quantity found, assume 1 unit
    return {
        quantity: 1,
        unit: 'pcs',
        name: trimmed,
        originalText: trimmed,
    };
}

/**
 * Parse multiple ingredient lines
 */
export function parseIngredients(text: string): ParsedIngredient[] {
    return text
        .split('\n')
        .map(line => parseIngredientLine(line))
        .filter((p): p is ParsedIngredient => p !== null);
}

/**
 * Match a parsed ingredient to a food item in the database
 * Uses fuzzy matching on name
 */
export function matchToFoodItem(parsed: ParsedIngredient, foodItems: FoodItem[]): FoodItem | null {
    const searchName = parsed.name.toLowerCase();

    // Try exact match first
    let match = foodItems.find(f => f.name.toLowerCase() === searchName);
    if (match) return match;

    // Try partial match (ingredient contains food name or vice versa)
    match = foodItems.find(f =>
        searchName.includes(f.name.toLowerCase()) ||
        f.name.toLowerCase().includes(searchName)
    );
    if (match) return match;

    // Try matching description
    match = foodItems.find(f =>
        f.description?.toLowerCase().includes(searchName)
    );
    if (match) return match;

    // Try first word match
    const firstWord = searchName.split(/\s+/)[0];
    match = foodItems.find(f =>
        f.name.toLowerCase().startsWith(firstWord) ||
        f.name.toLowerCase().includes(firstWord)
    );

    return match || null;
}

/**
 * Calculate nutrition for a matched ingredient
 */
export function calculateIngredientNutrition(
    parsed: ParsedIngredient,
    foodItem: FoodItem
): { nutrition: NutritionSummary; price: number; co2: number } {
    // Convert quantity to grams
    const gramsMultiplier = UNIT_TO_GRAMS[parsed.unit] || 100;
    const grams = parsed.quantity * gramsMultiplier;

    // Food item nutrition is per 100g
    const factor = grams / 100;

    return {
        nutrition: {
            calories: Math.round(foodItem.calories * factor),
            protein: Math.round(foodItem.protein * factor * 10) / 10,
            carbs: Math.round(foodItem.carbs * factor * 10) / 10,
            fat: Math.round(foodItem.fat * factor * 10) / 10,
            fiber: Math.round((foodItem.fiber || 0) * factor * 10) / 10,
        },
        price: Math.round((foodItem.pricePerUnit || 0) * (grams / 1000) * 10) / 10, // price per kg
        co2: Math.round((foodItem.co2PerUnit || 0) * (grams / 1000) * 100) / 100, // co2 per kg
    };
}

/**
 * Calculate total recipe nutrition from ingredient text
 */
export function calculateRecipeEstimate(
    ingredientsText: string,
    foodItems: FoodItem[],
    swaps?: Record<string, string>
): RecipeEstimate {
    const parsed = parseIngredients(ingredientsText);

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalPrice = 0;
    let totalCo2 = 0;
    let matchedCount = 0;
    const proteinCategories = new Set<string>();
    const seasons = new Set<string>();

    // Season detection
    const month = new Date().getMonth();
    let currentSeason: string = 'winter';
    if (month >= 2 && month <= 4) currentSeason = 'spring';
    else if (month >= 5 && month <= 7) currentSeason = 'summer';
    else if (month >= 8 && month <= 10) currentSeason = 'autumn';

    for (const ingredient of parsed) {
        let foodItem = matchToFoodItem(ingredient, foodItems);

        // Apply swap if exists
        if (foodItem && swaps && swaps[foodItem.id]) {
            const swappedItem = foodItems.find(f => f.id === swaps[foodItem!.id]);
            if (swappedItem) {
                // Use the swapped item, but keep the original quantity/unit from the recipe text
                // Ideally we might want a conversion factor here, but 1:1 is MVP
                foodItem = swappedItem;
            }
        }

        if (foodItem) {
            const { nutrition, price, co2 } = calculateIngredientNutrition(ingredient, foodItem);
            totalCalories += nutrition.calories;
            totalProtein += nutrition.protein;
            totalCarbs += nutrition.carbs;
            totalFat += nutrition.fat;
            totalFiber += nutrition.fiber;
            totalPrice += price;
            totalCo2 += co2;
            matchedCount++;

            if (foodItem.proteinCategory) {
                proteinCategories.add(foodItem.proteinCategory);
            }
            if (foodItem.seasons) {
                foodItem.seasons.forEach(s => seasons.add(s));
            }
        }
    }

    const categories = Array.from(proteinCategories);
    const isComplete =
        categories.includes('soy_quinoa') ||
        (categories.includes('legume') && categories.includes('grain'));

    const tags: string[] = [];
    if (isComplete) tags.push('complete-protein');
    if (seasons.has(currentSeason)) tags.push('seasonal-powerhouse');
    if (totalPrice < 30) tags.push('budget-win');

    // Synergy Detection
    const synergies: SynergyResult[] = [];

    // 1. Iron + Vitamin C Synergy
    let totalIron = 0;
    let totalVitC = 0;
    let totalVitA = 0;
    let totalZinc = 0;
    let hasTurmeric = false;
    let hasBlackPepper = false;
    let hasCruciferous = false;
    let hasMyrosinase = false;
    let hasAlliums = false;

    parsed.forEach(ing => {
        const item = matchToFoodItem(ing, foodItems);
        if (item) {
            const factor = ((UNIT_TO_GRAMS[ing.unit] || 100) * ing.quantity) / 100;
            totalIron += (item.iron || 0) * factor;
            totalVitC += (item.vitaminC || 0) * factor;
            totalVitA += (item.vitaminA || 0) * factor;
            totalZinc += (item.zinc || 0) * factor;

            const name = item.name.toLowerCase();
            if (name.includes('gurkmeja')) hasTurmeric = true;
            if (name.includes('svartpeppar') || name.includes('peppar')) hasBlackPepper = true;
            if (['broccoli', 'grönkål', 'blomkål', 'brysselkål', 'svartkål'].some(c => name.includes(c))) hasCruciferous = true;
            if (['senap', 'rädisa', 'pepparrot', 'rucola'].some(m => name.includes(m))) hasMyrosinase = true;
            if (['vitlök', 'lök', 'purjolök'].some(a => name.includes(a))) hasAlliums = true;
        }
    });

    // --- Synergies ---

    // Iron + VitC
    if (totalIron > 2 && totalVitC > 20) {
        synergies.push({
            id: 'iron-vitc',
            name: 'Järnupptag-Boost',
            description: 'Vitamin C ökar upptaget av järn från plantbaserade källor.',
            icon: '🍋+🌿',
            impact: 'absorption'
        });
    }

    // Fat + VitA (Fat Soluble Unlock)
    if (totalVitA > 500 && totalFat > 10) {
        synergies.push({
            id: 'fat-vita',
            name: 'Närings-Unlock',
            description: 'Hälsosamma fetter behövs för att ta upp fettlösligt Vitamin A (betakaroten).',
            icon: '🥑+🥕',
            impact: 'unlock'
        });
    }

    // Turmeric + Black Pepper
    if (hasTurmeric && hasBlackPepper) {
        synergies.push({
            id: 'turmeric-pepper',
            name: 'Bio-Boost',
            description: 'Piperin i svartpeppar ökar upptaget av kurkumin med upp till 2000%.',
            icon: '🧂+🌿',
            impact: 'efficiency'
        });
    }

    // Sulforaphane Activation (Cruciferous + Myrosinase)
    if (hasCruciferous && hasMyrosinase) {
        synergies.push({
            id: 'sulforaphane',
            name: 'Sulforafan-Aktivering',
            description: 'Senapsfrö eller rucola hjälper till att aktivera det cancerförebyggande sulforafanet i kål.',
            icon: '🥦+🧂',
            impact: 'efficiency'
        });
    }

    // Mineral Bridge (Allium + Minerals)
    if (hasAlliums && (totalIron > 3 || totalZinc > 3)) { // Zinc/Iron focused
        synergies.push({
            id: 'allium-minerals',
            name: 'Mineral-Brygga',
            description: 'Svavelföreningar i lök och vitlök ökar biotillgängligheten hos järn och zink.',
            icon: '🧄+🍛',
            impact: 'absorption'
        });
    }

    return {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein * 10) / 10,
        carbs: Math.round(totalCarbs * 10) / 10,
        fat: Math.round(totalFat * 10) / 10,
        fiber: Math.round(totalFiber * 10) / 10,
        price: Math.round(totalPrice),
        co2: Math.round(totalCo2 * 100) / 100,
        matchedCount,
        totalCount: parsed.length,
        proteinCategories: categories,
        isCompleteProtein: isComplete,
        tags,
        synergies
    };
}

/**
 * Calculate calories for a weighed portion
 * Solves the "gryta problem" - where you weigh your portion of a dish
 */
export function calculateWeighedPortion(
    totalRecipeCalories: number,
    totalRecipeWeight: number,  // grams
    portionWeight: number       // grams
): number {
    if (totalRecipeWeight <= 0) return 0;
    return Math.round((portionWeight / totalRecipeWeight) * totalRecipeCalories);
}

/**
 * Get autocomplete suggestions for ingredient names
 */
export function getIngredientSuggestions(
    query: string,
    foodItems: FoodItem[],
    limit: number = 5
): FoodItem[] {
    if (!query || query.length < 2) return [];

    const searchTerm = query.toLowerCase();

    return foodItems
        .filter(f =>
            f.name.toLowerCase().includes(searchTerm) ||
            f.description?.toLowerCase().includes(searchTerm)
        )
        .slice(0, limit);
}
