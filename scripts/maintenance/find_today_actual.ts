import { kv } from "../../src/api/kv.ts";

async function findTodayActualActivities() {
    const userId = "9c0c8484-ec34-412a-81cc-b49048843cd6";
    const today = "2026-05-07";
    const prefix = ['activities', userId, today];
    
    const iter = kv.list({ prefix });
    const activities: any[] = [];
    for await (const entry of iter) {
        activities.push(entry.value);
    }
    
    console.log(JSON.stringify(activities, null, 2));
}

findTodayActualActivities();
