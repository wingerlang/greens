import { z } from "zod";
import { ParseTextSchema } from "../schemas.ts";

/**
 * Extracts packaging weight (e.g. "275g") from text.
 *
 * Goal: Identify the total net weight of a product from unstructured text.
 * Constraints: May confuse "100g" (serving size) with package weight if context is ambiguous.
 * Dependencies: Zod for validation.
 *
 * @param text - The text to scan.
 * @returns Weight in grams, or undefined if not found.
 */
export const extractPackagingWeight = (text: string): number | undefined => {
    // 1. Validate Input
    const validInput = ParseTextSchema.parse(text);
    if (!validInput) return undefined;

    const lower = validInput.toLowerCase().replace(/,/g, '.'); // Normalize decimals

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
