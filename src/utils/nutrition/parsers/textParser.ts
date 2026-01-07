import { z } from "zod";
import { ParseTextSchema, ParsedNutritionSchema, type ParsedNutrition } from "../schemas.ts";

/**
 * Parses unstructured text to extract nutrition values per 100g/unit.
 *
 * Goal: Extract standard nutrition facts (Calories, Protein, Carbs, Fat, Fiber) from OCR text or HTML body.
 * Constraints: Relies on regex patterns; may fail on non-standard formatting.
 * Dependencies: Zod for validation.
 *
 * @param inputText - The raw text to parse.
 * @returns ParsedNutrition object with extracted values.
 */
export const parseNutritionText = (inputText: string): ParsedNutrition => {
    // 1. Validate Input
    const text = ParseTextSchema.parse(inputText);

    const result: ParsedNutrition = {};
    if (!text) return result;

    // Normalize: lowercase and standardize decimals
    const normalized = text.toLowerCase().replace(/,/g, '.');

    const findValue = (keywords: string[], excludeKeywords: string[] = []): number | undefined => {
        for (const kw of keywords) {
            const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Priority 1: Immediate proximity (e.g. "147kcal", "Protein: 14g")
            // Keyword followed by number with only punctuation/whitespace
            const patternImm1 = new RegExp(`${escapedKw}\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)`, 'i');
            const matchImm1 = normalized.match(patternImm1);
            if (matchImm1) return parseFloat(matchImm1[1]);

            // Number followed by keyword with only unit/whitespace
            const patternImm2 = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:g|gram|kcal|kj)?\\s*${escapedKw}`, 'i');
            const matchImm2 = normalized.match(patternImm2);
            if (matchImm2) return parseFloat(matchImm2[1]);

            // Priority 2: Flexible distance (if no immediate match found)
            // Keyword followed by number within 20 chars (strictly same line)
            const patternFlex1 = new RegExp(`${escapedKw}[^\\d\\n]{0,20}(\\d+(?:\\.\\d+)?)`, 'i');
            const matchFlex1 = normalized.match(patternFlex1);
            if (matchFlex1) {
                const val = parseFloat(matchFlex1[1]);
                const fragment = normalized.substring(matchFlex1.index!, matchFlex1.index! + matchFlex1[0].length);
                if (!excludeKeywords.some(ex => fragment.includes(ex))) {
                    return val;
                }
            }

            // Number followed by keyword within 20 chars (strictly same line)
            const patternFlex2 = new RegExp(`(\\d+(?:\\.\\d+)?)?[^\\d\\n]{0,20}${escapedKw}`, 'i');
            const matchFlex2 = normalized.match(patternFlex2);
            if (matchFlex2 && matchFlex2[1]) {
                const val = parseFloat(matchFlex2[1]);
                const fragment = normalized.substring(matchFlex2.index!, matchFlex2.index! + matchFlex2[0].length);
                if (!excludeKeywords.some(ex => fragment.includes(ex))) {
                    return val;
                }
            }
        }
        return undefined;
    };

    // 1. Calories ( kcal > kj )
    const kcal = findValue(['kcal', 'kalori', 'calorie']);
    if (kcal !== undefined) {
        result.calories = kcal;
    } else {
        const kj = findValue(['kj']);
        if (kj !== undefined) result.calories = Math.round(kj / 4.184);
    }

    // 2. Protein
    result.protein = findValue(['protein', 'äggvita', 'prot']);

    // 3. Carbohydrates
    result.carbs = findValue(['kolhydrat', 'carbohydrate', 'carbs', 'cho']);

    // 4. Fat
    result.fat = findValue(['fett', 'fat', 'lipids'], ['mättat', 'saturated', 'enkelomättat', 'fleromättat']);

    // 5. Fiber
    result.fiber = findValue(['fiber', 'fibrer']);

    // Higher-level extraction (Name, Ingredients)
    // We use lowercased original text to preserve commas for ingredients
    const textLower = text.toLowerCase();

    // 6. Name extraction (e.g. "Pizzakit")
    // If it's the first line and not numeric, it's likely the name
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length > 0) {
        const firstLine = lines[0].trim();
        if (!firstLine.match(/^\d/) && firstLine.length < 50) {
            result.name = firstLine;
        }
    }

    // 7. Ingredients Extraction - Use textLower to preserve commas
    const ingredientKeywords = ['ingredienser', 'ingredients', 'innehållsförteckning', 'innehåll'];
    for (const kw of ingredientKeywords) {
        const pattern = new RegExp(`${kw}\\s*[:=-]?\\s*([^\\d\\n][^\\n]{10,2000})`, 'i');
        const match = textLower.match(pattern);
        if (match) {
            result.ingredients = match[1].trim();
            break;
        }
    }

    // 2. Validate Output
    return ParsedNutritionSchema.parse(result);
};
