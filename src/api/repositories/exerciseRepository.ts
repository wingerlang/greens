// src/api/repositories/exerciseRepository.ts
import { ExerciseDatabase, ExerciseDefinition } from '../../models/exercise.ts';

const DATA_PATH = './data/exercises.json';

export async function getExerciseDatabase(): Promise<ExerciseDatabase> {
    try {
        const data = await Deno.readTextFile(DATA_PATH);
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to read exercise database:", error);
        // Return empty db if file missing (or handle appropriately)
        return { version: 1, lastUpdated: new Date().toISOString(), exercises: [] };
    }
}

export async function saveExerciseDatabase(db: ExerciseDatabase): Promise<void> {
    try {
        db.lastUpdated = new Date().toISOString();
        await Deno.writeTextFile(DATA_PATH, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error("Failed to save exercise database:", error);
        throw new Error("Could not save exercise database");
    }
}

export async function getExerciseById(id: string): Promise<ExerciseDefinition | undefined> {
    const db = await getExerciseDatabase();
    return db.exercises.find(e => e.id === id);
}

export async function searchExercises(query: string): Promise<ExerciseDefinition[]> {
    const db = await getExerciseDatabase();
    const q = query.toLowerCase();
    return db.exercises.filter(e =>
        e.name_en.toLowerCase().includes(q) ||
        e.name_sv.toLowerCase().includes(q) ||
        (e.aliases && e.aliases.some(a => a.toLowerCase().includes(q)))
    );
}

export async function upsertExercise(exercise: ExerciseDefinition): Promise<void> {
    const db = await getExerciseDatabase();
    const index = db.exercises.findIndex(e => e.id === exercise.id);

    if (index >= 0) {
        db.exercises[index] = exercise;
    } else {
        db.exercises.push(exercise);
    }

    await saveExerciseDatabase(db);
}

export async function deleteExercise(id: string): Promise<void> {
    const db = await getExerciseDatabase();
    const index = db.exercises.findIndex(e => e.id === id);

    if (index >= 0) {
        db.exercises.splice(index, 1);
        await saveExerciseDatabase(db);
    }
}
