/**
 * Shared formatting utilities for dates, text normalization, and URL slugs.
 * Consolidates duplicated logic from StrengthPage, DatabasePage, CaloriesPage, etc.
 */

// ============================================
// Date Formatting (Swedish Locale)
// ============================================

/**
 * Format date as "16 juli 2025 (3 dagar sedan)"
 */
export function formatDateFull(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const datePart = date.toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    let agoPart = '';
    if (diffDays === 0) agoPart = 'idag';
    else if (diffDays === 1) agoPart = 'igår';
    else if (diffDays < 7) agoPart = `${diffDays} dagar sedan`;
    else if (diffDays < 30) agoPart = `${Math.floor(diffDays / 7)} veckor sedan`;
    else if (diffDays < 365) agoPart = `${Math.floor(diffDays / 30)} mån sedan`;
    else {
        const years = Math.floor(diffDays / 365);
        const months = Math.floor((diffDays % 365) / 30);
        agoPart = months > 0 ? `${years} år ${months} mån sedan` : `${years} år sedan`;
    }

    return `${datePart} (${agoPart})`;
}

/**
 * Format as compact "3d sedan", "2v sedan", "2 år 4 mån sedan"
 */
export function formatDaysAgoCompact(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'idag';
    if (diffDays === 1) return 'igår';
    if (diffDays < 7) return `${diffDays}d sedan`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}v sedan`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mån sedan`;

    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    return months > 0 ? `${years} år ${months} mån sedan` : `${years} år sedan`;
}

/**
 * Format as relative date: "Idag", "Igår", "5 dagar sedan", or "15 dec"
 */
export function formatDateRelative(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' });
}

/**
 * Short relative format for compact UIs: "Idag", "Igår", "3d sedan", "2v sedan"
 */
export function formatDateShort(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays}d sedan`;
    return `${Math.floor(diffDays / 7)}v sedan`;
}

// ============================================
// Text Normalization (Search)
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

// ============================================
// URL Slugification
// ============================================

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

// ============================================
// Number Formatting
// ============================================

/**
 * Format large numbers with Swedish locale: 1234567 -> "1 234 567"
 */
export function formatNumber(num: number, decimals = 0): string {
    return num.toLocaleString('sv-SE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Format volume in tons: 45000 -> "45.0t"
 */
export function formatVolumeTons(volumeKg: number): string {
    return `${(volumeKg / 1000).toFixed(1)}t`;
}

/**
 * Format duration in minutes to "1h 30min" or "45min"
 */
export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// ============================================
// Data Analysis
// ============================================

/**
 * Calculate rolling average for smoothing noisy data (e.g., weight entries).
 * Returns an array of averages, with null for positions with insufficient data.
 */
export function calculateRollingAverage(
    data: number[],
    windowSize: number = 7
): (number | null)[] {
    if (data.length === 0) return [];
    if (windowSize < 1) windowSize = 1;

    return data.map((_, index) => {
        // Calculate average of available values in window
        const startIdx = Math.max(0, index - windowSize + 1);
        const windowValues = data.slice(startIdx, index + 1);

        if (windowValues.length === 0) return null;

        const sum = windowValues.reduce((a, b) => a + b, 0);
        return Math.round((sum / windowValues.length) * 10) / 10; // 1 decimal
    });
}

/**
 * Calculate trend direction from data points.
 * Returns: 'up' | 'down' | 'stable'
 */
export function calculateTrend(data: number[], minChange: number = 0.5): 'up' | 'down' | 'stable' {
    if (data.length < 2) return 'stable';

    const first = data[0];
    const last = data[data.length - 1];
    const change = last - first;

    if (change > minChange) return 'up';
    if (change < -minChange) return 'down';
    return 'stable';
}
