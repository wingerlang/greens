import { StrengthWorkout } from '../models/strengthTypes.ts';
import { BodyPart, InjuryLog } from '../models/types.ts';
import { mapExerciseToBodyParts } from './muscleMapper.ts';

// Enhanced return type
export interface MuscleStats {
    load: number;
    lastTrained?: string;
    intensity: 'low' | 'medium' | 'high';
}

/**
 * Calculates the Acute Load (last 7 days) and Last Trained date for each body part.
 */
export function calculateAcuteLoad(workouts: StrengthWorkout[]): Record<BodyPart, MuscleStats> {
    const statsMap: Partial<Record<BodyPart, MuscleStats>> = {};
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Sort by date desc to easily find "last trained"
    const sortedWorkouts = [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedWorkouts.forEach(workout => {
        const isRecent = new Date(workout.date) >= sevenDaysAgo;

        workout.exercises.forEach(exercise => {
            const targetParts = mapExerciseToBodyParts(exercise.exerciseName, 'full_body' as any);

            const exerciseLoad = exercise.sets.reduce((acc, set) => {
                const rpe = set.rpe || 7;
                return acc + (1 * rpe);
            }, 0);

            targetParts.forEach(part => {
                if (!statsMap[part]) {
                    statsMap[part] = { load: 0, intensity: 'low' };
                }

                // Set Last Trained (first time we see it, since we sorted desc)
                if (!statsMap[part]!.lastTrained) {
                    statsMap[part]!.lastTrained = workout.date;
                }

                if (isRecent) {
                    statsMap[part]!.load += exerciseLoad;
                }
            });
        });
    });

    // Determine intensity based on load thresholds
    Object.keys(statsMap).forEach(key => {
        const part = key as BodyPart;
        const load = statsMap[part]!.load;
        if (load > 60) statsMap[part]!.intensity = 'high';
        else if (load > 30) statsMap[part]!.intensity = 'medium';
    });

    return statsMap as Record<BodyPart, MuscleStats>;
}

/**
 * Generates warning messages based on load and injury status.
 */
export function analyzeInjuryRisk(
    statsMap: Record<BodyPart, MuscleStats>,
    injuryLogs: InjuryLog[]
): { part: BodyPart, level: 'low' | 'medium' | 'high' | 'critical', message: string }[] {
    const risks: { part: BodyPart, level: 'low' | 'medium' | 'high' | 'critical', message: string }[] = [];
    const CRITICAL_LOAD_THRESHOLD = 80;

    Object.entries(statsMap).forEach(([key, stats]) => {
        const part = key as BodyPart;
        const load = stats.load;

        // 1. Check against active injuries
        const activeInjury = injuryLogs.find(l => l.bodyPart === part && l.status === 'active');
        if (activeInjury && load > 10) {
            risks.push({
                part,
                level: 'critical',
                message: `Hög belastning (${load}) på skadad kroppsdel!`
            });
            return;
        }

        // 2. Check recovering injuries
        const recovering = injuryLogs.find(l => l.bodyPart === part && l.status === 'recovering');
        if (recovering && load > 30) {
            risks.push({
                part,
                level: 'high',
                message: `Var försiktig med återhämtande ${part} (${load} load).`
            });
            return;
        }

        // 3. Check pure overload
        if (load > CRITICAL_LOAD_THRESHOLD) {
            risks.push({
                part,
                level: 'high',
                message: `Extrem träningsvolym (${load}). Vila rekommenderas.`
            });
        }
    });

    return risks;
}
