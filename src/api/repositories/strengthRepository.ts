/**
 * Strength Repository
 * Deno KV storage for strength training data.
 */

import { kv } from '../kv.ts';
import {
    StrengthWorkout,
    StrengthExercise,
    PersonalBest,
    StrengthStats,
    StrengthLogImportResult,
    MuscleGroup
} from '../../models/strengthTypes.ts';

// ============================================
// Workouts
// ============================================

export async function saveWorkout(workout: StrengthWorkout): Promise<void> {
    // Primary key: ['strength_workouts', userId, date, workoutId]
    await kv.set(['strength_workouts', workout.userId, workout.date, workout.id], workout);
}

export async function getWorkout(userId: string, workoutId: string): Promise<StrengthWorkout | null> {
    // We need to search since we don't know the date
    const iter = kv.list<StrengthWorkout>({ prefix: ['strength_workouts', userId] });
    for await (const entry of iter) {
        if (entry.value.id === workoutId) {
            return entry.value;
        }
    }
    return null;
}

export async function getWorkoutsByDateRange(
    userId: string,
    startDate: string,
    endDate: string
): Promise<StrengthWorkout[]> {
    const iter = kv.list<StrengthWorkout>({
        start: ['strength_workouts', userId, startDate],
        end: ['strength_workouts', userId, endDate + '\uffff']
    });

    const workouts: StrengthWorkout[] = [];
    for await (const entry of iter) {
        workouts.push(entry.value);
    }
    return workouts.sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
}

export async function getAllWorkouts(userId: string): Promise<StrengthWorkout[]> {
    return getWorkoutsByDateRange(userId, '2000-01-01', '2099-12-31');
}

export async function getWorkoutByDateAndName(
    userId: string,
    date: string,
    name: string
): Promise<StrengthWorkout | null> {
    const iter = kv.list<StrengthWorkout>({ prefix: ['strength_workouts', userId, date] });
    for await (const entry of iter) {
        if (entry.value.name === name || entry.value.sourceWorkoutName === name) {
            return entry.value;
        }
    }
    return null;
}

export async function deleteWorkout(userId: string, date: string, workoutId: string): Promise<void> {
    await kv.delete(['strength_workouts', userId, date, workoutId]);
}

// ============================================
// Exercises
// ============================================

export async function saveExercise(exercise: StrengthExercise): Promise<void> {
    await kv.set(['strength_exercises', exercise.id], exercise);
}

export async function getExercise(exerciseId: string): Promise<StrengthExercise | null> {
    const res = await kv.get<StrengthExercise>(['strength_exercises', exerciseId]);
    return res.value;
}

