/**
 * Strength Training Types
 * Data models for strength workouts, exercises, sets, and personal bests.
 */

// ============================================
// Exercise Definition
// ============================================

export type ExerciseCategory =
    | 'barbell'
    | 'dumbbell'
    | 'machine'
    | 'bodyweight'
    | 'cable'
    | 'kettlebell'
    | 'cardio'
    | 'other';

export type MuscleGroup =
    | 'chest'
    | 'back'
    | 'shoulders'
    | 'biceps'
    | 'triceps'
    | 'forearms'
    | 'quads'
    | 'hamstrings'
    | 'glutes'
    | 'calves'
    | 'core'
    | 'traps'
    | 'lats'
    | 'full_body';

export interface StrengthExercise {
    id: string;
    name: string;                    // "Squat", "Bench Press"
    normalizedName: string;          // Lowercase, trimmed for matching
    category: ExerciseCategory;
    primaryMuscle: MuscleGroup;
    secondaryMuscles?: MuscleGroup[];
    isCompound: boolean;
    isUnilateral?: boolean;          // Single arm/leg
    equipment?: string;              // "barbell", "smith machine"
}

// ============================================
// Set Data
// ============================================

export interface StrengthSet {
    setNumber: number;
    reps: number;
    weight: number;                  // kg (0 for bodyweight-only)

    // Bodyweight exercises
    isBodyweight?: boolean;
    bodyweight?: number;             // User's bodyweight at time
    extraWeight?: number;            // Added weight for weighted pullups etc.

    // Cardio/timed exercises
    time?: string;                   // "00:04:44" format
    timeSeconds?: number;            // Parsed seconds
    distance?: number;               // meters or km
    distanceUnit?: 'km' | 'm';

    // Machine-specific
    calories?: number;
    rpm?: number;

    // Qualitative
    rpe?: number;                    // 1-10 Rate of Perceived Exertion
    isWarmup?: boolean;
    isDropset?: boolean;
    isFailed?: boolean;              // Didn't complete target reps
}

// ============================================
// Workout Structure
// ============================================

export interface StrengthWorkoutExercise {
    exerciseId: string;              // Reference to StrengthExercise.id
    exerciseName: string;            // Denormalized for display
    sets: StrengthSet[];

    // Computed/derived
    totalVolume?: number;            // sum(reps * weight)
    topSet?: { reps: number; weight: number }; // Heaviest set
    notes?: string;
}

export interface StrengthWorkout {
    id: string;
    userId: string;
    date: string;                    // YYYY-MM-DD
    name: string;                    // "Hyrox", "Wednesday Morning: Squat"

    // User state
    bodyWeight?: number;             // kg
    shape?: number;                  // -1 to 1 (StrengthLog format)
    sleep?: number;                  // -1 to 1
    stress?: number;                 // -1 to 1

    // Exercises performed
    exercises: StrengthWorkoutExercise[];

    // Computed totals
    totalVolume: number;             // Sum of all exercise volumes
    totalSets: number;
    totalReps: number;
    uniqueExercises: number;

    // Metadata
    duration?: number;               // minutes
    notes?: string;
    source: 'strengthlog' | 'manual' | 'garmin';
    sourceWorkoutName?: string;      // Original name from import

    createdAt: string;
    updatedAt: string;
}

// ============================================
// Personal Bests
// ============================================

export type PBType = '1rm' | '3rm' | '5rm' | '10rm' | 'volume' | 'reps' | 'time' | 'distance';

export interface PersonalBest {
    id: string;
    exerciseId: string;
    exerciseName: string;            // Denormalized
    userId: string;

    type: PBType;
    value: number;                   // The PB value (weight, volume, reps, seconds)

    // Context
    weight?: number;                 // Weight used
    reps?: number;                   // Reps achieved
    date: string;
    workoutId: string;
    workoutName?: string;
    isBodyweight?: boolean;
    extraWeight?: number;

    // Computed
    estimated1RM?: number;           // Epley/Brzycki formula

    createdAt: string;
    previousBest?: number;           // For tracking improvement
}

// ============================================
// Statistics & Aggregates
// ============================================

export interface ExerciseProgress {
    exerciseId: string;
    exerciseName: string;
    dataPoints: {
        date: string;
        topSetWeight: number;
        topSetReps: number;
        totalVolume: number;
        estimated1RM: number;
    }[];
}

export interface StrengthStats {
    userId: string;
    totalWorkouts: number;
    totalSets: number;
    totalVolume: number;             // All time

    // Time-based
    workoutsThisWeek: number;
    workoutsThisMonth: number;
    volumeThisWeek: number;
    volumeThisMonth: number;

    // Muscle group distribution
    muscleGroupVolume: Record<MuscleGroup, number>;

    // Streaks
    currentStreak: number;           // Consecutive weeks with workouts
    longestStreak: number;

    lastWorkoutDate?: string;
}

// ============================================
// Import Types
// ============================================

export interface StrengthLogImportResult {
    success: boolean;
    workoutsImported: number;
    workoutsUpdated: number;
    workoutsSkipped: number;
    exercisesDiscovered: number;
    personalBestsFound: number;
    errors: string[];
}

// ============================================
// Utility Functions
// ============================================

/** Calculate estimated 1RM using Epley formula */
export function calculate1RM(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps <= 0 || weight <= 0) return 0;
    return Math.round(weight * (1 + reps / 30));
}

/** Normalize exercise name for matching */
export function normalizeExerciseName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ');
}

/** Parse time string to seconds */
export function parseTimeToSeconds(time: string): number {
    const parts = time.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

/** Generate unique ID */
export function generateStrengthId(): string {
    return `str-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
