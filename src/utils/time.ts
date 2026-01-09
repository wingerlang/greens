// Time Utilities
// ============================================

/**
 * Parses a time string into total seconds.
 * Supports:
 * - mm:ss (e.g. 45:30)
 * - hh:mm:ss (e.g. 1:20:00)
 * - 45min, 1h 10m, 2h, etc.
 */
export function parseTimeToSeconds(input: string): number {
    if (!input) return 0;

    const cleanInput = input.toLowerCase().trim();

    // Pattern for colon format (HH:MM:SS or MM:SS)
    const colonPattern = /^(\d+:)?(\d+):(\d+)$/;
    const colonMatch = cleanInput.match(colonPattern);

    if (colonMatch) {
        const parts = cleanInput.split(':').map(Number);
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
        }
    }

    // Pattern for units (e.g. 1h 30m, 45min)
    let totalSeconds = 0;
    let hasMatch = false;

    const hMatch = cleanInput.match(/(\d+)\s*h/);
    if (hMatch) {
        totalSeconds += parseInt(hMatch[1]) * 3600;
        hasMatch = true;
    }

    const mMatch = cleanInput.match(/(\d+)\s*(m|min)/);
    if (mMatch) {
        totalSeconds += parseInt(mMatch[1]) * 60;
        hasMatch = true;
    }

    const sMatch = cleanInput.match(/(\d+)\s*(s|sek|sec)/);
    if (sMatch) {
        totalSeconds += parseInt(sMatch[1]);
        hasMatch = true;
    }

    if (hasMatch) return totalSeconds;

    // Fallback: Check if it's just a number (assume seconds if it's high, or minutes if it's low?)
    // This heuristic is dangerous but preserved for backward compatibility with existing inputs
    // "45" -> 45 minutes (2700s)
    // "300" -> 300 seconds (5min)
    const rawNumber = parseFloat(cleanInput);
    if (!isNaN(rawNumber) && !cleanInput.includes(':')) {
        // If < 300, assume minutes (common for exercise duration input)
        // If >= 300, assume seconds (e.g. imported data or long durations)
        return rawNumber < 300 ? rawNumber * 60 : rawNumber;
    }

    return 0;
}

/**
 * Formats seconds back to human readable string (e.g. 1:15:30 or 45:30)
 */
export function formatSecondsToTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to human-readable string (e.g., "2h 15m")
 * Used for detailed duration display.
 */
export function formatDurationSeconds(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

/**
 * Format duration in minutes to "1h 30min" or "45min"
 * Rounds to nearest integer if decimals present.
 */
export function formatDurationMinutes(minutes: number): string {
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes < 60) return `${roundedMinutes}min`;
    const hours = Math.floor(roundedMinutes / 60);
    const mins = roundedMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Format activity duration as a simple rounded minute string: "45 min"
 * Use this for activity cards and tooltips to avoid showing decimals like "30.633333"
 */
export function formatActivityDuration(minutes: number | undefined | null): string {
    if (minutes === undefined || minutes === null || isNaN(minutes)) return '0 min';
    return `${Math.round(minutes)} min`;
}

/**
 * Format activity duration as a compact string without space: "45min"
 */
export function formatActivityDurationCompact(minutes: number | undefined | null): string {
    if (minutes === undefined || minutes === null || isNaN(minutes)) return '0min';
    return `${Math.round(minutes)}min`;
}

/**
 * Format pace in seconds per km to mm:ss/km format
 */
export function formatPace(secPerKm: number): string {
    if (!secPerKm || !isFinite(secPerKm)) return '—';
    const m = Math.floor(secPerKm / 60);
    const s = Math.floor(secPerKm % 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
}

/**
 * Format speed in km/h
 */
export function formatSpeed(secondsPerKm: number): string {
    if (!secondsPerKm || !isFinite(secondsPerKm)) return '—';
    // speed (km/h) = 3600 / secondsPerKm
    const speed = 3600 / secondsPerKm;
    return `${speed.toFixed(1)} km/h`;
}
