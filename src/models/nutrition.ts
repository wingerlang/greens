import { Unit, MealType, Season, PriceCategory } from './common.ts';

/** Food category for organizing the database (vegan only) */
export type FoodCategory =
    | 'vegetables'     // Grönsaker
    | 'fruits'         // Frukter
    | 'grains'         // Spannmål, ris, pasta
    | 'legumes'        // Baljväxter (linser, bönor, kikärtor)
    | 'protein'        // Proteinrika (tofu, tempeh, seitan)
    | 'fats'           // Fetter/oljor
    | 'beverages'      // Drycker
    | 'dairy-alt'      // Mejerialternativ (havremjölk, veganost)
    | 'nuts-seeds'     // Nötter och frön
    | 'spices'         // Kryddor och örter
    | 'condiments'     // Smaksättare (soja, miso, vinäger)
    | 'sauces'         // Färdiga såser
    | 'sweeteners'     // Sötningsmedel (sirap, socker)
    | 'baking'         // Bakvaror (mjöl, bakpulver)
    | 'supplements'    // Kosttillskott (proteinpulver, vitaminer)
    | 'other';

/** Food storage type */
export type FoodStorageType = 'fresh' | 'pantry' | 'frozen';

/** Protein supplement type for complementary amino acids */
export type ProteinCategory =
    | 'legume'      // Bönor, linser (rich in lysine, low in methionine)
    | 'grain'       // Ris, vete, havre (rich in methionine, low in lysine)
    | 'seed'        // Solrosfrön, pumpakärnor
    | 'nut'         // Valnötter, mandlar
    | 'vegetable'   // Broccoli, spenat
    | 'soy_quinoa'; // Complete protein sources

/** Category display labels (Swedish, vegan only) */
export const CATEGORY_LABELS: Record<FoodCategory, string> = {
    vegetables: 'Grönsaker',
    fruits: 'Frukt',
    grains: 'Spannmål',
    legumes: 'Baljväxter',
    protein: 'Protein',
    fats: 'Fett & Oljor',
    beverages: 'Drycker',
    'dairy-alt': 'Mejerialternativ',
    'nuts-seeds': 'Nötter & Frön',
    spices: 'Kryddor',
    condiments: 'Smaksättare',
    sauces: 'Såser',
    sweeteners: 'Sötningsmedel',
    baking: 'Bakvaror',
    supplements: 'Kosttillskott',
    other: 'Övrigt'
};

export interface ExtendedFoodDetails {
    sugar?: number;             // g
    addedSugar?: number;        // g
    fiber?: number;             // g (Moved/Duplicated for completeness if needed, but FoodItem has it top-level)
    wholeGrains?: number;       // g

    // Fats Breakdown
    saturatedFat?: number;       // g
    monounsaturatedFat?: number; // g
    polyunsaturatedFat?: number; // g
    cholesterol?: number;        // mg
    omega3?: number;             // g
    omega6?: number;             // g

    // Extra Vitamins
    vitaminD?: number;           // µg
    caffeine?: number;           // mg
    // Add others if present in DB
}

/**
 * FoodItem - Base ingredient stored in the database
 * All nutritional values are per 100g/100ml
 */
export interface FoodItem {
    id: string;
    name: string;
    description?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    unit: Unit;
    category: FoodCategory;
    brand?: string;
    imageUrl?: string; // URL to product image (uploads/food-images/...)
    storageType?: FoodStorageType;
    // Extended properties
    pricePerUnit?: number;      // Price in SEK per unit
    co2PerUnit?: number;        // CO2 emission in kg per unit
    containsGluten?: boolean;   // Whether the item contains gluten
    isCooked?: boolean;         // Whether this is the cooked version (affects kcal)
    packageWeight?: number;     // Total weight of a full package (e.g. 275g)
    defaultPortionGrams?: number; // Default portion size in grams (e.g., banana = 120g)
    gramsPerDl?: number;        // Weight in grams for 1 dl
    yieldFactor?: number;       // Cooked weight / Raw weight (e.g. 2.5 for rice)
    linkedItemId?: string;      // ID of the corresponding raw/cooked version
    // Micronutrients (per 100g) - Core
    iron?: number;              // mg
    calcium?: number;           // mg
    zinc?: number;              // mg
    vitaminB12?: number;        // µg
    vitaminC?: number;          // mg
    vitaminA?: number;          // µg (RAE)
    // Extended Details (Full Macro/Micro Breakdown)
    extendedDetails?: ExtendedFoodDetails;

