import { kv } from "../kv.ts";
import { INITIAL_EXERCISE_MAPPINGS } from "../../data/initialExerciseMappings.ts";
import { type MuscleGroup } from "../../models/strengthTypes.ts";
import { normalizeExerciseName } from "../../models/strengthTypes.ts";
import { getExerciseDatabase } from "../repositories/exerciseRepository.ts";

const EXERCISE_MAP_KEY_PREFIX = ['config', 'exercise_mappings'];

/**
 * Get all exercise mappings for a user.
 * Merges the static seed data, NEW JSON database, and user-specific overrides from KV.
 */
export async function getExerciseMappings(userId: string): Promise<Record<string, MuscleGroup>> {
    // 1. Start with seed data (clone it)
    const mappings: Record<string, MuscleGroup> = { ...INITIAL_EXERCISE_MAPPINGS };

    // 1b. Merge in data from the new JSON Exercise Repository
    // This allows the Admin UI to override defaults globally
    try {
        const db = await getExerciseDatabase();
        for (const exercise of db.exercises) {
            // Map the primary muscle ID back to the legacy MuscleGroup type if possible
            if (exercise.primaryMuscles.length > 0) {
                // Heuristic mapping: 'chest_middle' -> 'chest'
                const primary = exercise.primaryMuscles[0].split('_')[0] as MuscleGroup;
                // Add mapping for both EN and SV names to ensure hit rate
                mappings[normalizeExerciseName(exercise.name_en)] = primary;
                if (exercise.name_sv) {
                    mappings[normalizeExerciseName(exercise.name_sv)] = primary;
                }
            }
        }
    } catch (e) {
        console.error("Failed to load exercise db in mapper", e);
    }

    // 2. Fetch user overrides from KV (Highest Priority)
    // Key structure: ['config', 'exercise_mappings', userId, normalizedName] -> MuscleGroup
    const iter = kv.list<MuscleGroup>({ prefix: [...EXERCISE_MAP_KEY_PREFIX, userId] });

    for await (const entry of iter) {
        // Entry key is [...prefix, userId, exerciseName]
        const exerciseName = entry.key[entry.key.length - 1] as string;
        mappings[exerciseName] = entry.value;
    }

    return mappings;
}

/**
 * Save a mapping for a specific exercise.
 */
export async function saveExerciseMapping(userId: string, exerciseName: string, muscleGroup: MuscleGroup): Promise<void> {
    const normalized = normalizeExerciseName(exerciseName);
    const key = [...EXERCISE_MAP_KEY_PREFIX, userId, normalized];

    await kv.set(key, muscleGroup);
}

/**
 * Delete a custom mapping (reset to default if exists, or unmap).
 */
export async function deleteExerciseMapping(userId: string, exerciseName: string): Promise<void> {
    const normalized = normalizeExerciseName(exerciseName);
    const key = [...EXERCISE_MAP_KEY_PREFIX, userId, normalized];

    await kv.delete(key);
}
