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
        avgWarmupPace: number;
        avgCooldownPace: number;
        avgIntervalHR?: number;
        avgRecoveryHR?: number;
        fastestIntervalPace: number;
        slowestIntervalPace: number;
    };
}

function getDistanceInTitle(title: string): number | null {
    const normalized = title.toLowerCase();
    if (normalized.includes('milen') || (normalized.match(/(?:\s|^)mil(?:\s|$)/) && !normalized.match(/\d/))) return 10;
    const milMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*mil/);
    if (milMatch) return parseFloat(milMatch[1].replace(',', '.')) * 10;
    const kmMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:km|k\b)/);
    if (kmMatch) return parseFloat(kmMatch[1].replace(',', '.'));
    if (normalized.includes('halvmarathon') || normalized.includes('half marathon')) return 21.1;
    if (normalized.includes('marathon')) return 42.195;
    return null;
}

/**
 * NEW SIMPLE & EFFECTIVE SEGMENTER
 */
export function segmentSplits(splits: KmSplit[], parsed?: ParsedWorkout, title?: string): SegmentedSplits | null {
    if (!splits || splits.length < 3) return null;

    const lowerTitle = (title || '').toLowerCase();
    const isExplicitlyInterval = lowerTitle.includes('intervall') || lowerTitle.includes('reps') || lowerTitle.includes('tusingar') || (parsed && parsed.suggestedSubType === 'interval');
    
    // 1. Calculate paces for all laps
    const paces = splits.map(s => s.movingTime / (Math.max(s.distance, 1) / 1000));
    const sortedPaces = [...paces].sort((a,b) => a - b);
    
    // Simple Threshold: Take the average of the fastest 3rd and middle 3rd to separate "Work" from "Rest/Jogg"
    const threshold = (sortedPaces[0] + sortedPaces[Math.floor(sortedPaces.length / 2)]) / 2;
    const isFast = paces.map(p => p < threshold);

    const firstFastIdx = isFast.indexOf(true);
    const lastFastIdx = isFast.lastIndexOf(true);

    if (firstFastIdx === -1) return null; // No intervals detected

    // 2. Adjust lastFastIdx or identify a trailing recovery
    // If there's a split immediately after the last fast one that is "short" (< 600m)
    // and it's not the very last split, it's likely the final recovery of the set.
    let effectiveLastFastIdx = lastFastIdx;
    if (lastFastIdx < splits.length - 1) {
        const nextSplit = splits[lastFastIdx + 1];
        const isTrailingShort = nextSplit.distance < 600;
        const existsMoreLaps = lastFastIdx + 1 < splits.length - 1;
        
        if (isTrailingShort && existsMoreLaps) {
            effectiveLastFastIdx = lastFastIdx + 1;
        }
    }

    const classified: ClassifiedSplit[] = splits.map((s, idx) => {
        let role: ClassifiedSplit['role'] = 'unknown';

        if (idx < firstFastIdx) {
            role = 'warmup';
        } else if (idx > effectiveLastFastIdx) {
            role = 'cooldown';
        } else {
            // Mid-section: Alternate based on threshold
            role = isFast[idx] ? 'interval' : 'recovery';
            
            // Special case for the trailing recovery we just identified
            if (idx === lastFastIdx + 1 && effectiveLastFastIdx === lastFastIdx + 1) {
                role = 'recovery';
            }
        }

        return { ...s, role };
    });

    // 2. Refine "Nerjogg" - If the last "interval" is very long, maybe it's partially cooldown?
    // Not needed for now, keep it simple.

    // 3. Number the intervals
    let intervalNumber = 0;
    let inInterval = false;
    for (let i = 0; i < classified.length; i++) {
        const split = classified[i];
        if (split.role === 'interval') {
            if (!inInterval) {
                intervalNumber++;
                inInterval = true;
            }
            split.intervalNumber = intervalNumber;
        } else if (split.role === 'recovery') {
            inInterval = false;
            split.intervalNumber = intervalNumber;
        } else {
            inInterval = false;
        }
    }

    // 4. Group into blocks
    const intervalGroups: SegmentedSplits['intervalGroups'] = [];
    let currentGroup: SegmentedSplits['intervalGroups'][0] | null = null;

    for (const split of classified) {
        if (split.role === 'interval') {
            if (!currentGroup || currentGroup.number !== split.intervalNumber!) {
                if (currentGroup) intervalGroups.push(finalizeGroup(currentGroup));
                currentGroup = { number: split.intervalNumber!, intervalSplits: [], recoverySplits: [] };
            }
            currentGroup.intervalSplits.push(split);
        } else if (split.role === 'recovery' && currentGroup) {
            currentGroup.recoverySplits.push(split);
        }
    }
    if (currentGroup) intervalGroups.push(finalizeGroup(currentGroup));

    const finalIntervalSplits = classified.filter(s => s.role === 'interval');
    const finalRecoverySplits = classified.filter(s => s.role === 'recovery');
    const intervalPaces = finalIntervalSplits.map(sp => sp.movingTime / (Math.max(sp.distance, 1) / 1000));

    return {
        type: 'intervals',
        classified,
        warmupSplits: classified.filter(s => s.role === 'warmup'),
        intervalGroups,
        cooldownSplits: classified.filter(s => s.role === 'cooldown'),
        summary: {
            warmupKm: classified.filter(s => s.role === 'warmup').reduce((s, sp) => s + sp.distance / 1000, 0),
            cooldownKm: classified.filter(s => s.role === 'cooldown').reduce((s, sp) => s + sp.distance / 1000, 0),
            totalIntervalKm: finalIntervalSplits.reduce((s, sp) => s + sp.distance / 1000, 0),
            totalRecoveryKm: finalRecoverySplits.reduce((s, sp) => s + sp.distance / 1000, 0),
            avgIntervalPace: getWeightedPace(finalIntervalSplits),
            avgRecoveryPace: getWeightedPace(finalRecoverySplits),
            avgWarmupPace: getWeightedPace(classified.filter(s => s.role === 'warmup')),
            avgCooldownPace: getWeightedPace(classified.filter(s => s.role === 'cooldown')),
            avgIntervalHR: finalIntervalSplits.some(s => s.averageHeartrate) ? 
                Math.round(finalIntervalSplits.reduce((s, sp) => s + (sp.averageHeartrate || 0), 0) / finalIntervalSplits.filter(s => s.averageHeartrate).length) : undefined,
            avgRecoveryHR: finalRecoverySplits.some(s => s.averageHeartrate) ?
                Math.round(finalRecoverySplits.reduce((s, sp) => s + (sp.averageHeartrate || 0), 0) / finalRecoverySplits.filter(s => s.averageHeartrate).length) : undefined,
            fastestIntervalPace: intervalPaces.length > 0 ? Math.min(...intervalPaces) : 0,
            slowestIntervalPace: intervalPaces.length > 0 ? Math.max(...intervalPaces) : 0,
        }
    };
}

function getWeightedPace(splits: KmSplit[]): number {
    if (splits.length === 0) return 0;
    const totalTime = splits.reduce((s, sp) => s + sp.movingTime, 0);
    const totalDistKm = splits.reduce((s, sp) => s + sp.distance / 1000, 0);
    if (totalDistKm <= 0) return 0;
    return totalTime / totalDistKm;
}

function finalizeGroup(group: any) {
    return {
        ...group,
        avgPace: getWeightedPace(group.intervalSplits),
        avgHR: group.intervalSplits.some((sp: any) => sp.averageHeartrate) ?
            group.intervalSplits.reduce((s: any, sp: any) => s + (sp.averageHeartrate || 0), 0) / group.intervalSplits.filter((sp: any) => sp.averageHeartrate).length : undefined
    };
}
