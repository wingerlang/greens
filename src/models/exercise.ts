// src/models/exercise.ts

export type MuscleRole = 'primary' | 'secondary' | 'stabilizer';

export interface ExerciseMuscleMap {
    muscleId: string; // Matches MuscleNode.id
    role: MuscleRole;
}

export interface ExerciseDefinition {
    id: string;               // Unique ID
    name_en: string;          // English Name (e.g., "Bench Press")
    name_sv: string;          // Swedish Name (e.g., "Bänkpress")
    aliases?: string[];       // Alternative names/spellings

    primaryMuscles: string[];   // List of muscle IDs
    secondaryMuscles: string[]; // List of muscle IDs

    category?: string;        // e.g., "Strength", "Cardio"
    equipment?: string[];     // e.g., "Barbell", "Dumbbell"

    // Future proofing
    movementPattern?: string; // e.g., "Push", "Pull", "Squat"
    notes?: string;
}

export interface ExerciseDatabase {
    version: number;
    lastUpdated: string;
    exercises: ExerciseDefinition[];
}
