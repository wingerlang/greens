
/**
 * Track distances in meters.
 */
export const TRACK_DISTANCES = [
    100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 1600, 
    2000, 2400, 3000, 3200, 4000, 4800, 5000, 6000, 8000, 10000
];

/**
 * Snaps a measured distance to the nearest track distance if within tolerance.
 * Tolerance is 7% (max 100m) or 60m, whichever is greater.
 */
export function snapToTrack(distanceM: number): number {
    let closest = distanceM;
    let minDiff = Infinity;
    
    for (const td of TRACK_DISTANCES) {
        const diff = Math.abs(distanceM - td);
        const tolerance = Math.min(td * 0.07, 100);
        if (diff < minDiff && (diff < tolerance || diff < 60)) {
            minDiff = diff;
            closest = td;
        }
    }
    
    // Also check for multiples of 400 (laps) if distance is large
    if (distanceM > 1000) {
        const laps = Math.round(distanceM / 400);
        const lapDist = laps * 400;
        const lapDiff = Math.abs(distanceM - lapDist);
        if (lapDiff < minDiff && (lapDiff < lapDist * 0.07 || lapDiff < 60)) {
            minDiff = lapDiff;
            closest = lapDist;
        }
    }
    
    return closest;
}
