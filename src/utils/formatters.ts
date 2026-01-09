/**
 * Shared formatting utilities for dates, text normalization, and URL slugs.
 * Consolidates duplicated logic from StrengthPage, DatabasePage, CaloriesPage, etc.
 * DEPRECATED: Use src/utils/date.ts, src/utils/time.ts, src/utils/text.ts, src/utils/number.ts
 */

import { formatDateFull, formatDaysAgoCompact, formatDateRelative, formatDateShort } from './date.ts';
import { normalizeText, slugify, deslugify } from './text.ts';
import { formatNumber, formatVolumeTons } from './number.ts';
import { formatDurationMinutes, formatActivityDuration, formatActivityDurationCompact } from './time.ts';
import { calculateRollingAverage, calculateTrend } from './math.ts';

// Re-export everything
export {
    formatDateFull,
    formatDaysAgoCompact,
    formatDateRelative,
    formatDateShort,
    normalizeText,
    slugify,
    deslugify,
    formatNumber,
    formatVolumeTons,
    formatActivityDuration,
    formatActivityDurationCompact,
    calculateRollingAverage,
    calculateTrend
};

/**
 * Format duration in minutes to "1h 30min" or "45min"
 * @deprecated Use formatDurationMinutes from time.ts
 */
export function formatDuration(minutes: number): string {
    return formatDurationMinutes(minutes);
}
