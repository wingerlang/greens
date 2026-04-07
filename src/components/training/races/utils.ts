import { ExerciseEntry, PlannedActivity } from '../../../models/types.ts';

export const isTrailRace = (title: string) => {
    const t = title.toLowerCase();
    return t.includes('trail') || t.includes('fjäll') || t.includes('skog') || t.includes('mountain') || t.includes('eco') || t.includes('kullamannen');
};

export const isUltraRace = (title: string, distance: number = 0) => {
    return distance >= 42.5 || title.toLowerCase().includes('ultra') || title.toLowerCase().includes('100 miles');
};

export const getDistanceStyle = (distance: number = 0) => {
    if (distance >= 42.5) return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'; // Ultra
    if (distance >= 42) return 'bg-rose-500/10 text-rose-400 border-rose-500/20'; // Marathon
    if (distance >= 21) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'; // Half
    if (distance >= 10) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; // 10k
    if (distance >= 5) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'; // 5k
    return 'bg-slate-800 text-slate-300 border-white/5'; // Other
};

export const normalizeRaceTitle = (title: string) => {
    if (!title) return '';
    let normalized = title.toLowerCase();
    // 1. Remove years (YYYY)
    normalized = normalized.replace(/\b(19|20)\d{2}\b/g, '');
    // 2. Remove distances (e.g., 34k, 21km, 1000m, 50 miles)
    normalized = normalized.replace(/\b\d+([,.]\d+)?\s*(km|k|m|mil|miles)\b/g, '');
    // 3. Remove "trailing junk" separators: " - ...", ", ..."
    normalized = normalized.split(/\s+[-–—]\s+/)[0];
    normalized = normalized.split(/,\s+/)[0];
    // 4. Remove emojis and special chars
    normalized = normalized.replace(/[\u{1F300}-\u{1FAFF}]/gu, '');
    normalized = normalized.replace(/['"()]/g, '');
    // 5. Cleanup whitespace
    return normalized.replace(/\s+/g, ' ').trim();
};

export const formatRaceDateCompact = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '');
};

export const calcPace = (distValues: number | undefined, minutes: number | undefined) => {
    if (!distValues || distValues <= 0 || !minutes) return '-';
    const paceDec = minutes / distValues;
    const pMin = Math.floor(paceDec);
    const pSec = Math.round((paceDec - pMin) * 60);
    if (pSec === 60) return `${pMin + 1}:00/km`;
    return `${pMin}:${pSec.toString().padStart(2, '0')}/km`;
};

export const parseRaceGoal = (goalStr: string | undefined): number | null => {
    if (!goalStr) return null;
    const s = goalStr.toLowerCase();
    
    // 1. Try HH:MM:SS or HH:MM (e.g., "1:43:00", "01:22", "1h43m")
    const timeMatch = s.match(/\b(\d{1,2})[:h](\d{2})(?:[:m](\d{2}))?\b/);
    if (timeMatch) {
        const h = parseInt(timeMatch[1]);
        const m = parseInt(timeMatch[2]);
        const sec = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
        return h * 60 + m + sec / 60;
    }

    // 2. Try "X h Y min" or "Xh Ym"
    const hMatch = s.match(/(\d+)\s*h/);
    const mMatch = s.match(/(\d+)\s*min/);
    if (hMatch || mMatch) {
        const h = hMatch ? parseInt(hMatch[1]) : 0;
        const m = mMatch ? parseInt(mMatch[1]) : 0;
        return h * 60 + m;
    }

    // 3. Try "X min"
    const minMatch = s.match(/(\d+)\s*(min|minuter)/);
    if (minMatch) return parseInt(minMatch[1]);

    return null;
};

export const getPlannedRaceTime = (race: PlannedActivity): number | undefined => {
    if (race.durationMinutes) return race.durationMinutes;
    // Check realistic goal B first, then dream goal A
    const goalB = parseRaceGoal(race.raceDetails?.goals?.b);
    if (goalB) return goalB;
    const goalA = parseRaceGoal(race.raceDetails?.goals?.a);
    if (goalA) return goalA;
    return undefined;
};

export const MONTH_MAP: Record<string, string> = { 
    'jan': '01', 'januari': '01', 
    'feb': '02', 'februari': '02', 
    'mar': '03', 'mars': '03', 
    'apr': '04', 'april': '04', 
    'maj': '05', 
    'jun': '06', 'juni': '06', 
    'jul': '07', 'juli': '07', 
    'aug': '08', 'augusti': '08', 
    'sep': '09', 'sept': '09', 'september': '09', 
    'okt': '10', 'oktober': '10', 
    'nov': '11', 'november': '11', 
    'dec': '12', 'december': '12' 
};
