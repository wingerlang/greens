// Date and time formatting utilities for Swedish locale

/**
 * Format a date string to Swedish short format (e.g., "15 dec 2024")
 */
export function formatSwedishDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Get relative time string in Swedish (e.g., "Idag", "2 dagar sedan")
 */
export function getRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Idag';
    if (diffDays === 1) return 'Igår';
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} vecka/or sedan`;
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} månad${months !== 1 ? 'er' : ''} sedan`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} år sedan`;
}

/**
 * Format duration in seconds to human-readable string (e.g., "2h 15m" or "19m 47s")
 */
export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (s > 0) return `${m}m ${s}s`;
    return `${m}m`;
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
 * Parse time string (HH:MM:SS or MM:SS) to seconds
 */
export function parseTimeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

/**
 * Format seconds to HH:MM:SS or MM:SS string
 */
export function formatSecondsToTime(totalSeconds: number): string {
    const rounded = Math.round(totalSeconds);
    const h = Math.floor(rounded / 3600);
    const m = Math.floor((rounded % 3600) / 60);
    const s = rounded % 60;

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
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
/**
 * Check if a Date object is valid
 */
export function isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Get the same date one year before. Returns ISO string (YYYY-MM-DD) or original if invalid.
 */
export function getYearBefore(dateStr: string): string {
    const d = new Date(dateStr);
    if (!isValidDate(d)) return dateStr;
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
}
