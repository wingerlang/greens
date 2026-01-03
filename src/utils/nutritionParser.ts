/**
 * Utility for parsing nutrition facts from unstructured text.
 * Robust against various formats, decimal separators (comma/dot), and cluttered text.
 */

export interface ParsedNutrition {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
}

/**
 * Parses unstructured text to extract nutrition values per 100g/unit.
 */
export const parseNutritionText = (inputText: string): ParsedNutrition => {
    const result: ParsedNutrition = {};
    if (!inputText) return result;

    // Normalize: lowercase and standardize decimals
    const normalized = inputText.toLowerCase().replace(/,/g, '.');

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

    return result;
};
