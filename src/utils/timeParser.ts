/**
 * Parses a time string into total seconds.
 * Supports: 
 * - mm:ss (e.g. 45:30)
 * - hh:mm:ss (e.g. 1:20:00)
 * - 45min, 1h 10m, 2h, etc.
 */
export function parseTimeToSeconds(input: string): number | null {
    if (!input) return null;

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
    // Actually, better to just return null if we can't be sure, to avoid wrong data.
    const rawNumber = parseFloat(cleanInput);
    if (!isNaN(rawNumber) && !cleanInput.includes(':')) {
        // If it's a naked number, let's treat it as seconds if it's > 300, else minutes?
        // Actually, users usually mean minutes when they type "45".
        return rawNumber < 300 ? rawNumber * 60 : rawNumber;
    }

    return null;
}

/**
 * Formats seconds back to human readable string (e.g. 1:15:30 or 45:30)
 */
export function formatSecondsToTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}
