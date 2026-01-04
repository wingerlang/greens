
/**
 * Utility for smart searching and ranking of items.
 * Prioritizes exact matches, prefixes, suffixes, and usage statistics.
 */

// Simple subsequence check (Sequence of chars must appear in order)
// Returns a score based on compactness (chars closer together = better)
function subsequenceScore(query: string, target: string): number {
    let qIdx = 0;
    let tIdx = 0;
    let firstMatchIdx = -1;

    while (qIdx < query.length && tIdx < target.length) {
        if (query[qIdx] === target[tIdx]) {
            if (firstMatchIdx === -1) firstMatchIdx = tIdx;
            qIdx++;
        }
        tIdx++;
    }

    if (qIdx === query.length) {
        // Full match found
        // Score: 100 max. Penalty for gaps.
        // Penalty for starting late in the string?
        const matchLength = tIdx - firstMatchIdx; // Effective length of the match in target
        const compactness = query.length / matchLength; // 1.0 = perfect contiguous

        // Base score for fuzzy match is lower than exact substring
        return 15 * compactness;
    }
    return 0;
}

// Remove accents (diacritics)
function normalizeStr(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

interface RankedItem<T> {
    item: T;
    score: number;
    matchType: 'exact' | 'prefix' | 'suffix' | 'contains' | 'fuzzy' | 'none';
}

export function performSmartSearch<T>(
    query: string,
    items: T[],
    options: {
        textFn: (item: T) => string;
        categoryFn?: (item: T) => string | undefined; // Category for fallback search
        usageCountFn?: (item: T) => number; // Return usage count
        limit?: number;
    }
): T[] {
    const rawQuery = query.toLowerCase().trim();
    if (!rawQuery) return [];

    const normQuery = normalizeStr(rawQuery);
    const useNormalization = rawQuery !== normQuery;

    const ranked: RankedItem<T>[] = items.map(item => {
        const text = options.textFn(item);
        const lowerText = text.toLowerCase();
        const normText = useNormalization ? normalizeStr(lowerText) : lowerText;

        let score = 0;
        let matchType: RankedItem<T>['matchType'] = 'none';

        // 1. Text Matching Logic
        // Priority: Exact > StartsWith > WordBoundary > EndsWith > Contains > Fuzzy

        // Check Raw (for exact accent matches)
        if (lowerText === rawQuery) {
            score = 100;
            matchType = 'exact';
        } else if (lowerText.startsWith(rawQuery)) {
            score = 80;
            matchType = 'prefix';
        } else if (lowerText.includes(' ' + rawQuery)) {
             // Word boundary match (e.g. "Svensk Öl")
            score = 75;
            matchType = 'contains'; // High value contains
        } else if (lowerText.endsWith(rawQuery)) {
            score = 70;
            matchType = 'suffix';
        } else if (lowerText.includes(rawQuery)) {
            score = 40;
            matchType = 'contains';
        } else {
            // Fallback to Normalized check (if query had accents/special chars that differ)
            if (useNormalization) {
                if (normText === normQuery) score = 90; // Normalized exact (penalty 10)
                else if (normText.startsWith(normQuery)) score = 70; // Normalized prefix
                else if (normText.includes(' ' + normQuery)) score = 65;
                else if (normText.endsWith(normQuery)) score = 60;
                else if (normText.includes(normQuery)) score = 35;
            }
        }

        // 2. Fuzzy / Subsequence fallback
        if (score === 0) {
            const subScore = subsequenceScore(rawQuery, lowerText);
            if (subScore > 0) {
                score = subScore;
                matchType = 'fuzzy';
            } else if (useNormalization) {
                const normSubScore = subsequenceScore(normQuery, normText);
                if (normSubScore > 0) {
                    score = normSubScore * 0.9; // Penalty
                    matchType = 'fuzzy';
                }
            }
        }

        // 3. Category Fallback
        // If no text match, check category (lower priority)
        if (score === 0 && options.categoryFn) {
            const cat = options.categoryFn(item)?.toLowerCase() || '';
            if (cat.includes(rawQuery)) {
                score = 10; // Very low base score for category match
                matchType = 'contains';
            }
        }

        // 4. Usage Boosting
        // We want highly used items to "jump" up a tier, but not override exact matches unless heavily used
        // Example: "Öl" query.
        // "Starköl" (EndsWith, 70 pts) + High Usage (+20) = 90.
        // "Ölkorv" (StartsWith, 80 pts) + Low Usage (+0) = 80.
        // Result: Starköl wins.
        if (score > 0 && options.usageCountFn) {
            const count = options.usageCountFn(item);
            if (count > 0) {
                // Logarithmic boost.
                // 1 usage = 0 pts
                // 10 usages = 10 pts
                // 100 usages = 20 pts
                // 1000 usages = 30 pts
                const boost = Math.log10(count) * 10;
                score += boost;
            }
        }

        return { item, score, matchType };
    });

    // Filter and Sort
    const result = ranked
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(r => r.item);

    return options.limit ? result.slice(0, options.limit) : result;
}
