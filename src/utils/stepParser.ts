/**
 * Step Parser - Parses cooking instructions to extract timers and ingredient references
 */

import { type FoodItem } from "../models/types.ts";

// ============================================
// Types
// ============================================

export interface ParsedStep {
  index: number;
  text: string;
  timerMinutes: number | null;
  timerLabel: string | null;
  isManualTimer?: boolean;
  ingredients: MatchedIngredient[];
  isCompleted: boolean;
}

export interface MatchedIngredient {
  name: string;
  amount: string;
  unit: string;
  originalText: string;
}

// ============================================
// Timer Detection Patterns
// ============================================

const TIMER_PATTERNS = [
  // "20 minuter" standalone
  { regex: /\b(\d+)\s*minut(?:er)?\b/i },
  // "10 min" standalone
  { regex: /\b(\d+)\s*min\b/i },
  // Indirect timer instructions
  { regex: /enligt\s*förpackning(?:en)?/i, isManual: true },
  { regex: /enligt\s*anvisning(?:ar)?(?:na)?/i, isManual: true },
  { regex: /se\s*förpackning(?:en)?/i, isManual: true },
  { regex: /se\s*anvisning(?:ar)?(?:na)?/i, isManual: true },
];

const COOKING_VERBS = [
  "stek",
  "koka",
  "grädda",
  "ugnsrosta",
  "rosta",
  "fräs",
  "bryn",
  "låt",
  "vila",
  "sjud",
  "puttra",
  "micra",
  "mikra",
  "vispa",
  "knåda",
  "baka",
  "ångkoka",
  "blanchera",
  "fritera",
  "woka",
  "eftergrädda",
  "jäs",
  "jäsa",
  "mixa",
  "koka",
];

/**
 * Extract verb context for timer label
 * Strategy:
 * 1. Find the sentence boundary ending before the match.
 * 2. Scan the current sentence (up to the match) for known cooking verbs.
 * 3. Use the first found verb.
 * 4. If "Låt", take the next word if it's also a verb/activity (e.g. "Låt puttra").
 */
function extractTimerLabel(text: string, matchIndex: number): string | null {
  // 1. Get text segment from last sentence boundary up to match
  const prefix = text.substring(0, matchIndex);
  const sentenceStart = Math.max(
    prefix.lastIndexOf(". "),
    prefix.lastIndexOf("! "),
    prefix.lastIndexOf("? "),
    0,
  );

  // If sentenceStart is > 0, we add 2 to skip the ". "
  const actualStart = sentenceStart > 0 ? sentenceStart + 2 : 0;
  const currentSentence = prefix.substring(actualStart).trim();

  if (!currentSentence) return null;

  // 2. Tokenize
  const words = currentSentence.split(/\s+/).map((w) =>
    w.replace(/[^a-zA-ZåäöÅÄÖ]/g, "")
  );

  // 3. Find first verb
  let foundVerb = "";
  let foundVerbIndex = -1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    // Check exact match or if word starts with verb (e.g. "stek" matches "stekta")
    // But be careful: "stek" matches "stekspade" (false positive).
    // Best to match against list of exact stems?
    // Swedish morphology is tricky. Let's do exact match or simple stems.
    const match = COOKING_VERBS.find((v) => word === v || word.startsWith(v));
    if (match) {
      foundVerb = words[i]; // Keep original case/form (e.g. "Stek")
      foundVerbIndex = i;
      break;
    }
  }

  if (foundVerb) {
    // Special cleanup for "Låt" (Låt puttra -> Puttra)
    if (foundVerb.toLowerCase().startsWith("låt")) {
      // Look ahead for another cooking verb in the same sentence
      for (let j = foundVerbIndex + 1; j < words.length; j++) {
        const subWord = words[j].toLowerCase();
        const subMatch = COOKING_VERBS.find((v) =>
          subWord === v || subWord.startsWith(v)
        );
        if (subMatch) {
          return capitalize(words[j]); // Return the secondary verb (e.g. "Vila")
        }
      }

      // If no secondary verb found, take next word if exists
      if (words[foundVerbIndex + 1]) {
        return capitalize(words[foundVerbIndex + 1]);
      }
    }

    // Try to include object? "Stek tofun"
    // If next word is not a preposition/conjunction
    if (words[foundVerbIndex + 1]) {
      const nextWord = words[foundVerbIndex + 1];
      const lowerNext = nextWord.toLowerCase();
      const stoppers = [
        "i",
        "på",
        "med",
        "och",
        "vid",
        "ca",
        "tills",
        "under",
        "mitt",
        "slätt",
        "fint",
      ];

      if (!stoppers.includes(lowerNext)) {
        return capitalize(foundVerb) + " " + nextWord;
      }
    }

    return capitalize(foundVerb);
  }

  return null;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Extract timer duration from step text
 */
