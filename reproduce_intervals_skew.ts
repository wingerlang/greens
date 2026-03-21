import { segmentSplits, KmSplit } from './src/utils/splitsSegmenter.ts';

function createSplit(n: number, dist: number, timeSec: number): KmSplit {
    return {
        split: n,
        distance: dist,
        movingTime: timeSec,
    };
}

// Scenario 3: Walking recovery or very slow laps drag c2 up
// Lap 1: 2500m, 13:01 (781s) -> 312s/km (5:12)
// Lap 2: 500m, 1:50 (110s) -> 220s/km (3:40)
// Lap 3: 500m, 3:45 (225s) -> 450s/km (7:30) (Walking/Vila)
// Lap 4: 500m, 1:50 (110s) -> 220s/km (3:40)
// Lap 5: 500m, 3:45 (225s) -> 450s/km (7:30)
// Lap 6: 1000m, 350s -> 350s/km (5:50) (Cooldown)

const splits3: KmSplit[] = [
    createSplit(1, 2500, 781),
    createSplit(2, 500, 110),
    createSplit(3, 500, 225),
    createSplit(4, 500, 110),
    createSplit(5, 500, 225),
    createSplit(6, 1000, 350),
];

// Let's also create Scenario 4 with EXACTLY the paces that would trigger the issue
// 220 (Interval), 312 (Warmup), 450 (Walking)
const splits4: KmSplit[] = [
    createSplit(1, 1000, 312), // Warmup
    createSplit(2, 1000, 220), // Interval
    createSplit(3, 1000, 450), // Walking
    createSplit(4, 1000, 220), // Interval
    createSplit(5, 1000, 450), // Walking
];

const result3 = segmentSplits(splits3);
const result4 = segmentSplits(splits4);

const output = {
    scenario3: result3 ? result3.classified.map(s => ({ split: s.split, role: s.role, pace: s.movingTime / (s.distance / 1000) })) : null,
    scenario4: result4 ? result4.classified.map(s => ({ split: s.split, role: s.role, pace: s.movingTime / (s.distance / 1000) })) : null,
};

await Deno.writeTextFile("output_intervals_skew.json", JSON.stringify(output, null, 2));
console.log("Done");
