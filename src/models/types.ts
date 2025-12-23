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

/** Protein supplement type for complementary amino acids */
export type ProteinCategory =
    | 'legume'      // Bönor, linser (rich in lysine, low in methionine)
    | 'grain'       // Ris, vete, havre (rich in methionine, low in lysine)
    | 'seed'        // Solrosfrön, pumpakärnor
    | 'nut'         // Valnötter, mandlar
    | 'vegetable'   // Broccoli, spenat
    | 'soy_quinoa'; // Complete protein sources

/** Seasonality for ingredients */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** Price category for budgeting */
export type PriceCategory = 'budget' | 'medium' | 'premium';


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
    // Physical Profile
    age?: number;
    height?: number; // cm
    gender?: 'male' | 'female' | 'other';
    trainingGoal?: 'neutral' | 'deff' | 'bulk';
    dailySleepGoal?: number;
    dailyWaterGoal?: number;
    showSleep?: boolean;
    showWater?: boolean;
}

/** User roles for permissions */
export type UserRole = 'admin' | 'user';

/** Subscription plans for monetization */
export type SubscriptionPlan = 'free' | 'evergreen';

/** User model */
export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    plan: SubscriptionPlan;
    settings: UserSettings;
    householdId?: string; // For shared plans
    createdAt: string;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
    theme: 'dark',
    visibleMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
    dailyCalorieGoal: 2000,
    dailyProteinGoal: 150,
    dailyCarbsGoal: 50,
    dailyFatGoal: 30,
    trainingGoal: 'neutral',
    dailySleepGoal: 8,
    dailyWaterGoal: 8,
    showSleep: true,
    showWater: true,
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
    // Micronutrients (per 100g)
    iron?: number;              // mg
    calcium?: number;           // mg
    zinc?: number;              // mg
    vitaminB12?: number;        // µg
    vitaminC?: number;          // mg
    vitaminA?: number;          // µg (RAE)
    // Protein Quality
    isCompleteProtein?: boolean;
    missingAminoAcids?: string[]; // e.g., ['lysine', 'methionine']
    complementaryCategories?: FoodCategory[]; // Categories that complete the protein
    proteinCategory?: ProteinCategory;        // For amino acid balancing
    seasons?: Season[];                       // Best seasons for this item
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

// ============================================
// Weekly Planning Types
// ============================================

/** Day of the week */
export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** Planned meal for a specific day and meal type */
export interface PlannedMeal {
    recipeId?: string;
    servings?: number;
    note?: string;
    /** Additional recipe IDs for multiple snacks */
    additionalRecipeIds?: string[];
    /** Ingredient swaps: originalItemId -> newItemId */
    swaps?: Record<string, string>;
    /** When this meal was cooked */
    cookedAt?: string;
    /** Whether logged to CaloriesPage */
    loggedToCalories?: boolean;
}

// ============================================
// Daily Vitality Tracking
// ============================================

/** Daily health and vitality metrics */
export interface DailyVitals {
    water: number;       // Glasses (approx 250ml)
    sleep: number;       // Hours
    caffeine?: number;   // Grams or counts (Coffee/Te/Nocco)
    updatedAt: string;
}

// ============================================
// Training & Exercise
// ============================================

/** Training goals for calorie adjustments */
export type TrainingGoal = 'neutral' | 'deff' | 'bulk';

export interface TrainingCycle {
    id: string;
    name: string;
    goal: TrainingGoal;
    startDate: string;
    endDate?: string;
    startWeight?: number;
    targetWeight?: number;
    notes?: string;
}

// ============================================
// Performance Goals (Detailed Goal Tracking)
// ============================================

/** Goal types for performance tracking */
export type PerformanceGoalType = 'frequency' | 'distance' | 'tonnage' | 'calories' | 'combination';

/** Period for goal measurement */
export type GoalPeriod = 'daily' | 'weekly';

/** Individual target within a goal */
export interface GoalTarget {
    exerciseType?: ExerciseType;  // e.g., 'strength', 'running'
    count?: number;               // For frequency goals (sessions)
    value?: number;               // For volume/calorie goals
    unit?: string;                // 'km', 'ton', 'kcal', 'sessions'
}

