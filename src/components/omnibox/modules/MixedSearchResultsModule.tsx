import React from 'react';
import { Calculator } from 'lucide-react';
import { getCategoryEmoji } from '../OmniboxConstants.ts';

interface MixedSearchResultsModuleProps {
    intent: any;
    foodResults: any[];
    standardQuickMeals: any[];
    savedEstimates: any[];
    selectableItems: any[];
    selectedIndex: number;
    logFoodItem: (item: any, quantity: number) => void;
    lockQuickMeal: (item: any) => void;
}

export const MixedSearchResultsModule: React.FC<MixedSearchResultsModuleProps> = ({
    intent,
    foodResults,
    standardQuickMeals,
    savedEstimates,
    selectableItems,
    selectedIndex,
    logFoodItem,
    lockQuickMeal
}) => {
    return (
        <div className="px-2 py-2">
            {/* Parsed Intent Preview for Food */}
            {intent.type === 'food' && (intent.data.quantity !== 100 || intent.data.mealType || intent.date) && (
                <div className="px-3 py-2 mb-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                        <span>🎯</span>
                        <span>Loggar:</span>
                        {intent.data.quantity && intent.data.quantity !== 100 && (
                            <span className="font-bold">{Math.round(intent.data.quantity)}{intent.data.unit || 'g'}</span>
                        )}
                        {intent.data.mealType && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-[10px] font-bold uppercase">
                                {intent.data.mealType === 'breakfast' ? 'frukost' :
                                    intent.data.mealType === 'lunch' ? 'lunch' :
                                        intent.data.mealType === 'dinner' ? 'middag' :
                                            intent.data.mealType === 'snack' ? 'mellanmål' : intent.data.mealType}
                            </span>
                        )}
                        {intent.date && (
                            <span className="text-slate-400 text-xs">→ {intent.date}</span>
                        )}
                    </div>
                </div>
            )}

            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span>🔍</span> Sökresultat ({selectableItems.filter(i => ['food', 'quickMeal', 'recipe', 'savedEstimate'].includes(i.itemType)).length})
            </div>

            {selectableItems.map((item, globalIdx) => {
                // 1. Render Food Item
                if (item.itemType === 'food') {
                    const logQuantity = (intent.type === 'food' && intent.data.quantity)
                        ? intent.data.quantity
                        : (item.defaultPortionGrams || item.usageStats?.avgGrams || 100);
                    const displayKcal = Math.round(item.calories * logQuantity / 100);

                    return (
                        <div
                            key={item.id}
                            id={`omnibox-item-${globalIdx}`}
                            onClick={() => logFoodItem(item, logQuantity)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'hover:bg-white/5 text-white'
                                }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm flex-shrink-0">
                                    {getCategoryEmoji(item.category)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium truncate">{item.name}</div>
                                        {item.brand && (
                                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide flex-shrink-0">
                                                {item.brand}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                        <span className="uppercase tracking-wide">{item.category || 'Övrigt'}</span>
                                        <span className="text-slate-600">•</span>
                                        <span className="text-slate-400">{displayKcal} kcal</span>
                                        {item.usageStats && (
                                            <>
                                                <span className="text-slate-600">•</span>
                                                <span className="text-emerald-500/70">{item.usageStats.count}x</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-600 bg-black/20 px-2 py-1 rounded ml-2 flex-shrink-0">
                                Råvara
                            </div>
                        </div>
                    );
                }

                // 2. Render Quick Meal / Combo
                if (item.itemType === 'quickMeal' || (item.id && item.id.startsWith('combo-'))) {
                    return (
                        <div
                            key={item.id}
                            id={`omnibox-item-${globalIdx}`}
                            onClick={() => lockQuickMeal(item)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'hover:bg-white/5 text-white'
                                }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                                    {item.id.startsWith('combo-') ? '💡' : '⚡'}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium truncate">{item.name}</div>
                                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">
                                            {Math.round((item as any).totals.calories)} kcal
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">{(item as any).summary}</div>
                                </div>
                            </div>
                            <div className="text-[10px] uppercase font-bold text-amber-500/60 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 ml-2 flex-shrink-0">
                                Snabbval
                            </div>
                        </div>
                    );
                }

                // 3. Render Saved Estimate
                if (item.itemType === 'savedEstimate') {
                    return (
                        <div
                            key={item.id}
                            id={`omnibox-item-${globalIdx}`}
                            onClick={() => lockQuickMeal(item)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'hover:bg-white/5 text-white'
                                }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-400 flex-shrink-0">
                                    <Calculator size={16} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium truncate">{item.name}</div>
                                        <div className="text-[10px] text-slate-500 flex items-center gap-2 flex-shrink-0">
                                            <span className="font-bold text-slate-400">{Math.round((item as any).totals.calories)} kcal</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">{(item as any).summary}</div>
                                </div>
                            </div>
                            <div className="text-[10px] uppercase font-bold text-purple-400/60 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 ml-2 flex-shrink-0">
                                Estimering
                            </div>
                        </div>
                    );
                }

                // 4. Render Recipe
                if (item.itemType === 'recipe') {
                    return (
                        <div
                            key={item.id}
                            id={`omnibox-item-${globalIdx}`}
                            onClick={() => lockQuickMeal(item)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                                ? 'bg-indigo-500/20 text-indigo-400 border-l-2 border-indigo-500'
                                : 'hover:bg-white/5 text-white border-l-2 border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-400 flex-shrink-0">
                                    📖
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="font-medium truncate italic">{item.name}</div>
                                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0">
                                            {Math.round((item as any).totals.calories)} kcal/p
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate">{(item as any).summary}</div>
                                </div>
                            </div>
                            <div className="text-[10px] uppercase font-bold text-indigo-400/80 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/30 ml-2 flex-shrink-0">
                                Recept
                            </div>
                        </div>
                    );
                }

                return null;
            })}

            <div className="px-2 py-1 text-[10px] text-slate-600 text-center mt-2 border-t border-white/5 pt-2">
                ↑↓ navigera • Enter för att logga
            </div>
        </div>
    );
};
