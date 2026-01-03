import { type ExerciseType, type ExerciseIntensity, type MealType, type ExerciseSubType, type BodyMeasurementType } from '../models/types.ts';

export type OmniboxIntent =
    | { type: 'exercise'; data: { exerciseType: ExerciseType; duration: number; intensity: ExerciseIntensity; notes?: string; subType?: ExerciseSubType; tonnage?: number; distance?: number; heartRateAvg?: number; heartRateMax?: number }; date?: string }
    | { type: 'food'; data: { query: string; quantity?: number; unit?: string; mealType?: MealType }; date?: string }
    | { type: 'weight'; data: { weight: number }; date?: string }
    | { type: 'vitals'; data: { vitalType: 'sleep' | 'water' | 'coffee' | 'nocco' | 'energy' | 'steps'; amount: number; caffeine?: number }; date?: string }
    | { type: 'measurement'; data: { measurementType?: BodyMeasurementType; value?: number }; date?: string }
    | { type: 'navigate'; data: { path: string }; date?: string }
    | { type: 'search'; data: { query: string }; date?: string };

/**
 * Calculate calories burned for an exercise.
 */
export function calculateCalories(type: ExerciseType, duration: number, intensity: ExerciseIntensity, weight: number = 75): number {
    const METS: Record<ExerciseType, Record<ExerciseIntensity, number>> = {
        running: { low: 7, moderate: 9, high: 12, ultra: 16 },
        cycling: { low: 5, moderate: 7, high: 10, ultra: 14 },
        strength: { low: 3, moderate: 4.5, high: 6, ultra: 8 },
        walking: { low: 2.5, moderate: 3.5, high: 4.5, ultra: 6 },
        swimming: { low: 6, moderate: 8, high: 10, ultra: 12 },
        yoga: { low: 2, moderate: 3, high: 4, ultra: 5 },
        other: { low: 4, moderate: 6, high: 8, ultra: 10 }
    };
    const met = METS[type]?.[intensity] || METS.other.moderate;
    return Math.round((met * 3.5 * weight / 200) * duration);
}

/**
 * Parse training string and return exercise data.
 */
export function parseTrainingString(input: string): { type: ExerciseType; duration: number; intensity: ExerciseIntensity } | null {
    const intent = parseExercise(input);
    if (intent && intent.type === 'exercise') {
        return {
            type: intent.data.exerciseType,
            duration: intent.data.duration,
            intensity: intent.data.intensity
        };
    }
    return null;
}

/**
 * Parses a natural language string into a structured intent
 */
