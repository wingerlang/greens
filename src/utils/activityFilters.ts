import { ExerciseEntry } from '../models/types.ts';

export type FilterType = 'distance' | 'duration' | 'pace' | 'tonnage' | 'date' | 'type' | 'text';
export type Operator = 'greater' | 'less' | 'range' | 'equal' | 'contains';

export interface SmartFilter {
    id: string;
    type: FilterType;
    operator: Operator;
    value: any; // Can be number or string for text
    value2?: number;
    label: string;
    originalQuery: string;
}

export function parseSmartQuery(query: string): { filters: SmartFilter[], remainingText: string } {
    const filters: SmartFilter[] = [];
    let remainingText = query;

    // 0. DATE/YEAR: >2025, <2024, 2023
    const yearRegex = /(?:([<>])\s*)?(20\d{2})\b/g;
    remainingText = remainingText.replace(yearRegex, (match, op, year) => {
        const val = parseInt(year);
        const operator = op === '>' ? 'greater' : op === '<' ? 'less' : 'equal';
        filters.push({
            id: crypto.randomUUID(),
            type: 'date',
            operator,
            value: val,
            label: `${op || ''}${year}`,
            originalQuery: match.trim()
        });
        return '';
    });

    // 1. DISTANCE: >10km, <5km, 10-20km, 12km, 10km +- 500m, ~10km
    const distRegex = /(~)?\s*(?:([<>])\s*)?(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*(?:km|k|m)?(?:\s*\+-\s*(\d+(?:[.,]\d+)?)\s*(km|k|m)?)?/gi;
    remainingText = remainingText.replace(distRegex, (match, approx, op, v1, v2, tolerance, tolUnit) => {
        const val1 = parseFloat(v1.replace(',', '.'));

        if (approx || tolerance) {
            let tolVal = 0.5; // Default 500m
            if (tolerance) {
                tolVal = parseFloat(tolerance.replace(',', '.'));
                if (tolUnit?.toLowerCase() === 'm' || (tolerance.length >= 3 && !tolUnit && parseInt(tolerance) >= 100)) {
                    tolVal = tolVal / 1000;
                }
            }

            filters.push({
                id: crypto.randomUUID(),
                type: 'distance',
                operator: 'range',
                value: val1 - tolVal,
                value2: val1 + tolVal,
                label: approx && !tolerance ? `~ ${val1} km` : `${val1} ± ${tolVal < 1 ? Math.round(tolVal * 1000) + 'm' : tolVal + 'km'}`,
                originalQuery: match.trim()
            });
        } else if (v2) {
            const val2 = parseFloat(v2.replace(',', '.'));
            filters.push({
                id: crypto.randomUUID(),
                type: 'distance',
                operator: 'range',
                value: val1,
                value2: val2,
                label: `${val1}-${val2} km`,
                originalQuery: match.trim()
            });
        } else {
            const operator = op === '>' ? 'greater' : op === '<' ? 'less' : 'equal';
            filters.push({
                id: crypto.randomUUID(),
                type: 'distance',
                operator,
                value: val1,
                label: `${op || ''}${val1} km`,
                originalQuery: match.trim()
            });
        }
        return '';
    });

    // 2. TONNAGE: >10t, <5.5t, 5-10t, 8t
    const tonnageRegex = /(?:([<>])\s*)?(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*t(?![a-z])/gi;
    remainingText = remainingText.replace(tonnageRegex, (match, op, v1, v2) => {
        const val1 = parseFloat(v1.replace(',', '.'));
        if (v2) {
            const val2 = parseFloat(v2.replace(',', '.'));
            filters.push({
                id: crypto.randomUUID(),
                type: 'tonnage',
                operator: 'range',
                value: val1,
                value2: val2,
                label: `${val1}-${val2} t`,
                originalQuery: match.trim()
            });
        } else {
            const operator = op === '>' ? 'greater' : op === '<' ? 'less' : 'equal';
            filters.push({
                id: crypto.randomUUID(),
                type: 'tonnage',
                operator,
                value: val1,
                label: `${op || ''}${val1} t`,
                originalQuery: match.trim()
            });
        }
        return '';
    });

    // 3. PACE: <4:00/km, >5:30 min/km, 4:00-5:00/km
    const paceRegex = /(?:([<>])\s*)?(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?\s*(?:min\/km|\/km|pace|tempo)/gi;
    const timeToPace = (t: string) => {
        const [m, s] = t.split(':').map(Number);
        return m + (s / 60);
    };

    remainingText = remainingText.replace(paceRegex, (match, op, p1, p2) => {
        const val1 = timeToPace(p1);
        if (p2) {
            const val2 = timeToPace(p2);
            filters.push({
                id: crypto.randomUUID(),
                type: 'pace',
                operator: 'range',
                value: val1,
                value2: val2,
                label: `${p1}-${p2} /km`,
                originalQuery: match.trim()
            });
        } else {
            const operator = op === '>' ? 'greater' : op === '<' ? 'less' : 'equal';
            filters.push({
                id: crypto.randomUUID(),
                type: 'pace',
                operator,
                value: val1,
                label: `${op || ''}${p1} /km`,
                originalQuery: match.trim()
            });
        }
        return '';
    });

    // 4. DURATION: >30min, <2h, 1:30h, 90m
    const durationRegex = /(?:([<>])\s*)?(\d+(?:[.,]\d+)?|(\d+:\d{2}))\s*(h|min|m|tim|t)/gi;
    const parseDuration = (d: string, unit: string) => {
        if (d.includes(':')) {
            const [h, m] = d.split(':').map(Number);
            return (h * 60) + m;
        }
        const val = parseFloat(d.replace(',', '.'));
        if (unit.toLowerCase().startsWith('h') || unit.toLowerCase() === 'tim') return val * 60;
        return val;
    };

    remainingText = remainingText.replace(durationRegex, (match, op, d1, d2, unit) => {
        // If it was already caught by tonnage (ends in 't'), don't catch it here unless it's clearly time
        if (unit === 't' && !d1.includes(':') && parseFloat(d1) > 24) return match;

        const val1 = parseDuration(d1, unit);
        const operator = op === '>' ? 'greater' : op === '<' ? 'less' : 'equal';
        filters.push({
            id: crypto.randomUUID(),
            type: 'duration',
            operator,
            value: val1,
            label: `${op || ''}${d1}${unit}`,
            originalQuery: match.trim()
        });
        return '';
    });

    // 5. GLOBAL TEXT SEARCH (General notes, categories, sources)
    const finalCleaned = remainingText.trim();
    if (finalCleaned.length > 0) {
        // Split by space? Or treat as one blob? 
        // User said "rubb och stubb", so let's treat each word as a search term if they are distinct
        // But for now, one filter is easier to manage in the UI
        filters.push({
            id: crypto.randomUUID(),
            type: 'text',
            operator: 'contains',
            value: finalCleaned,
            label: `Sök: "${finalCleaned}"`,
            originalQuery: finalCleaned
        });
        remainingText = '';
    }

    return { filters, remainingText: '' };
}

export function applySmartFilters<T extends ExerciseEntry>(activities: T[], filters: SmartFilter[]): T[] {
    return activities.filter(activity => {
        return filters.every(f => {
            switch (f.type) {
                case 'distance':
                    if (!activity.distance) return false;
                    if (f.operator === 'greater') return activity.distance > f.value;
                    if (f.operator === 'less') return activity.distance < f.value;
                    if (f.operator === 'range') return activity.distance >= f.value && activity.distance <= (f.value2 || f.value);
                    return Math.abs(activity.distance - f.value) < 0.1;

                case 'tonnage':
                    const ton = (activity.tonnage || 0) / 1000;
                    if (f.operator === 'greater') return ton > f.value;
                    if (f.operator === 'less') return ton < f.value;
                    if (f.operator === 'range') return ton >= f.value && ton <= (f.value2 || f.value);
                    return Math.abs(ton - f.value) < 0.1;

                case 'duration':
                    const dur = activity.durationMinutes;
                    if (f.operator === 'greater') return dur > f.value;
                    if (f.operator === 'less') return dur < f.value;
                    if (f.operator === 'range') return dur >= f.value && dur <= (f.value2 || f.value);
                    return Math.abs(dur - f.value) < 1;

                case 'pace':
                    if (!activity.distance || !activity.durationMinutes) return false;
                    const pace = activity.durationMinutes / activity.distance;
                    if (f.operator === 'greater') return pace > f.value;
                    if (f.operator === 'less') return pace < f.value;
                    if (f.operator === 'range') {
                        const v1 = Math.min(f.value, f.value2 || f.value);
                        const v2 = Math.max(f.value, f.value2 || f.value);
                        return pace >= v1 && pace <= v2;
                    }
                    return Math.abs(pace - f.value) < 0.05;

                case 'date':
                    const year = new Date(activity.date).getFullYear();
                    if (f.operator === 'greater') return year > f.value;
                    if (f.operator === 'less') return year < f.value;
                    return year === f.value;

                case 'text':
                    const searchStr = f.value.toLowerCase();
                    const a = activity as any;
                    const combinedText = `
                        ${a.type || ''} 
                        ${a.name || ''} 
                        ${a.notes || ''} 
                        ${a.category || ''} 
                        ${a.source || ''} 
                        ${a.subType || ''}
                    `.toLowerCase();
                    return combinedText.includes(searchStr);

                default:
                    return true;
            }
        });
    });
}
