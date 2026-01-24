import { HyroxStation, HyroxSessionSummary } from '../models/types.ts';

export interface HyroxMetrics {
    fatigueIndex: number; // Percentage increase from fastest to slowest run
    pacingDecay: number;  // Slope of run pace regression
    aerobicVsFunctionalRatio: number; // Running time / Station time
    bestStation: { id: HyroxStation; label: string; time: number; delta: number };
    worstStation: { id: HyroxStation; label: string; time: number; delta: number };
    projectedFullRaceTime?: number; // Estimated time for a full 8x8 race
    strengths: string[];
    weaknesses: string[];
    narrative: string;
}

const STATION_LABELS: Record<HyroxStation, string> = {
    ski_erg: '1000m SkiErg',
    sled_push: '50m Sled Push',
    sled_pull: '50m Sled Pull',
    burpee_broad_jumps: '80m BBJ',
    rowing: '1000m Rowing',
    farmers_carry: '200m Farmers Carry',
    sandbag_lunges: '100m Sandbag Lunges',
    wall_balls: 'Wall Balls',
    run_1km: '1km Run'
};

// Benchmarks (Pro times as baseline for comparison)
const PRO_BENCHMARKS: Partial<Record<HyroxStation, number>> = {
    ski_erg: 230,        // 3:50
    sled_push: 130,      // 2:10
    sled_pull: 210,      // 3:30
    burpee_broad_jumps: 180, // 3:00
    rowing: 235,         // 3:55
    farmers_carry: 100,  // 1:40
    sandbag_lunges: 220, // 3:40
    wall_balls: 240,     // 4:00
    run_1km: 240         // 4:00/km
};

export function analyzeHyroxRace(session: HyroxSessionSummary): HyroxMetrics {
    const runSplits = session.runSplits || [];
    const stations = session.splits || {};

    // 1. Fatigue Analysis
    const validRuns = (runSplits || []).filter((r: number) => r > 0);
    let fatigueIndex = 0;
    let pacingDecay = 0;

    if (validRuns.length >= 2) {
        const fastest = Math.min(...validRuns);
        const slowest = Math.max(...validRuns);
        fatigueIndex = ((slowest - fastest) / fastest) * 100;

        // Pacing decay (slope-ish)
        const run1 = validRuns[0];
        const runLast = validRuns[validRuns.length - 1];
        pacingDecay = ((runLast - run1) / run1) * 100;
    }

    // 2. Aerobic vs Functional power
    const totalRunTime = validRuns.reduce((a: number, b: number) => a + b, 0);
    const totalStationTime = Object.values(stations).reduce((acc: number, val: number | undefined) => acc + (val || 0), 0);
    const aerobicVsFunctionalRatio = totalStationTime > 0 ? totalRunTime / totalStationTime : 1;

    // 3. Station Performance
    const stationMetrics = Object.entries(stations)
        .filter(([id, time]) => id !== 'run_1km' && time && time > 0)
        .map(([id, time]) => {
            const sid = id as HyroxStation;
            const bench = PRO_BENCHMARKS[sid] || 300;
            const delta = ((time! - bench) / bench) * 100;
            return { id: sid, label: STATION_LABELS[sid], time: time!, delta };
        })
        .sort((a, b) => a.delta - b.delta);

    const bestStation = stationMetrics[0] || { id: 'ski_erg' as HyroxStation, label: 'N/A', time: 0, delta: 0 };
    const worstStation = stationMetrics[stationMetrics.length - 1] || { id: 'wall_balls' as HyroxStation, label: 'N/A', time: 0, delta: 0 };

    // 4. Insights & Narrative
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (aerobicVsFunctionalRatio > 1.2) strengths.push('Stark kondition: Du bibehåller farten i löpningen väl.');
    else if (aerobicVsFunctionalRatio < 0.8) strengths.push('Funktionell styrka: Du är snabbast inne i zonerna.');

    if (pacingDecay > 15) weaknesses.push('Uthållighet: Din löpfart sjunker markant mot slutet.');
    if (fatigueIndex > 20) weaknesses.push('Återhämtning: Du har svårt att sänka pulsen efter tunga stationer.');

    if (bestStation.delta < 50) strengths.push(`Mästerlig i ${bestStation.label}.`);
    if (worstStation.delta > 100) weaknesses.push(`Tidstapp i ${worstStation.label}. Flytta mer vikt här!`);

    // Narrative generation
    let narrative = '';
    if (validRuns.length < 8 || Object.keys(stations).length < 8) {
        narrative = "Detta ser ut som en simulation eller ett delat pass. ";
        if (pacingDecay > 10) narrative += "Redan här ser vi att tempot faller – fokusera på 'Hybrid Engine' träning.";
        else narrative += "Du håller jämna splits, vilket lovar gott inför en full distans!";
    } else {
        narrative = pacingDecay < 5
            ? "En perfekt genomförd tävling med 'negative splits' eller jämnt tempo."
            : "Tävlingsanalysen visar på ett starkt öppningstempo, men tröttheten tar ut sin rätt under andra halvan.";
    }

    // 5. Projected Finish (if applicable)
    let projectedFullRaceTime: number | undefined = undefined;
    if (totalRunTime > 0 && totalStationTime > 0) {
        // Simple projection: sum of current splits + average of missing ones + estimated 5 min roxzone
        const avgRun = totalRunTime / validRuns.length;
        const stationValues = Object.values(stations).filter((v): v is number => typeof v === 'number');
        const avgStation = stationValues.length > 0 ? stationValues.reduce((a, b) => a + b, 0) / stationValues.length : 300;
        projectedFullRaceTime = (avgRun * 8) + (avgStation * 8) + 300; // +5 mins transitions
    }

    return {
        fatigueIndex,
        pacingDecay,
        aerobicVsFunctionalRatio,
        bestStation,
        worstStation,
        projectedFullRaceTime,
        strengths,
        weaknesses,
        narrative
    };
}
