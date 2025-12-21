import React from 'react';
import { type MealItem, type Recipe, type FoodItem } from '../../models/types.ts';
import { parseIngredients, matchToFoodItem } from '../../utils/ingredientParser.ts';

interface NutritionBreakdownModalProps {
    item: MealItem | null;
    onClose: () => void;
    recipes: Recipe[];
    foodItems: FoodItem[];
    getFoodItem: (id: string) => FoodItem | undefined;
}

export function NutritionBreakdownModal({
    item,
    onClose,
    recipes,
    foodItems,
    getFoodItem,
}: NutritionBreakdownModalProps) {
    if (!item) return null;

    // Get recipe or food item details
    const isRecipe = item.type === 'recipe';
    const recipe = isRecipe ? recipes.find(r => r.id === item.referenceId) : null;
    const foodItem = !isRecipe ? getFoodItem(item.referenceId) : null;
    const itemName = isRecipe ? recipe?.name : foodItem?.name;
    const servings = item.servings;

    // Calculate ingredient breakdown for recipes
    const UNIT_TO_GRAMS: Record<string, number> = {
        'g': 1, 'kg': 1000, 'ml': 1, 'dl': 100, 'l': 1000,
        'msk': 15, 'tsk': 5, 'portion': 200, 'pcs': 100,
    };

    const ingredients = isRecipe && recipe?.ingredientsText
        ? parseIngredients(recipe.ingredientsText).map(ing => {
            const matched = matchToFoodItem(ing, foodItems);
            const unitGrams = UNIT_TO_GRAMS[ing.unit] || 100;
            const totalGrams = ing.quantity * unitGrams;
            const scaledGrams = (totalGrams / (recipe.servings || 1)) * servings;
            return {
                name: ing.name,
                amount: Math.round(scaledGrams),
                unit: 'g',
                calories: matched ? Math.round((matched.calories / 100) * scaledGrams) : 0,
                protein: matched ? Math.round((matched.protein / 100) * scaledGrams * 10) / 10 : 0,
                carbs: matched ? Math.round((matched.carbs / 100) * scaledGrams * 10) / 10 : 0,
                fat: matched ? Math.round((matched.fat / 100) * scaledGrams * 10) / 10 : 0,
                iron: matched ? ((matched.iron || 0) / 100) * scaledGrams : 0,
                calcium: matched ? ((matched.calcium || 0) / 100) * scaledGrams : 0,
                zinc: matched ? ((matched.zinc || 0) / 100) * scaledGrams : 0,
                vitaminB12: matched ? ((matched.vitaminB12 || 0) / 100) * scaledGrams : 0,
                isComplete: matched?.isCompleteProtein,
                missingAminoAcids: matched?.missingAminoAcids,
                complementaryCategories: matched?.complementaryCategories,
            };
        })
        : [];

    // For food items, create single-item breakdown
    const foodBreakdown = !isRecipe && foodItem ? [{
        name: foodItem.name,
        amount: servings,
        unit: 'g',
        calories: Math.round((foodItem.calories / 100) * servings),
        protein: Math.round((foodItem.protein / 100) * servings * 10) / 10,
        carbs: Math.round((foodItem.carbs / 100) * servings * 10) / 10,
        fat: Math.round((foodItem.fat / 100) * servings * 10) / 10,
        iron: ((foodItem.iron || 0) / 100) * servings,
        calcium: ((foodItem.calcium || 0) / 100) * servings,
        zinc: ((foodItem.zinc || 0) / 100) * servings,
        vitaminB12: ((foodItem.vitaminB12 || 0) / 100) * servings,
        isComplete: foodItem.isCompleteProtein,
        missingAminoAcids: foodItem.missingAminoAcids,
        complementaryCategories: foodItem.complementaryCategories,
    }] : [];

    const breakdown = isRecipe ? ingredients : foodBreakdown;
    const totals = breakdown.reduce((acc, bItem) => ({
        calories: acc.calories + bItem.calories,
        protein: acc.protein + bItem.protein,
        carbs: acc.carbs + bItem.carbs,
        fat: acc.fat + bItem.fat,
        iron: acc.iron + (bItem.iron || 0),
        calcium: acc.calcium + (bItem.calcium || 0),
        zinc: acc.zinc + (bItem.zinc || 0),
        vitaminB12: acc.vitaminB12 + (bItem.vitaminB12 || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, iron: 0, calcium: 0, zinc: 0, vitaminB12: 0 });

    // Protein quality logic
    const hasCompleteProtein = breakdown.some(b => b.isComplete) ||
        (breakdown.some(b => b.complementaryCategories?.includes('grains')) &&
            breakdown.some(b => b.complementaryCategories?.includes('legumes')));

    const missingAminos = breakdown.reduce((acc, b) => {
        if (!b.isComplete && b.missingAminoAcids) {
            b.missingAminoAcids.forEach(a => acc.add(a));
        }
        return acc;
    }, new Set<string>());

    // If it's a "combined" protein (grains + legumes), we clear the missing aminos
    const isCombinedComplete = breakdown.some(b => b.complementaryCategories?.includes('grains')) &&
        breakdown.some(b => b.complementaryCategories?.includes('legumes'));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-100">{itemName}</h2>
                        <span className="text-sm text-slate-400">
                            {isRecipe ? `${servings} portion${servings !== 1 ? 'er' : ''}` : `${servings}g`}
                        </span>
                    </div>
                    <button
                        className="text-slate-400 hover:text-slate-200 text-xl"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                {/* Summary Macros */}
                <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-slate-800/50 rounded-lg">
                    <div className="text-center">
                        <span className="block text-lg font-bold text-emerald-400">{Math.round(totals.calories)}</span>
                        <span className="text-xs text-slate-500">kcal</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-lg font-bold text-violet-400">{totals.protein.toFixed(1)}g</span>
                        <span className="text-xs text-slate-500">protein</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-lg font-bold text-amber-400">{totals.carbs.toFixed(1)}g</span>
                        <span className="text-xs text-slate-500">kolhydrat</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-lg font-bold text-rose-400">{totals.fat.toFixed(1)}g</span>
                        <span className="text-xs text-slate-500">fett</span>
                    </div>
                </div>

                {/* Protein Quality & Micronutrients */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                        <h3 className="text-[10px] text-slate-500 uppercase font-bold mb-2">Proteinkvalitet</h3>
                        {hasCompleteProtein ? (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                                    ✓ Fullvärdigt {isCombinedComplete && <span className="text-[10px] opacity-70">(kombinerat)</span>}
                                </span>
                                <span className="text-[10px] text-slate-400">Innehåller alla essentiella aminosyror.</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-amber-400 font-medium">! Inkomplett protein</span>
                                {missingAminos.size > 0 && (
                                    <span className="text-[10px] text-slate-400">Lågt på: {[...missingAminos].join(', ')}</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                        <h3 className="text-[10px] text-slate-500 uppercase font-bold mb-2">Mikronäring</h3>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Järn:</span>
                                <span className="text-slate-200">{totals.iron.toFixed(1)}mg</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Zink:</span>
                                <span className="text-slate-200">{totals.zinc.toFixed(1)}mg</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Kalcium:</span>
                                <span className="text-slate-200">{Math.round(totals.calcium)}mg</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">B12:</span>
                                <span className="text-slate-200">{totals.vitaminB12.toFixed(1)}µg</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ingredient List */}
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-[10px] text-slate-500 uppercase font-bold px-2 pb-1 border-b border-slate-700 sticky top-0 bg-slate-900">
                        <span>Ingrediens</span>
                        <span className="w-14 text-right">Mängd</span>
                        <span className="w-12 text-right">Kcal</span>
                        <span className="w-10 text-right">P</span>
                        <span className="w-10 text-right">Mikro</span>
                    </div>
                    {breakdown.map((bItem, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-sm py-1.5 px-2 hover:bg-slate-800/50 rounded">
                            <span className="text-slate-300 truncate" title={bItem.name}>{bItem.name}</span>
                            <span className="w-14 text-right text-slate-400">{bItem.amount}{bItem.unit}</span>
                            <span className="w-12 text-right text-emerald-400">{bItem.calories}</span>
                            <span className="w-10 text-right text-violet-400">{bItem.protein}</span>
                            <span className="w-10 text-right text-slate-400 text-[10px]">
                                {bItem.iron > 0.5 ? 'Fe ' : ''}
                                {bItem.calcium > 10 ? 'Ca ' : ''}
                            </span>
                        </div>
                    ))}
                </div>

                <button
                    className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                    onClick={onClose}
                >
                    Stäng
                </button>
            </div>
        </div>
    );
}
