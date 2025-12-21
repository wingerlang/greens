import { type ExerciseType, type ExerciseIntensity, type MealType } from '../models/types.ts';

export type OmniboxIntent =
    | { type: 'exercise'; data: { exerciseType: ExerciseType; duration: number; intensity: ExerciseIntensity; notes?: string }; date?: string }
    | { type: 'food'; data: { query: string; quantity?: number; unit?: string; mealType?: MealType }; date?: string }
    | { type: 'weight'; data: { weight: number }; date?: string }
    | { type: 'vitals'; data: { vitalType: 'sleep' | 'water' | 'coffee' | 'nocco' | 'energy'; amount: number }; date?: string }
    | { type: 'search'; data: { query: string }; date?: string };

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

    // 3. Weight Check
    const weightMatch = lower.match(/(?:vikt\s*[:\s]*|)(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)?$/);
    if (weightMatch && (lower.startsWith('vikt') || lower.endsWith('kg') || lower.endsWith('kilo'))) {
        const weight = parseFloat(weightMatch[1].replace(',', '.'));
        if (!isNaN(weight) && weight > 20 && weight < 500) {
            return { type: 'weight', data: { weight }, date };
        }
    }

    // 4. Exercise Check
    const exerciseIntents = parseExercise(lower);
    if (exerciseIntents) return { ...exerciseIntents, date };

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
    // ... (rest of the existing parseExercise function, but refactored to return intent)
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
        // Continue
    }

    if (!type && !input.match(/\d+\s*(min|h|t|m)/)) return null;

    const durationMatch = input.match(/(\d+)\s*(min|h|t|m)?/);
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

    return {
        type: 'exercise',
        data: {
            exerciseType: type || 'other',
            duration,
            intensity,
            notes: input.length > 20 ? input : undefined
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
