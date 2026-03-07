import { DB } from "https://deno.land/x/sqlite/mod.ts";
const db = new DB("greens.db");
const activities = [...db.query("SELECT id, name, type FROM activities WHERE date(start_date) = '2026-01-20'")];
console.log("STRAVA", activities);
const str = [...db.query("SELECT id, name FROM strength_workouts WHERE date(date) = '2026-01-20'")];
console.log("STRENGTH", str);
db.close();
