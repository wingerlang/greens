// Math & Analysis Utilities
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
