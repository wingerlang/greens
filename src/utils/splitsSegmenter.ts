import { WorkoutSegment, ParsedWorkout } from '../models/analysisTypes.ts';

export interface KmSplit {
    split: number;
    distance: number;
    movingTime: number;
    elapsedTime?: number;
    averageHeartrate?: number;
    elevationDiff?: number;
    averageSpeed?: number;
    paceZone?: number;
}

export interface ClassifiedSplit extends KmSplit {
    role: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'unknown';
    intervalNumber?: number;
    groupLabel?: string;
}

export interface SegmentedSplits {
    type: 'intervals' | 'sustained';
    classified: ClassifiedSplit[];
    warmupSplits: ClassifiedSplit[];
    intervalGroups: {
        number: number;
        intervalSplits: ClassifiedSplit[];
        recoverySplits: ClassifiedSplit[];
        avgPace: number;
        avgHR?: number;
    }[];
    cooldownSplits: ClassifiedSplit[];
    summary: {
        warmupKm: number;
        cooldownKm: number;
        totalIntervalKm: number;
        totalRecoveryKm: number;
        avgIntervalPace: number;
        avgRecoveryPace: number;
        fastestIntervalPace: number;
        slowestIntervalPace: number;
    };
}

export function segmentSplits(splits: KmSplit[], parsed?: ParsedWorkout, title?: string): SegmentedSplits | null {
    if (!splits || splits.length < 3) return null;

    const lowerTitle = (title || '').toLowerCase();
    const isExplicitlyDistance = lowerTitle.includes('distans') || lowerTitle.includes('zone 2') || lowerTitle.includes('z2') || lowerTitle.includes('lugnt');
    const isExplicitlyInterval = lowerTitle.includes('intervall') || lowerTitle.includes('reps') || lowerTitle.includes('tempo') || lowerTitle.includes('tröskel') || (parsed && parsed.suggestedSubType === 'interval');

    // 1. Beräkna tempo (sekunder per km)
    const paces = splits.map(s => s.movingTime / (Math.max(s.distance, 1) / 1000));

    const classified: ClassifiedSplit[] = splits.map(s => ({ ...s, role: 'unknown' as const }));

    // --- Pre-check: Title-Driven sequence matching ---
    const expectedSequence: { role: 'interval' | 'recovery', distance: number }[] = [];
    if (parsed) {
        parsed.segments.forEach(seg => {
            for (let i = 0; i < seg.reps; i++) {
                if (seg.work.dist) expectedSequence.push({ role: 'interval', distance: seg.work.dist });
                if (seg.recovery && seg.recovery.type === 'distance' && seg.recovery.value) {
                    expectedSequence.push({ role: 'recovery', distance: seg.recovery.value });
                }
            }
        });
    }

    let isTitleMatched = false;
    let bestStart = -1;
    let bestMatchCount = 0;

    if (expectedSequence.length >= 2 && splits.length >= expectedSequence.length) {
        for (let i = 0; i <= splits.length - expectedSequence.length; i++) {
            let matchCount = 0;
            for (let j = 0; j < expectedSequence.length; j++) {
                const split = splits[i + j];
                const exp = expectedSequence[j];
                const distDiff = Math.abs(split.distance - exp.distance);
                const tolerance = Math.max(150, exp.distance * 0.20); // 20% tolerance or 150m
                if (distDiff <= tolerance) matchCount++;
            }
            if (matchCount > bestMatchCount) {
                bestMatchCount = matchCount;
                bestStart = i;
            }
        }
        // At least 75% items match, and matched items count has to be reasonable
        if (bestMatchCount >= Math.ceil(expectedSequence.length * 0.75) && bestStart !== -1) {
            isTitleMatched = true;
        }
    }

    if (isTitleMatched && bestStart !== -1) {
        for (let i = 0; i < bestStart; i++) classified[i].role = 'warmup';
        for (let i = bestStart + expectedSequence.length; i < classified.length; i++) classified[i].role = 'cooldown';
        
        let intervalNumber = 0;
        for (let j = 0; j < expectedSequence.length; j++) {
            const splitIdx = bestStart + j;
            const exp = expectedSequence[j];
            if (exp.role === 'interval') {
                intervalNumber++;
                classified[splitIdx].role = 'interval';
                classified[splitIdx].intervalNumber = intervalNumber;
            } else {
                classified[splitIdx].role = 'recovery';
                classified[splitIdx].intervalNumber = intervalNumber;
            }
        }
    } else {
        // 2. K-Means Klustring (k=3) för att dynamiskt hitta tempogränser
        let c1 = Math.min(...paces); // Snabbast (Intervall)
        let c3 = Math.max(...paces); // Långsammast (Uppjogg/Nerjogg)
        let c2 = (c1 + c3) / 2;      // Vila (Mellan)

        for (let iter = 0; iter < 5; iter++) {
            const g1: number[] = [], g2: number[] = [], g3: number[] = [];
            for (const p of paces) {
                const d1 = Math.abs(p - c1);
                const d2 = Math.abs(p - c2);
                const d3 = Math.abs(p - c3);
                if (d1 <= d2 && d1 <= d3) g1.push(p);
                else if (d2 <= d1 && d2 <= d3) g2.push(p);
                else g3.push(p);
            }
            if (g1.length) c1 = g1.reduce((a, b) => a + b, 0) / g1.length;
            if (g2.length) c2 = g2.reduce((a, b) => a + b, 0) / g2.length;
            if (g3.length) c3 = g3.reduce((a, b) => a + b, 0) / g3.length;
        }

        // --- Robusthets-checkar ---
        const maxPace = Math.max(...paces);
        const minPace = Math.min(...paces);
        const paceRange = maxPace - minPace;
        const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;

        const minRequiredRange = isExplicitlyInterval ? 15 : 35;
        if (paceRange < minRequiredRange && !isExplicitlyInterval) return null;
        if (isExplicitlyDistance && paceRange < 50) return null;

        const clusterDiff = Math.abs(c1 - c2);
        const minClusterDiff = isExplicitlyInterval ? 10 : 25;
        if (clusterDiff < minClusterDiff && !isExplicitlyInterval) return null;

        const threshold = (c1 + c2) / 2;
        const isFast = paces.map(p => p < threshold);

        const firstFastIdx = isFast.indexOf(true);
        const lastFastIdx = isFast.lastIndexOf(true);

        if (firstFastIdx === -1) return null;

        // 3. Applicera roller enbart baserat på faktisk data
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
    }

    // 4. Bygg IntervalGroups för UI:t
    const intervalGroups: SegmentedSplits['intervalGroups'] = [];
    let currentGroup: { number: number; intervalSplits: ClassifiedSplit[]; recoverySplits: ClassifiedSplit[] } | null = null;

    for (const split of classified) {
        if (split.role === 'interval') {
            if (!currentGroup || currentGroup.number !== split.intervalNumber!) {
                if (currentGroup) {
                    intervalGroups.push({
                        ...currentGroup,
                        avgPace: currentGroup.intervalSplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / currentGroup.intervalSplits.length,
                        avgHR: currentGroup.intervalSplits.some(sp => sp.averageHeartrate) ?
                            currentGroup.intervalSplits.reduce((s, sp) => s + (sp.averageHeartrate || 0), 0) / currentGroup.intervalSplits.filter(sp => sp.averageHeartrate).length : undefined
                    });
                }
                currentGroup = { number: split.intervalNumber!, intervalSplits: [], recoverySplits: [] };
            }
            currentGroup.intervalSplits.push(split);
        } else if (split.role === 'recovery' && currentGroup) {
            currentGroup.recoverySplits.push(split);
        }
    }

    if (currentGroup) {
        intervalGroups.push({
            ...currentGroup,
            avgPace: currentGroup.intervalSplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / currentGroup.intervalSplits.length,
            avgHR: currentGroup.intervalSplits.some(sp => sp.averageHeartrate) ?
                currentGroup.intervalSplits.reduce((s, sp) => s + (sp.averageHeartrate || 0), 0) / currentGroup.intervalSplits.filter(sp => sp.averageHeartrate).length : undefined
        });
    }

    // 5. Sammanställ summary
    const warmupSplits = classified.filter(s => s.role === 'warmup');
    const cooldownSplits = classified.filter(s => s.role === 'cooldown');
    const allIntervalSplits = classified.filter(s => s.role === 'interval');
    const allRecoverySplits = classified.filter(s => s.role === 'recovery');

    const totalIntervalKm = allIntervalSplits.reduce((s, sp) => s + sp.distance / 1000, 0);
    const totalRecoveryKm = allRecoverySplits.reduce((s, sp) => s + sp.distance / 1000, 0);

    const avgIntervalPace = allIntervalSplits.length > 0
        ? allIntervalSplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / allIntervalSplits.length : 0;
    const avgRecoveryPace = allRecoverySplits.length > 0
        ? allRecoverySplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / allRecoverySplits.length : 0;
    const intervalPaces = allIntervalSplits.map(sp => sp.movingTime / (Math.max(sp.distance, 1) / 1000));

    // Detect if this is a sustained effort (tempo/test run)
    // We consider it sustained if it's one block and little to no recovery between warmup/cooldown
    const type = (intervalGroups.length === 1 && totalRecoveryKm < 0.1) ? 'sustained' : 'intervals';

    return {
        type,
        classified,
        warmupSplits,
        intervalGroups,
        cooldownSplits,
        summary: {
            warmupKm: warmupSplits.reduce((s, sp) => s + sp.distance / 1000, 0),
            cooldownKm: cooldownSplits.reduce((s, sp) => s + sp.distance / 1000, 0),
            totalIntervalKm,
            totalRecoveryKm,
            avgIntervalPace,
            avgRecoveryPace,
            fastestIntervalPace: intervalPaces.length > 0 ? Math.min(...intervalPaces) : 0,
            slowestIntervalPace: intervalPaces.length > 0 ? Math.max(...intervalPaces) : 0,
        }
    };
}
