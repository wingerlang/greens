import { PlannedActivity, StrengthMuscleGroup } from '../models/types.ts';
import { parseTimeToSeconds } from './timeParser.ts';

export interface PlanningIntent {
    type: 'planera';
    data: Partial<PlannedActivity>;
    rawInput: string;
}

/**
 * Parses a "planera" command string.
 * Example inputs:
 * "planera push imorgon fm 45min"
 * "planera pull idag em 60min"
 * "planera cardio imorgon 30min"
 * "planera cykel idag 45min"
 */
export function parsePlanningInput(input: string, contextDate: string = new Date().toISOString().split('T')[0]): PlanningIntent | null {
    const cleanInput = input.toLowerCase().trim();
    if (!cleanInput.startsWith('planera')) return null;

    const parts = cleanInput.replace(/^planera\s+/, '').split(/\s+/);
    if (parts.length === 0 || parts[0] === '') return null;

    const activity: Partial<PlannedActivity> = {
        status: 'PLANNED',
        date: contextDate,
        title: '',
        description: '',
        structure: {
            warmupKm: 0,
            mainSet: [],
            cooldownKm: 0
        }
    };

    let remainingLabel: string[] = [];

    // 1. Parse Date
    let dateFound = false;
    const today = new Date(contextDate);
    
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === 'idag') {
            activity.date = contextDate;
            dateFound = true;
            parts.splice(i, 1);
            i--;
        } else if (p === 'imorgon' || (p === 'i' && parts[i+1] === 'morgon')) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            activity.date = tomorrow.toISOString().split('T')[0];
            dateFound = true;
            if (p === 'i') parts.splice(i, 2);
            else parts.splice(i, 1);
            i--;
        } else if (p === 'övermorgon') {
            const nextDay = new Date(today);
            nextDay.setDate(nextDay.getDate() + 2);
            activity.date = nextDay.toISOString().split('T')[0];
            dateFound = true;
            parts.splice(i, 1);
            i--;
        } else if (['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön'].some(w => p.startsWith(w))) {
             const weekdaysMap: Record<string, number> = { 'mån': 1, 'tis': 2, 'ons': 3, 'tors': 4, 'fre': 5, 'lör': 6, 'sön': 0 };
             const dayKey = Object.keys(weekdaysMap).find(k => p.startsWith(k));
             if (dayKey !== undefined) {
                 const targetDay = weekdaysMap[dayKey];
                 const currentDay = today.getDay(); // 0-6 (Sun-Sat)
                 
                 // Normalize both to 1-7 (Mon-Sun) where 7 is Sunday
                 const normTarget = targetDay === 0 ? 7 : targetDay;
                 const normCurrent = currentDay === 0 ? 7 : currentDay;
                 
                 const diff = normTarget - normCurrent;
                 const targetDate = new Date(today);
                 targetDate.setDate(today.getDate() + diff);
                 
                 activity.date = targetDate.toISOString().split('T')[0];
                 dateFound = true;
                 parts.splice(i, 1);
                 i--;
             }
        }
    }

    // 2. Parse Time (fm/em)
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === 'fm') {
            activity.startTime = '10:00';
            parts.splice(i, 1);
            i--;
        } else if (p === 'em') {
            activity.startTime = '17:00';
            parts.splice(i, 1);
            i--;
        }
    }

    // 3. Parse Duration (X min)
    let durationSeconds = 0;
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        // Check if part contains "min" or if next part is "min"
        if (p.includes('min') || p.includes('h')) {
            const secs = parseTimeToSeconds(p);
            if (secs) {
                durationSeconds = secs;
                parts.splice(i, 1);
                i--;
            }
        } else if (!isNaN(parseInt(p)) && (parts[i+1]?.includes('min') || parts[i+1]?.includes('h'))) {
             const combined = p + parts[i+1];
             const secs = parseTimeToSeconds(combined);
             if (secs) {
                 durationSeconds = secs;
                 parts.splice(i, 2);
                 i--;
             }
        }
    }

    if (durationSeconds > 0) {
        const mins = Math.round(durationSeconds / 60);
        activity.description = `${mins} min pass.`;
        // For strength/cardio, we might just put it in the title or a basic structure
    }

    // 4. Parse Activity Type & Title
    const typeMap: Record<string, { type: PlannedActivity['type'], category: PlannedActivity['category'], subType?: PlannedActivity['subType'], label: string }> = {
        'push': { type: 'STRENGTH', category: 'STRENGTH', label: 'Styrka: Push' },
        'pull': { type: 'STRENGTH', category: 'STRENGTH', label: 'Styrka: Pull' },
        'ben': { type: 'STRENGTH', category: 'STRENGTH', label: 'Styrka: Ben' },
        'legs': { type: 'STRENGTH', category: 'STRENGTH', label: 'Styrka: Legs' },
        'cardio': { type: 'CARDIO', category: 'CARDIO', label: 'Cardio' },
        'cykel': { type: 'CARDIO', category: 'CARDIO', subType: 'cycling', label: 'Cykling' },
        'cycling': { type: 'CARDIO', category: 'CARDIO', subType: 'cycling', label: 'Cycling' },
        'cross-trainer': { type: 'CARDIO', category: 'CARDIO', subType: 'cross-trainer', label: 'Crosstrainer' },
        'cross trainer': { type: 'CARDIO', category: 'CARDIO', subType: 'cross-trainer', label: 'Crosstrainer' },
        'crosstrainer': { type: 'CARDIO', category: 'CARDIO', subType: 'cross-trainer', label: 'Crosstrainer' },
        'rodd': { type: 'CARDIO', category: 'CARDIO', label: 'Rodd' },
        'row': { type: 'CARDIO', category: 'CARDIO', label: 'Rowing' },
        'simning': { type: 'CARDIO', category: 'CARDIO', label: 'Simning' },
        'swim': { type: 'CARDIO', category: 'CARDIO', label: 'Swimming' },
        'löpning': { type: 'RUN', category: 'EASY', label: 'Löpning' },
        'run': { type: 'RUN', category: 'EASY', label: 'Run' },
    };

    let typeFound = false;
    const sortedTypeKeys = Object.keys(typeMap).sort((a, b) => b.length - a.length);

    for (const key of sortedTypeKeys) {
        if (cleanInput.includes(key)) {
            activity.type = typeMap[key].type;
            activity.category = typeMap[key].category;
            activity.subType = typeMap[key].subType;
            activity.title = typeMap[key].label;
            typeFound = true;
            
            // Remove the keyword from parts if it exists as a word
            const keyParts = key.split(/\s+/);
            keyParts.forEach(kp => {
                const idx = parts.indexOf(kp);
                if (idx !== -1) parts.splice(idx, 1);
            });
            break;
        }
    }

    // If no specific keyword found, use the first word as title and default to OTHER
    if (!typeFound) {
        activity.type = 'OTHER';
        activity.category = 'OTHER';
        activity.title = parts[0]?.charAt(0).toUpperCase() + parts[0]?.slice(1) || 'Planerat pass';
        if (parts.length > 0) parts.splice(0, 1);
    }

    // Add remaining parts to the title or description
    if (parts.length > 0) {
        activity.title += ' ' + parts.join(' ');
    }

    if (durationSeconds > 0) {
        const mins = Math.round(durationSeconds / 60);
        activity.title += ` (${mins}m)`;
    }

    return {
        type: 'planera',
        data: activity,
        rawInput: input
    };
}
