// Text Utilities
// ============================================

/**
 * Normalize text for search: NFC normalize, lowercase, trim, strip zero-width chars.
 * Handles Swedish characters (ö, ä, å) correctly.
 */
export function normalizeText(text: string): string {
    return text
        .normalize('NFC')
        .toLowerCase()
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Convert text to URL-safe slug: "Bench Press" -> "Bench-Press"
 */
export function slugify(text: string): string {
    return text.trim().replace(/\s+/g, '-');
}

/**
 * Convert slug back to readable text: "Bench-Press" -> "Bench Press"
 */
export function deslugify(slug: string): string {
    return slug.replace(/-/g, ' ');
}
