import { UniversalActivity } from '../models/types.ts';

/**
 * Shared Activity Utilities
 */

/**
 * Checks if an activity is a run.
 */
export function isRun(activity: any): boolean {
    if (!activity) return false;
    const type = (activity.type || activity.performance?.activityType || '').toLowerCase();
    
    // Safety check to prevent cardio machines or rides from being flagged as a run
    const lowerType = type.toLowerCase();
    if (
        lowerType.includes('ride') || 
        lowerType.includes('cycl') || 
        lowerType.includes('cyk') ||
        lowerType.includes('cross') ||
        lowerType.includes('elliptical') ||
        lowerType.includes('stair') ||
        lowerType.includes('row') ||
        lowerType.includes('cardio')
    ) {
        return false;
    }
    
    return ['running', 'run', 'löp', 'jog', 'trail'].some(t => lowerType.includes(t));
}

/**
 * Checks if an activity is strength training.
 */
export function isStrength(activity: any): boolean {
    if (!activity) return false;
    const type = (activity.type || activity.performance?.activityType || '').toLowerCase();
    return ['strength', 'styrka'].some(t => type.includes(t));
}

/**
 * Checks if an activity is a competition.
 */
export function isCompetition(activity: UniversalActivity | any): boolean {
    // If it's a warmup/cooldown, it's NOT a competition
    if (isWarmupOrCooldown(activity)) return false;

    const title = (activity.plan?.title || activity.name || activity.title || activity.performance?.notes || '').toLowerCase();
    const notes = (activity.performance?.notes || activity.notes || '').toLowerCase();
    
    // Explicit race flags (Planned or Actual) take absolute priority
    const isRacePlanned = !!activity.plan?.isRace || activity.plan?.category === 'RACE' || activity.isRace === true || activity.category === 'RACE';
    const isRaceActual = activity.subType === 'race' || activity.performance?.subType === 'race' || activity.isCompetition === true || activity.performance?.activityType === 'race';
    
    if (isRacePlanned || isRaceActual) return true;

    // If it has a bib number or rank, it's definitely a race
    if (activity.raceDetails?.bib || activity.raceDetails?.rank) return true;

    const raceKeywords = ['tävling', ' race', 'lopp', 'competition', 'marathon', 'maraton', 'halvmarathon', 'halvmaraton', 'challenge'];
    const distance = activity.distance || activity.performance?.distanceKm || 0;
    
    // Strong signal: Keyword in title
    if (raceKeywords.some(kw => title.includes(kw))) {
        // Special case: "1/10th Marathon" or similar short runs with "marathon/maraton" in name 
        // should only be counted if explicit or if distance is significant (> 5km)
        const isMarathonKW = title.includes('marathon') || title.includes('maraton');
        if (isMarathonKW && distance > 0 && distance < 5 && !isRaceActual) return false;
        
        // Avoid "Uppjogg" or "Inför" etc. if not already caught by isWarmupOrCooldown
        const exclusionKeywords = ['inför', 'efter', 'test', 'träning', 'pass', 'rehab', 'styrka'];
        if (exclusionKeywords.some(kw => title.includes(kw)) && !isRaceActual) return false;

        return true;
    }

    return false;
}

/**
 * Checks if an activity is a warmup or cooldown.
 */
export function isWarmupOrCooldown(activity: any): boolean {
    const title = (activity.plan?.title || activity.name || activity.title || activity.notes || activity.performance?.notes || '').toLowerCase();
    const subType = (activity.subType || activity.performance?.subType || '').toLowerCase();
    const category = (activity.category || activity.plan?.category || '').toLowerCase();
    
    return subType === 'warmup' || 
           subType === 'cooldown' || 
           category === 'warmup' ||
           category === 'cooldown' ||
           title.includes('uppjogg') ||
           title.includes('nerjogg') ||
           title.includes('nedjogg') ||
           title.includes('warmup') || 
           title.includes('cooldown') ||
           title.includes('nervärmning') ||
           title.includes('nedvarvning') ||
           title.includes('nedvärmning') ||
           title.includes('uppvärmning');
}

/**
 * Checks if an activity is a tempo or interval session.
 */
export function isTempoInterval(activity: any): boolean {
    if (!activity) return false;
    const subType = (activity.subType || activity.performance?.subType || '').toLowerCase();
    const title = (activity.title || activity.plan?.title || activity.name || '').toLowerCase();
    const notes = (activity.notes || activity.performance?.notes || '').toLowerCase();
    
    return subType === 'interval' || 
           subType === 'tempo' || 
           title.includes('intervall') || 
           title.includes('tempo') ||
           notes.includes('intervall') ||
           notes.includes('tempo') ||
           /\d+\s*x\s*\d+/.test(title) ||
           /\d+\s*x\s*\d+/.test(notes);
}

/**
 * Checks if an activity is a recovery session.
 */
