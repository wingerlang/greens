import { type StrengthWorkout, calculate1RM, normalizeExerciseName } from '../models/strengthTypes.ts';

export interface RepMaxStat {
    reps: number;
    weight: number;
    estimated1RM: number;
    date: string;
    workoutId: string;
}

export interface ExerciseAnalysis {
    exerciseName: string;
    bestRepMaxes: Record<number, RepMaxStat>; // e.g. { 1: {weight: 100...}, 5: {weight: 90...} }
    allTimeBest1RM: RepMaxStat | null;
    recentBest1RM: RepMaxStat | null; // Last 3 months
    totalSets: number;
    totalWorkouts: number;
}

export function analyzeStrengthHistory(
    sessions: StrengthWorkout[],
    targetExerciseName: string
): ExerciseAnalysis {
    const normalizedTarget = normalizeExerciseName(targetExerciseName);

    const analysis: ExerciseAnalysis = {
        exerciseName: targetExerciseName,
        bestRepMaxes: {},
        allTimeBest1RM: null,
        recentBest1RM: null,
        totalSets: 0,
        totalWorkouts: 0
    };

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const relevantSessions = sessions
        .sort((a, b) => b.date.localeCompare(a.date)); // Sort desc (newest first)

    for (const session of relevantSessions) {
        let hasExercise = false;

        for (const exercise of session.exercises) {
            if (normalizeExerciseName(exercise.exerciseName).includes(normalizedTarget)) {
                hasExercise = true;
                analysis.totalSets += exercise.sets.length;

                for (const set of exercise.sets) {
                    if (set.reps > 0 && set.weight > 0) {
                        const est1RM = calculate1RM(set.weight, set.reps);
                        const stat: RepMaxStat = {
                            reps: set.reps,
                            weight: set.weight,
                            estimated1RM: est1RM,
                            date: session.date,
                            workoutId: session.id
                        };

                        // Update Best Rep Maxes (e.g. best 5 rep set ever)
                        // We track best weight for that rep count.
                        // If weights are equal, take the one with higher est 1RM (unlikely if same reps) or newer date.
                        const currentBest = analysis.bestRepMaxes[set.reps];
                        if (!currentBest || set.weight > currentBest.weight) {
                            analysis.bestRepMaxes[set.reps] = stat;
                        }

                        // Update All Time Best Est 1RM
                        if (!analysis.allTimeBest1RM || est1RM > analysis.allTimeBest1RM.estimated1RM) {
                            analysis.allTimeBest1RM = stat;
                        }

                        // Update Recent Best
                        if (new Date(session.date) >= threeMonthsAgo) {
                            if (!analysis.recentBest1RM || est1RM > analysis.recentBest1RM.estimated1RM) {
                                analysis.recentBest1RM = stat;
                            }
                        }
                    }
                }
            }
        }
        if (hasExercise) analysis.totalWorkouts++;
    }

    return analysis;
}
