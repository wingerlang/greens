import { calculateEstimated1RM } from './strengthCalculators.ts';

/**
 * Shared Strength Analysis Utilities
 */

export interface SourceInfo {
    exerciseName: string;
    weight: number;
    reps: number;
    volume?: number;
    date: string;
    sessionId: string;
}

export interface BestSetResult {
    maxEstimated1RM: number;
    maxWeight: number;
    maxReps: number;
    bestEstimatedSet: SourceInfo | null;
    heaviestSet: SourceInfo | null;
    maxRepsSet: SourceInfo | null;
    exactNameEstimated: string;
    exactNameHeaviest: string;
    exactNameMaxReps: string;
}

/**
 * Detects the best sets for a list of exercise patterns.
 * Returns both the highest estimated 1RM and the heaviest absolute weight.
 */
export function getBestSetForPatterns(
    sessions: any[],
    patterns: string[],
    excludePatterns: string[] = []
): BestSetResult {
    let maxEstimated1RM = 0;
    let maxWeight = 0;
    let maxReps = 0;
    let bestEstimatedSet: SourceInfo | null = null;
    let heaviestSet: SourceInfo | null = null;
    let maxRepsSet: SourceInfo | null = null;
    let exactNameEstimated = '';
    let heaviestSetReps = 0;
    let exactNameHeaviest = '';
    let exactNameMaxReps = '';

    const normalizedPatterns = patterns.map(p => p.toLowerCase());
    const normalizedExcludes = excludePatterns.map(p => p.toLowerCase());

    sessions.forEach(session => {
        if (!session.exercises) return;
        session.exercises.forEach((ex: any) => {
            const name = (ex.name || ex.exerciseName || '').toLowerCase();

            const matchesPattern = normalizedPatterns.some(p => name.includes(p));
            const matchesExclude = normalizedExcludes.some(p => name.includes(p));

            if (matchesPattern && !matchesExclude) {
                if (ex.sets && Array.isArray(ex.sets)) {
                    ex.sets.forEach((set: any) => {
                        const weight = Number(set.weight) || 0;
                        const reps = Number(set.reps) || 0;
                        if (weight === 0 && reps === 0) return;

                        // Track Estimated 1RM
                        const estimated = calculateEstimated1RM(weight, reps);
                        if (estimated > maxEstimated1RM) {
                            maxEstimated1RM = estimated;
                            bestEstimatedSet = {
                                weight,
                                reps,
                                volume: weight * reps,
                                date: session.date,
                                sessionId: session.id,
                                exerciseName: ex.name || ex.exerciseName || ''
                            };
                            exactNameEstimated = ex.name || ex.exerciseName || '';
                        }

                        // Track Heaviest Weight (Favor higher reps if same weight)
                        if (weight > maxWeight || (weight === maxWeight && reps > heaviestSetReps)) {
                            maxWeight = weight;
                            heaviestSetReps = reps;
                            heaviestSet = {
                                weight,
                                reps,
                                volume: weight * reps,
                                date: session.date,
                                sessionId: session.id,
                                exerciseName: ex.name || ex.exerciseName || ''
                            };
                            exactNameHeaviest = ex.name || ex.exerciseName || '';
                        }

                        // Track Max Reps (Total reps in one set)
                        if (reps > maxReps) {
                            maxReps = reps;
                            maxRepsSet = {
                                weight,
                                reps,
                                volume: weight * reps,
                                date: session.date,
                                sessionId: session.id,
                                exerciseName: ex.name || ex.exerciseName || ''
                            };
                            exactNameMaxReps = ex.name || ex.exerciseName || '';
                        }
                    });
                }
            }
        });
    });

    return {
        maxEstimated1RM: Math.round(maxEstimated1RM),
        maxWeight: Math.round(maxWeight),
        maxReps,
        bestEstimatedSet,
        heaviestSet,
        maxRepsSet,
        exactNameEstimated,
        exactNameHeaviest,
        exactNameMaxReps
    };
}
