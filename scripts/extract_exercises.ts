
import { parse } from "npm:csv-parse/sync";

interface Exercise {
    id: string;
    name_en: string;
    name_sv: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
}

interface NewFormatRow {
    exercise: string;
    [key: string]: any;
}

interface JoelFormatRow {
    exercise_title: string;
    [key: string]: any;
}

async function main() {
    console.log("Reading existing exercises...");
    const currentDbRaw = await Deno.readTextFile("data/exercises.json");
    const currentDb: { exercises: Exercise[] } = JSON.parse(currentDbRaw);

    const uniqueExercises = new Set<string>();

    // Add existing exercises to set to avoid duplicates
    currentDb.exercises.forEach(e => {
        uniqueExercises.add(e.name_sv);
        uniqueExercises.add(e.name_en);
        // Also add aliases if we had them, but for now just names
    });

    console.log("Parsing Johannes New Format...");
    try {
        const content = await Deno.readTextFile("data/johannes_strengthlog_new_format.csv");
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true
        }) as NewFormatRow[];

        records.forEach(r => {
            if (r.exercise) uniqueExercises.add(r.exercise.trim());
        });
    } catch (e) {
        console.error("Error reading new format:", e);
    }

    console.log("Parsing Joel Format...");
    try {
        const content = await Deno.readTextFile("data/workout_data_joel.csv");
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true
        }) as JoelFormatRow[];

        records.forEach(r => {
            if (r.exercise_title) uniqueExercises.add(r.exercise_title.trim());
        });
    } catch (e) {
        console.error("Error reading Joel format:", e);
    }

    console.log("Parsing Johannes Old Format...");
    try {
        const content = await Deno.readTextFile("data/johannes_strengthlog_old_format.csv");
        const lines = content.split('\n');
        // Simple line scanning for "Exercise, <Name>" pattern as observed
        // "Exercise, Squat",Set,1...
        // Pattern: Starts with "Exercise, " (inside quotes usually)

        lines.forEach(line => {
            // Check for quoted "Exercise, Name"
            const match = line.match(/"Exercise, ([^"]+)"/);
            if (match && match[1]) {
                uniqueExercises.add(match[1].trim());
            }
        });
    } catch (e) {
        console.error("Error reading old format:", e);
    }

    console.log(`Found ${uniqueExercises.size} unique exercise names.`);

    const newExercises: Exercise[] = [...currentDb.exercises];
    const existingIds = new Set(currentDb.exercises.map(e => e.id));
    const existingNames = new Set(currentDb.exercises.flatMap(e => [e.name_sv.toLowerCase(), e.name_en.toLowerCase()]));

    for (const name of uniqueExercises) {
        const normalized = name.trim();
        if (existingNames.has(normalized.toLowerCase())) {
            continue;
        }

        // Create new ID
        let id = normalized.toLowerCase()
            .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

        // Ensure ID uniqueness
        let counter = 1;
        const originalId = id;
        while (existingIds.has(id)) {
            id = `${originalId}_${counter}`;
            counter++;
        }
        existingIds.add(id);
        existingNames.add(normalized.toLowerCase());

        newExercises.push({
            id,
            name_en: normalized, // Defaulting EN/SV to same name
            name_sv: normalized,
            primaryMuscles: ["other"], // Default
            secondaryMuscles: []
        });
    }

    console.log(`Total exercises after merge: ${newExercises.length}`);

    // Sort by name
    newExercises.sort((a, b) => a.name_sv.localeCompare(b.name_sv));

    const output = {
        ...currentDb,
        exercises: newExercises,
        lastUpdated: new Date().toISOString()
    };

    await Deno.writeTextFile("data/exercises.json", JSON.stringify(output, null, 2));
    console.log("Updated data/exercises.json");
}

main();
