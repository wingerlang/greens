/**
 * Math utilities for health data
 */

/**
 * Calculates a simple moving average for a series of numbers
 * @param values Array of numbers
 * @param window Size of the window
 * @returns Array of average values (same length as input, null for padded starts)
 */
export function calculateMovingAverage(values: (number | null)[], window: number): (number | null)[] {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - window + 1);
        const subSet = values.slice(start, i + 1).filter(v => v !== null) as number[];
        
        if (subSet.length === 0) {
            result.push(null);
        } else {
            const sum = subSet.reduce((a, b) => a + b, 0);
            result.push(sum / subSet.length);
        }
    }
    
    return result;
}

/**
 * Calculates a time-based moving average
 * @param entries Array of objects with date and value
 * @param days Number of days in the window
 * @returns Array of averaged values
 */
export function calculateTimeMovingAverage<T extends { date: string }>(
    entries: T[],
    getValue: (entry: T) => number | null,
    days: number
): (number | null)[] {
    const result: (number | null)[] = [];
    
    for (let i = 0; i < entries.length; i++) {
        const currentDate = new Date(entries[i].date);
        const startDate = new Date(currentDate);
        startDate.setDate(startDate.getDate() - days + 1);
        
        let sum = 0;
        let count = 0;
        
        // Look backwards through entries
        for (let j = i; j >= 0; j--) {
            const entryDate = new Date(entries[j].date);
            if (entryDate < startDate) break;
            
            const val = getValue(entries[j]);
            if (val !== null) {
                sum += val;
                count++;
            }
        }
        
        result.push(count > 0 ? sum / count : null);
    }
    
    return result;
}
