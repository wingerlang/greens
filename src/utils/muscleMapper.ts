import { BodyPart } from '../models/types.ts';
import { MuscleGroup } from '../models/strengthTypes.ts';

/**
 * Maps a general MuscleGroup from the strength model to specific BodyPart(s) in the recovery model.
 */
export function mapMuscleGroupToBodyParts(group: MuscleGroup): BodyPart[] {
    switch (group) {
        case 'chest': return ['chest', 'shoulders'];
        case 'back': return ['upper_back', 'lats' as any]; // lats isn't a BodyPart, map to upper_back
        case 'lats': return ['upper_back'];
        case 'traps': return ['upper_back', 'neck'];
        case 'shoulders': return ['shoulders'];
        case 'biceps': return ['biceps'];
        case 'triceps': return ['triceps'];
        case 'forearms': return ['forearms', 'hands'];
        case 'quads': return ['quads'];
        case 'hamstrings': return ['hamstrings'];
        case 'glutes': return ['glutes', 'hips'];
        case 'calves': return ['calves'];
        case 'core': return ['abs', 'lower_back'];
        case 'full_body': return ['quads', 'hamstrings', 'upper_back', 'chest', 'shoulders', 'core' as any];
        default: return [];
    }
}

/**
 * Advanced mapping based on Exercise Name for better precision.
 * This overrides the basic muscle group mapping.
 */
export function mapExerciseToBodyParts(exerciseName: string, primaryMuscle: MuscleGroup): BodyPart[] {
    const name = exerciseName.toLowerCase();

    // COMPOUNDS
    if (name.includes('squat') || name.includes('knäböj')) return ['quads', 'glutes', 'lower_back', 'adductors'];
    if (name.includes('deadlift') || name.includes('marklyft')) return ['hamstrings', 'glutes', 'lower_back', 'upper_back', 'forearms'];
    if (name.includes('bench press') || name.includes('bänkpress')) return ['chest', 'triceps', 'shoulders'];
    if (name.includes('overhead') || name.includes('militärpress')) return ['shoulders', 'triceps', 'upper_back'];
    if (name.includes('pull up') || name.includes('chins')) return ['upper_back', 'biceps', 'forearms'];
    if (name.includes('row') || name.includes('rodd')) return ['upper_back', 'biceps', 'lower_back'];
    if (name.includes('dip')) return ['chest', 'triceps', 'shoulders'];
    if (name.includes('lunge') || name.includes('utfall')) return ['quads', 'glutes', 'hamstrings'];

    // ISOLATION specific overrides
    if (name.includes('curl')) return ['biceps', 'forearms'];
    if (name.includes('extension') && primaryMuscle === 'triceps') return ['triceps'];
    if (name.includes('extension') && primaryMuscle === 'quads') return ['quads', 'knees'];
    if (name.includes('raise') && primaryMuscle === 'shoulders') return ['shoulders'];
    if (name.includes('fly')) return ['chest'];

    // Fallback to basic mapping
    return mapMuscleGroupToBodyParts(primaryMuscle);
}
