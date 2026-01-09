// Date and time formatting utilities for Swedish locale
// DEPRECATED: Use src/utils/date.ts and src/utils/time.ts instead

import { formatSwedishDate, getRelativeTime } from './date.ts';
import { formatDurationSeconds, formatPace, parseTimeToSeconds, formatSecondsToTime, formatSpeed } from './time.ts';

export { formatSwedishDate, getRelativeTime };

/**
 * Format duration in seconds to human-readable string (e.g., "2h 15m")
 * @deprecated Use formatDurationSeconds from time.ts
 */
export function formatDuration(seconds: number): string {
    return formatDurationSeconds(seconds);
}

export { formatPace, parseTimeToSeconds, formatSecondsToTime, formatSpeed };
