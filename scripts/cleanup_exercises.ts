import fs from "fs";

// Polyfill
const Deno = {
    readTextFile: async (path) => fs.promises.readFile(path, 'utf8'),
    writeTextFile: async (path, content) => fs.promises.writeFile(path, content, 'utf8')
};

async function main() {
    console.log("Cleaning exercises...");
    const raw = await Deno.readTextFile("data/exercises.json");
    const db = JSON.parse(raw);

    const initialCount = db.exercises.length;

    // Filter out numeric names (timestamps)
    // Regex: ^[0-9]+$ matches strings that are only numbers
    const validExercises = db.exercises.filter(e => !/^\d+$/.test(e.name_sv));

    console.log(`Removed ${initialCount - validExercises.length} garbage entries.`);

    db.exercises = validExercises;
    db.lastUpdated = new Date().toISOString();

    await Deno.writeTextFile("data/exercises.json", JSON.stringify(db, null, 2));
    console.log("Cleanup complete.");
}

main();