export function parseOmniboxInput(input: string): OmniboxIntent {
    const rawLower = input.toLowerCase().trim();
    if (!rawLower) return { type: 'search', data: { query: '' } };

    // 1. Extract Date
    const { date, remaining: afterDate } = parseDate(rawLower);
    const lower = afterDate.trim() || rawLower;

    // 2. Vitals Check (e.g., "7h sömn", "3 kaffe", "2 vatten")
    const vitalsIntent = parseVitals(lower);
    if (vitalsIntent) return { ...vitalsIntent, date };

    // 2.5 Navigation Check
    if (lower.startsWith('gå till') || lower.startsWith('navigera') || lower.startsWith('/')) {
        let path = '/';
        const target = lower.replace(/gå till|navigera/g, '').trim().toLowerCase();

        if (target.includes('trän') || target.includes('gym')) {
            if (target.includes('hälsa')) path = '/health/training';
            else path = '/training';
        }
        else if (target.includes('vikt') || target.includes('weight')) path = '/health/body';
        else if (target.includes('sömn') || target.includes('sleep')) path = '/health/body';
        else if (target.includes('mått') || target.includes('body') || target.includes('measurements')) path = '/health/body';
        else if (target.includes('hälsa')) {
            if (target.includes('mat')) path = '/health/food';
            else path = '/health';
        }
        else if (target.includes('recept')) path = '/recipes';
        else if (target.includes('mat') || target.includes('plan')) path = '/planera';
        else if (target.includes('kalori')) path = '/calories';
        else if (target.includes('skafferi')) path = '/pantry';
        else if (target.includes('tävling')) path = '/competition';
        else if (target.includes('profil')) path = '/profile';

        return { type: 'navigate', data: { path }, date };
    }

    // 3. Exercise Check (PRIORITY OVER WEIGHT if explicit exercise keywords exist)
    // This fixes "Styrka 200kg" being interpreted as weight update
    const exerciseIntents = parseExercise(lower);
    if (exerciseIntents) return { ...exerciseIntents, date };

    // 4. Weight Check
    // Matches "vikt 80kg", "80kg", "80 kg", but NOT if context implies exercise (handled above)
    const weightMatch = lower.match(/(?:vikt\s*[:\s]*|)(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)?$/);
    if (weightMatch && (lower.startsWith('vikt') || lower.endsWith('kg') || lower.endsWith('kilo'))) {
        const weight = parseFloat(weightMatch[1].replace(',', '.'));
        // Sanity check for weight
        if (!isNaN(weight) && weight > 20 && weight < 500) {
            return { type: 'weight', data: { weight }, date };
        }
    }

    // 4.5 Measurement Check
    const measurementIntent = parseMeasurements(lower);
    if (measurementIntent) return { ...measurementIntent, date };

    // 5. Food/Meal Check
    const foodIntents = parseFood(lower);
    if (foodIntents) return { ...foodIntents, date };

    // 6. Default to Search
    return { type: 'search', data: { query: input }, date };
}


function parseDate(input: string): { date?: string; remaining: string } {
    const today = new Date();
    const getISODate = (d: Date) => d.toISOString().split('T')[0];

    // Handle relative dates in Swedish and English
    // Use regex to catch 'i' optional before 'förrgår'
    if (input.includes('idag') || input.includes('today')) {
        return { date: getISODate(today), remaining: input.replace(/idag|today/g, '').trim() };
    }

    if (input.includes('igår') || input.includes('yesterday')) {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return { date: getISODate(d), remaining: input.replace(/igår|yesterday/g, '').trim() };
    }

    if (input.includes('förrgår') || input.includes('day before yesterday')) {
        const d = new Date(today);
        d.setDate(d.getDate() - 2);
        // Match 'i förrgår' or just 'förrgår'
        return { date: getISODate(d), remaining: input.replace(/(i\s*)?förrgår|day before yesterday/g, '').trim() };
    }

    // ISO Date Match (YYYY-MM-DD or MM-DD)
    const dateMatch = input.match(/\b(\d{4}-)?(\d{1,2})-(\d{1,2})\b/);
    if (dateMatch) {
        let year = dateMatch[1] ? dateMatch[1].replace('-', '') : today.getFullYear();
        let month = dateMatch[2].padStart(2, '0');
        let day = dateMatch[3].padStart(2, '0');
        return { date: `${year}-${month}-${day}`, remaining: input.replace(dateMatch[0], '').trim() };
    }

    return { remaining: input };
}

export interface SmartCycle {
    name: string;
    startDate: string;
    endDate: string;
    goal: 'deff' | 'bulk' | 'neutral';
}

/**
 * Parses a cycle string like "Deff 2026-02 - 3mån" or "Vinterbulk 2026-01 - 2026-04"
 */
