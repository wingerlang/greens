import { FoodItem } from '../models/types.ts';
import { ParsedIngredient } from './ingredientParser.ts';

export interface SwapSuggestion {
    original: ParsedIngredient;
    originalItem: FoodItem; // New: Include the matched food item
    suggestion: FoodItem;
    reason: 'price' | 'co2' | 'both';
    savingsFn: (amount: number) => string;
    impactFn: (amount: number) => string;
}

/**
 * Find smart swaps for a list of ingredients
 */
export function findSmartSwaps(ingredients: ParsedIngredient[], allFoods: FoodItem[]): SwapSuggestion[] {
    const suggestions: SwapSuggestion[] = [];

    ingredients.forEach(ing => {
        // Find matches
        const originalItem = allFoods.find(f =>
            (f.name.toLowerCase() === ing.name.toLowerCase()) ||
            ing.name.toLowerCase().includes(f.name.toLowerCase())
        );

        if (!originalItem) return;

        // Skip logic...
        if (['spices', 'condiments', 'other', 'baking'].includes(originalItem.category)) return;

        const candidates = allFoods.filter(f =>
            f.category === originalItem.category &&
            f.id !== originalItem.id &&
            f.storageType !== 'frozen'
        );

        let bestCandidate: FoodItem | null = null;
        let bestScore = 0;
        let reason: 'price' | 'co2' | 'both' = 'price';

        candidates.forEach(candidate => {
            // Price & CO2 calculations same as before
            const priceDiff = (originalItem.pricePerUnit || 0) - (candidate.pricePerUnit || 0);
            const priceSavingPct = (originalItem.pricePerUnit && originalItem.pricePerUnit > 0)
                ? priceDiff / originalItem.pricePerUnit
                : 0;

            const co2Diff = (originalItem.co2PerUnit || 0) - (candidate.co2PerUnit || 0);
            const co2SavingPct = (originalItem.co2PerUnit && originalItem.co2PerUnit > 0)
                ? co2Diff / originalItem.co2PerUnit
                : 0;

            let score = 0;
            let currentReason: 'price' | 'co2' | 'both' | null = null;

            if (priceSavingPct > 0.3) {
                score += priceSavingPct * 10;
                currentReason = 'price';
            }
            if (co2SavingPct > 0.3) {
                score += co2SavingPct * 10;
                if (currentReason === 'price') currentReason = 'both';
                else currentReason = 'co2';
            }

            if (priceSavingPct < -0.1) score -= 5;
            if (co2SavingPct < -0.1) score -= 5;

            if (score > bestScore && currentReason) {
                bestScore = score;
                bestCandidate = candidate;
                reason = currentReason;
            }
        });

        if (bestCandidate) {
            suggestions.push({
                original: ing,
                originalItem: originalItem, // Add this
                suggestion: bestCandidate,
                reason,
                savingsFn: (amount) => {
                    const saved = ((originalItem.pricePerUnit || 0) - (bestCandidate!.pricePerUnit || 0)) * (amount / 1000);
                    return `${Math.round(saved)} kr`;
                },
                impactFn: (amount) => {
                    const saved = ((originalItem.co2PerUnit || 0) - (bestCandidate!.co2PerUnit || 0)) * (amount / 1000);
                    return `${saved.toFixed(1)} kg CO₂e`;
                }
            });
        }
    });

    return suggestions;
}
