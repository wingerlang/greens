
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
// Levenshtein distance for typo tolerance
function levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    let i;
    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    let j;
    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1)); // deletion
            }
        }
    }

    return matrix[b.length][a.length];
}

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

    // Split query into tokens for word-level checks
    const queryTokens = rawQuery.split(/\s+/).filter(t => t.length > 0);

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

        // 1.5 Token Logic (Order agnostic)
        // If exact/prefix/suffix failed, check if ALL tokens imply a match (e.g. "tofu rökt" -> "Rökt Tofu")
        if (score === 0 && queryTokens.length > 1) {
            const allTokensMatch = queryTokens.every(t => lowerText.includes(t));
            if (allTokensMatch) {
                score = 60; // Better than generic "contains" (40), worse than ordered "contains" (75)
                matchType = 'contains';
            } else if (useNormalization) {
                const normTokens = normQuery.split(/\s+/).filter(t => t.length > 0);
                const allNormTokensMatch = normTokens.every(t => normText.includes(t));
                if (allNormTokensMatch) {
                    score = 50;
                    matchType = 'contains';
                }
            }
        }

        // 1.8 Typos / Levenshtein on Words (New: Fixes "jasminr" -> "jasmin")
        // Check if the query is very close to ANY individual word in the target
        if (score === 0 && rawQuery.length > 3) {
            const targetWords = lowerText.split(/[\s,().-]+/).filter(w => w.length > 0);
            for (const word of targetWords) {
                // Skip short words to avoid noise
                if (word.length < 3) continue;

                // If query is "jasminr" (7) and word is "jasmin" (6) -> dist 1
                // Allow 1 edit for length 4-7, 2 edits for length 8+
                const maxEdits = rawQuery.length > 7 ? 2 : 1;

                // Optimization: length diff check first
                if (Math.abs(word.length - rawQuery.length) > maxEdits) continue;

                const dist = levenshtein(rawQuery, word);
                if (dist <= maxEdits) {
                    score = 55 - (dist * 10); // Dist 1 = 45, Dist 2 = 35. 
                    // This is better than random subsequence (usually <20), but worse than exact contains.
                    matchType = 'fuzzy';
                    break; // Found a good word match, stop checking other words
                }
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
