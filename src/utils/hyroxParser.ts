import { ExerciseEntry, HyroxStation, HyroxActivityStats } from '../models/types.ts';

// Standard Weights (Men/Women Open) - can be configured later
const HYROX_STANDARDS = {
    sledPush: { weight: 152 }, // kg (Open Men)
    sledPull: { weight: 103 }, // kg
    farmersCarry: { weight: 24 }, // kg x 2
    sandbagLunges: { weight: 20 }, // kg
    wallBalls: { weight: 6 } // kg
};

export function identifyHyroxActivity(activity: ExerciseEntry): boolean {
    const text = (activity.notes + ' ' + (activity as any).name).toLowerCase(); // basic check, 'name' might need casting if not on ExerciseEntry yet
    return text.includes('hyrox') || text.includes('sled push') || text.includes('wall ball');
}

export function parseHyroxStats(activities: ExerciseEntry[]): Record<HyroxStation, number[]> {
    const stats: Record<HyroxStation, number[]> = {
        ski_erg: [],
        sled_push: [],
        sled_pull: [],
        burpee_broad_jumps: [],
        rowing: [],
        farmers_carry: [],
        sandbag_lunges: [],
        wall_balls: [],
        run_1km: []
    };

    activities.forEach(a => {
        const text = (a.notes || '' + ' ' + (a as any).name || '').toLowerCase();

        // 1. Individual Station Parsing (from notes like "Ski: 4:30")
        parseTimeForStation(text, ['ski', 'ski erg'], stats.ski_erg);
        parseTimeForStation(text, ['sled push', 'push'], stats.sled_push);
        parseTimeForStation(text, ['sled pull', 'pull'], stats.sled_pull);
        parseTimeForStation(text, ['burpee', 'bbj'], stats.burpee_broad_jumps);
        parseTimeForStation(text, ['row', 'rowing'], stats.rowing);
        parseTimeForStation(text, ['farmers', 'carry'], stats.farmers_carry);
        parseTimeForStation(text, ['lunge', 'sandbag'], stats.sandbag_lunges);
        parseTimeForStation(text, ['wall', 'wall ball', 'wb'], stats.wall_balls);

        // 2. Run Parsing
        // A) Dedicated 1km Intervals (strict distance check)
        if (a.type === 'running' && a.distance && Math.abs(a.distance - 1.0) < 0.1) {
            stats.run_1km.push(a.durationMinutes * 60);
        }
        // B) Splits inside a Hyrox Note (e.g., "Run 1: 4:00", "Run 8: 5:30")
        parseRunSplits(text, stats.run_1km);
    });

    return stats;
}

function parseTimeForStation(text: string, keywords: string[], targetArray: number[]) {
    // Try each keyword
    for (const keyword of keywords) {
        // Look for patterns like "Ski: 4:30", "Ski 4m30s", "Ski - 4:15"
        // Regex explanation:
        // keyword
        // [^\\d]*  -> skip non-digits (colon, space, dash)
        // (\\d+)   -> Capture Minutes
        // (:|m|\\s|\\.) -> Separator (colon, 'm', space, dot)
        // (\\d+)?  -> Capture Seconds (optional)
        const regex = new RegExp(`${keyword}[^\\d\\r\\n]*(\\d+)(:|m|\\s|\\.)(\\d{2})?`, 'i');
        const match = text.match(regex);

        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = match[3] ? parseInt(match[3]) : 0;
            const totalSeconds = minutes * 60 + seconds;

            // Sanity check (60s to 12 mins)
            if (totalSeconds > 45 && totalSeconds < 900) {
                targetArray.push(totalSeconds);
                return; // Found a match, stop checking other keywords for this station
            }
        }
    }
}

function parseRunSplits(text: string, targetArray: number[]) {
    // Look for "Run X: 4:30"
    const regex = /run\s*\d*[^\\d]*(\d+)(:|m|\s|\.)(\d{2})/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const minutes = parseInt(match[1]);
        const seconds = match[3] ? parseInt(match[3]) : 0;
        const total = minutes * 60 + seconds;
        if (total > 150 && total < 600) { // 2:30 to 10:00 range
            targetArray.push(total);
        }
    }
}
