import { calculateEstimated1RM } from './strengthCalculators.ts';

/**
 * Shared Strength Analysis Utilities
 */

export interface SourceInfo {
    exerciseName: string;
    weight: number;
    reps: number;
    date: string;
    sessionId: string;
}

export interface BestSetResult {
    maxEstimated1RM: number;
    maxWeight: number;
    bestEstimatedSet: SourceInfo | null;
    heaviestSet: SourceInfo | null;
    exactNameEstimated: string;
    exactNameHeaviest: string;
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
    let bestEstimatedSet: SourceInfo | null = null;
    let heaviestSet: SourceInfo | null = null;
    let exactNameEstimated = '';
    let exactNameHeaviest = '';

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
                        if (weight === 0 || reps === 0) return;

                        // Track Estimated 1RM
                        const estimated = calculateEstimated1RM(weight, reps);
                        if (estimated > maxEstimated1RM) {
                            maxEstimated1RM = estimated;
                            bestEstimatedSet = {
                                weight,
                                reps,
                                date: session.date,
                                sessionId: session.id,
                                exerciseName: ex.name || ex.exerciseName || ''
                            };
                            exactNameEstimated = ex.name || ex.exerciseName || '';
                        }

                        // Track Heaviest Weight (Actual 1RM context)
                        if (weight > maxWeight) {
                            maxWeight = weight;
                            heaviestSet = {
                                weight,
                                reps,
                                date: session.date,
                                sessionId: session.id,
                                exerciseName: ex.name || ex.exerciseName || ''
                            };
                            exactNameHeaviest = ex.name || ex.exerciseName || '';
                        }
                    });
                }
            }
        });
    });

    return {
        maxEstimated1RM: Math.round(maxEstimated1RM),
        maxWeight: Math.round(maxWeight),
        bestEstimatedSet,
        heaviestSet,
        exactNameEstimated,
        exactNameHeaviest
    };
}