/** Performance goal for detailed tracking */
export interface PerformanceGoal {
    id: string;
    name: string;
    type: PerformanceGoalType;
    period: GoalPeriod;
    targets: GoalTarget[];        // Supports combination goals
    cycleId?: string;             // Link to TrainingCycle (optional)
    startDate: string;
    endDate?: string;             // Undefined = "tills vidare"
    createdAt: string;
}

/** Available exercise categories */
export type ExerciseType =
    | 'running'
    | 'cycling'
    | 'strength'
    | 'walking'
    | 'swimming'
    | 'yoga'
    | 'other';

/** Intensity levels for exercise */
export type ExerciseIntensity = 'low' | 'moderate' | 'high' | 'ultra';

/** Available sub-types for deep exercise analysis */
export type ExerciseSubType = 'default' | 'interval' | 'long-run' | 'race' | 'tonnage' | 'ultra' | 'competition';

/** Exercise tracking entry */
export interface ExerciseEntry {
    id: string;
    date: string; // ISO date string (YYYY-MM-DD)
    type: ExerciseType;
    durationMinutes: number;
    intensity: ExerciseIntensity;
    caloriesBurned: number;
    notes?: string;
    subType?: ExerciseSubType;
    tonnage?: number;   // total kg lifted
    distance?: number;  // km
    createdAt: string;
    // Integration fields (Strava/Garmin)
    externalId?: string;          // e.g., "strava_123456"
    platform?: 'strava' | 'garmin';
    heartRateAvg?: number;
    heartRateMax?: number;
    elevationGain?: number;       // meters
    prCount?: number;
    kudosCount?: number;
}

/**
 * Raw Strava activity from API
 */
export interface StravaActivity {
    id: number;
    name: string;
    type: string;
    sport_type: string;
    start_date: string;
    start_date_local: string;
    elapsed_time: number;      // seconds
    moving_time: number;       // seconds
    distance: number;          // meters
    total_elevation_gain: number; // meters
    average_heartrate?: number;
    max_heartrate?: number;
    calories?: number;
    average_speed: number;     // m/s
    max_speed: number;         // m/s
    has_heartrate: boolean;
    pr_count: number;
    kudos_count: number;
    achievement_count: number;
}

// ============================================
// Smart Coach Types
// ============================================

export interface CoachGoal {
    id: string;
    type: 'MARATHON' | 'HALF_MARATHON' | '10K' | '5K' | 'MAINTENANCE';
    targetDate: string; // ISO date string
    targetTimeSeconds?: number;
    isActive: boolean;
    createdAt: string;
}

export interface CoachConfig {
    userProfile: {
        maxHr: number;
        restingHr: number;
        recentRaceTime?: { distance: number; timeSeconds: number }; // Used for VDOT
        currentForm?: { distanceKm: number; timeSeconds: number }; // User's assessment of current 5k/10k form
    };
    preferences: {
        weeklyVolumeKm: number; // Target volume
        longRunDay: string;
        intervalDay: string;
        trainingDays: number[]; // 0-6 (Sun-Sat)
        weightGoal?: number; // Target weight for performance/health
    };
    goals: CoachGoal[];
    fineTuning?: FineTuningConfig;
}

// ============================================
// Phase 1: Fine-Tuning Configuration
// ============================================

export interface FineTuningConfig {
    sessionsPerWeek: number;           // 2-7
    loadIndex: number;                 // 1-10 intensity scale
    longRunPercentage: number;         // 15-40% of weekly volume
    easyPaceAdjustmentSec: number;     // +/- seconds per km for easy pace
    qualitySessionRatio: number;       // 0.1-0.4 (% of sessions that are hard)
    includeStrength: boolean;
    strengthDays: number[];            // 0-6 for days of week
    longRunMaxKm?: number;             // Cap for long run distance
    tempoIntensity?: 'conservative' | 'moderate' | 'aggressive';
}

export const DEFAULT_FINE_TUNING: FineTuningConfig = {
    sessionsPerWeek: 4,
    loadIndex: 5,
    longRunPercentage: 30,
    easyPaceAdjustmentSec: 0,
    qualitySessionRatio: 0.25,
    includeStrength: false,
    strengthDays: [],
    tempoIntensity: 'moderate'
};

