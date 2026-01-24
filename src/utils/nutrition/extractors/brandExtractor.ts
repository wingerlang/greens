import { z } from "zod";
import { ExtractBrandSchema } from "../schemas.ts";

/**
 * Extracts brand name using heuristics and Fuzzy matching against known brands.
 *
 * Goal: Identify the manufacturer or brand of a product.
 * Constraints: Relies on "knownBrands" list for high accuracy; heuristic fallbacks may be noisy.
 * Dependencies: Zod for validation.
 *
 * @param text - The text to scan.
 * @param knownBrands - Optional list of brands to check against.
 * @returns Found brand name or undefined.
 */
export const extractBrand = (
  text: string,
  knownBrands: string[] = [],
): string | undefined => {
  // 1. Validate Input
  const input = ExtractBrandSchema.parse({ text, knownBrands });

  if (!input.text) return undefined;
  const lower = input.text.toLowerCase();

  // 1. Look for "Varumärke: Schysst käk"
  const brandKeywords = [
    "varumärke",
    "brand",
    "märke",
    "tillverkare",
    "producerad av",
    "från",
  ];
  for (const kw of brandKeywords) {
    // Capture text until next newline or punctuation
    const pattern = new RegExp(
      `${kw}\\s*[:=-]?\\s*([^\\n\\.\\,\\|©®]{2,30})`,
      "i",
    );
    const match = lower.match(pattern);
    if (match) {
      // Clean up common noise words
      let candidate = match[1].trim();
      if (
        candidate &&
        !["sweden", "sverige", "ab"].includes(candidate.toLowerCase())
      ) {
        return candidate.replace(/\b(ab|as|oy)\b/gi, "").trim(); // Remove corporate suffix
      }
    }
  }

  // 2. SMART FEATURE: Fuzzy match against known brands
  // If we have a list of brands from our database, check if any of them appear in the text
  // Sort known brands by length desc to match "Oatly" before "Oat"
  const sortedBrands = [...input.knownBrands].sort((a, b) =>
    b.length - a.length
  );

  for (const brand of sortedBrands) {
    if (brand.length < 3) continue;
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Look for whole word match
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    if (pattern.test(input.text)) return brand;
  }

  return undefined;
};