export function parseCycleString(input: string): SmartCycle | null {
    if (!input || input.length < 3) return null;

    const lower = input.toLowerCase().trim();
    const today = new Date();
    const getISODate = (d: Date) => d.toISOString().split('T')[0];

    // 1. Identify Goal
    let goal: 'deff' | 'bulk' | 'neutral' = 'neutral';
    if (lower.includes('deff') || lower.includes('cut')) goal = 'deff';
    else if (lower.includes('bulk') || lower.includes('bygga')) goal = 'bulk';
    else if (lower.includes('balans') || lower.includes('maintain')) goal = 'neutral';

    // 2. Identify Dates/Durations
    let startDate = getISODate(today);
    let endDate = '';

    // Regex Patterns
    const datePattern = /(\d{4})[-\/](\d{1,2})(?:[-\/](\d{1,2}))?/g; // Matches YYYY-MM or YYYY-MM-DD
    const durationPattern = /(\d+)\s*(mån|vec|veckor|dagar?|days?|months?)/i;

    const dates: string[] = [];
    let match;
    while ((match = datePattern.exec(lower)) !== null) {
        const y = match[1];
        const m = match[2].padStart(2, '0');
        const d = match[3] ? match[3].padStart(2, '0') : '01'; // Default day to 01 if missing
        dates.push(`${y}-${m}-${d}`);
    }

    const durationMatch = lower.match(durationPattern);

    if (dates.length >= 2) {
        // "2026-01 - 2026-03"
        startDate = dates[0];
        endDate = dates[1];
    } else if (dates.length === 1 && durationMatch) {
        // "2026-01 - 3mån"
        startDate = dates[0];
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        const end = new Date(startDate);
        if (unit.startsWith('mån')) end.setMonth(end.getMonth() + amount);
        else if (unit.startsWith('vec')) end.setDate(end.getDate() + amount * 7);
        else if (unit.startsWith('dag')) end.setDate(end.getDate() + amount);
        endDate = getISODate(end);
    } else if (dates.length === 1) {
        // Only start date? or assumed end date? 
        startDate = dates[0];
        // If they only provided one date and no duration, we can't infer end date reliably yet.
        // But maybe they meant "End Date"? No, usually Start.
    } else if (durationMatch) {
        // "Deff 3 mån" -> Start Today, End Today + 3 months
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        const end = new Date(startDate); // Start is today
        if (unit.startsWith('mån')) end.setMonth(end.getMonth() + amount);
        else if (unit.startsWith('vec')) end.setDate(end.getDate() + amount * 7);
        else if (unit.startsWith('dag')) end.setDate(end.getDate() + amount);
        endDate = getISODate(end);
    }

    // 3. Name Inference
    let name = input
        .replace(datePattern, '')
        .replace(durationPattern, '')
        .replace(/-|to|till/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!name || name.length < 2) name = goal.charAt(0).toUpperCase() + goal.slice(1);

    return { name, startDate, endDate, goal };
}

