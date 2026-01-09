// ============================================
// Persistence Types
// ============================================

import { FoodItem, Recipe, MealEntry } from './nutrition.ts';
import { WeeklyPlan } from './planning.ts';
import { User, UserSettings } from './user.ts';
import { CoachConfig } from './coach.ts';
import { PlannedActivity, ExerciseEntry, UniversalActivity, StrengthSession } from './activity.ts';
import { DailyVitals, WeightEntry, SleepSession, IntakeLog, BodyMeasurementEntry, InjuryLog, RecoveryMetric } from './health.ts';
import { Competition } from './social.ts';
import { TrainingCycle } from './activity.ts';
import { PerformanceGoal, TrainingPeriod } from './goals.ts';

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
    trainingPeriods?: TrainingPeriod[];
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
    strengthSessions?: StrengthSession[];
}

/** Pantry quantities - maps item name (lowercase) to quantity at home */
export interface PantryQuantities {
    [itemName: string]: {
        quantity: number;
        unit: string;
    };
}

export interface AppSettings extends Partial<UserSettings> {
    // Legacy support or simplified settings
    calorieTarget?: number;
}
