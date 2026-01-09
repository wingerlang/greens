import { type MuscleGroup } from '../models/strengthTypes.ts';

// Display names for the UI (Swedish preferred as per app convention, or English if technical)
// The key must match StrengthMuscleGroup
export const MUSCLE_DISPLAY_NAMES: Record<MuscleGroup, string> = {
    chest: 'Bröst',
    back: 'Rygg',
    shoulders: 'Axlar',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Underarmar',
    quads: 'Framsida lår',
    hamstrings: 'Baksida lår',
    glutes: 'Säte',
    calves: 'Vader',
    core: 'Mage/Core',
    traps: 'Traps',
    lats: 'Lats',
    full_body: 'Helkropp'
};

export const GRANULAR_MUSCLES: MuscleGroup[] = [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'forearms',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'core',
    'traps',
    'lats',
    'full_body'
];
