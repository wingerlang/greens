import { data } from "./src/data/database.ts";

const strength = data.strengthWorkouts.filter(s => s.date.includes("2026-01-20"));
const strava = data.activities.filter(a => a.date.includes("2026-01-20"));

console.log("=== STRENGTHLOG ===");
strength.forEach(s => {
    console.log(`- ID: ${s.id}, Title: ${s.name}, Duration: ${s.durationMinutes}, Sets: ${s.exercises.map(e => e.exerciseName).join(", ")}`);
    console.log(`  - Tonnage: ${s.totalVolume}, Distance: ${s.exercises.reduce((sum, e) => sum + e.sets.reduce((s, set) => s + (set.distance || 0), 0), 0) / 1000} km`);
});

console.log("\n=== STRAVA === ");
strava.forEach(s => {
    console.log(`- ID: ${s.id}, Title: ${s.title}, Type: ${s.type}, Duration: ${Math.round(s.movingTime / 60)}`);
});
