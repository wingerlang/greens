// ============================================
// Performance Goals (Detailed Goal Tracking)
// ============================================

import { ExerciseType } from './activity.ts';

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
