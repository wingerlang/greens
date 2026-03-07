import { Database } from "jsr:@db/sqlite";
const db = new Database("greens.db", { readonly: true });
console.log("STRAVA", db.prepare("SELECT id, name, type FROM activities WHERE date(start_date) = '2026-01-20'").all());
console.log("STRENGTH", db.prepare("SELECT id, name FROM strength_workouts WHERE date(date) = '2026-01-20'").all());
db.close();
