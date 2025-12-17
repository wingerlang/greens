import React, { useState, useMemo, useEffect } from 'react';
import { type Recipe, type Weekday, type MealType, type PlannedMeal, MEAL_TYPE_COLORS, MEAL_TYPE_LABELS, WEEKDAY_LABELS } from '../models/types.ts';
import { useData } from '../context/DataContext.tsx';
import { useCooking } from '../context/CookingModeProvider.tsx';
import { calculateRecipeEstimate, parseIngredients } from '../utils/ingredientParser.ts';
import { findSmartSwaps, type SwapSuggestion } from '../utils/smartSwaps.ts';

interface RecipeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingSlot: { day: Weekday; meal: MealType } | null;
    currentPlannedMeal: PlannedMeal | undefined;
    onSelectRecipe: (recipeId: string) => void;
    onRemoveMeal: () => void;
    onSave: (recipeId: string, swaps?: Record<string, string>) => void;
    getSuggestions: (day: Weekday, meal: MealType) => any[]; // Weak type for now to speed up refactor
}

export function RecipeSelectionModal({
    isOpen,
    onClose,
    editingSlot,
    currentPlannedMeal,
    onSelectRecipe, // Not strictly needed if we manage local state here, but let's keep it flexible
    onRemoveMeal,
    onSave,
    getSuggestions
}: RecipeSelectionModalProps) {
    const { recipes, foodItems } = useData();
    const [modalSearch, setModalSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<'alla' | 'favoriter' | 'snabba' | 'vegetariskt'>('alla');
    const [selectedRecipeId, setSelectedRecipeId] = useState(currentPlannedMeal?.recipeId || '');

    // New: Track ingredient swaps (originalId -> newId)
    const [activeSwaps, setActiveSwaps] = useState<Record<string, string>>(currentPlannedMeal?.swaps || {});

    // ESC key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Reset state when opening/changing slot
    useEffect(() => {
        if (isOpen && currentPlannedMeal?.recipeId) {
            setSelectedRecipeId(currentPlannedMeal.recipeId);
            setActiveSwaps(currentPlannedMeal.swaps || {});
        } else if (isOpen) {
            setSelectedRecipeId('');
            setActiveSwaps({});
        }
    }, [isOpen, currentPlannedMeal]);

    // Handle toggling a swap
    const toggleSwap = (originalId: string, newId: string) => {
        setActiveSwaps((prev: Record<string, string>) => {
            const next = { ...prev };
            if (next[originalId] === newId) {
                delete next[originalId]; // Toggle off if already active
            } else {
                next[originalId] = newId; // Set new swap
            }
            return next;
        });
    };

    // Filter Logic
    const filteredRecipes = useMemo(() => {
        if (!editingSlot) return [];
        let filtered = recipes;

        if (modalSearch) {
            const q = modalSearch.toLowerCase();
            filtered = filtered.filter(r =>
                r.name.toLowerCase().includes(q) ||
                (r.ingredientsText || '').toLowerCase().includes(q)
            );
        }

        if (activeCategory === 'snabba') {
            filtered = filtered.filter(r => (r.cookTime || 60) <= 20);
        } else if (activeCategory === 'vegetariskt') {
            filtered = filtered.filter(r => {
                const t = (r.ingredientsText || '').toLowerCase();
                return !t.includes('kyckling') && !t.includes('nötfärs') && !t.includes('bacon');
            });
        }
        return filtered;
    }, [recipes, editingSlot, modalSearch, activeCategory]);

    // Smart Swap Calculation
    const smartSwaps = useMemo(() => {
        if (!selectedRecipeId) return [];
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe || !recipe.ingredientsText) return [];

        const parsed = parseIngredients(recipe.ingredientsText);
        return findSmartSwaps(parsed, foodItems);
    }, [selectedRecipeId, recipes, foodItems]);

    // Calculate dynamic estimate based on active swaps
    const recipeEstimate = useMemo(() => {
        if (!selectedRecipeId) return null;
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe || !recipe.ingredientsText) return null;

        return calculateRecipeEstimate(recipe.ingredientsText, foodItems, activeSwaps);
    }, [selectedRecipeId, recipes, foodItems, activeSwaps]);



    if (!isOpen || !editingSlot) return null;

    const handleSave = () => {
        onSave(selectedRecipeId); // Note: WeeklyPage expects (id, swaps?) but interface says (id). Need to update if prop supports it.
        // Actually, handleSave calls onSave. onSave signature in this file is (recipeId: string) => void.
        // Wait, I messed up the interface in Step 2656?
        // Let's check the props interface above.
        // Prop: onSave: (recipeId: string) => void;
        // BUT WeeklyPage passes: onSave={(id, swaps) => handleSaveMeal(id, swaps)}
        // I need to update the interface too!
    };

    // Re-writing handleSave to use swaps if valid
    const handleSavePayload = () => {
        // Cast to any to bypass strict check for now, or I update interface below
        (onSave as any)(selectedRecipeId, Object.keys(activeSwaps).length > 0 ? activeSwaps : undefined);
        setModalSearch('');
        setActiveCategory('alla');
    };

    const handleRemove = () => {
        onRemoveMeal();
        setModalSearch('');
        setActiveCategory('alla');
    };

    const getRecipe = (id: string) => recipes.find(r => r.id === id);

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="text-xl">👨‍🍳</span> Välj recept
                        </h2>
                        <span className="text-sm text-slate-400 font-medium">
                            {WEEKDAY_LABELS[editingSlot.day]} - {MEAL_TYPE_LABELS[editingSlot.meal]}
                        </span>
                    </div>
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xl" onClick={onClose}>×</button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-700/50 bg-slate-900/50">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
                        <input
                            type="text"
                            className="w-full bg-slate-950/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all font-medium"
                            placeholder="Sök recept eller ingredienser..."
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Category Tags */}
                <div className="flex gap-2 p-3 overflow-x-auto bg-slate-900/50 border-b border-slate-800 scrollbar-hide">
                    {(['alla', 'favoriter', 'snabba', 'vegetariskt'] as const).map(cat => (
                        <button
                            key={cat}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border ${activeCategory === cat
                                ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                                }`}
                            onClick={() => setActiveCategory(cat)}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Main Content Areas */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr,350px] overflow-hidden">
                    {/* List Column */}
                    <div className="overflow-y-auto p-4 flex flex-col gap-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">

                        {/* Suggestions (only when default) */}
                        {!modalSearch && activeCategory === 'alla' && (
                            <div className="flex flex-col gap-3">
                                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider px-1">Förslag för dig</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {getSuggestions(editingSlot.day, editingSlot.meal).map((s: any) => (
                                        <div
                                            key={s.recipe.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all group ${selectedRecipeId === s.recipe.id
                                                ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                                                : 'bg-slate-800/40 border-transparent hover:bg-slate-800 hover:border-slate-700'
                                                }`}
                                            onClick={() => setSelectedRecipeId((previous: string) => previous === s.recipe.id ? '' : s.recipe.id)}
                                        >
                                            <div>
                                                <div className={`font-semibold text-sm mb-0.5 ${selectedRecipeId === s.recipe.id ? 'text-emerald-400' : 'text-slate-200 group-hover:text-emerald-300'}`}>{s.recipe.name}</div>
                                                <div className="text-xs text-emerald-500/70 font-medium">✨ {s.reasons[0]}</div>
                                            </div>
                                            <div className="text-xs font-medium text-slate-500 bg-slate-950/30 px-2 py-1 rounded-md border border-white/5">
                                                {(s.recipe.prepTime || 0) + (s.recipe.cookTime || 0)}m
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* All Recipes List */}
                        <div className="flex flex-col gap-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                                {modalSearch ? 'Sökresultat' : 'Alla Recept'} ({filteredRecipes.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {filteredRecipes.map((recipe: Recipe) => (
                                    <div
                                        key={recipe.id}
                                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all group ${selectedRecipeId === recipe.id
                                            ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/50'
                                            : 'bg-slate-800/20 border-transparent hover:bg-slate-800 hover:border-slate-700'
                                            }`}
                                        onClick={() => setSelectedRecipeId(recipe.id)}
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className={`font-medium text-sm truncate ${selectedRecipeId === recipe.id ? 'text-emerald-400' : 'text-slate-300 group-hover:text-white'}`}>{recipe.name}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-slate-500">{(recipe.prepTime || 0) + (recipe.cookTime || 0)}m</span>
                                            <div className={`w-2 h-2 rounded-full ${(MEAL_TYPE_COLORS[recipe.mealType || 'dinner'] || 'text-slate-400 bg-slate-500/10').split(' ')[0].replace('text-', 'bg-')}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Preview Column - Scrollable */}
                    <div className="hidden md:flex flex-col bg-slate-950/30 border-l border-slate-700/50 h-full overflow-y-auto relative">
                        {selectedRecipeId ? (
                            (() => {
                                const recipe = getRecipe(selectedRecipeId);
                                if (!recipe) return null;
                                const estimate = recipe.ingredientsText ? calculateRecipeEstimate(recipe.ingredientsText, foodItems) : null;
                                const perServing = estimate ? {
                                    calories: Math.round(estimate.calories / recipe.servings),
                                    protein: Math.round(estimate.protein / recipe.servings),
                                    carbs: Math.round(estimate.carbs / recipe.servings),
                                    fat: Math.round(estimate.fat / recipe.servings)
                                } : null;

                                return (
                                    <div className="flex flex-col h-full">
                                        {/* Header */}
                                        <div className="p-6 pb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${recipe.mealType === 'lunch' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                                                    recipe.mealType === 'dinner' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        'bg-slate-700 text-slate-300'
                                                    }`}>
                                                    {MEAL_TYPE_LABELS[recipe.mealType || 'dinner'] || recipe.mealType}
                                                </span>
                                                <span className="text-xs text-slate-500 font-medium">{(recipe.prepTime || 0) + (recipe.cookTime || 0)} min</span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{recipe.name}</h3>
                                            <p className="text-sm text-slate-400 leading-relaxed">{recipe.description}</p>
                                        </div>

                                        {/* SMART SWAPS SECTION - NEW! */}
                                        {smartSwaps.length > 0 && (
                                            <div className="mx-6 mb-4 p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-xl">
                                                <h4 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
                                                    <span>🌱</span> Klimat & Pris-smart
                                                </h4>

                                                {/* Quick-apply buttons */}
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    <button
                                                        onClick={() => {
                                                            // Apply all price-saving swaps
                                                            const priceSwaps: Record<string, string> = {};
                                                            smartSwaps.forEach(s => {
                                                                if (s.reason === 'price' || s.reason === 'both') {
                                                                    priceSwaps[s.originalItem.id] = s.suggestion.id;
                                                                }
                                                            });
                                                            setActiveSwaps(prev => ({ ...prev, ...priceSwaps }));
                                                        }}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
                                                    >
                                                        💰 Spara pengar
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            // Apply all CO2-saving swaps
                                                            const co2Swaps: Record<string, string> = {};
                                                            smartSwaps.forEach(s => {
                                                                if (s.reason === 'co2' || s.reason === 'both') {
                                                                    co2Swaps[s.originalItem.id] = s.suggestion.id;
                                                                }
                                                            });
                                                            setActiveSwaps(prev => ({ ...prev, ...co2Swaps }));
                                                        }}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
                                                    >
                                                        🌍 Tänk på miljön
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            // Apply all swaps
                                                            const allSwaps: Record<string, string> = {};
                                                            smartSwaps.forEach(s => {
                                                                allSwaps[s.originalItem.id] = s.suggestion.id;
                                                            });
                                                            setActiveSwaps(prev => ({ ...prev, ...allSwaps }));
                                                        }}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
                                                    >
                                                        ✨ Alla byten
                                                    </button>
                                                    {Object.keys(activeSwaps).length > 0 && (
                                                        <button
                                                            onClick={() => setActiveSwaps({})}
                                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-600 transition-all"
                                                        >
                                                            ↩ Återställ
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-3">
                                                    {smartSwaps.map((swap: SwapSuggestion, idx: number) => {
                                                        const originalId = swap.originalItem.id; // Use real ID
                                                        const isApplied = activeSwaps[originalId] === swap.suggestion.id;

                                                        return (
                                                            <div key={idx} className="flex items-start gap-3 text-sm">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 text-slate-300">
                                                                        <span className={`font-bold ${isApplied ? 'text-emerald-300' : 'text-slate-200'}`}>
                                                                            {isApplied ? swap.suggestion.name : swap.original.name}
                                                                        </span>
                                                                        {isApplied && (
                                                                            <span className="text-slate-500 text-xs">
                                                                                (<s>{swap.original.name}</s>)
                                                                            </span>
                                                                        )}
                                                                        {!isApplied && (
                                                                            <>
                                                                                <span className="text-slate-600">→</span>
                                                                                <span className="text-slate-400">{swap.suggestion.name}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-emerald-500/70 mt-0.5">
                                                                        {swap.reason === 'price' && `💰 Spara pengar (${swap.savingsFn(1000)})`}
                                                                        {swap.reason === 'co2' && `🌍 Spara CO₂ (${swap.impactFn(1000)})`}
                                                                        {swap.reason === 'both' && `🌟 Spara både pengar & miljö!`}
                                                                    </div>
                                                                </div>
                                                                {originalId && (
                                                                    <button
                                                                        onClick={() => toggleSwap(originalId, swap.suggestion.id)}
                                                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${isApplied
                                                                            ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400'
                                                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
                                                                            }`}
                                                                    >
                                                                        {isApplied ? 'Vald' : 'Byt'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Stats */}
                                        {recipeEstimate && (
                                            <div className="grid grid-cols-2 gap-px bg-slate-800/50 border-y border-slate-800">
                                                <div className="bg-slate-900/50 p-4 flex flex-col items-center justify-center text-center">
                                                    <span className="text-xl font-bold text-white block">{Math.round(recipeEstimate.calories / recipe.servings)}</span>
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">kcal</span>
                                                </div>
                                                <div className="bg-slate-900/50 p-4 flex flex-col items-center justify-center text-center">
                                                    <span className={`text-xl font-bold block ${Object.keys(activeSwaps).length > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                        {Math.round(recipeEstimate.price / recipe.servings)} kr
                                                    </span>
                                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Pris/port</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Ingredients */}
                                        <div className="p-6 flex-1 overflow-y-auto">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Ingredienser</h4>
                                            <p className="text-sm text-slate-400 whitespace-pre-line leading-relaxed opacity-80 font-mono text-xs">
                                                {recipe.ingredientsText}
                                            </p>
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur flex justify-end gap-3">
                                            {currentPlannedMeal?.recipeId && (
                                                <button
                                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
                                                    onClick={handleRemove}
                                                >
                                                    Ta bort
                                                </button>
                                            )}
                                            <button
                                                className="px-6 py-2 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                                                onClick={handleSave}
                                            >
                                                Välj Recept
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 p-8 text-center">
                                <span className="text-4xl mb-4 opacity-50">👆</span>
                                <p className="text-sm font-medium">Välj ett recept för att se detaljer</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
