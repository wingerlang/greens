/**
 * Format activity duration as a simple rounded minute string: "45 min" or "1h 30m"
 * Rounds to nearest integer if decimals present.
 */
export function formatActivityDuration(minutes: number | undefined | null): string {
    if (minutes === undefined || minutes === null || isNaN(minutes)) return '0 min';
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes < 60) return `${roundedMinutes}min`;
    const hours = Math.floor(roundedMinutes / 60);
    const mins = roundedMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}
