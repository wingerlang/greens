// src/api/repositories/muscleRepository.ts
import { MuscleHierarchy } from '../../models/muscle.ts';

const DATA_PATH = './data/muscles.json';

export async function getMuscleHierarchy(): Promise<MuscleHierarchy> {
    try {
        const data = await Deno.readTextFile(DATA_PATH);
        return JSON.parse(data);
    } catch (error) {
        console.error("Failed to read muscle hierarchy:", error);
        throw new Error("Could not load muscle database");
    }
}
