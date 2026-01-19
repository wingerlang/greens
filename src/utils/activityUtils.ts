import { UniversalActivity } from '../models/types.ts';

/**
 * Shared Activity Utilities
 */

/**
 * Checks if an activity is a competition.
 */
export function isCompetition(activity: UniversalActivity | any): boolean {
    const title = (activity.plan?.title || '').toLowerCase();
    const notes = (activity.performance?.notes || '').toLowerCase();
    const isRacePlanned = !!activity.plan?.isRace || activity.plan?.category === 'RACE';
    const isRaceActual = activity.subType === 'race'; // For ExerciseEntry/StrengthSession style

    const raceKeywords = ['tävling', ' race', 'lopp', 'competition', 'marathon', 'maraton'];
    const matchesKeyword = raceKeywords.some(kw => title.includes(kw) || notes.includes(kw));

    return isRacePlanned || isRaceActual || matchesKeyword;
}

/**
 * Formats seconds into human-readable time (H:MM:SS or M:SS).
 */
export function formatTime(seconds: number): string {
    if (seconds <= 0) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parses time string (MM:SS or H:MM:SS) into seconds.
 */
export function parseTimeInSeconds(timeStr?: string): number {
    if (!timeStr || timeStr === '-') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
}

/**
 * Detects running PBs for common distances.
 */
export function detectRunningPBs(activities: UniversalActivity[]) {
    const pbs = {
        best5k: { time: '-', date: '-' },
        best10k: { time: '-', date: '-' },
        bestHalf: { time: '-', date: '-' },
        bestFull: { time: '-', date: '-' },
        longestRun: { dist: 0, time: '-', date: '-' },
        competitions: 0
    };

    activities.forEach(a => {
        const type = a.performance?.activityType;
        if (type !== 'running') return;

        const dist = a.performance?.distanceKm || 0;
        const time = a.performance?.elapsedTimeSeconds || (a.performance?.durationMinutes ? a.performance.durationMinutes * 60 : 0);

        if (isCompetition(a)) {
            pbs.competitions++;
        }

        // Longest
        if (dist > pbs.longestRun.dist) {
            pbs.longestRun = { dist, time: formatTime(time), date: a.date };
        }

        // Simple distance-based PB detection
        const ranges = [
            { key: 'best5k', min: 4.9, max: 5.3 },
            { key: 'best10k', min: 9.8, max: 10.5 },
            { key: 'bestHalf', min: 20.8, max: 21.5 },
            { key: 'bestFull', min: 41.5, max: 43.0 }
        ];

        ranges.forEach(r => {
            if (dist >= r.min && dist <= r.max) {
                const currentBestSec = parseTimeInSeconds((pbs as any)[r.key].time) || 999999;
                if (time < currentBestSec && time > 0) {
                    (pbs as any)[r.key] = { time: formatTime(time), date: a.date, id: a.id };
                }
            }
        });
    });

    return pbs;
}
