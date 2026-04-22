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

    // Running specific
    flexibilityMin?: number; // e.g. 7 km
    flexibilityMax?: number; // e.g. 20 km
    estimatedDistance?: number; // km
    runBlocks?: RunBlock[]; // Structured running data

    tips?: string;
}

// Strictly Typed Running Structures
export type IntensityZone = 'Zon 1 (Återhämtning)' | 'Zon 2 (Distans)' | 'Zon 3 (Tempo)' | 'Zon 4 (Tröskel)' | 'Zon 5 (VO2 Max)';
export type RunUnit = 'km' | 'm' | 'min' | 's';

export interface RunBlock {
    id: string;
    type: 'warmup' | 'cooldown' | 'interval' | 'continuous';
    amount: number; // e.g. 5, 400
    unit: RunUnit;
    zone?: IntensityZone;
    targetPace?: string; // min/km, e.g. "4:30"
    targetHr?: string; // e.g. "130 bpm", "140-150"
    
    // Interval Specifics
    sets?: number; // e.g. 10
    restType?: 'Ståvila' | 'Gåvila' | 'Joggvila';
    restAmount?: number;
    restUnit?: RunUnit;
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

    // Running specific details
    intervalType?: 'VO2' | 'Threshold' | 'Tempo' | 'Sprint' | 'Recovery';
    restType?: 'Ståvila' | 'Gåvila' | 'Joggvila';
    restAmount?: string; // "60s", "200m"
}
