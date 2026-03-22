import { segmentSplits, KmSplit } from './src/utils/splitsSegmenter.ts';

function createSplit(n: number, dist: number, timeSec: number): KmSplit {
    return {
        split: n,
        distance: dist,
        movingTime: timeSec,
    };
}

const splits5: KmSplit[] = [
    createSplit(1, 1000, 313), // 5:13/km (Warmup)
    createSplit(2, 1000, 224), // 3:44/km (Interval)
    createSplit(3, 1000, 650), // 10:50/km (Very Slow Walking)
    createSplit(4, 1000, 224), // 3:44/km (Interval)
    createSplit(5, 1000, 650), // 10:50/km
];

const result5 = segmentSplits(splits5);

const output = {
    scenario5: result5 ? result5.classified.map(s => ({ split: s.split, role: s.role, pace: s.movingTime / (s.distance / 1000) })) : null,
};

await Deno.writeTextFile("output_intervals_skew2.json", JSON.stringify(output, null, 2));
console.log("Done");
