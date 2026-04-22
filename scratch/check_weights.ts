
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const db = new DB("greens.db");
const rows = db.query("SELECT weight, date, createdAt FROM weight_entries WHERE date = '2026-04-14' ORDER BY createdAt DESC");
console.log(JSON.stringify(rows));
db.close();
