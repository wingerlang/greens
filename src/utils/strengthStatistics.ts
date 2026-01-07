import { normalizeExerciseName, type StrengthWorkout } from '../models/strengthTypes.ts';

export interface RepRecord {
    reps: number;
    weight: number;
    date: string;
    e1rm: number; // Calculated Epley 1RM for this record
    diff?: number; // Calculated diff vs main Epley 1RM
}

export type ExerciseRecordsMap = Record<number, RepRecord>;

/**
 * Iterates through all strength sessions to find the maximum weight lifted
 * for each rep count for a specific exercise.
 * Note: No upper limit on reps - we want to capture all data including high-rep sets.
 */
export function getPersonalRecords(
    exerciseName: string,
    sessions: StrengthWorkout[]
): ExerciseRecordsMap {
    const records: ExerciseRecordsMap = {};
    const normalizedTarget = normalizeExerciseName(exerciseName);

    if (!normalizedTarget) return records;

    for (const session of sessions) {
        for (const exercise of session.exercises) {
            // Check name match
            if (normalizeExerciseName(exercise.exerciseName) === normalizedTarget) {
                for (const set of exercise.sets) {
                    // Only require valid reps (>= 1) and positive weight - NO upper limit
                    if (set.reps >= 1 && set.weight > 0) {
                        const currentRecord = records[set.reps];

                        // If no record exists for this rep count, or this set is heavier
                        if (!currentRecord || set.weight > currentRecord.weight) {
                            records[set.reps] = {
                                reps: set.reps,
                                weight: set.weight,
                                date: session.date,
                                e1rm: Math.round(set.weight * (1 + set.reps / 30))
                            };
                        }
                    }
                }
            }
        }
    }

    return records;
}

export const PERCENTAGE_MAP: Record<number, number> = {
    1: 100,
    2: 95,
    3: 93,
    4: 90,
    5: 87,
    6: 85,
    7: 83,
    8: 80,
    9: 77,
    10: 75,
    11: 73,
    12: 70,
    13: 67,
    14: 65,
    15: 63
};
