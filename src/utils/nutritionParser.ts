/**
 * Utility for parsing nutrition facts from unstructured text.
 * Robust against various formats, decimal separators (comma/dot), and cluttered text.
 */

export interface ParsedNutrition {
    name?: string;
    brand?: string;
    packageWeight?: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    ingredients?: string;
    defaultPortionGrams?: number;
}

/**
 * Parses unstructured text to extract nutrition values per 100g/unit.
 */
export const parseNutritionText = (inputText: string): ParsedNutrition => {
    const result: ParsedNutrition = {};
    if (!inputText) return result;

    // 1. Advanced Normalization
    let normalized = inputText
        .replace(/,/g, '.')               // Standardize decimals (70,9 -> 70.9)
        .replace(/(\d)\s+\./g, '$1.')     // Fix "70 .9" -> "70.9"
        .replace(/\.\s+(\d)/g, '.$1')     // Fix "70. 9" -> "70.9"
        .replace(/\s(\d)\s+(\d)\s/g, ' $1$2 ') // Fix spaced digits "1 268" -> "1268" (risky, but common for kJ)
        .toLowerCase();

    // Fix common OCR errors
    normalized = normalized
        .replace(/o(\.\d)/g, '0$1')       // "O.4" -> "0.4"
        .replace(/(\d)\s*g\b/g, '$1 g');  // Ensure space before unit "70.9g" -> "70.9 g" to help regex

    const findValue = (keywords: string[], excludeKeywords: string[] = []): number | undefined => {
        for (const kw of keywords) {
            // Escape keyword
            const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Regex Construction:
            // 1. Keyword boundary (\b) to avoid partial matches
            // 2. Flexible separator ( colon, dash, equals, whitespace)
            // 3. Capture group for number

            // Priority 1: "Protein 14g" or "Protein: 14"
            const patternImm1 = new RegExp(`\\b${escapedKw}\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)`, 'i');
            const matchImm1 = normalized.match(patternImm1);
            if (matchImm1) return parseFloat(matchImm1[1]);

            // Priority 2: "14g Protein"
            const patternImm2 = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:g|gram|kcal|kj)?\\s*\\b${escapedKw}\\b`, 'i');
            const matchImm2 = normalized.match(patternImm2);
            if (matchImm2) return parseFloat(matchImm2[1]);

            // Priority 3: Loose search (same line)
            // Look for keyword, then ignore up to 20 non-digit chars, then capture number
            const patternFlex1 = new RegExp(`\\b${escapedKw}\\b[^\\d\\n]{0,30}(\\d+(?:\\.\\d+)?)`, 'i');
            const matchFlex1 = normalized.match(patternFlex1);
            if (matchFlex1) {
                const val = parseFloat(matchFlex1[1]);
                // Verify no exclusion keywords in between
                const fragment = normalized.substring(matchFlex1.index!, matchFlex1.index! + matchFlex1[0].length);
                if (!excludeKeywords.some(ex => fragment.includes(ex))) {
                    return val;
                }
            }
        }
        return undefined;
    };

    // 1. Calories ( kcal > kj )
    const kcal = findValue(['kcal', 'kalori', 'calorie', 'energi']);
    if (kcal !== undefined && kcal > 0) {
        // If we matched "Energi: 303", it might be raw number.
        // Usually Energi has two values: 1200kJ / 300kcal.
        // Regex might catch 1200 first.
        // Let's refine: try explicit 'kcal' search first (already done above in loop).
        // If value > 1000 and we suspect it's kJ, convert?
        // Heuristic: If > 800 and not explicitly kcal, assume kJ? No, butter is 700kcal.
        // Safe bet: trust the parser. But "Energi 303kcal / 1268kJ" -> "Energi 303".
        result.calories = kcal;
    } else {
        const kj = findValue(['kj']);
        if (kj !== undefined) result.calories = Math.round(kj / 4.184);
    }

    // 2. Protein
    result.protein = findValue(['protein', 'äggvita', 'prot']);

    // 3. Carbohydrates
    // "Kolhydrat" often precedes "varav sockerarter".
    // If we match "Kolhydrat" we want the first number.
    result.carbs = findValue(['kolhydrat', 'carbohydrate', 'carbs', 'cho'], ['socker', 'sugar', 'varav']);

    // 4. Fat
    // "Fett" often precedes "mättat fett".
    result.fat = findValue(['fett', 'fat', 'lipids'], ['mättat', 'saturated', 'enkelomättat', 'fleromättat', 'trans']);

    // 5. Fiber
    result.fiber = findValue(['fiber', 'fibrer', 'kostfiber']);

    // 6. Name Extraction (Improved)
    const lines = inputText.split('\n').filter(l => l.trim().length > 0);
    const blacklist = [
        'innehåll', 'innehållsförteckning', 'ingredienser',
        'näringsvärde', 'näringsdeklaration', 'per 100g',
        'per 100 g', 'deklaration', 'nutrition', 'facts',
        'ingredients', 'energy', 'energi'
    ];

    for (const line of lines) {
        const cleaned = line.trim();
        // Skip short noise or numeric lines
        if (cleaned.length < 3 || cleaned.match(/^\d/)) continue;

        // Skip headers
        if (blacklist.some(bl => cleaned.toLowerCase().includes(bl))) continue;

        // Found a candidate!
        if (cleaned.length < 60) {
            result.name = cleaned;
            break;
        }
    }

    // 7. Ingredients Extraction (Improved)
    const textLower = inputText.toLowerCase();
    const ingredientKeywords = ['ingredienser', 'ingredients', 'innehållsförteckning']; // Priority order

    for (const kw of ingredientKeywords) {
        // 1. Look for Header followed by content (possibly next line)
        // Match boundary, then colon/whitespace, then capture until double-newline or end
        // [^#]* is a trick to match across lines but stop at some point?
        // Actually, ingredients usually end at "Näringsvärde".

        const pattern = new RegExp(`\\b${kw}\\b[:;]?\\s*([\\s\\S]+?)(\n\\s*näring|\n\\s*energi|$)`, 'i');
        const match = textLower.match(pattern);

        if (match && match[1]) {
            let candidate = match[1].trim();
            // Cleanup: if it starts with "..." or similar
            candidate = candidate.replace(/^[:\-.]+\s*/, '');
            // Limit length to avoid capturing whole document
            if (candidate.length > 5 && candidate.length < 2000) {
                result.ingredients = candidate;
                break;
            }
        }
    }

    return result;
};

/**
 * Extracts values from Schema.org JSON-LD data
 */
export const extractFromJSONLD = (jsonLds: any[]): ParsedNutrition => {
    const result: ParsedNutrition = {};

    const findNutritionInObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        // Common schema.org paths
        const nutrition = obj.nutrition || obj;
        if (nutrition) {
            if (nutrition.calories) result.calories = parseFloat(nutrition.calories);
            if (nutrition.proteinContent) result.protein = parseFloat(nutrition.proteinContent);
            if (nutrition.fatContent) result.fat = parseFloat(nutrition.fatContent);
            if (nutrition.carbohydrateContent) result.carbs = parseFloat(nutrition.carbohydrateContent);
            if (nutrition.fiberContent) result.fiber = parseFloat(nutrition.fiberContent);
        }

        if (obj.name && !result.name) result.name = obj.name;
        if (obj.brand && !result.brand) {
            result.brand = typeof obj.brand === 'string' ? obj.brand : obj.brand.name;
        }

        // Ingredients in JSON-LD
        if ((obj.recipeIngredient || obj.ingredients) && !result.ingredients) {
            const ingredients = obj.recipeIngredient || obj.ingredients;
            result.ingredients = Array.isArray(ingredients) ? ingredients.join(', ') : ingredients;
        }

        // Recursive search for deeper objects
        for (const key in obj) {
            if (typeof obj[key] === 'object') findNutritionInObject(obj[key]);
        }
    };

    jsonLds.forEach(findNutritionInObject);
    return result;
};

/**
 * Heuristic to clean up a product name from a page title or H1
 */
export const cleanProductName = (title: string, h1?: string): string => {
    // If title is generic, prioritize H1
    const genericTitles = ['startsida', 'home', 'login', 'produkter', 'varukorg'];
    const lowerTitle = (title || '').toLowerCase();

    let base = title;
    if (h1 && (genericTitles.some(g => lowerTitle.includes(g)) || !title)) {
        base = h1;
    }

    if (!base) return '';

    // Remove common site suffixes
    let name = base.split(/[|•\-–—]| - /)[0].trim();

    // Remove "Handla", "Köp", "Price" etc if they are at the start
    name = name.replace(/^(Handla|Köp|Pris på|Varuinformation för|Se priset på)\s+/i, '');

    // SMART FEATURE: Remove weight suffixes like "275g" or "1kg" from the name if they exist
    name = name.replace(/\s*\d+\s*(g|kg|ml|l|cl)\b/i, '').trim();

    return name;
};

/**
 * Extracts packaging weight (e.g. "275g") from text
 */
export const extractPackagingWeight = (text: string): number | undefined => {
    if (!text) return undefined;
    const lower = text.toLowerCase().replace(/,/g, '.'); // Normalize decimals

    // Pattern 1: Look for explicit weight/size keywords
    const weightKeywords = ['vikt', 'innehåll', 'nettovikt', 'mängd', 'storlek', 'portionsstorlek', 'netto'];
    for (const kw of weightKeywords) {
        // Must NOT match "per 100g" or similar table headers
        // Negative lookahead to ensure we don't match "vikt per 100g"
        const pattern = new RegExp(`${kw}\\D*?(?!per\\s*100)(\\d+(?:\\.\\d+)?)\\s*(g|kg|ml|l)\\b`, 'i');
        const match = lower.match(pattern);
        if (match) {
            let val = parseFloat(match[1]);
            const unit = match[2];
            if (unit === 'kg' || unit === 'l') val *= 1000;
            return val;
        }
    }

    // Pattern 2: Look for any standalone weight like "275 g" that appears often or early
    // We specifically exclude "100g" because it usually refers to the nutrition table
    const standalonePattern = /(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b/gi;
    const matches = Array.from(lower.matchAll(standalonePattern));
    if (matches.length > 0) {
        for (const m of matches) {
            let val = parseFloat(m[1]);
            const unit = m[2];
            if (unit === 'kg' || unit === 'l') val *= 1000;

            // Heuristic: package sizes are usually between 5g and 5kg
            // AND specifically avoid exactly 100g unless it is explicitly marked as "netto" (handled above)
            if (val > 5 && val < 5000 && val !== 100) return val;
        }
    }

    return undefined;
};

/**
 * Extracts brand name using heuristics and Fuzzy matching against known brands
 */
export const extractBrand = (text: string, knownBrands: string[] = []): string | undefined => {
    if (!text) return undefined;
    const lower = text.toLowerCase();

    // 1. Look for "Varumärke: Schysst käk"
    const brandKeywords = ['varumärke', 'brand', 'märke', 'tillverkare', 'producerad av', 'från'];
    for (const kw of brandKeywords) {
        // Capture text until next newline or punctuation
        const pattern = new RegExp(`${kw}\\s*[:=-]?\\s*([^\\n\\.\\,\\|©®]{2,30})`, 'i');
        const match = lower.match(pattern);
        if (match) {
            // Clean up common noise words
            let candidate = match[1].trim();
            if (candidate && !['sweden', 'sverige', 'ab'].includes(candidate.toLowerCase())) {
                 return candidate.replace(/\b(ab|as|oy)\b/gi, '').trim(); // Remove corporate suffix
            }
        }
    }

    // 2. SMART FEATURE: Fuzzy match against known brands
    const sortedBrands = [...knownBrands].sort((a, b) => b.length - a.length);

    for (const brand of sortedBrands) {
        if (brand.length < 3) continue;
        const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Look for whole word match
        const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
        if (pattern.test(text)) return brand;
    }

    return undefined;
};
