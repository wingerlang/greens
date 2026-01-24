// Shared Types - Reusable across all modules
// ============================================

import { type StrengthWorkout, type StrengthSet } from './strengthTypes.ts';
import { type ExerciseDefinition } from './exercise.ts';
export type { StrengthWorkout, StrengthSet, ExerciseDefinition };

/** Unit of measurement for food items and recipe ingredients */
export type Unit = 'g' | 'ml' | 'pcs' | 'kg' | 'l' | 'cup';

/** Meal type for calorie tracking entries */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'beverage' | 'estimate';

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
    birthYear?: number;
    height?: number; // cm
    gender?: 'male' | 'female' | 'other';
    trainingGoal?: 'neutral' | 'deff' | 'bulk';
    weight?: number; // kg
    dailySleepGoal?: number;
    dailyWaterGoal?: number;
    showSleep?: boolean;
    showWater?: boolean;
    dailyCaffeineLimit?: number;
    dailyTrainingGoal?: number; // minutes
    dailyAlcoholLimitWeekday?: number;
    dailyAlcoholLimitWeekend?: number;
    densityMode?: 'compact' | 'slim' | 'cozy';
    expandedSections?: Record<string, boolean>; // Persisted UI state
    // Calorie Mode: 'tdee' = TDEE-based, 'fixed' = fixed base + exercise calories
    calorieMode?: 'tdee' | 'fixed';
    fixedCalorieBase?: number; // Base calories when calorieMode === 'fixed'
    incompleteDays?: Record<string, boolean>; // Map of date (YYYY-MM-DD) -> isIncomplete
    noccoOClockEnabled?: boolean;
    trainingPreferences?: {
        longRunThreshold?: number; // km
    };
    // New Feature Flags
    trainingInterests?: {
        running: boolean;
        strength: boolean;
        hyrox: boolean;
    };
    longRunThreshold?: number; // km
    pinnedPaths?: string[]; // Custom navbar pins
    stravaTimePreference?: 'moving' | 'elapsed';
}

/** Weekly Stats Interface */
export interface WeeklyStats {
    running: {
        sessions: number;
        km: number;
        time: number;
    };
    strength: {
        sessions: number;
        time: number;
        tonnage: number;
    };
    forecast: {
        runningSessions: number;
        runningKm: number;
        strengthSessions: number;
    };
}

/** User roles for permissions */
export type UserRole = 'admin' | 'user' | 'coach' | 'athlete' | 'developer';

/** Subscription plans for monetization */
export type SubscriptionPlan = 'free' | 'evergreen';

/** User model */
export interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    role: UserRole;
    plan: SubscriptionPlan;
    settings: UserSettings;
    householdId?: string; // For shared plans
    createdAt: string;

    // Social & Privacy (Phase 6)
    handle?: string; // Unique @handle
    bio?: string;
    location?: string;
    website?: string;
    avatarUrl?: string; // Explicit field for social
    followersCount?: number;
    followingCount?: number;
    privacy?: UserPrivacy;
}

export type VisibilityLevel = 'PUBLIC' | 'FRIENDS' | 'PRIVATE' | 'INDIVIDUAL';

export interface UserPrivacy {
    isPublic: boolean; // Base profile visibility
    allowFollowers: boolean;

    // Granular Category Sharing
    sharing: {
        training: VisibilityLevel;
        nutrition: VisibilityLevel;
        health: VisibilityLevel;
        social: VisibilityLevel;
        body: VisibilityLevel;
    };

    // Whitelisted user IDs for individual or exclusive sharing
    whitelistedUsers: string[];

    // NEW: Per-person overrides for specific categories
    // Key = userId, Value = which categories they have access to (true = allow, false = deny)
    categoryOverrides?: {
        [userId: string]: {
            training?: boolean;
            nutrition?: boolean;
            health?: boolean;
            social?: boolean;
            body?: boolean;
        };
    };

    // Specific Detail Toggles
    showWeight: boolean;
    showHeight: boolean;
    showBirthYear: boolean;
    showDetailedTraining: boolean; // Full workout vs summary
}

export const DEFAULT_PRIVACY: UserPrivacy = {
    isPublic: true,
    allowFollowers: true,
    sharing: {
        training: 'FRIENDS',
        nutrition: 'FRIENDS',
        health: 'PRIVATE',
        social: 'FRIENDS',
        body: 'PRIVATE'
    },
    whitelistedUsers: [],
    showWeight: false,
    showHeight: false,
    showBirthYear: false,
    showDetailedTraining: true
};


