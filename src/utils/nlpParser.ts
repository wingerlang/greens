import { type ExerciseType, type ExerciseIntensity, type MealType, type ExerciseSubType } from '../models/types.ts';

export type OmniboxIntent =
    | { type: 'exercise'; data: { exerciseType: ExerciseType; duration: number; intensity: ExerciseIntensity; notes?: string; subType?: ExerciseSubType; tonnage?: number }; date?: string }
    | { type: 'food'; data: { query: string; quantity?: number; unit?: string; mealType?: MealType }; date?: string }
    | { type: 'weight'; data: { weight: number }; date?: string }
    | { type: 'vitals'; data: { vitalType: 'sleep' | 'water' | 'coffee' | 'nocco' | 'energy'; amount: number }; date?: string }
    | { type: 'search'; data: { query: string }; date?: string };

/**
 * Parses a natural language string into a structured intent
 */
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

    // 5. Food/Meal Check
    const foodIntents = parseFood(lower);
    if (foodIntents) return { ...foodIntents, date };

    // 6. Default to Search
    return { type: 'search', data: { query: input }, date };
}


function parseDate(input: string): { date?: string; remaining: string } {
    const today = new Date();
    const getISODate = (d: Date) => d.toISOString().split('T')[0];

    if (input.includes('idag')) return { date: getISODate(today), remaining: input.replace('idag', '') };
    if (input.includes('igår')) {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return { date: getISODate(d), remaining: input.replace('igår', '') };
    }
    if (input.includes('förrgår')) {
        const d = new Date(today);
        d.setDate(d.getDate() - 2);
        return { date: getISODate(d), remaining: input.replace('förrgår', '') };
    }

    // ISO Date Match (YYYY-MM-DD or MM-DD)
    const dateMatch = input.match(/\b(\d{4}-)?(\d{1,2})-(\d{1,2})\b/);
    if (dateMatch) {
        let year = dateMatch[1] ? dateMatch[1].replace('-', '') : today.getFullYear();
        let month = dateMatch[2].padStart(2, '0');
        let day = dateMatch[3].padStart(2, '0');
        return { date: `${year}-${month}-${day}`, remaining: input.replace(dateMatch[0], '') };
    }

    return { remaining: input };
}

function parseVitals(input: string): OmniboxIntent | null {
    // Sleep: "7h sömn", "sömn 8", "8.5 timmar sömn"
    const sleepMatch = input.match(/(\d+(?:[.,]\d+)?)\s*(?:h|t|timmar|tim)?\s*sömn/i) ||
        input.match(/sömn\s*(\d+(?:[.,]\d+)?)\s*(?:h|t|timmar|tim)?/i);
    if (sleepMatch) {
        return { type: 'vitals', data: { vitalType: 'sleep', amount: parseFloat(sleepMatch[1].replace(',', '.')) } };
    }

    // Multiplier vitals: "3 kaffe", "2 vatten", "nocco"
    const multiplierMatch = input.match(/(\d+)?\s*(kaffe|vatten|water|nocco|energydryck|energy|energidryck)/i);
    if (multiplierMatch) {
        const amount = parseInt(multiplierMatch[1] || '1');
        const term = multiplierMatch[2].toLowerCase();

        let type: 'water' | 'coffee' | 'nocco' | 'energy' = 'water';
        if (term.includes('kaffe')) type = 'coffee';
        else if (term.includes('nocco')) type = 'nocco';
        else if (term.includes('energy') || term.includes('energi')) type = 'energy';
        else if (term.includes('vatten') || term.includes('water')) type = 'water';

        return { type: 'vitals', data: { vitalType: type, amount } };
    }

    return null;
}

