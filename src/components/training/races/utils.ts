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

    // Special handling for common multi-named races or variations
    if (normalized.includes('wings for life')) {
        return 'wings for life';
    }

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

export const getAvgElevation = (title: string, distance: number, history: ExerciseEntry[]) => {
    const normTitle = normalizeRaceTitle(title);
    if (!normTitle) return null;
    
    const matches = history.filter(h => {
        const hTitle = normalizeRaceTitle(h.title || h.notes || '');
        const hDist = h.distance || 0;
        const titleMatch = hTitle === normTitle;
        // If distance is explicitly set, check it. Otherwise just match title.
        const distMatch = !distance || !hDist || Math.abs(hDist - distance) / distance < 0.15;
        return titleMatch && distMatch;
    });

    if (matches.length === 0) return null;

    const elevs = matches
        .map(m => m.elevationGain || m.raceDetails?.elevationGain || 0)
        .filter(e => e > 0);
    
    if (elevs.length === 0) return null;
    
    return Math.round(elevs.reduce((a, b) => a + b, 0) / elevs.length);
};

export const formatRaceDateCompact = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '');
};

export const calcPace = (distValues: number | undefined, minutes: number | undefined) => {
    if (!distValues || distValues <= 0 || !minutes || minutes <= 0) return '-';
    const paceDec = minutes / distValues;
    const pMin = Math.floor(paceDec);
    const pSec = Math.round((paceDec - pMin) * 60);
    if (pSec === 60) return `${pMin + 1}:00/km`;
    return `${pMin}:${pSec.toString().padStart(2, '0')}/km`;
};

export const calcStifa = (distKm: number | undefined, elevM: number | undefined) => {
    if (!distKm || distKm <= 0 || !elevM || elevM <= 0) return '-';
    // STIFA = elevation (m) / distance (km)
    return Math.round(elevM / distKm).toString();
};

export const parseRaceGoal = (goalStr: string | undefined, distance?: number): number | null => {
    if (!goalStr) return null;
    let s = goalStr.toLowerCase();
    
    // Remove "sub", "under", "target" etc.
    s = s.replace(/(sub|under|mål|target|ca|~)\s*/g, '').trim();
    
    // 1. HH:MM:SS or MM:SS (e.g., "1:43:00", "19:30", "01:22")
    const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
        let h = parseInt(timeMatch[1]);
        let m = parseInt(timeMatch[2]);
        const sec = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
        
        let totalMinutes = 0;
        
        if (timeMatch[3]) {
            // HH:MM:SS
            totalMinutes = h * 60 + m + sec / 60;
        } else {
            // HH:MM or MM:SS? This is where the reality check comes in.
            // If distance is provided, we can see if HH:MM results in an insane pace.
            const totalMinAsHHMM = h * 60 + m;
            const totalMinAsMMSS = h + m / 60;
            
            if (distance && distance > 0) {
                const paceAsHHMM = totalMinAsHHMM / distance;
                const paceAsMMSS = totalMinAsMMSS / distance;
                
                // Reality check: Pace typically between 2:30 and 15:00 min/km
                const isHHMMRealistic = paceAsHHMM >= 2.5 && paceAsHHMM <= 15;
                const isMMSSRealistic = paceAsMMSS >= 2.5 && paceAsMMSS <= 15;
                
                if (isHHMMRealistic && !isMMSSRealistic) {
                    totalMinutes = totalMinAsHHMM;
                } else if (isMMSSRealistic && !isHHMMRealistic) {
                    totalMinutes = totalMinAsMMSS;
                } else {
                    // If neither or both are realistic, use a heuristic.
                    // If h > 6, it's almost certainly MM:SS (who targets a 6+ hour 5k?)
                    if (h >= 6) totalMinutes = totalMinAsMMSS;
                    else totalMinutes = totalMinAsHHMM;
                }
            } else {
                // No distance? Heuristic: if h > 6, assume MM:SS.
                if (h >= 6) totalMinutes = totalMinAsMMSS;
                else totalMinutes = totalMinAsHHMM;
            }
        }
        return totalMinutes;
    }

    // 2. Patterns like "1h 45min", "2h", "103m"
    const hMatch = s.match(/(\d+)\s*h/);
    const mMatch = s.match(/(\d+)\s*m/); 
    
    if (hMatch || mMatch) {
        const h = hMatch ? parseInt(hMatch[1]) : 0;
        const m = mMatch ? parseInt(mMatch[1]) : 0;
        if (h > 0 || (m > 0 && m < 1000)) {
            return h * 60 + m;
        }
    }

    return null;
};

export const getPlannedRaceTime = (race: PlannedActivity): number | undefined => {
    // For races, explicit goals should always take priority over the generic durationMinutes
    // which might just be a default value (like 5:30 min/km fallback)
    const dist = (race as any).distanceKm || race.estimatedDistance || 0;
    const goalA = parseRaceGoal(race.raceDetails?.goals?.a, dist);
    if (goalA) return goalA;
    const goalB = parseRaceGoal(race.raceDetails?.goals?.b, dist);
    if (goalB) return goalB;
    const goalC = parseRaceGoal(race.raceDetails?.goals?.c, dist);
    if (goalC) return goalC;

    // Use manual duration if set and no goals matched
    if (race.durationMinutes) return race.durationMinutes;
    
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