export const DEFAULT_USER_SETTINGS: UserSettings = {
    theme: 'dark',
    visibleMeals: ['breakfast', 'lunch', 'dinner', 'snack'],
    dailyCalorieGoal: 2000,
    dailyProteinGoal: 150,
    dailyCarbsGoal: 50,
    dailyFatGoal: 30,
    trainingGoal: 'neutral',
    weight: 80,
    dailySleepGoal: 8,
    dailyWaterGoal: 8,
    dailyCaffeineLimit: 400,
    dailyTrainingGoal: 60,
    dailyAlcoholLimitWeekday: 0,
    dailyAlcoholLimitWeekend: 2,
    showSleep: true,
    showWater: true,
    densityMode: 'cozy',
    expandedSections: {
        'recent-workouts': true,
        'top-exercises': true
    },
    noccoOClockEnabled: true,
    trainingPreferences: {
        longRunThreshold: 20 // Default based on user request, or could be undefined to use smart default
    },
    trainingInterests: {
        running: true,
        strength: true,
        hyrox: true
    },
    longRunThreshold: 20,
    pinnedPaths: []
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

    // Variants (Flavors/Types)
    variants?: FoodVariant[];

    // Protein Quality
    isCompleteProtein?: boolean;
    missingAminoAcids?: string[]; // e.g., ['lysine', 'methionine']
    complementaryCategories?: FoodCategory[]; // Categories that complete the protein
    proteinCategory?: ProteinCategory;        // For amino acid balancing
    seasons?: Season[];                       // Best seasons for this item
    ingredients?: string;                     // List of ingredients
    createdAt: string;
    updatedAt: string;
    createdBy?: string; // User ID of the creator
    deletedAt?: string;                       // For 3-month quarantine (Soft Delete)
}

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
    alcohol?: number;            // % vol
    // Add others if present in DB
}

/**
 * FoodVariant - A specific variant/flavor of a food item
 */
export interface FoodVariant {
    id: string;
    name: string; // e.g. "Päron", "Carnival", "Original"

    // Optional overrides
    nutrition?: Partial<NutritionSummary>; // Overrides for Kcal, Protein, etc.
    caffeine?: number; // mg
    alcohol?: number; // % vol
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
    type: 'recipe' | 'foodItem' | 'estimate';
    referenceId: string;
    servings: number;
    // New fields for enhanced calorie tracking
    verified?: boolean;              // User has confirmed this entry
    sourceRecipeId?: string;         // If auto-added from weekly plan
    portionType?: 'serving' | 'weight';  // How to calculate
    weightGrams?: number;            // For weight-based portions
    componentLabel?: string;         // "Gryta", "Ris", etc.
    loggedAsCooked?: boolean;        // If true, divide kcal by yieldFactor (raw→cooked conversion)
    effectiveYieldFactor?: number;   // The yield factor used for calorie calculation when loggedAsCooked
    variantId?: string;              // Specific variant ID if applicable

    // For type: 'estimate'
    estimateDetails?: {
        name: string;
        caloriesMin: number;
        caloriesMax: number;
        caloriesAvg: number;
        protein?: number;
        carbs?: number;
        fat?: number;
        uncertaintyEmoji?: string;
    };
}

/**
 * MealEntry - Daily meal tracking entry
 */
export interface MealEntry {
    id: string;
    date: string;  // ISO date string (YYYY-MM-DD)
    mealType: MealType;
    items: MealItem[];
    title?: string; // Optional title for the meal (e.g. "Breakfast Sandwich")
    snabbvalId?: string; // ID of the quick meal used to create this entry
    pieces?: number; // How many of this snabbval were consumed (default 1)
    createdAt: string;
}

export interface QuickMeal {
    id: string;
    userId: string;
    name: string;
    items: MealItem[];
    createdAt: string;
}

import type { RaceProfile, RunnerProfile, IntakeEvent, PacingStrategy } from '../utils/racePlannerCalculators.ts';

export interface RacePlan {
    id: string;
    userId: string;
    name: string;
    createdAt: string;
    updatedAt: string;

    // Config
    raceProfile: RaceProfile;
    runnerProfile: RunnerProfile;
    environment: {
        temperatureC: number;
        humidityPercent: number;
        sunsetTime?: string;
    };

    // Strategy
    pacingStrategy: PacingStrategy;