export async function getAllExercises(): Promise<StrengthExercise[]> {
    const iter = kv.list<StrengthExercise>({ prefix: ['strength_exercises'] });
    const exercises: StrengthExercise[] = [];
    for await (const entry of iter) {
        exercises.push(entry.value);
    }
    return exercises.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveExercises(exercises: Map<string, StrengthExercise>): Promise<number> {
    let count = 0;
    for (const exercise of exercises.values()) {
        const existing = await getExercise(exercise.id);
        if (!existing) {
            await saveExercise(exercise);
            count++;
        }
    }
    return count;
}

// ============================================
// Personal Bests
// ============================================

export async function savePersonalBest(pb: PersonalBest): Promise<void> {
    await kv.set(['strength_pbs', pb.userId, pb.exerciseId, pb.type], pb);
}

export async function getPersonalBest(
    userId: string,
    exerciseId: string,
    type: PersonalBest['type']
): Promise<PersonalBest | null> {
    const res = await kv.get<PersonalBest>(['strength_pbs', userId, exerciseId, type]);
    return res.value;
}

export async function getAllPersonalBests(userId: string): Promise<PersonalBest[]> {
    const iter = kv.list<PersonalBest>({ prefix: ['strength_pbs', userId] });
    const pbs: PersonalBest[] = [];
    for await (const entry of iter) {
        pbs.push(entry.value);
    }
    return pbs.sort((a, b) => b.value - a.value); // Highest first
}

export async function savePersonalBests(pbs: PersonalBest[]): Promise<number> {
    let count = 0;
    for (const pb of pbs) {
        const existing = await getPersonalBest(pb.userId, pb.exerciseId, pb.type);
        if (!existing || pb.value > existing.value) {
            await savePersonalBest(pb);
            count++;
        }
    }
    return count;
}

/**
 * Reset an exercise - delete all personal bests for a specific exercise.
 * Workout data is preserved, PBs will be recalculated on next import.
 */
export async function resetExercise(userId: string, exerciseId: string): Promise<number> {
    const iter = kv.list<PersonalBest>({ prefix: ['strength_pbs', userId, exerciseId] });
    let deletedCount = 0;

    for await (const entry of iter) {
        await kv.delete(entry.key);
        deletedCount++;
    }

    return deletedCount;
}

// ============================================
// Import Logic
// ============================================

export async function importWorkouts(
    userId: string,
    workouts: StrengthWorkout[],
    exercises: Map<string, StrengthExercise>,
    personalBests: PersonalBest[]
): Promise<StrengthLogImportResult> {
    const result: StrengthLogImportResult = {
        success: true,
        workoutsImported: 0,
        workoutsUpdated: 0,
        workoutsSkipped: 0,
        exercisesDiscovered: 0,
        personalBestsFound: 0,
        errors: []
    };

    try {
        // Save exercises first
        result.exercisesDiscovered = await saveExercises(exercises);

        // Import workouts with merge logic
        for (const workout of workouts) {
            workout.userId = userId; // Ensure userId is set

            const existing = await getWorkoutByDateAndName(userId, workout.date, workout.name);

            if (existing) {
                // Update existing workout
                workout.id = existing.id;
                workout.createdAt = existing.createdAt;
                workout.updatedAt = new Date().toISOString();
                await saveWorkout(workout);
                result.workoutsUpdated++;
            } else {
                // New workout
                await saveWorkout(workout);
                result.workoutsImported++;
            }
        }

        // Save personal bests
        result.personalBestsFound = await savePersonalBests(personalBests);

    } catch (e) {
        result.success = false;
        result.errors.push(e instanceof Error ? e.message : String(e));
    }

    return result;
}

// ============================================
// Statistics
// ============================================

export async function getStrengthStats(userId: string): Promise<StrengthStats> {
    const allWorkouts = await getAllWorkouts(userId);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const muscleGroupVolume: Record<MuscleGroup, number> = {
        chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, forearms: 0,
        quads: 0, hamstrings: 0, glutes: 0, calves: 0, core: 0, traps: 0, lats: 0, full_body: 0
    };

    let totalSets = 0;
    let totalVolume = 0;
    let workoutsThisWeek = 0;
    let workoutsThisMonth = 0;
    let volumeThisWeek = 0;
    let volumeThisMonth = 0;

    for (const workout of allWorkouts) {
        totalSets += workout.totalSets;
        totalVolume += workout.totalVolume;

        if (workout.date >= weekAgo) {
            workoutsThisWeek++;
            volumeThisWeek += workout.totalVolume;
        }
        if (workout.date >= monthAgo) {
            workoutsThisMonth++;
            volumeThisMonth += workout.totalVolume;
        }
    }

    return {
        userId,
        totalWorkouts: allWorkouts.length,
        totalSets,
        totalVolume,
        workoutsThisWeek,
        workoutsThisMonth,
        volumeThisWeek,
        volumeThisMonth,
        muscleGroupVolume,
        currentStreak: 0, // TODO: Calculate
        longestStreak: 0,
        lastWorkoutDate: allWorkouts[0]?.date
    };
}

// ============================================
// Data Management
// ============================================

export async function clearUserStrengthData(userId: string): Promise<void> {
    // 1. Delete all workouts
    const workoutIter = kv.list({ prefix: ['strength_workouts', userId] });
    for await (const entry of workoutIter) {
        await kv.delete(entry.key);
    }

    // 2. Delete all Personal Bests
    const pbIter = kv.list({ prefix: ['strength_pbs', userId] });
    for await (const entry of pbIter) {
        await kv.delete(entry.key);
    }
}

// Export singleton-style
export const strengthRepo = {
    saveWorkout,
    getWorkout,
    getWorkoutsByDateRange,
    getAllWorkouts,
    getWorkoutByDateAndName,
    deleteWorkout,
    saveExercise,
    getExercise,
    getAllExercises,
    saveExercises,
    savePersonalBest,
    getPersonalBest,
    getAllPersonalBests,
    savePersonalBests,
    resetExercise,
    importWorkouts,
    getStrengthStats,
    clearUserStrengthData
};
