import { ExerciseDefinition } from '../models/exercise.ts';

/**
 * Normalizes a string for robust matching.
 * Removes special characters, extra spaces, and converts to lowercase.
 */
export const normalizeName = (name: string): string => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-zåäö0-9]/g, '')
        .replace(/\s+/g, '');
};

/**
 * Finds the best matching exercise from the database for a given raw name.
 */
export const findExerciseMatch = (
    rawName: string,
    exercises: ExerciseDefinition[]
): { exercise: ExerciseDefinition; reason: string } | null => {
    if (!rawName || !exercises.length) return null;

    const normalizedRaw = normalizeName(rawName);
    if (!normalizedRaw) return null;

    // 1. Direct ID Match (if rawName is already an ID)
    const idMatch = exercises.find(ex => ex.id.toLowerCase() === rawName.toLowerCase() || normalizeName(ex.id) === normalizedRaw);
    if (idMatch) return { exercise: idMatch, reason: 'ID Match' };

    // 2. Exact Name Match (Swedish or English)
    const exactMatch = exercises.find(ex =>
        ex.name_sv.toLowerCase() === rawName.toLowerCase() ||
        ex.name_en.toLowerCase() === rawName.toLowerCase()
    );
    if (exactMatch) return { exercise: exactMatch, reason: 'Exact Name Match' };

    // 3. Exact Alias Match
    const aliasMatch = exercises.find(ex =>
        ex.aliases?.some(alias => alias.toLowerCase() === rawName.toLowerCase())
    );
    if (aliasMatch) return { exercise: aliasMatch, reason: 'Alias Match' };

    // 4. Normalized Name Match
    const normalizedNameMatch = exercises.find(ex =>
        normalizeName(ex.name_sv) === normalizedRaw ||
        normalizeName(ex.name_en) === normalizedRaw
    );
    if (normalizedNameMatch) return { exercise: normalizedNameMatch, reason: 'Normalized Name Match' };

    // 5. Normalized Alias Match
    const normalizedAliasMatch = exercises.find(ex =>
        ex.aliases?.some(alias => normalizeName(alias) === normalizedRaw)
    );
    if (normalizedAliasMatch) return { exercise: normalizedAliasMatch, reason: 'Normalized Alias Match' };

    // 6. Fuzzy Match: Exercise name or ID is contained in raw name as a whole word
    const fuzzyMatch = exercises.find(ex => {
        const normId = normalizeName(ex.id);
        const normSv = normalizeName(ex.name_sv);
        const normEn = normalizeName(ex.name_en);

        // Heuristic: only match if the term is at least 3 chars AND (starts or ends the string)
        const terms = [normId, normSv, normEn, ...(ex.aliases?.map(normalizeName) || [])].filter(t => t.length >= 3);

        return terms.some(term => {
            if (normalizedRaw === term) return true;
            if (normalizedRaw.includes(term)) {
                // To avoid "skipping" matching "ski", we require the term to be either:
                // a) The start of the word (e.g., "Sled push 50kg" starts with "sledpush")
                // b) The end of the word (e.g., "Heavy sled" ends with "sled")
                // c) Long enough to be very specific (>= 6 chars)
                const isStartOrEnd = normalizedRaw.startsWith(term) || normalizedRaw.endsWith(term);
                const isVerySpecific = term.length >= 7;
                return isStartOrEnd || isVerySpecific;
            }
            return false;
        });
    });
    if (fuzzyMatch) return { exercise: fuzzyMatch, reason: 'Fuzzy Match' };

    return null;
};
