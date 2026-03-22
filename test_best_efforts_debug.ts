import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { segmentSplits } from "./src/utils/splitsSegmenter.ts";
import { parseWorkout } from "./src/utils/workoutParser.ts";

const db = new DB("greens.db");

// Find activities that are roughly 10.5km
const rows = db.query(`
    SELECT id, title, source, performance, plan, notes
    FROM activities
    WHERE
        (json_extract(performance, '$.distanceKm') BETWEEN 10.2 AND 10.8) OR
        (source = 'manual' AND distance BETWEEN 10.2 AND 10.8)
`);

console.log(`Found ${rows.length} activities around 10.5km`);

function formatPaceSec(seconds: number): string {
    if (!seconds || !isFinite(seconds) || seconds <= 0) return '--:--';
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getBestEfforts(splits: any[]) {
    const targets = [1, 2, 3, 5, 10, 21];
    const efforts: any[] = [];

    for (const n of targets) {
        const targetM = n * 1000;
        let bestTime = Infinity;
        let bestPace = Infinity;

        for (let i = 0; i < splits.length; i++) {
            let distAcc = 0;
            let timeAcc = 0;
            let j = i;

            while (j < splits.length && distAcc < targetM) {
                distAcc += splits[j].distance;
                timeAcc += splits[j].movingTime;
                j++;
            }

            if (distAcc >= targetM) {
                const overshootM = distAcc - targetM;
                const lastSplit = splits[j - 1];
                const lastSplitPace = lastSplit.movingTime / Math.max(lastSplit.distance, 1);
                const correctedTime = timeAcc - (overshootM * lastSplitPace);
                const pace = correctedTime / (targetM / 1000);

                const tolerance = 100 * n;
                // LOGGING FOR 5K and 10K
                if (n === 5 || n === 10) {
                    console.log(`[Target ${n}k] i=${i}, dist=${distAcc.toFixed(1)}m, overshoot=${overshootM.toFixed(1)}m, tol=${tolerance}m, corrTime=${formatDuration(correctedTime)}`);
                }

                if (overshootM <= tolerance && correctedTime < bestTime) {
                    bestTime = correctedTime;
                    bestPace = pace;
                }
            }
        }

        if (bestTime !== Infinity) {
            efforts.push({ distance: n, time: bestTime, pace: bestPace });
        }
    }
    return efforts;
}

for (const [id, title, source, perfStr, planStr, notes] of rows) {
    console.log(`\n--- Activity: ${title} (${id}) ---`);
    let perf: any = {};
    try { perf = JSON.parse(perfStr); } catch(e) {}

    let plan: any = {};
    try { plan = JSON.parse(planStr); } catch(e) {}

    const splits = perf.laps && perf.laps.length > 0 ? perf.laps : [];

    if (splits.length === 0) {
        console.log("No laps/splits found in performance blob.");
        continue;
    }

    const parsedWorkout = parseWorkout(plan.title || title || 'Workout', plan.description || notes || '');
    const segmented = segmentSplits(splits.map((s: any, i: number) => ({
        split: i + 1,
        distance: s.distance,
        movingTime: s.movingTime,
        elapsedTime: s.elapsedTime || s.movingTime,
        averageHeartrate: s.averageHeartrate || s.avgHeartRate || 0,
        elevationDiff: s.elevationDiff || 0
    })), parsedWorkout, title || 'Workout');

    console.log(`Total distance in splits: ${(splits.reduce((sum: number, s: any) => sum + s.distance, 0) / 1000).toFixed(2)} km`);
    console.log(`Classified splits count: ${segmented.classified.length}`);

    const efforts = getBestEfforts(segmented.classified);
    console.log("Best Efforts Found:", efforts.map(e => `${e.distance}k: ${formatDuration(e.time)} (${formatPaceSec(e.pace)}/km)`));
}

db.close();