function parseVitals(input: string): OmniboxIntent | null {
    const lower = input.toLowerCase();

    // Sleep: "7h sömn", "sömn 8", "8.5 timmar sömn", "sova 7h", "7h sova", OR JUST "7h" (fallback)
    // We handle strict "sömn" keywords first
    const sleepMatch = lower.match(/(?:sömn|sova|sov|natt)\s*(\d+(?:[.,]\d+)?)\s*(?:h|t|timmar|tim)?/i) ||
        lower.match(/(\d+(?:[.,]\d+)?)\s*(?:h|t|timmar|tim)?\s*(?:sömn|sova|sov|natt)/i);
    if (sleepMatch) {
        return { type: 'vitals', data: { vitalType: 'sleep', amount: parseFloat(sleepMatch[1].replace(',', '.')) } };
    }

    // Aggressive "Just hours" match (e.g., "7h", "7.5h") - ONLY if it looks like a sleep log (short string, just number+h)
    // We must be careful not to match "Run 1h" here, so we check this LAST in the main loop or rely on it being checked before others if context is clear?
    // Actually, parseVitals is called BEFORE parseExercise in parseOmniboxInput.
    // If user types "Run 1h", parseVitals shouldn't steal it. 
    // BUT "7h" is ambiguous. "7h" usually means sleep in a health app context if no other keywords.
    // Let's add strict standalone check.
    const standaloneSleepMatch = lower.match(/^(\d+(?:[.,]\d+)?)\s*(?:h|t|timmar|tim)$/i);
    if (standaloneSleepMatch) {
        const val = parseFloat(standaloneSleepMatch[1].replace(',', '.'));
        // Sanity check: sleep is usually 3-14 hours. 
        if (val > 2 && val < 16) {
            return { type: 'vitals', data: { vitalType: 'sleep', amount: val } };
        }
    }

    // Steps: "10000 steg", "steg 8000"
    const stepsMatch = lower.match(/(\d+)\s*steg/i) || lower.match(/steg\s*(\d+)/i);
    if (stepsMatch) {
        return { type: 'vitals', data: { vitalType: 'steps', amount: parseInt(stepsMatch[1]) } };
    }

    // Caffeine with custom mg: "105 caf", "200mg koffein", "koffein 150"
    const caffeineMatch = lower.match(/(\d+)\s*(?:mg)?\s*(?:caf|koffein|caffeine)/i) ||
        lower.match(/(?:koffein|caffeine)\s*(\d+)\s*(?:mg)?/i);
    if (caffeineMatch) {
        const caffeineMg = parseInt(caffeineMatch[1]);
        return { type: 'vitals', data: { vitalType: 'coffee', amount: 1, caffeine: caffeineMg } };
    }

    // Coffee with intensity: "svag kaffe" (60mg), "kaffe" (100mg), "stark kaffe" (150mg)
    // Also: "2 kaffe", "stark kaffe", "svag kaffe"
    const coffeeMatch = lower.match(/(\d+)?\s*(svag|stark|starkt)?\s*kaffe/i);
    if (coffeeMatch) {
        const amount = parseInt(coffeeMatch[1] || '1');
        const intensity = coffeeMatch[2]?.toLowerCase();
        let caffeine = 100; // Default: normal coffee
        if (intensity === 'svag') caffeine = 60;
        else if (intensity === 'stark' || intensity === 'starkt') caffeine = 150;
        return { type: 'vitals', data: { vitalType: 'coffee', amount, caffeine: caffeine * amount } };
    }

    // Energy drinks: "nocco" (~180mg), "energidryck" (~80mg)
    const energyMatch = lower.match(/(\d+)?\s*(nocco|energydryck|energy|energidryck)/i);
    if (energyMatch) {
        const amount = parseInt(energyMatch[1] || '1');
        const term = energyMatch[2].toLowerCase();
        let type: 'nocco' | 'energy' = 'energy';
        let caffeine = 80; // Default energy drink
        if (term.includes('nocco')) {
            type = 'nocco';
            caffeine = 180;
        }
        return { type: 'vitals', data: { vitalType: type, amount, caffeine: caffeine * amount } };
    }

    // Water: "3 vatten", "vatten"
    const waterMatch = lower.match(/(\d+)?\s*(vatten|water)/i);
    if (waterMatch) {
        const amount = parseInt(waterMatch[1] || '1');
        return { type: 'vitals', data: { vitalType: 'water', amount } };
    }

    return null;
}

