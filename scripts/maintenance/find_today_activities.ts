import { kv } from "../../src/api/kv.ts";

async function findDuplicates() {
    const today = "2026-05-07";
    const iter = kv.list({ prefix: ["planned_activities"] });
    const activities: any[] = [];
    for await (const entry of iter) {
        const act = entry.value as any;
        if (act.date === today) {
             activities.push({ userId: entry.key[1], ...act });
        }
    }
    
    console.log(JSON.stringify(activities, null, 2));
}

findDuplicates();
