import { HyroxStation, HyroxActivityStats } from '../models/types.ts';

export type HyroxClass =
    | 'MEN_OPEN' | 'WOMEN_OPEN'
    | 'MEN_PRO' | 'WOMEN_PRO'
    | 'DOUBLES_MEN' | 'DOUBLES_WOMEN' | 'DOUBLES_MIXED'
    | 'RELAY';

interface ClassStandards {
    sledPush: number; // kg
    sledPull: number; // kg
    lunge: number;    // kg
    wallBall: number; // kg
    wallBallreps?: number; // usually 100, but height changes?
    wallBallHeight?: number; // meters (approx)
    baseTimeFactor: number; // Multiplier for baseline time (1.0 = Men Open)
}

export const HYROX_STANDARDS: Record<HyroxClass, ClassStandards> = {
    'MEN_OPEN': { sledPush: 152, sledPull: 103, lunge: 20, wallBall: 6, baseTimeFactor: 1.0 },
    'WOMEN_OPEN': { sledPush: 102, sledPull: 78, lunge: 10, wallBall: 4, baseTimeFactor: 1.1 },
    'MEN_PRO': { sledPush: 202, sledPull: 153, lunge: 30, wallBall: 9, baseTimeFactor: 1.15 }, // Heavier = Slower
    'WOMEN_PRO': { sledPush: 152, sledPull: 103, lunge: 20, wallBall: 6, baseTimeFactor: 1.2 },
    'DOUBLES_MEN': { sledPush: 152, sledPull: 103, lunge: 20, wallBall: 6, baseTimeFactor: 0.6 }, // Faster (Split work)
    'DOUBLES_WOMEN': { sledPush: 102, sledPull: 78, lunge: 10, wallBall: 4, baseTimeFactor: 0.65 },
    'DOUBLES_MIXED': { sledPush: 152, sledPull: 103, lunge: 20, wallBall: 6, baseTimeFactor: 0.62 }, // Usually Men's weights? No, Sleds are Men's weights, Lunges/Wallballs depend? (Actually Mixed uses Open Men weights mostly but let's approximate)
    'RELAY': { sledPush: 152, sledPull: 103, lunge: 20, wallBall: 6, baseTimeFactor: 0.5 }, // Sprint style
};

// Base station times for a "Good" Men Open athlete (~1:15 finish)
const BASE_TIMES: Record<HyroxStation, number> = {
    ski_erg: 255, // 4:15
    sled_push: 180, // 3:00
    sled_pull: 240, // 4:00
    burpee_broad_jumps: 270, // 4:30
    rowing: 255, // 4:15
    farmers_carry: 150, // 2:30
    sandbag_lunges: 210, // 3:30
    wall_balls: 240, // 4:00
    run_1km: 285 // 4:45
};

const ROXZONE_TIME = 5 * 60; // 5 minutes total transition time (optimistic but good goal)

export interface HyroxPrediction {
    totalTimeSeconds: number;
    totalTimeFormatted: string;
    splits: Record<HyroxStation, number>;
    runTotal: number;
    roxzone: number;
    weakestStation: HyroxStation;
    strongestStation: HyroxStation;
    percentile: number; // Estimated percentile
}

export function predictHyroxTime(
    runCapacity5k: string, // "20:00"
    knownStationStats: Partial<Record<HyroxStation, number>>,
    hyroxClass: HyroxClass = 'MEN_OPEN',
    simulation: { runGlobalImprovement?: number, stationGlobalImprovement?: number } = {}
): HyroxPrediction {

    const standards = HYROX_STANDARDS[hyroxClass];
    const classFactor = standards.baseTimeFactor;

    // 1. Analyze Running Base
    const [min, sec] = runCapacity5k.split(':').map(Number);
    const runTimeSeconds = min * 60 + sec;
    const pace5k = runTimeSeconds / 5; // seconds per km

    // Hyrox running fatigue + Class Factor (Pro run is same distance but heavier legs? Maybe slight impact)
    // Run improvement simulation (negative percentage = faster)
    const runMod = 1 - ((simulation.runGlobalImprovement || 0) / 100);
    const fatigueFactor = 1.15;
    const hyroxRunPace = (pace5k * fatigueFactor) * runMod;

    const totalRunTime = hyroxRunPace * 8;

    // 2. Estimate Station Times
    const estimatedSplits = { ...BASE_TIMES };

    const stationMod = 1 - ((simulation.stationGlobalImprovement || 0) / 100);

    Object.keys(estimatedSplits).forEach(k => {
        const key = k as HyroxStation;
        if (key === 'run_1km') return;

        let time = BASE_TIMES[key];

        // Scale by Class Difficulty (Pro takes longer)
        time = time * classFactor;

        // Apply known stats if available (and assume known stats are RELEVANT to the class, 
        // OR we should scale them? If user did Open Sled Push but selects Pro, we should slow them down).
        // For now, assume known stats are raw capability and scale them if moving UP classes.
        // Simplified: known stats override baseline, but we apply simulation improvement.
        if (knownStationStats[key]) {
            time = knownStationStats[key]!;
        }

        estimatedSplits[key] = time * stationMod;
    });

    // 3. Calculate Total
    let stationSum = 0;
    Object.entries(estimatedSplits).forEach(([k, v]) => {
        if (k !== 'run_1km') stationSum += v;
    });

    const totalSeconds = totalRunTime + stationSum + ROXZONE_TIME;

    // 4. Weak/Strong Logic (Updated to use dynamic splits)
    const ratios: { station: HyroxStation, ratio: number }[] = (Object.keys(estimatedSplits) as HyroxStation[])
        .filter(k => k !== 'run_1km')
        .map(station => ({
            station,
            ratio: estimatedSplits[station] / (BASE_TIMES[station] * classFactor) // Compare to CLASS baseline
        }));

    ratios.sort((a, b) => a.ratio - b.ratio);

    const strongest = ratios[0].station;
    const weakest = ratios[ratios.length - 1].station;

    return {
        totalTimeSeconds: totalSeconds,
        totalTimeFormatted: formatSeconds(totalSeconds),
        splits: estimatedSplits,
        runTotal: totalRunTime,
        roxzone: ROXZONE_TIME,
        weakestStation: weakest,
        strongestStation: strongest,
        percentile: calculateMockPercentile(totalSeconds, hyroxClass) // Pass class for accurate percentile
    };
}

function formatSeconds(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
}

function calculateMockPercentile(totalSeconds: number, hyroxClass: HyroxClass): number {
    // Pro times are slower, so thresholds should be higher
    let eliteThreshold = 3600; // 1h
    const standards = HYROX_STANDARDS[hyroxClass];

    if (hyroxClass.includes('PRO')) eliteThreshold += 600; // +10 mins for Pro Elite
    if (hyroxClass.includes('DOUBLES')) eliteThreshold -= 600; // -10 mins for Doubles Elite

    if (totalSeconds < eliteThreshold) return 99; // Elite
    if (totalSeconds < eliteThreshold + 900) return 90;
    if (totalSeconds < eliteThreshold + 1800) return 50;
    if (totalSeconds < eliteThreshold + 2700) return 30;
    return 10;
}
