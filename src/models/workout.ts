export interface WorkoutDefinition {
    id: string;
    title: string;
    category: 'HYROX' | 'RUNNING' | 'STRENGTH' | 'HYBRID' | 'RECOVERY' | 'CROSSFIT';
    description: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
    durationMin: number; // Approximate duration in minutes
    subCategory?: string; // e.g. "Push", "Intervals"
    tags: string[];
    source: 'HYROX_DB' | 'COACH_AI' | 'USER_CUSTOM';

    // For static workouts (e.g. Hyrox standard sessions)
    staticStructure?: string[];

    // For dynamic workouts (e.g. AI Coach)
    // The generator takes input values and returns the list of steps/structure
    generator?: (inputs: Record<string, number | string>) => string[];

    // Input fields for the generator
    inputs?: {
        id: string;
        label: string;
        type: 'slider' | 'select' | 'number';
        min?: number;
        max?: number;
        step?: number;
        defaultValue: number | string;
        options?: { label: string; value: string }[];
        unit?: string;
    }[];

    // structured routine for the builder
    exercises?: WorkoutSection[];

    // Smart metadata
    targetedMuscles?: string[]; // e.g. ['Chest', 'Triceps']
    estimatedVolume?: number; // kg

    tips?: string;
}

export interface WorkoutSection {
    id: string;
    title: string; // "Warmup", "Main Lift", "Conditioning"
    exercises: WorkoutExercise[];
}

export interface WorkoutExercise {
    id: string; // unique instance id
    exerciseId: string; // link to Exercise Database (or raw string if custom)
    name: string; // Snapshot of name
    sets: number; // e.g. 3
    reps: string; // "8-12" or "AMRAP"
    weight?: string; // "70%" or "20kg"
    rest?: number; // seconds
    notes?: string;

    // Smart tags
    primaryMuscle?: string;
}
