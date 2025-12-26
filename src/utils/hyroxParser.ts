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
        const text = (a.notes || '').toLowerCase();

        // Simple regex parsing for specific stations mentioned in notes
        // Format expectations: "Sled Push: 3:00", "Wall Balls: 4:30"

        parseTimeForStation(text, 'ski', stats.ski_erg);
        parseTimeForStation(text, 'sled push', stats.sled_push);
        parseTimeForStation(text, 'sled pull', stats.sled_pull);
        parseTimeForStation(text, 'burpee', stats.burpee_broad_jumps);
        parseTimeForStation(text, 'row', stats.rowing);
        parseTimeForStation(text, 'farmers', stats.farmers_carry);
        parseTimeForStation(text, 'lunge', stats.sandbag_lunges);
        parseTimeForStation(text, 'wall ball', stats.wall_balls);

        // Running splits are harder to extract from unstructured text without more strict logging 
        // or lap data. For now, we rely on dedicated 1km intervals if identified.
        if (a.type === 'running' && a.distance && Math.abs(a.distance - 1.0) < 0.1) {
            stats.run_1km.push(a.durationMinutes * 60);
        }
    });

    return stats;
}

function parseTimeForStation(text: string, keyword: string, targetArray: number[]) {
    if (!text.includes(keyword)) return;

    // Look for patterns like "Ski: 4:30" or "Ski 4m30s"
    const regex = new RegExp(`${keyword}[^\\d]*(\\d+)(:|m|\\s)(\\d+)?`, 'i');
    const match = text.match(regex);

    if (match) {
        const minutes = parseInt(match[1]);
        const seconds = match[3] ? parseInt(match[3]) : 0;
        const totalSeconds = minutes * 60 + seconds;

        // Sanity check (e.g. Ski Erg shouldn't take 50 mins or 10 seconds for a full station)
        if (totalSeconds > 60 && totalSeconds < 600) {
            targetArray.push(totalSeconds);
        }
    }
}