// ============================================
// Phase 2: Strength & Cross-Training
// ============================================

export type StrengthMuscleGroup = 'legs' | 'core' | 'upper' | 'full_body' | 'mobility';

export interface StrengthExercise {
    id: string;
    name: string;
    muscleGroups: StrengthMuscleGroup[];
    sets: number;
    reps: number;
    weight?: number;
    notes?: string;
}

export interface StrengthSession {
    id: string;
    date: string;
    title: string;
    muscleGroups: StrengthMuscleGroup[];
    exercises: StrengthExercise[];
    durationMinutes: number;
    estimatedCalories: number;
    source?: 'manual' | 'strengthlog' | 'imported';
    externalId?: string; // For Strengthlog API integration
}

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


export interface PlannedActivity {
    id: string;
    goalId?: string; // Link to a specific CoachGoal
    date: string; // ISO Date (YYYY-MM-DD)
    type: 'RUN';
    category: 'LONG_RUN' | 'INTERVALS' | 'TEMPO' | 'EASY' | 'RECOVERY' | 'REPETITION';
    title: string;
    description: string;
    structure: {
        warmupKm: number;
        mainSet: { reps: number; distKm: number; pace: string; restMin: number }[];
        cooldownKm: number;
    };
    targetPace: string;
    targetHrZone: number;
    estimatedDistance: number;
    // Progress Tracking
    status: 'PLANNED' | 'COMPLETED' | 'SKIPPED';
    feedback?: 'EASY' | 'PERFECT' | 'HARD' | 'TOO_HARD' | 'INJURY';
    completedDate?: string;
    actualDistance?: number;
    actualTimeSeconds?: number;
    // Phase 2 enhancements
    scientificBenefit?: string;
    isVolumePR?: boolean;
    isLongestInPlan?: boolean;
    customScalingFactor?: number; // Scale target distances/paces (e.g. 0.85 for "piano")
}

/** Weight tracking entry */
export interface WeightEntry {
    id: string;
    date: string; // ISO date string (YYYY-MM-DD)
    weight: number; // kg
    createdAt: string;
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

// ============================================
// Form Types (for creating/editing entities)
// ============================================

export type FoodItemFormData = Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt'>;
export type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;
export type MealEntryFormData = Omit<MealEntry, 'id' | 'createdAt'>;

// ============================================
// Utility Types
// ============================================

// ============================================
// Competition Mode Types
// ============================================

export interface CompetitionRule {
    id: string;
    name: string;
    description: string;
    points: number;
    type: 'activity' | 'metric' | 'diet' | 'custom';
    presetId?: string;
}

export interface CompetitionParticipant {
    userId: string;
    name: string;
    scores: Record<string, number>; // date -> daily total points
}

export interface Competition {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    participants: CompetitionParticipant[];
    rules: CompetitionRule[];
    isDraft?: boolean;
    isPublic?: boolean;
    creatorId?: string;
    createdAt: string;
}

/** Storage structure for LocalStorage persistence */
export interface AppData {
    foodItems: FoodItem[];
    recipes: Recipe[];
    mealEntries: MealEntry[];
    weeklyPlans?: WeeklyPlan[];
    pantryItems?: string[]; // Legacy: List of ingredient names user has at home
    pantryQuantities?: PantryQuantities; // New: Item name -> quantity at home
    userSettings?: AppSettings;
    users?: User[];
    currentUserId?: string;
    coachConfig?: CoachConfig;
    plannedActivities?: PlannedActivity[];
    dailyVitals?: Record<string, DailyVitals>; // Key is YYYY-MM-DD
    exerciseEntries?: ExerciseEntry[];
    weightEntries?: WeightEntry[];
    competitions?: Competition[];
    trainingCycles?: TrainingCycle[];
    performanceGoals?: PerformanceGoal[];
}

/** Pantry quantities - maps item name (lowercase) to quantity at home */
export interface PantryQuantities {
    [itemName: string]: {
        quantity: number;
        unit: string;
    };
}

/** Generate a unique ID */
export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/** Get ISO date string (YYYY-MM-DD) in local time */
export const getISODate = (date: Date = new Date()): string => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
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

