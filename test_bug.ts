import { kv } from "./src/api/kv.ts";

async function dumpActivities(dateIso: string) {
    const actList = [];
    for await (const entry of kv.list({ prefix: ["activities"] })) {
        const item = entry.value;
        if (item.date && item.date.startsWith(dateIso)) {
            actList.push(item);
        }
    }

    const strList = [];
    for await (const entry of kv.list({ prefix: ["strength_workouts"] })) {
        const item = entry.value;
        if (item.date && item.date.startsWith(dateIso)) {
            strList.push(item);
        }
    }

    const legacy = [];
    for await (const entry of kv.list({ prefix: ["exercise_entries"] })) {
        const item = entry.value;
        if (item.date && item.date.startsWith(dateIso)) {
            legacy.push(item);
        }
    }

    console.log("=== UNIVERSAL ACTIVITIES ===");
    console.log(JSON.stringify(actList.map((a: any) => ({ id: a.id, title: a.plan?.title || a.performance?.title, date: a.date, mergedIntoId: a.mergedIntoId, isMerged: a.mergeInfo?.isMerged, originalIds: a.mergeInfo?.originalActivityIds, source: a.externalId, perf: a.performance })), null, 2));

    console.log("\n=== STRENGTH WORKOUTS ===");
    console.log(JSON.stringify(strList.map((s: any) => ({ id: s.id, name: s.name, date: s.date, duration: s.durationMinutes || s.duration, isMerged: s.mergeInfo?.isMerged, stravaId: s.mergeInfo?.stravaActivityId })), null, 2));

    console.log("\n=== LEGACY ===");
    console.log(JSON.stringify(legacy.map((e: any) => ({ id: e.id, title: e.title, date: e.date, type: e.type })), null, 2));
}

dumpActivities("2026-01-20").catch(console.error);
