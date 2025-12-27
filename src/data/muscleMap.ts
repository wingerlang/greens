// Basic mapping of common exercises to muscles
// In a real app, this would be in the database
export const MUSCLE_MAP: Record<string, { primary: string; secondary: string[] }> = {
    // HYROX
    "Sled Push": { primary: "Quads", secondary: ["Glutes", "Shoulders", "Core"] },
    "Sled Pull": { primary: "Back", secondary: ["Biceps", "Glutes", "Quads"] },
    "Burpee Broad Jump": { primary: "Full Body", secondary: ["Chest", "Quads", "Cardio"] },
    "Rowing": { primary: "Back", secondary: ["Legs", "Arms", "Cardio"] },
    "Wall Balls": { primary: "Quads", secondary: ["Shoulders", "Glutes"] },
    "Farmers Carry": { primary: "Traps", secondary: ["Grip", "Core"] },
    "Lunges": { primary: "Glutes", secondary: ["Quads", "Hamstrings"] },
    "Ski Erg": { primary: "Lats", secondary: ["Triceps", "Core", "Cardio"] },
    "Running": { primary: "Cardio", secondary: ["Legs"] },

    // STRENGTH - CHEST
    "Bench Press": { primary: "Chest", secondary: ["Triceps", "Front Delts"] },
    "Push Ups": { primary: "Chest", secondary: ["Triceps", "Core"] },
    "Dips": { primary: "Triceps", secondary: ["Chest", "Shoulders"] },

    // STRENGTH - BACK
    "Pull Ups": { primary: "Lats", secondary: ["Biceps"] },
    "Deadlift": { primary: "Posterior Chain", secondary: ["Back", "Grip"] },
    "Bent Over Row": { primary: "Back", secondary: ["Biceps"] },

    // STRENGTH - LEGS
    "Squat": { primary: "Quads", secondary: ["Glutes", "Core"] },
    "Leg Press": { primary: "Quads", secondary: [] },
    "RDL": { primary: "Hamstrings", secondary: ["Glutes", "Lower Back"] },

    // STRENGTH - SHOULDERS
    "Overhead Press": { primary: "Shoulders", secondary: ["Triceps"] },
    "Lateral Raises": { primary: "Side Delts", secondary: [] },
};

export const BODY_PARTS = [
    "Neck", "Traps", "Shoulders", "Chest", "Biceps", "Triceps",
    "Forearms", "Back", "Lats", "Lower Back", "Abs", "Obliques",
    "Glutes", "Quads", "Hamstrings", "Calves"
];