export function extractTimer(
  text: string,
): { minutes: number; label: string; isManual?: boolean } | null {
  for (const pattern of TIMER_PATTERNS) {
    const match = text.match(pattern.regex);

    if (match && (pattern as any).isManual) {
      // For manual timers ("enligt förpackning"), try to find verb too.
      const contextLabel = extractTimerLabel(text, match.index || 0);
      const label = contextLabel || "Se förpackning";

      return {
        minutes: 10, // Default to 10 minutes for manual timers
        label: label,
        isManual: true,
      };
    }

    if (match && match[1]) {
      const minutes = parseInt(match[1], 10);
      if (minutes > 0 && minutes <= 180) { // Sanity check: max 3 hours
        // Infer label from context
        const contextLabel = extractTimerLabel(text, match.index || 0) ||
          `${minutes} min`;

        return {
          minutes,
          label: contextLabel,
          isManual: false,
        };
      }
    }
  }
  return null;
}

// ============================================
// Ingredient Matching
// ============================================

/**
 * Parse ingredient line into components
 * Examples:
 * - "3 dl belugalinser" -> { amount: "3", unit: "dl", name: "belugalinser" }
 * - "2 msk tomatpuré" -> { amount: "2", unit: "msk", name: "tomatpuré" }
 */
export function parseIngredientLine(line: string): MatchedIngredient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Pattern: [amount] [unit] [name]
  // Updated to handle "port", "portion", "st port"
  // Also captures "4 st port" -> amount: 4, unit: port, name: ...
  // Regex breakdown:
  // 1. Amount: numbers with chars ,./
  // 2. Unit: standard units OR port/portion
  // 3. Name: rest

  // First try to catch specific "st port" case which is tricky
  const stPortMatch = trimmed.match(
    /^([\d,./]+)?\s*st\s*(?:port|portion(?:er)?)\s*(.+)$/i,
  );
  if (stPortMatch) {
    return {
      amount: stPortMatch[1] || "1",
      unit: "port",
      name: stPortMatch[2].trim(),
      originalText: trimmed,
    };
  }

  const match = trimmed.match(
    /^([\d,./]+)?\s*(dl|l|msk|tsk|g|kg|st|ml|cl|port|portion(?:er)?)?\s*(.+)$/i,
  );

  if (match) {
    return {
      amount: match[1] || "1",
      unit: match[2] || "st",
      name: match[3].trim(),
      originalText: trimmed,
    };
  }

  return {
    amount: "",
    unit: "",
    name: trimmed,
    originalText: trimmed,
  };
}

/**
 * Find which ingredients are mentioned in a step
 */
export function matchIngredientsToStep(
  stepText: string,
  ingredients: MatchedIngredient[],
): MatchedIngredient[] {
  const stepLower = stepText.toLowerCase();
  const matched: MatchedIngredient[] = [];

  for (const ingredient of ingredients) {
    const nameLower = ingredient.name.toLowerCase();

    // Check for ingredient name or parts of it
    const nameParts = nameLower.split(/\s+/);
    const isMatched = nameParts.some((part) => {
      // Skip very short words that might cause false positives
      if (part.length < 3) return false;
      return stepLower.includes(part);
    }) || stepLower.includes(nameLower);

    if (isMatched) {
      matched.push(ingredient);
    }
  }

  return matched;
}

// ============================================
// Step Parser
// ============================================

/**
 * Parse all steps from instructions text
 */
export function parseSteps(
  instructionsText: string,
  ingredientsText: string,
): ParsedStep[] {
  // Parse ingredients first
  const ingredientLines = ingredientsText
    .split("\n")
    .map((line) => parseIngredientLine(line))
    .filter((i): i is MatchedIngredient => i !== null);

  // Split instructions into steps
  const lines = instructionsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((text, index) => {
    const timer = extractTimer(text);
    const ingredients = matchIngredientsToStep(text, ingredientLines);

    return {
      index,
      text,
      timerMinutes: timer?.minutes || null,
      timerLabel: timer?.label || null,
      isManualTimer: timer?.isManual || false,
      ingredients,
      isCompleted: false,
    };
  });
}

/**
 * Scale ingredient amount by portion multiplier
 */
export function scaleAmount(amount: string, multiplier: number): string {
  // Handle fractions like "1/2"
  if (amount.includes("/")) {
    const [num, den] = amount.split("/").map(Number);
    const result = (num / den) * multiplier;
    return formatNumber(result);
  }

  // Handle commas (Swedish decimal)
  const normalized = amount.replace(",", ".");
  const num = parseFloat(normalized);

  if (isNaN(num)) return amount;

  return formatNumber(num * multiplier);
}

/**
 * Format number nicely (avoid "2.0000000001")
 */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();

  // Round to 1 decimal if needed
  const rounded = Math.round(n * 10) / 10;

  // Use Swedish comma for decimals
  return rounded.toString().replace(".", ",");
}