export function isRecovery(activity: any): boolean {
    if (!activity) return false;
    const subType = (activity.subType || activity.performance?.subType || '').toLowerCase();
    const category = (activity.category || activity.plan?.category || '').toLowerCase();
    const title = (activity.title || activity.plan?.title || activity.name || '').toLowerCase();
    const notes = (activity.notes || activity.performance?.notes || '').toLowerCase();
    
    return subType === 'recovery' || 
           category === 'recovery' || 
           title.includes('återhämtning') ||
           title.includes('recovery') ||
           notes.includes('återhämtning');
}

/**
 * Formats seconds into human-readable time (H:MM:SS or M:SS).
 */
export function formatTime(seconds: number): string {
    if (seconds <= 0) return '-';
    const totalSeconds = Math.round(seconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
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
    if (parts.length === 1) return parts[0];
    return 0;
}

/**
 * Detects running PBs for common distances.
 */
export function detectRunningPBs(activities: (UniversalActivity | any)[]) {
    const pbs = {
        best5k: { time: '-', date: '-', id: '' },
        best10k: { time: '-', date: '-', id: '' },
        bestHalf: { time: '-', date: '-', id: '' },
        bestFull: { time: '-', date: '-', id: '' },
        longestRun: { dist: 0, time: '-', date: '-' },
        competitions: 0
    };

    activities.forEach(a => {
        if (a.excludeFromStats || a.performance?.excludeFromStats) return;

        // Extract type, distance and time regardless of object structure
        const type = (a.performance?.activityType || a.type || '').toLowerCase();
        if (type !== 'running' && type !== 'löpning') return;

        const dist = a.performance?.distanceKm || a.distance || 0;
        let time = a.performance?.elapsedTimeSeconds || (a.performance?.durationMinutes ? a.performance.durationMinutes * 60 : 0);

        if (!time && (a.duration || a.durationMinutes)) {
            time = (a.duration || a.durationMinutes) * (a.durationMinutes ? 60 : 1);
        }

        if (isCompetition(a)) {
            pbs.competitions++;
        }

        // Longest
        if (dist > pbs.longestRun.dist) {
            pbs.longestRun = { dist, time: formatTime(time), date: a.date };
        }

        // Simple distance-based PB detection
        const ranges = [
            { key: 'best5k', min: 4.85, max: 5.35 },
            { key: 'best10k', min: 9.7, max: 10.7 },
            { key: 'bestHalf', min: 20.7, max: 21.7 },
            { key: 'bestFull', min: 41.5, max: 43.5 }
        ];

        ranges.forEach(r => {
            if (dist >= r.min && dist <= r.max) {
                const currentBestSec = parseTimeInSeconds((pbs as any)[r.key].time) || 9999999;
                if (time < currentBestSec && time > 0) {
                    (pbs as any)[r.key] = { time: formatTime(time), date: a.date, id: a.id };
                }
            }
        });
    });

    return pbs;
}

/**
 * Checks if an activity is a long run (default > 20km but < 42.2km).
 */
export function isLongRun(activity: any, threshold: number = 20): boolean {
    const type = (activity.type || activity.performance?.activityType || '').toLowerCase();
    if (type !== 'running' && type !== 'löpning') return false;
    const dist = activity.distance || activity.performance?.distanceKm || 0;
    return dist >= threshold && dist < 42.2;
}

/**
 * Checks if an activity is an ultra (>= 42.2km).
 */
export function isUltra(activity: any): boolean {
    const type = (activity.type || activity.performance?.activityType || '').toLowerCase();
    if (type !== 'running' && type !== 'löpning') return false;
    const dist = activity.distance || activity.performance?.distanceKm || 0;
    return dist >= 42.2;
}

/**
 * Checks if an activity is a quality session (interval, tempo, race, etc).
 */
export function isQualitySession(activity: any): boolean {
    if (!activity) return false;
    
    // Warmups/cooldowns are never the "quality" part themselves in terms of categorization
    if (isWarmupOrCooldown(activity)) return false;

    const title = (activity.title || activity.plan?.title || activity.name || '').toLowerCase();
    const notes = (activity.notes || activity.performance?.notes || '').toLowerCase();
    const subType = (activity.subType || activity.performance?.subType || '').toLowerCase();
    
    // 1. Explicit subTypes or Competition status
    if (subType === 'interval' || subType === 'tempo' || subType === 'race' || isCompetition(activity)) {
        return true;
    }

    // 2. Specific Quality Keywords (avoiding overly broad ones like 'fart' or 'snabb')
    const keywords = [
        'intervall', 'tempo', 'tröskel', 'threshold', 'fartlek', 
        'tusingar', 'snabbdistans', 'utdrag', 'reps', 'backe', 
        'tusen', 'progression', 'repetition', 'fartpass'
    ];
    
    const hasKeyword = keywords.some(kw => title.includes(kw) || notes.includes(kw));
    if (hasKeyword) return true;

    // 3. Pattern matching (e.g., 3x3km, 10x400m)
    const pattern = /\d+\s*x\s*\d+/;
    if (pattern.test(title) || pattern.test(notes)) return true;

    return false;
}
