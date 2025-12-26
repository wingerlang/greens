export interface WorkoutDefinition {
    id: string;
    title: string;
    category: 'HYROX' | 'RUNNING' | 'STRENGTH' | 'HYBRID' | 'RECOVERY' | 'CROSSFIT';
    description: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
    durationMin: number; // Approximate duration in minutes
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

    tips?: string;
}
