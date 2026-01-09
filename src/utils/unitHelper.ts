/**
 * Unit Helper
 * Logic for converting and formatting ingredient quantities with rich context
 */

import { type FoodItem } from '../models/nutrition.ts';
import { formatNumber } from './number.ts';

/**
 * Format ingredient quantity with rich unit detail
 * e.g. "4 port" -> "4 port (3.3 dl / 280g)"
 */
export function formatIngredientQuantity(
    quantity: number,
    unit: string,
    foodItem?: FoodItem
): string {
    const formattedQuantity = formatNumber(quantity, 1);
    if (!foodItem) return `${formattedQuantity} ${unit}`;

    const parts: string[] = [];

    // Base unit
    parts.push(`${formattedQuantity} ${unit}`);

    // If unit is 'port'/'portion' and we have weight/volume info
    if ((unit === 'port' || unit === 'portion') && foodItem.defaultPortionGrams) {
        const grams = quantity * foodItem.defaultPortionGrams;
        const extraInfo: string[] = [];

        // Add volume if available
        if (foodItem.gramsPerDl) {
            const dl = grams / foodItem.gramsPerDl;
            extraInfo.push(`${formatNumber(dl, 1)} dl`);
        }

        // Add weight
        extraInfo.push(`${Math.round(grams)}g`);

        if (extraInfo.length > 0) {
            parts.push(`(${extraInfo.join(' / ')})`);
        }
    }

    // If unit is 'dl' and we have density
    else if ((unit === 'dl') && foodItem.gramsPerDl) {
        const grams = quantity * foodItem.gramsPerDl;
        parts.push(`(${Math.round(grams)}g)`);
    }

    // If unit is 'g' and we have volume
    else if ((unit === 'g') && foodItem.gramsPerDl) {
        const dl = quantity / foodItem.gramsPerDl;
        parts.push(`(${formatNumber(dl, 1)} dl)`);
    }

    return parts.join(' ');
}
