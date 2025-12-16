// ============================================
// Shared Types - Reusable across all modules
// ============================================

/** Unit of measurement for food items and recipe ingredients */
export type Unit = 'g' | 'ml' | 'pcs' | 'kg' | 'l';

/** Meal type for calorie tracking entries */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'beverage';

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
    | 'other';

/** Food storage type */
export type FoodStorageType = 'fresh' | 'pantry' | 'frozen';

/** Theme type */
export type Theme = 'light' | 'dark';

// ============================================
// User Settings
// ============================================

/** User preferences and settings */
export interface UserSettings {
    theme: Theme;
    visibleMeals: MealType[];
    dailyCalorieGoal: number;
    dailyProteinGoal: number;
    dailyCarbsGoal: number;
    dailyFatGoal: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
    theme: 'light',
    visibleMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
    dailyCalorieGoal: 2000,
    dailyProteinGoal: 150,
    dailyCarbsGoal: 250,
    dailyFatGoal: 65,
};

// ============================================
// Core Entities
// ============================================

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
    storageType?: FoodStorageType;
    // Extended properties
    pricePerUnit?: number;      // Price in SEK per unit
    co2PerUnit?: number;        // CO2 emission in kg per unit
    containsGluten?: boolean;   // Whether the item contains gluten
    isCooked?: boolean;         // Whether this is the cooked version (affects kcal)
    defaultPortionGrams?: number; // Default portion size in grams (e.g., banana = 120g)
    gramsPerDl?: number;        // Weight in grams for 1 dl
    yieldFactor?: number;       // Cooked weight / Raw weight (e.g. 2.5 for rice)
    linkedItemId?: string;      // ID of the corresponding raw/cooked version
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

// ============================================
// Weekly Planning Types
// ============================================

/** Day of the week */
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** Planned meal for a specific day and meal type */
export interface PlannedMeal {
    recipeId?: string;
    note?: string;
    /** Additional recipe IDs for multiple snacks */
    additionalRecipeIds?: string[];
    /** Ingredient swaps: originalItemId -> newItemId */
    swaps?: Record<string, string>;
}

/** Weekly meal plan structure */
export interface WeeklyPlan {
    id: string;
    weekStartDate: string;  // ISO date of Monday
    meals: {
        [key in Weekday]: {
            [key in MealType]?: PlannedMeal;
        };
    };
    createdAt: string;
    updatedAt: string;
}

export type WeeklyPlanFormData = Omit<WeeklyPlan, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================
// Computed Types (for display purposes)
// ============================================

/** Nutritional summary for recipes and daily totals */
export interface NutritionSummary {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
}

/** Recipe with computed nutritional info */
export interface RecipeWithNutrition extends Recipe {
    nutrition: NutritionSummary;
    nutritionPerServing: NutritionSummary;
}

// ============================================
// Form Types (for creating/editing entities)
// ============================================

export type FoodItemFormData = Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>;
export type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;
export type MealEntryFormData = Omit<MealEntry, 'id' | 'createdAt'>;

// ============================================
// Utility Types
// ============================================

/** Storage structure for LocalStorage persistence */
export interface AppData {
    foodItems: FoodItem[];
    recipes: Recipe[];
    mealEntries: MealEntry[];
    weeklyPlans?: WeeklyPlan[];
    pantryItems?: string[]; // New: List of ingredient names user has at home
    userSettings?: AppSettings;
}

/** Generate a unique ID */
export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/** Get ISO date string (YYYY-MM-DD) */
export const getISODate = (date: Date = new Date()): string => {
    return date.toISOString().split('T')[0];
};

/** Get the Monday of the week for a given date */
export const getWeekStartDate = (date: Date = new Date()): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    d.setDate(diff);
    return getISODate(d);
};

/** Unit display labels */
export const UNIT_LABELS: Record<Unit, string> = {
    g: 'gram',
    ml: 'milliliter',
    pcs: 'styck',
    kg: 'kilogram',
    l: 'liter'
};

/** Meal type display labels (Swedish) */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
    breakfast: 'Frukost',
    lunch: 'Lunch',
    dinner: 'Middag',
    snack: 'Mellanmål',
    beverage: 'Dryck'
};

/** Meal type colors for UI */
export const MEAL_TYPE_COLORS: Record<MealType, string> = {
    breakfast: 'text-amber-400 bg-amber-500/10',
    lunch: 'text-sky-400 bg-sky-500/10',
    dinner: 'text-emerald-400 bg-emerald-500/10',
    snack: 'text-violet-400 bg-violet-500/10',
    beverage: 'text-cyan-400 bg-cyan-500/10',
};

/** Weekday display labels (Swedish) */
export const WEEKDAY_LABELS: Record<Weekday, string> = {
    monday: 'Måndag',
    tuesday: 'Tisdag',
    wednesday: 'Onsdag',
    thursday: 'Torsdag',
    friday: 'Fredag',
    saturday: 'Lördag',
    sunday: 'Söndag'
};

/** Ordered weekdays array */
export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export interface AppSettings {
    visibleMeals: MealType[];
    calorieTarget?: number;
    theme?: 'light' | 'dark';
}

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
    other: 'Övrigt'
};

/**
 * Get weekday key from ISO date string
 * @param date ISO date string (YYYY-MM-DD)
 * @returns Weekday key or null if invalid
 */
export function getWeekdayFromDate(date: string): Weekday | null {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    // getDay() returns 0-6 where 0 is Sunday
    const jsDay = d.getDay();
    // Convert to Monday-first index: 0=Mon, 1=Tue, ..., 6=Sun
    const weekdayIndex = jsDay === 0 ? 6 : jsDay - 1;
    return WEEKDAYS[weekdayIndex];
}

