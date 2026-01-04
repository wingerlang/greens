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

    // Higher-level extraction (Name, Ingredients)
    // We use lowercased original text to preserve commas for ingredients
    const textLower = inputText.toLowerCase();

    // 6. Name extraction (e.g. "Pizzakit")
    // If it's the first line and not numeric, it's likely the name
    const lines = inputText.split('\n').filter(l => l.trim().length > 0);
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
    // This is riskier so we look for common package sizes
    // We specifically exclude "100g" because it usually refers to the nutrition table
    const standalonePattern = /(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\\b/gi;
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
    // If we have a list of brands from our database, check if any of them appear in the text
    // Sort known brands by length desc to match "Oatly" before "Oat"
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
