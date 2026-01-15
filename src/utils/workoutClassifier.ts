/**
 * Workout Classifier
 * Classifies strength workouts into categories: Push, Pull, Legs, Mixed
 * Based on the exercises performed and their muscle groups.
 */

import { type MuscleGroup, type WorkoutCategory, type StrengthWorkout, normalizeExerciseName } from '../models/strengthTypes.ts';
import { INITIAL_EXERCISE_MAPPINGS } from '../data/initialExerciseMappings.ts';

// ============================================
// Category Definitions
// ============================================

export const WORKOUT_CATEGORY_INFO: Record<WorkoutCategory, {
    label: string;
    labelSe: string;
    icon: string;
    color: string;
    bgColor: string;
}> = {
    push: {
        label: 'Push',
        labelSe: 'Push',
        icon: '💪',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10'
    },
    pull: {
        label: 'Pull',
        labelSe: 'Pull',
        icon: '🔙',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10'
    },
    legs: {
        label: 'Legs',
        labelSe: 'Ben',
        icon: '🦵',
        color: 'text-rose-400',
        bgColor: 'bg-rose-500/10'
    },
    mixed: {
        label: 'Mixed',
        labelSe: 'Mix',
        icon: '🔄',
        color: 'text-violet-400',
        bgColor: 'bg-violet-500/10'
    },
    other: {
        label: 'Other',
        labelSe: 'Övrigt',
        icon: '🏋️',
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/10'
    }
};

// ============================================
// Muscle Group to Category Mapping
// ============================================

export const MUSCLE_TO_CATEGORY: Record<MuscleGroup, WorkoutCategory> = {
    // Push muscles
    chest: 'push',
    shoulders: 'push',
    triceps: 'push',

    // Pull muscles
    back: 'pull',
    lats: 'pull',
    biceps: 'pull',
    traps: 'pull',

    // Leg muscles
    quads: 'legs',
    hamstrings: 'legs',
    glutes: 'legs',
    calves: 'legs',

    // Mixed/Other
    core: 'mixed',
    forearms: 'mixed',
    full_body: 'mixed'
};

// ============================================
// Title-based Keywords
// ============================================

const TITLE_KEYWORDS: Record<WorkoutCategory, string[]> = {
    push: [
        'push', 'chest', 'bröst', 'axel', 'shoulder', 'tricep', 'tryck',
        'bench', 'bänk', 'press', 'överkropp push'
    ],
    pull: [
        'pull', 'back', 'rygg', 'bicep', 'lat', 'drag', 'row', 'rodd',
        'chin', 'pullup', 'pull-up', 'överkropp pull'
    ],
    legs: [
        'leg', 'ben', 'squat', 'böj', 'knäböj', 'deadlift', 'marklyft',
        'quad', 'hamstring', 'glute', 'rumpa', 'säte', 'lårcurl',
        'underkropp', 'lower body'
    ],
    mixed: [
        'full body', 'helkropp', 'hyrox', 'crossfit', 'functional',
        'circuit', 'total body', 'mix'
    ],
    other: []
};

// ============================================
// Classification Functions
// ============================================

/**
 * Get workout category from workout title using keyword matching.
 * Returns null if no strong match is found.
 */
export function getWorkoutCategoryFromTitle(title: string): WorkoutCategory | null {
    const normalizedTitle = title.toLowerCase();

    for (const [category, keywords] of Object.entries(TITLE_KEYWORDS)) {
        for (const keyword of keywords) {
            if (normalizedTitle.includes(keyword)) {
                return category as WorkoutCategory;
            }
        }
    }

    return null;
}

/**
 * Get the MuscleGroup for an exercise name.
 * Uses stored mappings first, then falls back to initial mappings.
 */
export function getExerciseMuscleGroup(
    exerciseName: string,
    customMappings?: Record<string, MuscleGroup>
): MuscleGroup | null {
    const normalized = normalizeExerciseName(exerciseName);

    // Check custom mappings first (from user/db)
    if (customMappings?.[normalized]) {
        return customMappings[normalized];
    }

    // Check initial mappings
    if (INITIAL_EXERCISE_MAPPINGS[normalized]) {
        return INITIAL_EXERCISE_MAPPINGS[normalized];
    }

    // Try partial matching
    for (const [key, muscle] of Object.entries(INITIAL_EXERCISE_MAPPINGS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return muscle;
        }
    }

    return null;
}

/**
 * Classify a workout based on its exercises.
 * Uses volume-weighted calculation: if ≥70% of volume belongs to one category, assign it.
 * Otherwise, classify as 'mixed'.
 */
export function classifyWorkout(
    workout: StrengthWorkout,
    customMappings?: Record<string, MuscleGroup>
): WorkoutCategory {
    // 1. First, check if title strongly suggests a category
    const titleCategory = getWorkoutCategoryFromTitle(workout.name);

    // 2. If no exercises, use title-based or fallback
    if (!workout.exercises || workout.exercises.length === 0) {
        return titleCategory || 'other';
    }

    // 3. Calculate volume per category
    const categoryVolume: Record<WorkoutCategory, number> = {
        push: 0,
        pull: 0,
        legs: 0,
        mixed: 0,
        other: 0
    };

    let totalMappedVolume = 0;

    for (const exercise of workout.exercises) {
        const muscle = getExerciseMuscleGroup(exercise.exerciseName, customMappings);
        const volume = exercise.totalVolume || exercise.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);

        if (muscle) {
            const category = MUSCLE_TO_CATEGORY[muscle];
            categoryVolume[category] += volume;
            totalMappedVolume += volume;
        }
    }

    // 4. If we couldn't map any exercises, use title or 'other'
    if (totalMappedVolume === 0) {
        return titleCategory || 'other';
    }

    // 5. Find dominant category (≥70% threshold)
    const threshold = 0.7;
    for (const [category, volume] of Object.entries(categoryVolume)) {
        if (category !== 'mixed' && category !== 'other') {
            if (volume / totalMappedVolume >= threshold) {
                return category as WorkoutCategory;
            }
        }
    }

    // 6. No dominant category - it's mixed
    return 'mixed';
}

/**
 * Classify multiple workouts and return them with category assigned.
 */
export function classifyWorkouts(
    workouts: StrengthWorkout[],
    customMappings?: Record<string, MuscleGroup>
): StrengthWorkout[] {
    return workouts.map(workout => ({
        ...workout,
        workoutCategory: workout.workoutCategory || classifyWorkout(workout, customMappings)
    }));
}

/**
 * Get category statistics for a list of workouts.
 */
export function getWorkoutCategoryStats(workouts: StrengthWorkout[]): Record<WorkoutCategory, number> {
    const stats: Record<WorkoutCategory, number> = {
        push: 0,
        pull: 0,
        legs: 0,
        mixed: 0,
        other: 0
    };

    for (const workout of workouts) {
        const category = workout.workoutCategory || classifyWorkout(workout);
        stats[category]++;
    }

    return stats;
}
