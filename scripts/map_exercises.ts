
import fs from "fs";

// Polyfill
const Deno = {
    readTextFile: async (path) => fs.promises.readFile(path, 'utf8'),
    writeTextFile: async (path, content) => fs.promises.writeFile(path, content, 'utf8')
};

const muscleMap = {
    "squat": ["quads"],
    "knäböj": ["quads"],
    "bench": ["chest_middle"],
    "bänk": ["chest_middle"],
    "deadlift": ["lower_back", "hamstrings"],
    "marklyft": ["lower_back", "hamstrings"],
    "press": ["shoulders_front"],
    "militär": ["shoulders_front"],
    "curl": ["biceps"],
    "tricep": ["triceps"],
    "row": ["lats"],
    "rodd": ["lats"],
    "pull": ["lats"],
    "chin": ["lats"],
    "dip": ["triceps", "chest_lower"],
    "leg": ["quads"],
    "ben": ["quads"],
    "calf": ["calves"],
    "vad": ["calves"],
    "ab": ["abs_upper"],
    "mage": ["abs_upper"],
    "crunch": ["abs_upper"],
    "fly": ["chest_middle"],
    "raise": ["shoulders_mid"],
    "lyft": ["shoulders_mid"],
    "extension": ["triceps"], // Context dependent usually, but tricep extension common
    "lunge": ["glute_max", "quads"],
    "utfall": ["glute_max", "quads"],
    "thrust": ["glute_max"]
};

async function main() {
    console.log("Mapping muscles...");
    const raw = await Deno.readTextFile("data/exercises.json");
    const db = JSON.parse(raw);
    let updatedCount = 0;

    db.exercises = db.exercises.map(e => {
        // Only map if currently "other" (unmapped)
        if (e.primaryMuscles.length === 1 && e.primaryMuscles[0] === "other") {
            const name = (e.name_en + " " + e.name_sv).toLowerCase();
            for (const [keyword, muscles] of Object.entries(muscleMap)) {
                if (name.includes(keyword)) {
                    e.primaryMuscles = muscles;
                    // Secondary logic could be added but skipping for simplicity
                    updatedCount++;
                    break;
                }
            }
        }
        return e;
    });

    console.log(`Updated ${updatedCount} exercises with muscle mappings.`);

    db.lastUpdated = new Date().toISOString();
    await Deno.writeTextFile("data/exercises.json", JSON.stringify(db, null, 2));
}

main();
