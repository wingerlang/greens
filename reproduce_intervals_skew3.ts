import { segmentSplits, KmSplit } from './src/utils/splitsSegmenter.ts';

function createSplit(n: number, dist: number, timeSec: number): KmSplit {
    return {
        split: n,
        distance: dist,
        movingTime: timeSec,
    };
}

// Scenario 6: 3 Intervals, 7 Recovery Laps (extreme skew)
// 3x 220s (3:40/km)
// 2x 312s (5:12/km) (Warmup, Cooldown)
// 7x 450s (7:30/km) (Recovery)
const splits6: KmSplit[] = [
    createSplit(1, 1000, 312), // Warmup
    createSplit(2, 500, 110),  // Interval (220)
    createSplit(3, 500, 225),  // Recovery (450)
    createSplit(4, 500, 110),  // Interval (220)
    createSplit(5, 500, 225),  // Recovery (450)
    createSplit(6, 500, 110),  // Interval (220)
    createSplit(7, 500, 225),  // Recovery (450)
    createSplit(8, 500, 225),  // Recovery (450)
    createSplit(9, 500, 225),  // Recovery (450)
    createSplit(10, 500, 225), // Recovery (450)
    createSplit(11, 500, 225), // Recovery (450)
    createSplit(12, 1000, 312), // Cooldown
];

const result6 = segmentSplits(splits6);

const output = {
    scenario6: result6 ? result6.classified.map(s => ({ split: s.split, role: s.role, pace: s.movingTime / (s.distance / 1000) })) : null,
};

await Deno.writeTextFile("output_intervals_skew3.json", JSON.stringify(output, null, 2));
console.log("Done");