function parseExercise(input: string): OmniboxIntent | null {
    // Type keywords mapping
    const typeKeywords: Record<string, ExerciseType> = {
        'löpning': 'running', 'löpn': 'running', 'löp': 'running', 'run': 'running',
        'cykling': 'cycling', 'cykl': 'cycling', 'cyk': 'cycling', 'bike': 'cycling',
        'styrka': 'strength', 'styrk': 'strength', 'gym': 'strength', 'lyft': 'strength',
        'promenad': 'walking', 'prom': 'walking', 'walk': 'walking', 'gång': 'walking',
        'simning': 'swimming', 'simn': 'swimming', 'sim': 'swimming', 'swim': 'swimming',
        'yoga': 'yoga'
    };

    let type: ExerciseType | null = null;
    const sortedKeywords = Object.keys(typeKeywords).sort((a, b) => b.length - a.length);

    for (const kw of sortedKeywords) {
        const regex = new RegExp(`\\b${kw}\\w*\\b`, 'i');
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

    if (!type && !inputForDuration.match(/\d+\s*(min|h|t|m)/)) return null;

    const durationMatch = inputForDuration.match(/(\d+)\s*(min|h|t|m)?/);
    let duration = 30;
    if (durationMatch) {
        duration = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        if (unit === 'h' || unit === 't') duration *= 60;
    }

    let intensity: ExerciseIntensity = 'moderate';
    if (input.includes('lätt') || input.includes('låg') || input.includes('slow')) intensity = 'low';
    else if (input.includes('hög') || input.includes('hårt') || input.includes('hard') || input.includes('tuff')) intensity = 'high';
    else if (input.includes('max') || input.includes('ultra')) intensity = 'ultra';

    // Sub-types for running
    if (type === 'running') {
        if (input.includes('intervall')) subType = 'interval';
        else if (input.includes('långpass')) subType = 'long-run';
        else if (input.includes('tävling')) subType = 'competition';
        else if (input.includes('lopp')) subType = 'race';
        else if (input.includes('ultra')) subType = 'ultra';
    }

    return {
        type: 'exercise',
        data: {
            exerciseType: type || 'other',
            duration,
            intensity,
            notes: input.length > 20 ? input : undefined,
            subType,
            tonnage
        }
    };
}

function parseFood(input: string): OmniboxIntent | null {
    const mealKeywords: Record<string, MealType> = {
        'frukost': 'breakfast', 'fruk': 'breakfast',
        'lunch': 'lunch', 'lun': 'lunch',
        'middag': 'dinner', 'midda': 'dinner', 'mid': 'dinner',
        'mellanmål': 'snack', 'mellis': 'snack', 'mellan': 'snack',
        'dryck': 'beverage', 'drick': 'beverage', 'dry': 'beverage'
    };

    let explicitMealType: MealType | undefined;
    let queryWithoutMeal = input.toLowerCase();
    const sortedKeywords = Object.keys(mealKeywords).sort((a, b) => b.length - a.length);

    for (const kw of sortedKeywords) {
        const regex = new RegExp(`\\b${kw}\\w*\\b`, 'i');
        if (regex.test(input)) {
            explicitMealType = mealKeywords[kw];
            queryWithoutMeal = input.replace(regex, '').trim();
            break;
        }
    }

    const quantityMatch = queryWithoutMeal.match(/(\d+(?:[.,]\d+)?)\s*(g|ml|st|pcs|kg|l|port)?/i);
    let quantity: number | undefined;
    let unit: string | undefined;
    let query = queryWithoutMeal;

    if (quantityMatch) {
        quantity = parseFloat(quantityMatch[1].replace(',', '.'));
        unit = quantityMatch[2]?.toLowerCase() || 'g';
        query = queryWithoutMeal.replace(quantityMatch[0], '').trim();
    }

    if (!query) return null;

    let mealType = explicitMealType;
    if (!mealType) {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 10) mealType = 'breakfast';
        else if (hour >= 11 && hour < 14) mealType = 'lunch';
        else if (hour >= 17 && hour < 20) mealType = 'dinner';
        else mealType = 'snack';
    }

    return {
        type: 'food',
        data: { query, quantity, unit, mealType }
    };
}
