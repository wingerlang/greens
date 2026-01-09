import { kv } from "../kv.ts";
import { INITIAL_EXERCISE_MAPPINGS } from "../../data/initialExerciseMappings.ts";
import { type MuscleGroup } from "../../models/strengthTypes.ts";
import { normalizeExerciseName } from "../../models/strengthTypes.ts";

const EXERCISE_MAP_KEY_PREFIX = ['config', 'exercise_mappings'];

/**
 * Get all exercise mappings for a user.
 * Merges the static seed data with user-specific overrides from KV.
 */
export async function getExerciseMappings(userId: string): Promise<Record<string, MuscleGroup>> {
    // 1. Start with seed data (clone it)
    const mappings: Record<string, MuscleGroup> = { ...INITIAL_EXERCISE_MAPPINGS };

    // 2. Fetch user overrides from KV
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
