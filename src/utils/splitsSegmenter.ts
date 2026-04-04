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
        avgIntervalHR?: number;
        avgRecoveryHR?: number;
        fastestIntervalPace: number;
        slowestIntervalPace: number;
    };
}

function getDistanceInTitle(title: string): number | null {
    // Look for 5km, 10km, 21.1km, 42.2km, 5k, 10k, 1/2 marathon, halvmarathon, mil, etc.
    const normalized = title.toLowerCase();
    
    // Check for "mil" (Swedish for 10km)
    if (normalized.includes('milen') || (normalized.match(/(?:\s|^)mil(?:\s|$)/) && !normalized.match(/\d/))) return 10;
    
    const milMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*mil/);
    if (milMatch) return parseFloat(milMatch[1].replace(',', '.')) * 10;

    const kmMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:km|k\b)/);
    if (kmMatch) return parseFloat(kmMatch[1].replace(',', '.'));

    if (normalized.includes('halvmarathon') || normalized.includes('half marathon') || normalized.includes('halvmarata')) return 21.1;
    if (normalized.includes('marathon') || normalized.includes('marata')) return 42.195;

    return null;
}

export function segmentSplits(splits: KmSplit[], parsed?: ParsedWorkout, title?: string): SegmentedSplits | null {
    if (!splits || splits.length < 3) return null;

    const lowerTitle = (title || '').toLowerCase();
    
    // Explicit exclusions for any analysis
    const isExplicitlyDistance = lowerTitle.includes('distans') || lowerTitle.includes('zone 2') || lowerTitle.includes('z2') || lowerTitle.includes('lugnt') || lowerTitle.includes('återhämtning') || lowerTitle.includes('recovery');
    
    // Keywords that imply separate work/rest repeats
    const isExplicitlyInterval = lowerTitle.includes('intervall') || lowerTitle.includes('reps') || lowerTitle.includes('tusingar') || lowerTitle.includes('backe') || (parsed && parsed.suggestedSubType === 'interval');
    
    // Keywords that imply a single hard effort block
    const distInTitle = getDistanceInTitle(lowerTitle);
    const hasDistKeyword = distInTitle !== null;
    const isExplicitlySustained = lowerTitle.includes('tempo') || lowerTitle.includes('tröskel') || lowerTitle.includes('max') || lowerTitle.includes('test') || lowerTitle.includes('race') || lowerTitle.includes('lopp') || lowerTitle.includes('pb') || lowerTitle.includes('rekord') || lowerTitle.includes('tävling') || hasDistKeyword;

    if (isExplicitlyDistance && !isExplicitlyInterval && !hasDistKeyword) {
        return null; // Skip interval clustering for explicit distance/recovery runs
    }

    // 1. Calculate pace (seconds per km)
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
        if (bestMatchCount >= Math.ceil(expectedSequence.length * 0.75) && bestStart !== -1) {
            isTitleMatched = true;
        }
    }

    if (isTitleMatched && bestStart !== -1) {
        // ... (title matching logic remains the same)
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
        // 2. K-Means Clustering (k=3)
        const uniquePaces = [...new Set(paces)].sort((a, b) => a - b);
        let c1 = uniquePaces[0]; // Fast
        let c3 = uniquePaces[uniquePaces.length - 1]; // Slow
        let c2 = uniquePaces.length >= 3 ? uniquePaces[Math.floor(uniquePaces.length / 2)] : (c1 + c3) / 2;

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

        // --- Robustness Checks ---
        const maxPace = Math.max(...paces);
        const minPace = Math.min(...paces);
        const paceRange = maxPace - minPace;

        // Requirement: Range must be significant for non-explicit sessions
        const minRequiredRange = isExplicitlyInterval ? 15 : 45; 
        if (paceRange < minRequiredRange && !isExplicitlyInterval && !isExplicitlySustained) return null;

        // Determine if clustering is valid (Fast vs Medium gap)
        const clusterDiff = Math.abs(c1 - c2);
        const minClusterDiff = isExplicitlyInterval ? 12 : 25;
        if (clusterDiff < minClusterDiff && !isExplicitlyInterval && !isExplicitlySustained) return null;

        const threshold = (c1 + c2) / 2;
        const isFast = paces.map(p => p < threshold);

        const firstFastIdx = isFast.indexOf(true);
        const lastFastIdx = isFast.lastIndexOf(true);

        if (firstFastIdx === -1) return null;

        // 3. Apply roles
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

    // 4. Build IntervalGroups
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

    // 5. Sustained Effort Refinement & Logic
    const allIntervalSplits = classified.filter(s => s.role === 'interval');
    const allRecoverySplits = classified.filter(s => s.role === 'recovery');
    
    const avgIntervalPace = allIntervalSplits.length > 0
        ? allIntervalSplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / allIntervalSplits.length : 0;
    const avgRecoveryPace = allRecoverySplits.length > 0
        ? allRecoverySplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / allRecoverySplits.length : 0;

    const paceRatio = avgIntervalPace > 0 ? avgRecoveryPace / avgIntervalPace : 0;
    
    // Heuristic: If "recovery" is less than 18% slower than "intervals", it's likely a sustained run.
    const isVeryClosePace = paceRatio > 0 && paceRatio < 1.18;

    let type: 'intervals' | 'sustained' = (intervalGroups.length === 1 && allRecoverySplits.length === 0) ? 'sustained' : 'intervals';
    
    if (isExplicitlySustained || isVeryClosePace) {
        type = 'sustained';
        
        // COLLAPSE & EXPAND LOGIC: If sustained, we merge all interval blocks into one
        const firstIntervalIdx = classified.findIndex(s => s.role === 'interval');
        let lastIntervalIdx = classified.lastIndexOf(classified.findLast(s => s.role === 'interval')!);
        
        if (firstIntervalIdx !== -1) {
            // STRATEGY 1: Title-based extension
            // If the title says "10km" and we only found 3km, check if we can extend to 10km if the pace is decent
            if (distInTitle && lastIntervalIdx - firstIntervalIdx < distInTitle - 1) {
                const targetIdx = firstIntervalIdx + Math.round(distInTitle) - 1;
                // Extend if we have the laps and the pace isn't extremely slow (e.g. > 30% slower than interval)
                for (let i = lastIntervalIdx + 1; i <= Math.min(targetIdx, classified.length - 1); i++) {
                    const lapPace = paces[i];
                    if (lapPace < avgIntervalPace * 1.35) { // 35% margin for "fading" in a race
                        classified[i].role = 'interval';
                        lastIntervalIdx = i;
                    } else {
                        break; // Too slow, stop extending
                    }
                }
            }

            // STRATEGY 2: Dynamic extension (re-classify cooldown if still somewhat fast)
            // If we are in "sustained" mode and the "cooldown" is still fast (e.g. within 20% of effort), it belongs to effort
            for (let i = lastIntervalIdx + 1; i < classified.length; i++) {
                if (classified[i].role === 'cooldown' && paces[i] < avgIntervalPace * 1.25) {
                    classified[i].role = 'interval';
                    lastIntervalIdx = i;
                } else {
                    break;
                }
            }

            // Perform the vertical collapse
            for (let i = firstIntervalIdx; i <= lastIntervalIdx; i++) {
                classified[i].role = 'interval';
                classified[i].intervalNumber = 1;
            }
            
            // Rebuild groups with new collapsed state
            intervalGroups.length = 0;
            const collapsedSplits = classified.filter(s => s.role === 'interval');
            intervalGroups.push({
                number: 1,
                intervalSplits: collapsedSplits,
                recoverySplits: [],
                avgPace: collapsedSplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / collapsedSplits.length,
                avgHR: collapsedSplits.some(sp => sp.averageHeartrate) ?
                    collapsedSplits.reduce((s, sp) => s + (sp.averageHeartrate || 0), 0) / collapsedSplits.filter(sp => sp.averageHeartrate).length : undefined
            });
        }
    }

    // Final exclusion for accidental noisy sustained runs
    if (type === 'sustained' && !isExplicitlySustained && !isExplicitlyInterval) {
        // If it's a "sustained" run by heuristic, but the pace is very close to warmup/cooldown, ignore it
        const warmupPace = classified.filter(s => s.role === 'warmup').reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / classified.filter(s => s.role === 'warmup').length;
        if (avgIntervalPace / warmupPace > 0.95) {
             // Too close to warmup pace to be a meaningful "effort" block
             // (unless user explicitly named it Tempo/Max)
             return null;
        }
    }

    const warmupSplits = classified.filter(s => s.role === 'warmup');
    const cooldownSplits = classified.filter(s => s.role === 'cooldown');
    const finalIntervalSplits = classified.filter(s => s.role === 'interval');
    const finalRecoverySplits = classified.filter(s => s.role === 'recovery');

    const totalIntervalKm = finalIntervalSplits.reduce((s, sp) => s + sp.distance / 1000, 0);
    const totalRecoveryKm = finalRecoverySplits.reduce((s, sp) => s + sp.distance / 1000, 0);
    const intervalPaces = finalIntervalSplits.map(sp => sp.movingTime / (Math.max(sp.distance, 1) / 1000));

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
            avgIntervalPace: finalIntervalSplits.length > 0 ? finalIntervalSplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / finalIntervalSplits.length : 0,
            avgRecoveryPace: finalRecoverySplits.length > 0 ? finalRecoverySplits.reduce((s, sp) => s + sp.movingTime / (Math.max(sp.distance, 1) / 1000), 0) / finalRecoverySplits.length : 0,
            avgIntervalHR: finalIntervalSplits.some(s => s.averageHeartrate) ? 
                Math.round(finalIntervalSplits.reduce((s, sp) => s + (sp.averageHeartrate || 0), 0) / finalIntervalSplits.filter(s => s.averageHeartrate).length) : undefined,
            avgRecoveryHR: finalRecoverySplits.some(s => s.averageHeartrate) ?
                Math.round(finalRecoverySplits.reduce((s, sp) => s + (sp.averageHeartrate || 0), 0) / finalRecoverySplits.filter(s => s.averageHeartrate).length) : undefined,
            fastestIntervalPace: intervalPaces.length > 0 ? Math.min(...intervalPaces) : 0,
            slowestIntervalPace: intervalPaces.length > 0 ? Math.max(...intervalPaces) : 0,
        }
    };
}

