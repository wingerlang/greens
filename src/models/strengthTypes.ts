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
    tempo?: string;                  // e.g. "2:05/500m"
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
    distance?: number;               // Distance covered (meters)
    distanceUnit?: 'm' | 'km';
    time?: number;
    tempo?: string;
    date: string;
    workoutId: string;
    workoutName?: string;
    isBodyweight?: boolean;
    extraWeight?: number;
    orderIndex?: number;            // For chronological sorting within same day
    isActual1RM?: boolean;          // reps === 1
    isHighestWeight?: boolean;       // Highest absolute weight to date

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

// ============================================
// Exercise Type Detection
// ============================================

/** Bodyweight exercises - should use actual 1RM (max reps × extra weight) not estimated */
export const BODYWEIGHT_EXERCISES = [
    'pull up', 'pullup', 'pull-up', 'chin up', 'chinup', 'chin-up', 'chins',
    'push up', 'pushup', 'push-up', 'push ups', 'armhävningar', 'armhävning',
    'dip', 'dips', 'dippar',
    'muscle up', 'muscle-up', 'muscleup',
    'pistol squat', 'pistol', 'pistols',
    'lunge', 'lunges', 'utfall',
    'burpee', 'burpees',
    'squat jump', 'jump squat', 'box jump',
    'inverted row', 'body row', 'australian pull up',
    'leg raise', 'hanging leg raise', 'toes to bar',
    'l-sit', 'l sit',
    'handstand', 'handstand push up', 'hspu',
    'nordic curl', 'nordic hamstring curl',
    'back extension', 'reverse hyper'
];

/** Time-based exercises - track duration instead of reps */
export const TIME_BASED_EXERCISES = [
    'plank', 'plankan', 'planking', 'side plank',
    'dead hang', 'hang', 'hängning',
    'wall sit', 'wall squat',
    'hollow hold', 'hollow body hold',
    'superman hold', 'superman',
    'bridge hold', 'glute bridge hold',
    'farmer walk', 'farmers walk', 'farmer carry',
    'l-sit', 'l sit',
    'handstand hold', 'handstand',
    'flexed arm hang',
    'static hold', 'statiskt håll'
];

/** Distance/cardio exercises - track distance + time */
export const DISTANCE_BASED_EXERCISES = [
    'rowing', 'rowing machine', 'rower', 'rodd',
    'ski erg', 'skierg', 'skiing',
    'assault bike', 'echo bike', 'air bike',
    'treadmill', 'löpband',
    'stationary bike', 'cycle', 'cykel',
    'running', 'löpning',
    'burpee broad jump', 'burpee broad jumps'
];

/** Weighted Distance exercises - track Weight (primary) + Distance (secondary) */
export const WEIGHTED_DISTANCE_EXERCISES = [
    'sled push', 'sled', 'sledge push', 'prowler',
    'sled pull', 'sled rope pull',
    'farmers walk', 'farmers carry', 'farmer walk', 'farmer carry',
    'yoke', 'yoke walk', 'yoke carry',
    'sandbag lunge', 'sandbag lunges', 'walking lunge', 'walking lunges', 'utfallsgång'
];

/** Hyrox specific exercises - for labeling */
export const HYROX_EXERCISES = [
    'ski erg', 'skierg',
    'sled push', 'sled', 'prowler',
    'sled pull', 'sled rope pull',
    'burpee broad jump', 'burpee broad jumps',
    'rowing', 'rowing machine', 'rodd',
    'farmers walk', 'farmers carry', 'farmer walk',
    'sandbag lunge', 'sandbag lunges', 'walking lunge', 'walking lunges', 'utfallsgång',
    'wall ball', 'wall balls', 'wallball', 'wallballs'
];

/** Check if exercise is bodyweight-based */
export function isBodyweightExercise(name: string): boolean {
    const normalized = normalizeExerciseName(name);
    return BODYWEIGHT_EXERCISES.some(bw => normalized.includes(bw));
}

/** Check if exercise is time-based (duration instead of reps) */
export function isTimeBasedExercise(name: string): boolean {
    const normalized = normalizeExerciseName(name);
    return TIME_BASED_EXERCISES.some(tb => normalized.includes(tb));
}

/** Check if exercise is distance-based (rowing, skiing, etc.) */
export function isDistanceBasedExercise(name: string): boolean {
    const normalized = normalizeExerciseName(name);
    return DISTANCE_BASED_EXERCISES.some(db => normalized.includes(db));
}

/** Check if exercise is weighted distance (heavy carry/push) */
export function isWeightedDistanceExercise(name: string): boolean {
    const normalized = normalizeExerciseName(name);
    return WEIGHTED_DISTANCE_EXERCISES.some(wd => normalized.includes(wd));
}

/** Check if exercise is a Hyrox event */
export function isHyroxExercise(name: string): boolean {
    const normalized = normalizeExerciseName(name);
    return HYROX_EXERCISES.some(h => normalized.includes(h));
}

/**
 * Calculate 1RM for bodyweight exercises.
 * For bodyweight exercises, the "1RM" is bodyweight + extra weight.
 * Returns: { used1RM: actual max weight used, estimated1RM: Epley estimate }
 */
export function calculate1RMForBodyweight(
    bodyweight: number,
    extraWeight: number,
    reps: number
): { actual1RM: number; estimated1RM: number } {
    const totalWeight = bodyweight + extraWeight;
    const estimated1RM = calculate1RM(totalWeight, reps);

    // For bodyweight, actual 1RM is just the max weight achieved (BW + extra)
    // We don't estimate because bodyweight exercises have different mechanics
    return {
        actual1RM: totalWeight,
        estimated1RM
    };
}

/**
 * Get the best set value for a time-based exercise.
 * Returns duration in seconds (longer is better).
 */
export function getTimePBValue(sets: StrengthSet[]): { seconds: number; formatted: string } | null {
    let maxSeconds = 0;

    for (const set of sets) {
        const seconds = set.timeSeconds ?? (set.time ? parseTimeToSeconds(set.time) : 0);
        if (seconds > maxSeconds) {
            maxSeconds = seconds;
        }
    }

    if (maxSeconds === 0) return null;

    // Format as mm:ss or hh:mm:ss
    const hours = Math.floor(maxSeconds / 3600);
    const mins = Math.floor((maxSeconds % 3600) / 60);
    const secs = maxSeconds % 60;

    const formatted = hours > 0
        ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`;

    return { seconds: maxSeconds, formatted };
}