    // Logistics
    intakeEvents: IntakeEvent[];
    dropbagKms: number[];
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
    alcohol?: number;    // Units
    incomplete?: boolean; // If true, this day is marked as unfinished (e.g. forgot to log food)
    completed?: boolean; // If true, this day is explicitly marked as complete/closed
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
export type PerformanceGoalType =
    | 'frequency'    // X sessions per period
    | 'distance'     // X km per period
    | 'tonnage'      // X tons per period
    | 'calories'     // Burn X kcal per period
    | 'speed'        // X distance in Y time
    | 'combination'  // Multiple targets
    | 'milestone'    // One-time achievement (e.g., run 1000km lifetime)
    | 'streak'       // Consecutive days/weeks with activity
    | 'pb'           // Personal best (e.g., 100kg bench)
    | 'nutrition'    // Macro/calorie goals
    | 'weight'       // Target body weight
    | 'measurement'; // Body measurements (waist, hip, arm, etc)

/** Period for goal measurement */
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'once';

/** Goal category for organization */
export type GoalCategory = 'training' | 'nutrition' | 'body' | 'lifestyle';

/** Goal status */
export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed';

/** Individual target within a goal */
export interface GoalTarget {
    exerciseType?: ExerciseType;  // e.g., 'strength', 'running'
    count?: number;               // For frequency goals (sessions)
    value?: number;               // For volume/calorie goals
    unit?: string;                // 'km', 'ton', 'kcal', 'sessions', 's'
    timeSeconds?: number;         // For speed/time goals
    distanceKm?: number;          // For speed goals (e.g., target 5.0 km)
    // Extended targets:
    exerciseName?: string;        // For specific exercise PBs (e.g., "Marklyft")
    nutritionType?: 'protein' | 'carbs' | 'fat' | 'calories';  // For nutrition goals
}

/** Performance goal for detailed tracking */
export interface PerformanceGoal {
    id: string;
    userId: string; // Owner of the goal
    name: string;
    type: PerformanceGoalType;
    period: GoalPeriod;
    targets: GoalTarget[];        // Supports combination goals
    cycleId?: string;             // Link to TrainingCycle (optional)
    startDate: string;
    endDate?: string;             // Undefined = "tills vidare"
    createdAt: string;
    // Extended fields for Goals 2.0:
    category: GoalCategory;
    status: GoalStatus;
    icon?: string;                // Custom emoji/icon
    color?: string;               // Custom accent color
    description?: string;         // User notes about the goal
    completedAt?: string;         // When goal was achieved
    progressHistory?: { date: string; value: number }[];  // Historical tracking
    streakCurrent?: number;       // Current streak count
    streakBest?: number;          // All-time best streak
    milestoneValue?: number;      // Target for milestone/pb goals
    milestoneUnit?: string;       // Unit for milestone (km, kg, etc)
    milestoneProgress?: number;   // Current progress toward milestone
    nutritionMacros?: {           // For nutrition goals
        protein?: number;
        carbs?: number;
        fat?: number;
        calories?: number;
    };
    targetWeight?: number;        // For weight goals (target kg)
    targetWeightRate?: number;    // Rate of change (kg per week)
    targetMeasurement?: number;   // For measurement goals (target cm)
    measurementType?: 'waist' | 'hip' | 'chest' | 'arm' | 'thigh' | 'neck';
    goalDirection?: 'up' | 'down' | 'stable';
    periodId?: string;            // Link to TrainingPeriod
}

// ============================================
// Training Periods (Goals 2.0)
// ============================================

export type PeriodFocus = 'weight_loss' | 'strength' | 'endurance' | 'general' | 'habit';

export interface TrainingPeriod {
    id: string;
    userId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    focusType: PeriodFocus;
    nutritionGoal?: {
        calories: number;
        protein?: number;
        carbs?: number;
        fat?: number;
    };
    createdAt: string;
    updatedAt: string;
}

/** Available exercise categories */
export type ExerciseType =
    | 'running'
    | 'cycling'
    | 'strength'
    | 'walking'
    | 'swimming'
    | 'yoga'
    | 'hyrox'
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
    calorieBreakdown?: string;
    notes?: string;
    excludeFromStats?: boolean;
    elapsedTimeSeconds?: number;
    subType?: ExerciseSubType;
    title?: string; // e.g. "Morning Run" or "Strava Activity Title"
    tonnage?: number;   // total kg lifted
    totalSets?: number;
    totalReps?: number;
    // Cycling / Performance
    averageWatts?: number;
    maxWatts?: number;
    averageSpeed?: number; // km/h
    distance?: number;  // km
    startTime?: string; // HH:mm format local start time
    createdAt: string;
    source?: string;
    location?: string; // Optional location string (e.g. "Båstad", "Göteborg")
    // Integration fields (Strava/Garmin)
    externalId?: string;          // e.g., "strava_123456"
    overridesActivityId?: string; // ID of activity this manual entry supersedes (e.g., to "tag" a Strava activity locally)
    platform?: 'strava' | 'garmin';
    heartRateAvg?: number;
    heartRateMax?: number;
    elevationGain?: number;       // meters
    prCount?: number;
    kudosCount?: number;
    achievementCount?: number;
    maxSpeed?: number;
    kilojoules?: number;

