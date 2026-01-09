import { type MuscleGroup } from '../models/strengthTypes.ts';

// Seed data for common exercises
// Key: Lowercase, trimmed exercise name
// Value: Primary MuscleGroup
export const INITIAL_EXERCISE_MAPPINGS: Record<string, MuscleGroup> = {
    // Chest
    'bench press': 'chest',
    'bänkpress': 'chest',
    'dumbbell press': 'chest',
    'hantelpress': 'chest',
    'push up': 'chest',
    'armhävning': 'chest',
    'cable fly': 'chest',
    'dips': 'chest', // Can be triceps too, but usually chest compound

    // Back
    'pull up': 'lats',
    'chins': 'lats',
    'lat pulldown': 'lats',
    'latsdrag': 'lats',
    'seated row': 'back',
    'sittande rodd': 'back',
    'bent over row': 'back',
    'stångrodd': 'back',
    'deadlift': 'back', // Debatable (Posterior Chain), but Back is a common primary classification for tracking
    'marklyft': 'back',

    // Shoulders
    'overhead press': 'shoulders',
    'militärpress': 'shoulders',
    'lateral raise': 'shoulders',
    'hantellyft åt sidan': 'shoulders',
    'face pull': 'shoulders',

    // Legs (Quads)
    'squat': 'quads',
    'knäböj': 'quads',
    'front squat': 'quads',
    'frontböj': 'quads',
    'leg press': 'quads',
    'benpress': 'quads',
    'leg extension': 'quads',
    'benspark': 'quads',
    'goblet squat': 'quads',

    // Legs (Hamstrings/Glutes)
    'romanian deadlift': 'hamstrings',
    'raka marklyft': 'hamstrings',
    'leg curl': 'hamstrings',
    'lårcurl': 'hamstrings',
    'hip thrust': 'glutes',
    'lunges': 'glutes',
    'utfall': 'glutes',

    // Arms
    'bicep curl': 'biceps',
    'stångcurl': 'biceps',
    'tricep pushdown': 'triceps',
    'tricep extension': 'triceps',
    'hammer curl': 'biceps',
    'skullcrusher': 'triceps',

    // Core
    'plank': 'core',
    'plankan': 'core',
    'hanging leg raise': 'core',
    'benlyft': 'core',
    'crunch': 'core',
    'sit up': 'core',

    // Hyrox / Cardio-Strength
    'sled push': 'quads',
    'sled pull': 'back',
    'wall ball': 'quads',
    'burpee broad jump': 'full_body',
    'farmers carry': 'traps',
    'ski erg': 'lats',
    'rowing': 'back'
};
