import { segmentSplits, KmSplit } from './src/utils/splitsSegmenter.ts';

function createSplit(n: number, dist: number, timeSec: number): KmSplit {
    return {
        split: n,
        distance: dist,
        movingTime: timeSec,
    };
}

const splits1: KmSplit[] = [
    createSplit(1, 2500, 781), // 5:12/km
    createSplit(2, 510, 113),  // 3:41/km
    createSplit(3, 80, 45),    // 9:22/km
    createSplit(4, 510, 115),  // 3:45/km
    createSplit(5, 80, 45),    // 9:22/km
    createSplit(6, 1000, 330), // 5:30/km
];

const result1 = segmentSplits(splits1);

const splits2: KmSplit[] = [
    createSplit(1, 2500, 781), // 5:12/km
    createSplit(2, 510, 113),  // 3:41/km
    createSplit(3, 80, 45),    // 9:22/km
    createSplit(4, 510, 115),  // 3:45/km
    createSplit(5, 80, 45),    // 9:22/km
    createSplit(6, 510, 112),  // 3:40/km
    createSplit(7, 80, 45),    // 9:22/km
    createSplit(8, 2000, 700), // 5:50/km
];

const result2 = segmentSplits(splits2);

const output = {
    scenario1: result1 ? result1.classified.map(s => ({ split: s.split, role: s.role, pace: s.movingTime / (s.distance / 1000) })) : null,
    scenario2: result2 ? result2.classified.map(s => ({ split: s.split, role: s.role, pace: s.movingTime / (s.distance / 1000) })) : null,
};

await Deno.writeTextFile("output_intervals.json", JSON.stringify(output, null, 2));
console.log("Done");