function parseExercise(input: string): OmniboxIntent | null {
    // Type keywords mapping
    const typeKeywords: Record<string, ExerciseType> = {
        'löpning': 'running', 'löpn': 'running', 'löp': 'running', 'run': 'running', 'jogging': 'running', 'jogg': 'running',
        'cykling': 'cycling', 'cykl': 'cycling', 'cyk': 'cycling', 'bike': 'cycling', 'cykel': 'cycling',
        'styrka': 'strength', 'styrk': 'strength', 'gym': 'strength', 'lyft': 'strength', 'strength': 'strength', 'weights': 'strength',
        'promenad': 'walking', 'prom': 'walking', 'walk': 'walking', 'gång': 'walking', 'gå': 'walking',
        'simning': 'swimming', 'simn': 'swimming', 'sim': 'swimming', 'swim': 'swimming', 'bad': 'swimming',
        'yoga': 'yoga', 'pilates': 'yoga', 'stretch': 'yoga'
    };

    let type: ExerciseType | null = null;
    const sortedKeywords = Object.keys(typeKeywords).sort((a, b) => b.length - a.length);

    // Improved regex to handle Swedish characters (åäö) as word characters
    // Using explicit boundary checks instead of \b which fails on åäö in some engines
    // Matches: (Start OR Non-Word)(Keyword)(WordChars containing swedish)(Non-Word OR End)

    for (const kw of sortedKeywords) {
        // Construct regex that allows keyword followed by optional ending (like "löpning" matching "löp")
        // but robustly handles the boundary.
        // We use a simpler approach: check if the word exists as a distinct token.

        // Strategy: Replace non-word chars with spaces, then check token list?
        // Or just improved Regex:
        const regex = new RegExp(`(?:^|[\\s.,!?;])(${kw}[a-zA-ZåäöÅÄÖ0-9]*)(?=$|[\\s.,!?;])`, 'i');

        if (regex.test(input)) {
            type = typeKeywords[kw];
            break;
        }
    }

    if (!type && (input.includes('träning') || input.includes('tränat') || input.includes('pass'))) {
        // Continue but generic
    }

    // Tonnage detection (moved UP to avoid conflict with duration)
    // E.g. "20 ton" or "20t" (if ton shorthand) should NOT match duration
    let tonnage: number | undefined;
    let subType: ExerciseSubType = 'default';

    // Intensity detection - needs to be declared early for pace calculation
    let intensity: ExerciseIntensity = 'moderate';
    if (input.includes('lätt') || input.includes('låg') || input.includes('lugnt') || input.includes('lugn') || input.includes('slow') || input.includes('easy')) intensity = 'low';
    else if (input.includes('hög') || input.includes('hårt') || input.includes('hard') || input.includes('tuff') || input.includes('snabb') || input.includes('snabbt') || input.includes('fast')) intensity = 'high';
    else if (input.includes('max') || input.includes('ultra')) intensity = 'ultra';

    // We create a "clean" string for duration parsing that removes tonnage
    let inputForDuration = input;

    const tonnageMatch = input.match(/(\d+)\s*ton/i); // Matches "20 ton", "20ton"
    const tonnageShortMatch = input.match(/(\d+)\s*t\b/i); // Matches "20 t" (but could be hours?) - "t" usually means hours in duration. 
    // Let's stick to "ton" explicit or maybe context. User said "20t" calculates ton correctly.
    // If user says "20t" and it matches tonnage, we must assume it's NOT duration.

    if (tonnageMatch) {
        tonnage = parseInt(tonnageMatch[1]) * 1000;
        subType = 'tonnage';
        inputForDuration = inputForDuration.replace(tonnageMatch[0], '');
    } else {
        const setRepWeightMatch = input.match(/(\d+)\s*x\s*(\d+)\s*(\d+)\s*kg/i);
        if (setRepWeightMatch) {
            const sets = parseInt(setRepWeightMatch[1]);
            const reps = parseInt(setRepWeightMatch[2]);
            const weight = parseInt(setRepWeightMatch[3]);
            tonnage = sets * reps * weight;
            subType = 'tonnage';
            inputForDuration = inputForDuration.replace(setRepWeightMatch[0], '');
        } else {
            const multiTonnageMatch = input.match(/(\d+)\s*kg/i);
            // If it's a large weight and context is strength, assume tonnage
            if (multiTonnageMatch && (type === 'strength' || input.includes('lyft'))) {
                const totalKg = parseInt(multiTonnageMatch[1]);
                if (totalKg > 300) { // Unlikely to be a single lift notes, probably tonnage
                    tonnage = totalKg;
                    subType = 'tonnage';
                    // Don't replace for duration, unlikely to conflict with "min"
                } else if (type === 'strength') {
                    // "Styrka 200kg" -> Tonnage implied? 
                    // Or maybe just generic strength. 
                    // User said "Styrka 200kg" thinks it is weight update.
                    // By attempting parseExercise FIRST, we are here.
                    // We can swallow this as a strength workout with 200kg "tonnage" (maybe deadlift?) or just notes?
                    // Let's assume tonnage if explicitly strength
                    tonnage = totalKg;
                    subType = 'tonnage';
                }
            }
        }
    }

    // Now check for duration in the CLEANED string
    // This prevents "20 ton" from matching "20 t" (hours)

    // Heart Rate Detection: "Puls 145", "HR 145", "145 bpm", "Puls 130/170"
    let heartRateAvg: number | undefined;
    let heartRateMax: number | undefined;

    // Matches: "puls 130/170", "hr 130/170"
    const hrRangeMatch = input.match(/(?:puls|hr|bpm)\s*(\d+)\/(\d+)/i);
    if (hrRangeMatch) {
        heartRateAvg = parseInt(hrRangeMatch[1]);
        heartRateMax = parseInt(hrRangeMatch[2]);
    } else {
        // Matches: "puls 140", "140 bpm", "hr 140"
        const hrMatch = input.match(/(?:puls|hr|bpm)\s*(\d+)/i) || input.match(/(\d+)\s*bpm/i);
        if (hrMatch) {
            heartRateAvg = parseInt(hrMatch[1]);
        }
    }

    // Distance detection (km) - moved up to clean string for duration
    let distance: number | undefined;
    const distanceMatch = input.match(/(\d+(?:[.,]\d+)?)\s*km/i);
    if (distanceMatch) {
        distance = parseFloat(distanceMatch[1].replace(',', '.'));
        // Remove distance from inputForDuration so "10km" doesn't become "10 min"
        inputForDuration = inputForDuration.replace(distanceMatch[0], '');
    }

    // Pace detection and smart duration calculation for running
    // Supports: "@ 5:00", "@5:00", "5:00 min/km", "5 min/km", "tempo 5:00"
    let pace: number | undefined; // pace in seconds per km
    const paceMatch = input.match(/@?\s*(\d+):(\d+)(?:\s*(?:min)?\/km)?/i)
        || input.match(/tempo\s*(\d+):(\d+)/i)
        || input.match(/(\d+)\s*min\/km/i);

    if (paceMatch) {
        if (paceMatch[2]) {
            // Format: 5:30 (min:sec per km)
            pace = parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]);
        } else {
            // Format: 5 min/km (just minutes)
            pace = parseInt(paceMatch[1]) * 60;
        }
    }

    // Now check for duration in the CLEANED string
    // This prevents "20 ton" or "10 km" from matching "XX min/h" if loose regex used,
    // or specifically prevents "10" from being picked up as duration if we used a loose fallback.

    // We strictly look for units first
    const durationMatch = inputForDuration.match(/(\d+)\s*(min|h|t|m)\b/i);
    let duration = 30; // Default

    if (durationMatch) {
        duration = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        if (unit.startsWith('h') || unit.startsWith('t')) duration *= 60;
    } else {
        // Fallback: If no units, checks for just number?
        // NO, standard practice is to require units or rely on smart estimation from distance/pace.
        // If we have distance but no duration (and no pace), we estimate.
        if (distance) {
            if (pace) {
                duration = Math.round((distance * pace) / 60);
            } else {
                // Default paces by intensity
                const defaultPace: Record<ExerciseIntensity, number> = {
                    low: 7 * 60,     // 7:00 min/km
                    moderate: 6 * 60, // 6:00 min/km
                    high: 5 * 60,     // 5:00 min/km
                    ultra: 4.5 * 60   // 4:30 min/km
                };
                duration = Math.round((distance * defaultPace[intensity]) / 60);
            }
        }
    }

    // Sub-types for running
    if (type === 'running') {
        if (input.includes('intervall')) subType = 'interval';
        else if (input.includes('långpass')) subType = 'long-run';
        else if (input.includes('tävling')) subType = 'competition';
        else if (input.includes('lopp')) subType = 'race';
        else if (input.includes('ultra')) subType = 'ultra';
    }

    // Inferred type from keywords (if not explicit)
    if (!type) {
        if (input.includes('intervall') || input.includes('långpass') || input.includes('lopp') || input.includes('tävling') || input.includes('ultra')) {
            type = 'running';
        } else if (tonnage) {
            // If we detected tonnage, it's definitely strength training
            type = 'strength';
        }
    }

    // ONLY return exercise if we have a clear indication this is an exercise
    // Otherwise return null to allow food/search fallback
    if (!type && !tonnage && !distance && !heartRateAvg) {
        return null;
    }

    return {
        type: 'exercise',
        data: {
            exerciseType: type || 'other',
            duration,
            intensity,
            notes: input.length > 20 ? input : undefined,
            subType,
            tonnage,
            distance,
            heartRateAvg,
            heartRateMax
        }
    };
}

