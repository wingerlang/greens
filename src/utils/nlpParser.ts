import { type ExerciseType, type ExerciseIntensity, type MealType } from '../models/types.ts';

export type OmniboxIntent =
    | { type: 'exercise'; data: { exerciseType: ExerciseType; duration: number; intensity: ExerciseIntensity; notes?: string } }
    | { type: 'food'; data: { query: string; quantity?: number; unit?: string; mealType?: MealType } }
    | { type: 'weight'; data: { weight: number } }
    | { type: 'search'; data: { query: string } };

/**
 * Parses a natural language string into a structured intent
 */
export function parseOmniboxInput(input: string): OmniboxIntent {
    const lower = input.toLowerCase().trim();
    if (!lower) return { type: 'search', data: { query: '' } };

    // 1. Weight Check (e.g., "vikt 75.5", "vikt: 80", "80kg")
    const weightMatch = lower.match(/(?:vikt\s*[:\s]*|)(\d+(?:[.,]\d+)?)\s*(?:kg|kilo)?$/);
    if (weightMatch && (lower.startsWith('vikt') || lower.endsWith('kg') || lower.endsWith('kilo'))) {
        const weight = parseFloat(weightMatch[1].replace(',', '.'));
        if (!isNaN(weight) && weight > 20 && weight < 500) {
            return { type: 'weight', data: { weight } };
        }
    }

    // 2. Exercise Check (e.g., "60min löpning", "hård styrka")
    const exerciseIntents = parseExercise(lower);
    if (exerciseIntents) return exerciseIntents;

    // 3. Food/Meal Check (e.g., "100g banan", "2 st äpplen", "proteinshake")
    const foodIntents = parseFood(lower);
    if (foodIntents) return foodIntents;

    // 4. Default to Search
    return { type: 'search', data: { query: input } };
}

function parseExercise(input: string): OmniboxIntent | null {
    // Type keywords
    let type: ExerciseType | null = null;
    if (input.includes('lö') || input.includes('run')) type = 'running';
    else if (input.includes('cy') || input.includes('bik')) type = 'cycling';
    else if (input.includes('st') || input.includes('gym') || input.includes('lyft')) type = 'strength';
    else if (input.includes('ga') || input.includes('prom') || input.includes('walk')) type = 'walking';
    else if (input.includes('si') || input.includes('swi')) type = 'swimming';
    else if (input.includes('yo')) type = 'yoga';

    if (!type && !input.match(/\d+\s*(min|h|t|m)/)) return null;

    // Duration
    const durationMatch = input.match(/(\d+)\s*(min|h|t|m)?/);
    let duration = 30; // Default
    if (durationMatch) {
        duration = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        if (unit === 'h' || unit === 't') duration *= 60;
    }

    // Intensity
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
    // 1. Check for explicit meal type mentions
    let explicitMealType: MealType | undefined;
    if (input.includes('frukost')) explicitMealType = 'breakfast';
    else if (input.includes('lunch')) explicitMealType = 'lunch';
    else if (input.includes('middag')) explicitMealType = 'dinner';
    else if (input.includes('mellanmål')) explicitMealType = 'snack';
    else if (input.includes('dryck')) explicitMealType = 'beverage';

    // 2. Extract quantity and food item name
    // Pattern matches: "100g banan", "banan 100g", "2 st äpplen", "äpple 2st"
    const quantityMatch = input.match(/(\d+(?:[.,]\d+)?)\s*(g|ml|st|pcs|kg|l|port)?/i);

    let quantity: number | undefined;
    let unit: string | undefined;
    let query = input;

    if (quantityMatch) {
        quantity = parseFloat(quantityMatch[1].replace(',', '.'));
        unit = quantityMatch[2]?.toLowerCase() || 'g';
        // Remove the quantity part from the query
        query = input.replace(quantityMatch[0], '').trim();
    }

    // Remove meal type words from query if present
    const mealKeywords = ['frukost', 'lunch', 'middag', 'mellanmål', 'dryck'];
    mealKeywords.forEach(kw => {
        query = query.replace(kw, '').trim();
    });

    if (!query) return null;

    // Default meal type based on time if not explicit
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
