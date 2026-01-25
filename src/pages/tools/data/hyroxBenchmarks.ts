/**
 * Hyrox Benchmark Standards
 * Time-based benchmarks for all Hyrox stations across skill levels.
 * All times are in SECONDS.
 * 
 * Sources: Hyrox official finish time distributions, competition data, 
 * and community consensus estimates.
 */

import { HyroxStation } from '../../../models/types.ts';

// Level labels (Swedish)
export const HYROX_LEVEL_LABELS = ['Nybörjare', 'Motionär', 'Atlet', 'Avancerad', 'Elit', 'Pro'];

// Level colors for UI
export const HYROX_LEVEL_COLORS = [
    'from-slate-600 to-slate-500',      // Nybörjare
    'from-emerald-600 to-emerald-500',  // Motionär
    'from-blue-600 to-blue-500',        // Atlet
    'from-violet-600 to-violet-500',    // Avancerad
    'from-amber-500 to-yellow-400',     // Elit
    'from-rose-600 to-rose-500'         // Pro
];

// Station benchmarks per level (in seconds)
// [Nybörjare, Motionär, Atlet, Avancerad, Elit, Pro]
export const HYROX_STATION_BENCHMARKS: Record<HyroxStation, { male: number[]; female: number[] }> = {
    ski_erg: {
        male: [420, 360, 300, 260, 230, 200],   // 7:00 -> 3:20
        female: [480, 420, 360, 310, 270, 240]    // 8:00 -> 4:00
    },
    sled_push: {
        male: [300, 240, 180, 150, 130, 100],   // 5:00 -> 1:40
        female: [360, 300, 240, 200, 160, 130]    // 6:00 -> 2:10
    },
    sled_pull: {
        male: [360, 300, 240, 210, 180, 150],   // 6:00 -> 2:30
        female: [420, 360, 300, 260, 220, 180]    // 7:00 -> 3:00
    },
    burpee_broad_jumps: {
        male: [360, 300, 240, 200, 160, 130],   // 6:00 -> 2:10
        female: [420, 360, 300, 250, 200, 160]    // 7:00 -> 2:40
    },
    rowing: {
        male: [420, 360, 300, 260, 230, 200],   // 7:00 -> 3:20
        female: [480, 420, 360, 310, 270, 235]    // 8:00 -> 3:55
    },
    farmers_carry: {
        male: [240, 180, 140, 110, 90, 70],     // 4:00 -> 1:10
        female: [300, 240, 180, 140, 110, 90]     // 5:00 -> 1:30
    },
    sandbag_lunges: {
        male: [420, 360, 300, 250, 210, 170],   // 7:00 -> 2:50
        female: [480, 420, 360, 300, 250, 200]    // 8:00 -> 3:20
    },
    wall_balls: {
        male: [420, 360, 300, 260, 220, 180],   // 7:00 -> 3:00
        female: [480, 420, 360, 310, 260, 220]    // 8:00 -> 3:40
    },
    run_1km: {
        male: [390, 330, 300, 270, 240, 210],   // 6:30 -> 3:30
        female: [450, 390, 360, 320, 280, 250]    // 7:30 -> 4:10
    }
};

// Full race time benchmarks (in seconds)
// [Nybörjare, Motionär, Atlet, Avancerad, Elit, Pro]
export const HYROX_RACE_BENCHMARKS = {
    male: [7200, 6000, 5100, 4500, 4200, 3660],   // 2:00:00 -> 1:01:00
    female: [7800, 6600, 5700, 5100, 4500, 4020]    // 2:10:00 -> 1:07:00
};

// Get level index based on time (lower is better)
export function getHyroxLevelIndex(time: number, benchmarks: number[]): number {
    for (let i = benchmarks.length - 1; i >= 0; i--) {
        if (time <= benchmarks[i]) return i + 1;
    }
    return 0; // Slower than Nybörjare
}

// Get level label
export function getHyroxLevelLabel(index: number): string {
    return HYROX_LEVEL_LABELS[Math.min(index, HYROX_LEVEL_LABELS.length - 1)] || 'Nybörjare';
}

// Get descriptive percentile for a given time vs benchmarks
export function getHyroxPercentile(time: number, benchmarks: number[]): number {
    // Estimate what % of participants you're faster than
    // Based on level, rough distribution:
    // Nybörjare: bottom 10%, Motionär: 10-40%, Atlet: 40-70%, Avancerad: 70-90%, Elit: 90-98%, Pro: 98-100%
    const PERCENTILE_RANGES = [10, 40, 70, 90, 98, 100];
    const levelIdx = getHyroxLevelIndex(time, benchmarks);

    if (levelIdx === 0) return 5; // Below Nybörjare

    const prevPct = PERCENTILE_RANGES[levelIdx - 2] || 0;
    const nextPct = PERCENTILE_RANGES[levelIdx - 1] || 100;

    // Interpolate within the level range
    const levelStart = benchmarks[levelIdx - 1] || benchmarks[0] * 1.2;
    const levelEnd = benchmarks[levelIdx] || benchmarks[benchmarks.length - 1];

    // Calculate position within level (inverted because lower time is better)
    const position = 1 - (time - levelEnd) / (levelStart - levelEnd);
    const clampedPosition = Math.max(0, Math.min(1, position));

    return Math.round(prevPct + (nextPct - prevPct) * clampedPosition);
}