    // Hyrox Specifics (Phase 8)
    hyroxStats?: HyroxActivityStats;
}

export type HyroxStation =
    | 'ski_erg'
    | 'sled_push'
    | 'sled_pull'
    | 'burpee_broad_jumps'
    | 'rowing'
    | 'farmers_carry'
    | 'sandbag_lunges'
    | 'wall_balls'
    | 'run_1km';

export interface HyroxActivityStats {
    totalTime?: number;
    stations?: Partial<Record<HyroxStation, number>>; // time in seconds
    stationDistances?: Partial<Record<HyroxStation, number>>; // In meters (custom)
    runSplits?: number[]; // 8 x 1km splits
}

/**
 * Race Definition for Aliasing and Grouping
 */
export interface RaceDefinition {
    id: string;
    name: string; // Canonical Name (e.g. "Göteborgsvarvet")
    aliases: string[]; // Fuzzy match strings (e.g. "Gbg varvet", "Göteborgs Varvet")
    distance?: number; // Canonical distance in km
    location?: string;
    website?: string;
}

/**
 * Rules for excluding activities from Race List automatically
 */
export interface RaceIgnoreRule {
    id: string;
    pattern: string; // Regex or string match
    matchType: 'exact' | 'contains' | 'regex';
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
    excludeFromStats?: boolean;
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

export type StrengthMuscleGroup = 'legs' | 'chest' | 'back' | 'arms' | 'shoulders' | 'core' | 'full_body' | 'mobility';

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

// ============================================
// Phase 3: Feedback & Adaptation
// ============================================

export type RPE = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FeedbackEntry {
    id: string;
    activityId: string;
    date: string;
    // Core metrics
    rpe: RPE;
    perceivedDifficulty: 'EASY' | 'PERFECT' | 'HARD' | 'TOO_HARD';
    // Body state
    sleepQuality?: 1 | 2 | 3 | 4 | 5;
    stressLevel?: 1 | 2 | 3 | 4 | 5;
    musclesSoreness?: 'none' | 'mild' | 'moderate' | 'severe';
    injuryFlag?: boolean;
    injuryLocation?: string;
    // Qualitative
    notes?: string;
    mood?: 'great' | 'good' | 'neutral' | 'low' | 'terrible';
    createdAt: string;
}

export interface FatigueTrend {
    date: string;
    fatigueScore: number;    // 0-100, computed from RPE, sleep, stress
    acuteLoad: number;       // Rolling 7-day load
    chronicLoad: number;     // Rolling 28-day load
    trainingStressBalance: number; // TSB = CTL - ATL
}

export interface AdaptationSuggestion {
    id: string;
    type: 'reduce_volume' | 'add_recovery' | 'reduce_intensity' | 'injury_risk' | 'overtraining_risk';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    suggestedAction?: string;
    affectedDates?: string[];
    createdAt: string;
    dismissed?: boolean;
}

// ============================================
// Phase 4: Coach-Athlete Mode
// ============================================

export interface CoachAthleteRelation {
    id: string;
    coachId: string;
    athleteId: string;
    coachName?: string;
    athleteName?: string;
    status: 'pending' | 'active' | 'declined' | 'removed';
    sharedPlanIds: string[];
    permissions: {
        canViewPlan: boolean;
        canEditPlan: boolean;
        canViewProgress: boolean;
        canComment: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

export interface Comment {
    id: string;
    parentId?: string;        // For nested replies
    targetType: 'activity' | 'plan' | 'goal';
    targetId: string;
    authorId: string;
    authorName: string;
    authorRole: 'coach' | 'athlete';
    content: string;
    reactions?: { emoji: string; count: number; userIds: string[] }[];
    createdAt: string;
    updatedAt?: string;
    isEdited?: boolean;
}

export interface Notification {
    id: string;
    userId: string;
    type: 'comment' | 'feedback' | 'plan_shared' | 'plan_updated' | 'invitation' | 'reminder';
    title: string;
    message: string;
    relatedId?: string;
    relatedType?: 'activity' | 'plan' | 'goal' | 'athlete';
    isRead: boolean;
    createdAt: string;
}

export interface SharedPlan {
    id: string;
    planOwnerId: string;
    sharedWithIds: string[];
    visibility: 'private' | 'shared' | 'public';
    allowComments: boolean;
    allowForks: boolean;
    createdAt: string;
}

// ============================================
// Phase 5: Social & Community Features
// ============================================

export type PlanDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type PlanGoalType = '5K' | '10K' | 'half_marathon' | 'marathon' | 'ultra' | 'base_building' | 'custom';

export interface PlanTemplate {
    id: string;
    title: string;
    description: string;
    creatorId: string;
    creatorName: string;
    // Plan metadata
    goalType: PlanGoalType;
    difficulty: PlanDifficulty;
    durationWeeks: number;
    weeklyVolumeRange: { min: number; max: number };
    sessionsPerWeek: number;
    // Template structure (relative days, not absolute dates)
    weekTemplates: {
        weekNumber: number;
        phase: 'base' | 'build' | 'peak' | 'taper';
        targetVolumeKm: number;
        sessions: {
            dayOfWeek: number; // 0-6
            category: PlannedActivity['category'];
            title: string;
            description: string;
            distanceKm: number;
            paceDescription: string;
        }[];
    }[];
    // Social
    visibility: 'private' | 'public';
    forkCount: number;
    likeCount: number;
    rating?: number;
    tags: string[];
    version: number;
    changelog?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface LeaderboardEntry {
    userId: string;
    userName: string;
    avatarUrl?: string;
    rank: number;
    // Stats
    weeklyVolumeKm: number;
    monthlyVolumeKm: number;
    currentStreak: number;
    prCount: number;
    completionRate: number;
    // Badges
    badges: { type: string; name: string; icon: string }[];
    lastActiveDate: string;
}

// ============================================
// Phase 7: Recovery & Injury Hub ("The Physio-AI")
// ============================================

export type BodyPart =
    | 'neck' | 'shoulders' | 'upper_back' | 'lower_back' | 'chest' | 'abs'
    | 'glutes' | 'hips' | 'quads' | 'hamstrings' | 'calves' | 'shins' | 'adductors' | 'abductors'
    | 'knees' | 'ankles' | 'feet'
    | 'biceps' | 'triceps' | 'forearms' | 'wrist' | 'hands';

export type InjuryType = 'pain' | 'soreness' | 'tightness' | 'injury' | 'fatigue';
export type InjuryStatus = 'active' | 'recovering' | 'healed' | 'chronic';
export type PainLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface InjuryLog {
    id: string;
    userId: string;
    date: string; // ISO date
    bodyPart: BodyPart;
    side: 'left' | 'right' | 'both' | 'center';
    type: InjuryType;
    severity: PainLevel;
    status: InjuryStatus;
    notes?: string;

    // Correlated Activity (e.g., "Hände ont efter Marklyft")
    relatedActivityId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RecoveryMetric {
    id: string;
    userId: string;
    date: string;

    // Subjective Scores (1-10)
    sorenessScore: number; // 1 = Fresh, 10 = Broken
    fatigueScore: number;  // 1 = Energetic, 10 = Exhausted
    sleepQuality: number;  // 1 = Terrible, 10 = Perfect
    stressLevel: number;   // 1 = Zen, 10 = Panic
    mood: number;          // 1 = Depressed, 10 = Euphoric

    // Calculated
    readinessScore?: number; // 0-100 (Computed from above + Training Load)

    notes?: string;
}

// ============================================
// Universal Activity Model (Database Overhaul)
// ============================================

export type ActivityStatus = 'PLANNED' | 'COMPLETED' | 'SKIPPED' | 'MISSED' | 'CHANGED';
export type DataSource = 'strava' | 'garmin' | 'apple_health' | 'manual' | 'unknown' | 'strength';
export type ActivitySource = DataSource;
/**
 * The Data Source for a specific part of the activity.
 * e.g., Plan came from "Coach", Performance came from "Strava"
 */
export interface DataSourceInfo {
    source: DataSource;
    externalId?: string;
    importedAt?: string;
}

/**
 * Phase 1: The Plan
 * Defines what was intended to be done.
 */
export interface ActivityPlanSection {
    // Core Identity
    title: string;
    description?: string;
    activityType: ExerciseType; // 'running', 'cycling', etc.
    activityCategory?: PlannedActivity['category']; // 'LONG_RUN', 'INTERVALS' etc.
    source?: string;

    // Usage in Coach Logic
    templateId?: string; // If this came from a reusable plan template
    trainingPlanId?: string; // ID of the specific active plan instance

    // Planned Metrics
    distanceKm: number;
    durationMinutes?: number;
    targetPace?: string;   // e.g. "5:30/km"
    targetHrZone?: number; // 1-5

    // Structured Workout Data
    structure?: {
        warmupKm: number;
        mainSet: { reps: number; distKm: number; pace: string; restMin: number }[];
        cooldownKm: number;
    };
}

/**
 * Phase 2: The Performance (Execution)
 * Defines what was actually done.
 */
export interface ActivityPerformanceSection {
    // Provenance
    source?: DataSourceInfo;

    // Core Metrics
    activityType?: ExerciseType; // Captures actual performed type (e.g. walked instead of ran)
    startTimeLocal?: string; // Full ISO timestamp for time-of-day analysis
    durationMinutes: number;
    elapsedTimeSeconds?: number;
    distanceKm?: number;
    calories: number;
    calorieBreakdown?: string;
    excludeFromStats?: boolean;

    // Physiological
    avgHeartRate?: number;
    maxHeartRate?: number;
    elevationGain?: number;

    // Cycling / Advanced
    averageWatts?: number;
    maxWatts?: number;
    averageSpeed?: number; // km/h
    maxSpeed?: number;     // km/h
    kilojoules?: number;
    kudosCount?: number;
    achievementCount?: number;

    // Qualitative (RPE/Feel) - Moved to Analysis or here? 
    // Usually RPE is subjective 'performance' data.
    rpe?: number; // 1-10
    feel?: 'good' | 'average' | 'bad';
    notes?: string;
    subType?: ExerciseSubType;
    splits?: Array<{
        split: number;
        distance: number;
        elapsedTime: number;
        movingTime: number;
        elevationDiff: number;
        averageSpeed: number;
        averageHeartrate?: number;
    }>;
    prCount?: number;
}

/**
 * Phase 3: Analysis & Insights
 * Computed derived values.
 */
export interface ActivityAnalysisSection {
    complianceScore?: number; // 0-100% match with Plan
    effortScore?: number; // e.g. Relative Effort
    trainingLoad?: {
        score: number; // TSS
        type: 'hr' | 'pace' | 'power';
    };
    benefits?: string[]; // "Improved Aerobic Base"
    badges?: string[]; // "Fastest 5k this year"
}

/**
 * Universal Activity Entity
 * Merges PlannedActivity and ExerciseEntry into one Source of Truth.
 */
export interface UniversalActivity {
    id: string;
    userId: string;
    date: string; // ISO YYYY-MM-DD

    // High-level status
    status: ActivityStatus;

    // The Three Pillars
    plan?: ActivityPlanSection;
    performance?: ActivityPerformanceSection;
    analysis?: ActivityAnalysisSection;

    // Merge tracking (for combined activities)
    mergeInfo?: {
        isMerged: boolean;
        originalActivityIds: string[];  // IDs of activities that were merged
        mergedAt: string;               // ISO timestamp when merge occurred
    };

    // If this activity was merged INTO another, hide it from views
    // This ID points to the merged activity that replaced this one
    mergedIntoId?: string;

    createdAt: string;
    updatedAt: string;
}

// ============================================
// Phase 6: Analytics & AI Insights
// ============================================

export interface TrainingLoadData {
    date: string;
    // Training Impulse (TRIMP)
    trimp: number;
    // Training Stress Score (TSS-like)
    tss: number;
    // Chronic Training Load (fitness)
    ctl: number;
    // Acute Training Load (fatigue)
    atl: number;
    // Training Stress Balance (form)
    tsb: number;
    // Activity details
    distanceKm: number;
    durationMinutes: number;
    avgHeartRate?: number;
    category?: PlannedActivity['category'];
}

export interface PerformanceTrend {
    date: string;
    pacePerKm: number;
    avgHeartRate: number;
    efficiency: number; // pace / HR ratio
    vdot?: number;
}

export interface AICoachTip {
    id: string;
    type: 'insight' | 'warning' | 'celebration' | 'suggestion';
    category: 'volume' | 'intensity' | 'recovery' | 'nutrition' | 'form' | 'motivation';
    title: string;
    message: string;
    actionable?: { label: string; action: string };
    priority: number;
    createdAt: string;
    expiresAt?: string;
    dismissed?: boolean;
}

export interface PlannedActivity {
    id: string;
    goalId?: string; // Link to a specific CoachGoal
    date: string; // ISO Date (YYYY-MM-DD)
    type: 'RUN' | 'STRENGTH' | 'HYROX' | 'BIKE' | 'REST' | 'OTHER';
    category: 'LONG_RUN' | 'INTERVALS' | 'TEMPO' | 'EASY' | 'RECOVERY' | 'REPETITION' | 'STRENGTH' | 'REST' | 'RACE';
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
    // Strength specific fields
    tonnage?: number;
    muscleGroups?: StrengthMuscleGroup[];
    // Progress Tracking
    status: 'PLANNED' | 'COMPLETED' | 'SKIPPED' | 'DRAFT' | 'CHANGED';
    feedback?: 'EASY' | 'PERFECT' | 'HARD' | 'TOO_HARD' | 'INJURY';
    completedDate?: string;
    actualDistance?: number;
    actualTimeSeconds?: number;
    // Phase 2 enhancements
    scientificBenefit?: string;
    isVolumePR?: boolean;
    isLongestInPlan?: boolean;
    customScalingFactor?: number; // Scale target distances/paces (e.g. 0.85 for "piano")
    isRace?: boolean;
    externalId?: string; // Reference to the activity that completed this plan
    raceUrl?: string;

    hyroxFocus?: 'hybrid' | 'strength' | 'cardio';
    startTime?: string; // HH:mm
    includesRunning?: boolean;

    reconciliation?: {
        score?: number;
        matchReason?: string;
        bestCandidateId?: string;
        reconciledAt?: string;
    };

    // Race Specific Details (Metadata)
    raceDetails?: RaceDetails;
}

export interface RaceDetails {
    goals?: {
        a?: string; // Dream goal (e.g., "Sub 3:00")
        b?: string; // Realistic goal (e.g., "Sub 3:15")
        c?: string; // Safe/Bailout goal (e.g., "Finish")
    };
    logistics?: {
        location?: string;
        bibNumber?: string;
        travelInfo?: string;
        accommodation?: string;
    };
    checklist?: {
        id: string;
        item: string;
        checked: boolean;
        category: 'gear' | 'nutrition' | 'logistics' | 'other';
    }[];
    strategy?: {
        pacingPlan?: string;    // e.g. "Negative split"
        fuelingPlan?: string;   // e.g. "Gel every 30m"
        weatherNotes?: string;  // e.g. "Expected rain, wear cap"
    };
}

/** Weight and body measurements tracking entry */
export interface WeightEntry {
    id: string;
    date: string; // ISO date string (YYYY-MM-DD)
    weight: number; // kg
    waist?: number; // cm
    chest?: number; // cm
    hips?: number; // cm
    thigh?: number; // cm
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
    snabbvalId?: string;
    pieces?: number; // How many of this snabbval were consumed (default 1)
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
    trainingPeriods?: TrainingPeriod[];
    performanceGoals?: PerformanceGoal[];
    racePlans?: RacePlan[];
    plannedActivities?: PlannedActivity[];
    dailyVitals?: Record<string, DailyVitals>; // Key is YYYY-MM-DD
    exerciseEntries?: ExerciseEntry[];
    weightEntries?: WeightEntry[];
    competitions?: Competition[];
    trainingCycles?: TrainingCycle[];
    // Phase 8
    sleepSessions?: SleepSession[];
    intakeLogs?: IntakeLog[];
    universalActivities?: UniversalActivity[];
    // Phase 7: Physio-AI
    injuryLogs?: InjuryLog[];
    recoveryMetrics?: RecoveryMetric[];
    // Phase Legacy+ (Body)
    bodyMeasurements?: BodyMeasurementEntry[];
    // Phase 12: Strength Sessions
    strengthSessions?: StrengthWorkout[];

    // Quick Meals & Aliases
    quickMeals?: QuickMeal[];
    foodAliases?: Record<string, string>; // foodId -> alias

    exercises?: ExerciseDefinition[]; // Central exercise database

    // Activity Log
    databaseActions?: DatabaseAction[];
}

// ============================================
// Database Action Tracking
// ============================================

export type DatabaseActionType =
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE';

export type DatabaseEntityType =
    | 'food_item'
    | 'recipe'
    | 'meal_entry'
    | 'weight_entry'
    | 'exercise_entry'
    | 'weekly_plan'
    | 'quick_meal'
    | 'strength_session'
    | 'goal'
    | 'period'
    | 'body_measurement'
    | 'other';

export interface DatabaseAction {
    id: string;
    timestamp: string; // ISO
    userId?: string;
    actionType: DatabaseActionType;
    entityType: DatabaseEntityType;
    entityId: string;
    entityName?: string; // e.g., "Havregryn" or "Pasta Marinara"
    metadata?: Record<string, any>; // Extra context
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
    l: 'liter',
    cup: 'kopp'
};

/** Meal type display labels (Swedish) */
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
    breakfast: 'Frukost',
    lunch: 'Lunch',
    dinner: 'Middag',
    snack: 'Mellanmål',
    beverage: 'Dryck',
    estimate: 'Estimering 🤷',
};

/** Meal type colors for UI */
export const MEAL_TYPE_COLORS: Record<MealType, string> = {
    breakfast: 'text-amber-400 bg-amber-500/10',
    lunch: 'text-sky-400 bg-sky-500/10',
    dinner: 'text-emerald-400 bg-emerald-500/10',
    snack: 'text-violet-400 bg-violet-500/10',
    beverage: 'text-cyan-400 bg-cyan-500/10',
    estimate: 'text-orange-400 bg-orange-500/10',
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

    // Bio & Goals
    height?: number;
    birthYear?: number;
    gender?: 'male' | 'female' | 'other';
    dailyCalorieGoal?: number;
    dailyProteinGoal?: number;
    dailyCarbsGoal?: number;
    dailyFatGoal?: number;
    dailySleepGoal?: number;
    dailyWaterGoal?: number;
    dailyStepGoal?: number;
    dailyCaffeineMax?: number;
    dailyTrainingGoal?: number;
    noccoOClockEnabled?: boolean;
    densityMode?: 'compact' | 'slim' | 'cozy';

    // Training Logic Flags
    trainingInterests?: {
        running: boolean;
        strength: boolean;
        hyrox: boolean;
    };
    longRunThreshold?: number; // km
    incompleteDays?: Record<string, boolean>; // Map of date (YYYY-MM-DD) -> isIncomplete
    stravaTimePreference?: 'moving' | 'elapsed';
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
    supplements: 'Kosttillskott',
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

// ============================================
// Phase 8: Data Persistence & Deep Integration (Garmin/Strava)
// ============================================

export type SleepStage = 'deep' | 'light' | 'rem' | 'awake';

export interface SleepSession {
    id: string;
    date: string; // YYYY-MM-DD
    startTime: string; // ISO
    endTime: string; // ISO
    durationSeconds: number;
    score?: number; // 0-100
    source: ActivitySource;
    stages?: {
        deepSeconds: number;
        lightSeconds: number;
        remSeconds: number;
        awakeSeconds: number;
    };
    efficiency?: number; // 0-100%
}

export interface IntakeLog {
    id: string;
    userId: string;
    type: 'caffeine' | 'water' | 'alcohol' | 'medication';
    amount: number;
    unit: string;
    timestamp: string; // ISO
    source: ActivitySource;
}


// ============================================
// Phase 9: Physio-AI / Rehab Content
// ============================================

export interface RehabExercise {
    id: string;
    name: string;
    description: string;
    reps: string; // "3x10" or "2 min"
    videoUrl?: string; // YouTube ID or similar
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface RehabRoutine {
    id: string;
    title: string;
    description: string;
    tags: BodyPart[]; // Which parts this helps
    condition?: InjuryType; // e.g., 'tightness', 'pain'
    exercises: RehabExercise[];
    estimatedDurationMin: number;
}

// ============================================
// Body Measurements (Phase Legacy+)
// ============================================

export type BodyMeasurementType =
    | 'waist'       // Midja
    | 'hips'        // Höft
    | 'chest'       // Bröst
    | 'arm_left'    // Vänster arm
    | 'arm_right'   // Höger arm
    | 'thigh_left'  // Vänster lår
    | 'thigh_right' // Höger lår
    | 'calf_left'   // Vänster vad
    | 'calf_right'  // Höger vad
    | 'neck'        // Nacke
    | 'shoulders'   // Axlar
    | 'forearm_left' // Vänster underarm
    | 'forearm_right'; // Höger underarm

export interface BodyMeasurementEntry {
    id: string;
    date: string; // ISO Date YYYY-MM-DD
    type: BodyMeasurementType;
    value: number; // cm
    notes?: string;
    createdAt: string;
}

// ============================================
// Phase 10: Usage Analytics
// ============================================

export interface PageView {
    id: string;
    userId: string;
    sessionId: string;
    path: string;
    timestamp: string; // ISO
    durationSeconds?: number; // Calculated on exit
    userAgent?: string;
}

export interface InteractionEvent {
    id: string;
    userId: string;
    sessionId: string;
    type: 'click' | 'submit' | 'change' | 'other' | 'omnibox_search' | 'omnibox_log' | 'omnibox_nav' | 'quick_add_log' | 'estimate_lunch_log' | 'error' | 'rage_click' | 'dead_click';
    target: string; // e.g., "button", "a", "input"
    label: string; // e.g., "Save Workout", "Log Out"
    path: string; // Where it happened
    timestamp: string;
    metadata?: Record<string, any>;
    coordinates?: {
        x: number; // ClientX: relative to viewport
        y: number; // ClientY
        pctX: number; // 0-100% of viewport width
        pctY: number; // 0-100% of viewport height
        viewportW: number;
        viewportH: number;
    };
}

export interface AnalyticsSession {
    id: string;
    userId: string;
    startTime: string; // ISO
    endTime?: string;
    userAgent: string;
    screenSize?: string;
    platform?: string;
}

export interface AnalyticsStats {
    totalPageViews: number;
    totalEvents: number;
    popularPages: { path: string; count: number; avgTime: number }[];
    popularInteractions: { label: string; count: number }[];
    activeUsers24h: number;
    // Phase 2 Metrics
    moduleStats?: Record<string, number>;
    conversionStats?: {
        meals: { planned: number; logged: number };
        training: { planned: number; completed: number };
    };
    sessionDepth?: number; // avg events per view
    deviceBreakdown?: Record<string, number>;
    browserBreakdown?: Record<string, number>;
}
