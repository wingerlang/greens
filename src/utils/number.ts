// Number Utilities
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
