function segmentSplitsFixed(splits: any[], parsed?: any, title?: string): any {
    if (!splits || splits.length < 3) return null;

    const lowerTitle = (title || '').toLowerCase();
    const isExplicitlyDistance = lowerTitle.includes('distans') || lowerTitle.includes('zone 2') || lowerTitle.includes('z2') || lowerTitle.includes('lugnt');
    const isExplicitlyInterval = lowerTitle.includes('intervall') || lowerTitle.includes('reps') || lowerTitle.includes('tempo') || lowerTitle.includes('tröskel');

    const paces = splits.map(s => s.movingTime / (Math.max(s.distance, 1) / 1000));
    const classified = splits.map(s => ({ ...s, role: 'unknown' }));

    // --- Title-driven matching skipped for this test ---

    // 2. K-Means Klustring (k=3) för att dynamiskt hitta tempogränser
    // --- FIX APPLIED HERE ---
    // Take unique paces to find distinct levels (e.g. Interval, Warmup, Recovery)
    // and sort them to get robust center initialization
    const uniquePaces = [...new Set(paces)].sort((a, b) => a - b);

    let c1 = uniquePaces[0]; // Fastest
    let c3 = uniquePaces[uniquePaces.length - 1]; // Slowest
    let c2 = (c1 + c3) / 2; // Default fallback if length < 3

    if (uniquePaces.length >= 3) {
        c2 = uniquePaces[Math.floor(uniquePaces.length / 2)]; // Invariant to lap count skew
    } else if (uniquePaces.length === 2) {
        c2 = (c1 + c3) / 2;
    }

    for (let iter = 0; iter < 5; iter++) {
        const g1: number[] = [], g2: number[] = [], g3: number[] = [];
        for (const p of paces) {
            const d1 = Math.abs(p - c1);
            const d2 = Math.abs(p - c3); // Wait, this is cluster diff
            const d2_actual = Math.abs(p - c2);
            const d3_actual = Math.abs(p - c3);

            if (d1 <= d2_actual && d1 <= d3_actual) g1.push(p);
            else if (d2_actual <= d1 && d2_actual <= d3_actual) g2.push(p);
            else g3.push(p);
        }
        if (g1.length) c1 = g1.reduce((a, b) => a + b, 0) / g1.length;
        if (g2.length) c2 = g2.reduce((a, b) => a + b, 0) / g2.length;
        if (g3.length) c3 = g3.reduce((a, b) => a + b, 0) / g3.length;
    }

    const threshold = (c1 + c2) / 2;
    const isFast = paces.map(p => p < threshold);

    const firstFastIdx = isFast.indexOf(true);
    const lastFastIdx = isFast.lastIndexOf(true);

    if (firstFastIdx === -1) return null;

    for (let i = 0; i < firstFastIdx; i++) classified[i].role = 'warmup';
    for (let i = lastFastIdx + 1; i < classified.length; i++) classified[i].role = 'cooldown';

    let intervalNumber = 0;
    let inInterval = false;

    for (let i = firstFastIdx; i <= lastFastIdx; i++) {
        if (isFast[i]) {
            if (!inInterval) {
                intervalNumber++;
                inInterval = true;
            }
            classified[i].role = 'interval';
            classified[i].intervalNumber = intervalNumber;
        } else {
            inInterval = false;
            classified[i].role = 'recovery';
            classified[i].intervalNumber = intervalNumber;
        }
    }

    return { classified };
}

function createSplit(n: number, dist: number, timeSec: number): any {
    return {
        split: n,
        distance: dist,
        movingTime: timeSec,
    };
}

const splits6: any[] = [
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

const result = segmentSplitsFixed(splits6);

const output = {
    scenario6_fixed: result ? result.classified.map((s: any) => ({ split: s.split, role: s.role, pace: s.movingTime / (s.distance / 1000) })) : null,
};

await Deno.writeTextFile("output_intervals_skew4_fixed.json", JSON.stringify(output, null, 2));
console.log("Done");