function parseFood(input: string): OmniboxIntent | null {
    const mealKeywords: Record<string, MealType> = {
        'frukost': 'breakfast', 'fruk': 'breakfast',
        'lunch': 'lunch', 'lun': 'lunch',
        'middag': 'dinner', 'midda': 'dinner', 'kvällsmat': 'dinner',
        'mellanmål': 'snack', 'mellis': 'snack', 'mellan': 'snack', 'snack': 'snack',
        'dryck': 'beverage', 'drick': 'beverage'
    };

    let working = input.toLowerCase().trim();

    // 1. Extract meal type
    let explicitMealType: MealType | undefined;
    const sortedKeywords = Object.keys(mealKeywords).sort((a, b) => b.length - a.length);

    for (const kw of sortedKeywords) {
        const regex = new RegExp(`\\b${kw}\\w*\\b`, 'i');
        if (regex.test(working)) {
            explicitMealType = mealKeywords[kw];
            working = working.replace(regex, '').trim();
            break;
        }
    }

    // 2. Extract quantity and unit - more flexible matching
    // Matches: "123g", "123 g", "2.5 kg", "100ml", "2 st", "1 portion"
    const quantityPatterns = [
        /([\d.,]+)\s*(g|gram|gr)\b/i,
        /([\d.,]+)\s*(kg|kilo)\b/i,
        /([\d.,]+)\s*(ml|milliliter)\b/i,
        /([\d.,]+)\s*(l|liter)\b/i,
        /([\d.,]+)\s*(st|stycken?|pcs)\b/i,
        /([\d.,]+)\s*(port|portion(?:er)?)\b/i,
        /([\d.,]+)(port)\b/i,  // Shorthand: "2port" without space
        /([\d.,]+)\s*(dl|deciliter)\b/i,
        /([\d.,]+)\s*(msk|matsked(?:ar)?)\b/i,
        /([\d.,]+)\s*(tsk|tesked(?:ar)?)\b/i,
    ];

    let quantity: number | undefined;
    let unit: string = 'g';

    for (const pattern of quantityPatterns) {
        const match = working.match(pattern);
        if (match) {
            const rawNum = parseFloat(match[1].replace(',', '.'));
            const rawUnit = match[2].toLowerCase();

            // Convert to grams for common units
            if (rawUnit.startsWith('kg') || rawUnit.startsWith('kilo')) {
                quantity = rawNum * 1000;
                unit = 'g';
            } else if (rawUnit.startsWith('l') && !rawUnit.startsWith('liter')) {
                quantity = rawNum * 1000;
                unit = 'ml';
            } else if (rawUnit.startsWith('dl')) {
                quantity = rawNum * 100;
                unit = 'ml';
            } else if (rawUnit.startsWith('st') || rawUnit.startsWith('pcs')) {
                quantity = rawNum;
                unit = 'st';
            } else if (rawUnit.startsWith('port')) {
                quantity = rawNum;
                unit = 'portion';
            } else if (rawUnit.startsWith('msk')) {
                quantity = rawNum * 15; // 15g per msk
                unit = 'g';
            } else if (rawUnit.startsWith('tsk')) {
                quantity = rawNum * 5; // 5g per tsk
                unit = 'g';
            } else {
                quantity = rawNum;
                unit = rawUnit.replace(/s$/, ''); // Remove trailing 's'
            }

            working = working.replace(match[0], '').trim();
            break;
        }
    }

    // 3. Clean up the query - remove extra spaces and common filler words
    let query = working
        .replace(/\s+/g, ' ')
        .replace(/^(jag|ska|vill|logga|lägga till|äta|äter|ät|har ätit)\s+/i, '')
        .replace(/\s+(till|som|för)\s*$/i, '')
        .trim();

    // 4. If query is empty but we have quantity, it's not a valid food intent
    if (!query && !quantity) return null;

    // 5. If we only have a number left (no food name), return null
    if (/^\d+$/.test(query)) return null;

    // 6. Determine meal type from time if not explicit
    let mealType = explicitMealType;
    if (!mealType) {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 10) mealType = 'breakfast';
        else if (hour >= 10 && hour < 14) mealType = 'lunch';
        else if (hour >= 17 && hour < 21) mealType = 'dinner';
        else mealType = 'snack';
    }

    // 7. Default quantity to 100g if parsing food but no quantity given
    // This can be overridden by the user's typical amount in the Omnibox
    if (!quantity && query) {
        quantity = 100;
    }

    return {
        type: 'food',
        data: { query, quantity, unit, mealType }
    };
}

