
import { parse } from "csv-parse/sync";
import fs from "fs";

// Polyfill Deno.readTextFile/writeTextFile for Node execution
const Deno = {
    readTextFile: async (path) => fs.promises.readFile(path, 'utf8'),
    writeTextFile: async (path, content) => fs.promises.writeFile(path, content, 'utf8')
};

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
    const currentDb = JSON.parse(currentDbRaw);

    const uniqueExercises = new Set();

    // Add existing exercises to set to avoid duplicates
    currentDb.exercises.forEach(e => {
        uniqueExercises.add(e.name_sv);
        uniqueExercises.add(e.name_en);
    });

    console.log("Parsing Johannes New Format...");
    try {
        const content = await Deno.readTextFile("data/johannes_strengthlog_new_format.csv");
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true // Handle lines with extra columns due to unquoted commas
        });

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
            skip_empty_lines: true,
            relax_column_count: true
        });

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

        lines.forEach(line => {
            const match = line.match(/"Exercise, ([^"]+)"/);
            if (match && match[1]) {
                uniqueExercises.add(match[1].trim());
            }
        });
    } catch (e) {
        console.error("Error reading old format:", e);
    }

    console.log(`Found ${uniqueExercises.size} unique exercise names.`);

    const newExercises = [...currentDb.exercises];
    const existingIds = new Set(currentDb.exercises.map(e => e.id));
    const existingNames = new Set(currentDb.exercises.flatMap(e => [e.name_sv.toLowerCase(), e.name_en.toLowerCase()]));

    for (const name of uniqueExercises) {
        // @ts-ignore
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
