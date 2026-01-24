import { HyroxStation, ExerciseEntry, StrengthWorkout } from '../models/types.ts';

export const HYROX_STATIONS_ORDER: HyroxStation[] = [
    'ski_erg',
    'sled_push',
    'sled_pull',
    'burpee_broad_jumps',
    'rowing',
    'farmers_carry',
    'sandbag_lunges',
    'wall_balls'
];

interface ParsedHyroxData {
    runSplits: number[];
    stations: Partial<Record<HyroxStation, number>>;
}

// Convert "05:31" or "5:31" to seconds
const parseTime = (timeStr: string): number | null => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
    }
    const num = parseInt(timeStr);
    return isNaN(num) ? null : num;
};

export const parseHyroxText = (text: string): ParsedHyroxData => {
    const lines = text.split('\n');
    const runSplits: number[] = new Array(8).fill(0);
    const stations: Partial<Record<HyroxStation, number>> = {};

    // Regex Patterns
    const runRegex = /R(\d+).*?(\d{1,2}:\d{2})/i; // Matches R1: 05:31
    const runWordRegex = /Run\s*(\d+).*?(\d{1,2}:\d{2})/i;

    // Station Regexes - map varying names to keys
    const stationMap: Record<string, HyroxStation> = {
        'ski': 'ski_erg', 'skierg': 'ski_erg',
        'push': 'sled_push', 'sled push': 'sled_push',
        'pull': 'sled_pull', 'sled pull': 'sled_pull',
        'burpee': 'burpee_broad_jumps', 'bbj': 'burpee_broad_jumps', 'broad': 'burpee_broad_jumps',
        'row': 'rowing', 'rower': 'rowing', 'rowing': 'rowing',
        'farmer': 'farmers_carry', 'farmers': 'farmers_carry', 'carry': 'farmers_carry',
        'lunge': 'sandbag_lunges', 'lunges': 'sandbag_lunges', 'sandbag': 'sandbag_lunges',
        'wall': 'wall_balls', 'balls': 'wall_balls', 'wallballs': 'wall_balls'
    };

    // Generic S-regex: S1 (SkiErg): 03:58
    const sRegex = /S(\d+).*?(\d{1,2}:\d{2})/i;

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        // 1. Try match Runs
        let match = cleanLine.match(runRegex) || cleanLine.match(runWordRegex);
        if (match) {
            const index = parseInt(match[1]) - 1;
            const time = parseTime(match[2]);
            if (index >= 0 && index < 8 && time !== null) {
                runSplits[index] = time;
                return;
            }
        }

        // 2. Try match indexed Stations (S1, S2...)
        match = cleanLine.match(sRegex);
        if (match) {
            const index = parseInt(match[1]) - 1;
            const time = parseTime(match[2]);
            if (index >= 0 && index < 8 && time !== null) {
                stations[HYROX_STATIONS_ORDER[index]] = time;
                return;
            }
        }

        // 3. Try match named stations (Wall Balls: 07:11)
        // We look for time at the end or after a separator
        const timeMatch = cleanLine.match(/(\d{1,2}:\d{2})/);
        if (timeMatch) {
            const lower = cleanLine.toLowerCase();
            for (const [key, stationId] of Object.entries(stationMap)) {
                if (lower.includes(key)) {
                    const time = parseTime(timeMatch[1]);
                    if (time !== null) {
                        stations[stationId] = time;
                    }
                    break;
                }
            }
        }
    });

    return { runSplits, stations };
};

/**
 * Aggregates all Hyrox station times from history
 */
export const parseHyroxStats = (exercises: ExerciseEntry[], _strength: StrengthWorkout[]): Record<HyroxStation, number[]> => {
    const stats: Record<HyroxStation, number[]> = {
        ski_erg: [],
        sled_push: [],
        sled_pull: [],
        burpee_broad_jumps: [],
        rowing: [],
        farmers_carry: [],
        sandbag_lunges: [],
        wall_balls: [],
        run_1km: [] // We might not track individual runs here easily unless averaged
    };

    exercises.forEach(ex => {
        if (ex.type === 'hyrox' && ex.hyroxStats?.stations) {
            Object.entries(ex.hyroxStats.stations).forEach(([key, value]) => {
                const k = key as HyroxStation;
                if (typeof value === 'number' && stats[k]) {
                    stats[k].push(value);
                }
            });
        }
    });

    return stats;
};