function parseMeasurements(input: string): OmniboxIntent | null {
    // 1. Extract date first
    const { date, remaining } = parseDate(input);
    const lower = remaining.toLowerCase().trim();

    // Mapping of Swedish keywords to BodyMeasurementType
    const measurementMap: Record<string, BodyMeasurementType> = {
        'midja': 'waist',
        'waist': 'waist',
        'höft': 'hips',
        'hips': 'hips',
        'stuss': 'hips',
        'bröst': 'chest',
        'chest': 'chest',
        'lår vänster': 'thigh_left',
        'vänster lår': 'thigh_left',
        'thigh left': 'thigh_left',
        'lår höger': 'thigh_right',
        'höger lår': 'thigh_right',
        'thigh right': 'thigh_right',
        'lår': 'thigh_left',
        'överarm vänster': 'arm_left',
        'vänster arm': 'arm_left',
        'arm vänster': 'arm_left',
        'arm left': 'arm_left',
        'överarm höger': 'arm_right',
        'höger arm': 'arm_right',
        'arm höger': 'arm_right',
        'arm right': 'arm_right',
        'arm': 'arm_left',
        'vad vänster': 'calf_left',
        'vänster vad': 'calf_left',
        'calf left': 'calf_left',
        'vad höger': 'calf_right',
        'höger vad': 'calf_right',
        'calf right': 'calf_right',
        'vad': 'calf_left',
        'nacke': 'neck',
        'neck': 'neck',
        'hals': 'neck',
        'axlar': 'shoulders',
        'shoulders': 'shoulders',
        'underarm vänster': 'forearm_left',
        'forearm left': 'forearm_left',
        'underarm höger': 'forearm_right',
        'forearm right': 'forearm_right',
    };

    // 2. Check for standalone triggers
    if (lower === 'mått' || lower === 'measurements' || lower === 'body') {
        return { type: 'measurement', data: {}, date };
    }

    // 3. Try to match specific measurement (+ optional value)
    for (const [kw, type] of Object.entries(measurementMap)) {
        // Pattern for keyword + optional number
        const pattern1 = new RegExp(`(?:mått\\s+)?${kw}(?:\\s*[:\\s]*(\\d+(?:[.,]\\d+)?))?\\s*(?:cm)?`, 'i');
        // Pattern for number + keyword
        const pattern2 = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:cm)?\\s*${kw}`, 'i');

        const match1 = lower.match(pattern1);
        const match2 = lower.match(pattern2);

        if (match1) {
            const valueStr = match1[1];
            if (valueStr) {
                const value = parseFloat(valueStr.replace(',', '.'));
                return { type: 'measurement', data: { measurementType: type, value }, date };
            } else if (lower.includes('mått') || lower.startsWith(kw)) {
                // Return type even without value if "mått" prefix is used or keyword is at start
                return { type: 'measurement', data: { measurementType: type }, date };
            }
        }

        if (match2) {
            const value = parseFloat(match2[1].replace(',', '.'));
            return { type: 'measurement', data: { measurementType: type, value }, date };
        }
    }

    return null;
}