    // Protein Quality
    isCompleteProtein?: boolean;
    missingAminoAcids?: string[]; // e.g., ['lysine', 'methionine']
    complementaryCategories?: FoodCategory[]; // Categories that complete the protein
    proteinCategory?: ProteinCategory;        // For amino acid balancing
    seasons?: Season[];                       // Best seasons for this item
    ingredients?: string;                     // List of ingredients
    createdAt: string;
    updatedAt: string;
}

/**
 * RecipeIngredient - Links a FoodItem to a Recipe with quantity
 */
export interface RecipeIngredient {
    foodItemId: string;
    quantity: number;
    unit: Unit;
}

/**
 * Recipe - Composed of multiple FoodItems
 */
export interface Recipe {
    id: string;
    name: string;
    description: string;
    servings: number;
    ingredients: RecipeIngredient[];
    instructions: string[];
    prepTime?: number;  // in minutes
    cookTime?: number;  // in minutes
    mealType?: MealType; // Lunch, Middag etc
    // Text-based input (new UI)
    ingredientsText?: string; // Free-form ingredients, one per line
    instructionsText?: string; // Free-form instructions, one per line
    // For weighted portion calculation
    totalWeight?: number; // Total weight in grams for portion calculation
    priceCategory?: PriceCategory; // Estimated cost level
    seasons?: Season[];            // Best seasons for this recipe
    createdAt: string;
    updatedAt: string;
}

/**
 * MealItem - A single item in a meal entry
 */
export interface MealItem {
    type: 'recipe' | 'foodItem';
    referenceId: string;
    servings: number;
    // New fields for enhanced calorie tracking
    verified?: boolean;              // User has confirmed this entry
    sourceRecipeId?: string;         // If auto-added from weekly plan
    portionType?: 'serving' | 'weight';  // How to calculate
    weightGrams?: number;            // For weight-based portions
    componentLabel?: string;         // "Gryta", "Ris", etc.
}

/**
 * MealEntry - Daily meal tracking entry
 */
export interface MealEntry {
    id: string;
    date: string;  // ISO date string (YYYY-MM-DD)
    mealType: MealType;
    items: MealItem[];
    createdAt: string;
}

/** Nutritional summary for recipes and daily totals */
export interface NutritionSummary {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    // Micronutrients
    iron?: number;
    calcium?: number;
    zinc?: number;
    vitaminB12?: number;
    vitaminC?: number;
    vitaminA?: number;
    proteinCategories?: string[];
}

/** Recipe with computed nutritional info */
export interface RecipeWithNutrition extends Recipe {
    nutrition: NutritionSummary;
    nutritionPerServing: NutritionSummary;
}

// Form Types
export type FoodItemFormData = Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>;
export type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;
export type MealEntryFormData = Omit<MealEntry, 'id' | 'createdAt'>;

export type NutritionWarningType =
    | 'leg_run_conflict'      // Leg day + run on same day
    | 'calorie_deficit'       // Not enough fuel for workout
    | 'recovery_needed'       // High volume without rest
    | 'hydration_reminder'    // Long run hydration
    | 'post_run_nutrition';   // Recovery fuel needed

export interface NutritionWarning {
    id: string;
    type: NutritionWarningType;
    date: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    dismissed?: boolean;
    suggestedAction?: string;
    relatedActivityId?: string;
}

export interface QuickNutritionItem {
    id: string;
    name: string;
    type: 'gel' | 'drink' | 'recovery' | 'snack';
    calories: number;
    carbs: number;
    protein?: number;
    caffeine?: number;
    timing: 'pre' | 'during' | 'post';
}

export const QUICK_NUTRITION_ITEMS: QuickNutritionItem[] = [
    { id: 'gel1', name: 'Energigel', type: 'gel', calories: 100, carbs: 25, caffeine: 25, timing: 'during' },
    { id: 'gel2', name: 'Iso-gel (koffeinfri)', type: 'gel', calories: 90, carbs: 22, timing: 'during' },
    { id: 'drink1', name: 'Sportdryck 500ml', type: 'drink', calories: 140, carbs: 34, timing: 'during' },
    { id: 'drink2', name: 'Elektrolytvatten', type: 'drink', calories: 20, carbs: 4, timing: 'during' },
    { id: 'recover1', name: 'Proteinshake', type: 'recovery', calories: 200, carbs: 15, protein: 30, timing: 'post' },
    { id: 'recover2', name: 'Chokladmjölk', type: 'recovery', calories: 180, carbs: 26, protein: 8, timing: 'post' },
    { id: 'snack1', name: 'Banan', type: 'snack', calories: 105, carbs: 27, timing: 'pre' },
    { id: 'snack2', name: 'Dadlar (3st)', type: 'snack', calories: 70, carbs: 18, timing: 'pre' }
];
