import React, { useEffect, useState, useMemo } from 'react';
import { type MealType, type FoodCategory, type QuickMeal, MEAL_TYPE_LABELS } from '../../models/types.ts';

interface SearchResult {
    type: 'recipe' | 'foodItem';
    id: string;
    name: string;
    subtitle: string;
    defaultPortion?: number;
    yieldFactor?: number;
    isCooked?: boolean;
    category?: FoodCategory;
}

// Default yield factors for common cookable categories
const DEFAULT_YIELD_FACTORS: Record<string, number> = {
    'ris': 2.5,
    'pasta': 2.2,
    'quinoa': 3.0,
    'bulgur': 2.5,
    'couscous': 2.0,
    'havregryn': 3.0,
    'linser': 2.0,
};

// Check if name suggests an uncooked item
function isLikelyUncooked(name: string): boolean {
    const lower = name.toLowerCase();
    // Uncooked indicators
    if (lower.includes('okokt') || lower.includes('torr') || lower.includes('rå')) {
        return true;
    }
    // Cooked indicators = NOT uncooked
    if (lower.includes('kokt') || lower.includes('tillagad') || lower.includes('stekt')) {
        return false;
    }
    return false;
}

// Get default yield factor based on name
function getDefaultYieldFactor(name: string): number | undefined {
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(DEFAULT_YIELD_FACTORS)) {
        if (lower.includes(key)) {
            return value;
        }
    }
    return undefined;
}

// QuickMealRow with piece counter
function QuickMealRow({ qm, onLogQuickMeal }: { qm: QuickMeal; onLogQuickMeal?: (qm: QuickMeal, pieceCount?: number) => void }) {
    const [pieces, setPieces] = useState(1);

    const handleLog = () => {
        if (pieces === 1) {
            onLogQuickMeal?.(qm);
        } else {
            // Create a new QuickMeal with multiplied servings
            const multipliedQm: QuickMeal = {
                ...qm,
                items: qm.items.map(item => ({
                    ...item,
                    servings: item.servings * pieces
                }))
            };
            onLogQuickMeal?.(multipliedQm, pieces);
        }
    };

    return (
        <div className="search-result-item">
            <div className="result-info">
                <span className="result-type">⚡</span>
                <div>
                    <strong>{qm.name}</strong>
                    <small>{qm.items.length} ingredienser {pieces > 1 && <span className="text-emerald-400 font-bold">× {pieces}</span>}</small>
                </div>
            </div>
            <div className="result-actions">
                {/* Piece counter */}
                <div className="portion-control mr-2">
                    <button
                        className="btn-portion"
                        onClick={() => setPieces(Math.max(1, pieces - 1))}
                    >−</button>
                    <span className="portion-value">{pieces}st</span>
                    <button
                        className="btn-portion"
                        onClick={() => setPieces(pieces + 1)}
                    >+</button>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleLog}
                >
                    + Logga
                </button>
            </div>
        </div>
    );
}

interface QuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    mealType: MealType;
    setMealType: (type: MealType) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: SearchResult[];
    proposals: SearchResult[];
    quickAddServings: number;
    setQuickAddServings: (val: number) => void;
    handleQuickAdd: (type: 'recipe' | 'foodItem', id: string, defaultPortion?: number, loggedAsCooked?: boolean, effectiveYieldFactor?: number) => void;
    selectedDate?: string;
    quickMeals?: QuickMeal[];
    onLogQuickMeal?: (qm: QuickMeal, pieceCount?: number) => void;
}


export function QuickAddModal({
    isOpen,
    onClose,
    mealType,
    setMealType,
    searchQuery,
    setSearchQuery,
    searchResults,
    proposals,
    quickAddServings,
    setQuickAddServings,
    handleQuickAdd,
    selectedDate,
    quickMeals,
    onLogQuickMeal,
}: QuickAddModalProps) {
    // Track which items are toggled to "cooked" mode
    const [cookedItems, setCookedItems] = useState<Set<string>>(new Set());

    const toggleCooked = (id: string) => {
        setCookedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Check if item can be logged as cooked - now with smart detection
    const canLogAsCooked = (result: SearchResult): { canCook: boolean; effectiveYieldFactor: number } => {
        if (result.type !== 'foodItem') {
            return { canCook: false, effectiveYieldFactor: 1 };
        }

        // Already cooked = no toggle
        if (result.isCooked) {
            return { canCook: false, effectiveYieldFactor: 1 };
        }

        // Has explicit yieldFactor? Use it
        if (result.yieldFactor && result.yieldFactor > 1) {
            return { canCook: true, effectiveYieldFactor: result.yieldFactor };
        }

        // Smart detection: check if name suggests uncooked AND has a default yield factor
        const defaultYield = getDefaultYieldFactor(result.name);
        if (defaultYield && isLikelyUncooked(result.name)) {
            return { canCook: true, effectiveYieldFactor: defaultYield };
        }

        // Even without "okokt", if it's a cookable type (ris, pasta), show toggle
        if (defaultYield) {
            return { canCook: true, effectiveYieldFactor: defaultYield };
        }

        return { canCook: false, effectiveYieldFactor: 1 };
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Reset cooked toggles when closing
    useEffect(() => {
        if (!isOpen) {
            setCookedItems(new Set());
        }
    }, [isOpen]);

    const filteredQuickMeals = useMemo(() => {
        if (!quickMeals) return [];
        if (!searchQuery) return quickMeals;
        return quickMeals.filter(qm => qm.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [quickMeals, searchQuery]);

    if (!isOpen) return null;

    const renderResultItem = (result: SearchResult, keyPrefix: string) => {
        const isCooked = cookedItems.has(result.id);
        const { canCook: showCookedToggle, effectiveYieldFactor } = canLogAsCooked(result);

        return (
            <div
                key={`${keyPrefix}-${result.type}-${result.id}`}
                className="search-result-item"
            >
                <div className="result-info">
                    <span className="result-type">{result.type === 'recipe' ? '🍳' : '🥕'}</span>
                    <div>
                        <strong>{result.name}</strong>
                        <small>
                            {result.subtitle}
                            {showCookedToggle && isCooked && (
                                <span className="ml-2 text-emerald-400">→ kokt (×{effectiveYieldFactor})</span>
                            )}
                        </small>
                    </div>
                </div>
                <div className="result-actions">
                    {/* Cooked toggle for raw ingredients with yieldFactor */}
                    {showCookedToggle && (
                        <button
                            type="button"
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all mr-2 ${isCooked
                                ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-500'
                                }`}
                            onClick={() => toggleCooked(result.id)}
                            title={isCooked ? 'Logga som rå' : 'Logga som kokt'}
                        >
                            🍳
                        </button>
                    )}
                    {/* Portion Controls */}
                    <div className="portion-control">
                        <button
                            className="btn-portion"
                            onClick={() => setQuickAddServings(Math.max(0.25, quickAddServings - 0.25))}
                        >−</button>
                        <span className="portion-value">{quickAddServings}</span>
                        <button
                            className="btn-portion"
                            onClick={() => setQuickAddServings(quickAddServings + 0.25)}
                        >+</button>
                    </div>
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleQuickAdd(result.type, result.id, result.defaultPortion, isCooked, isCooked ? effectiveYieldFactor : undefined)}
                    >
                        + Lägg till
                    </button>
                </div>
            </div>
        );
    };

    // Date helpers
    const today = new Date().toISOString().split('T')[0];
    const isToday = !selectedDate || selectedDate === today;
    const getRelativeDateLabel = (dateStr: string) => {
        if (dateStr === today) return 'Idag';
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (dateStr === yesterday) return 'Igår';
        const diff = Math.floor((new Date(today).getTime() - new Date(dateStr).getTime()) / 86400000);
        if (diff < 7) return `${diff} dgr sen`;
        return dateStr;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal quick-add-modal" onClick={(e) => e.stopPropagation()}>
                <h2>🔍 Sök och lägg till</h2>

                {/* Date indicator - prominent when not today */}
                {selectedDate && (
                    <div className={`mb-4 px-4 py-3 rounded-xl border flex items-center gap-3 ${isToday
                        ? 'bg-slate-800/50 border-slate-700'
                        : 'bg-amber-900/20 border-amber-500/30'
                        }`}>
                        <div className={`text-xl ${isToday ? 'opacity-50' : ''}`}>
                            {isToday ? '📅' : '⏮️'}
                        </div>
                        <div>
                            <div className={`text-sm font-bold ${isToday ? 'text-slate-400' : 'text-amber-400'}`}>
                                {getRelativeDateLabel(selectedDate)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                                {new Date(selectedDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </div>
                        </div>
                        {!isToday && (
                            <div className="ml-auto text-[9px] font-bold text-amber-500 uppercase tracking-wider bg-amber-500/20 px-2 py-1 rounded-lg">
                                Historik
                            </div>
                        )}
                    </div>
                )}

                {/* Meal Type Selector */}
                <div className="form-group">
                    <label>Måltidstyp</label>
                    <div className="meal-type-selector">
                        {(Object.entries(MEAL_TYPE_LABELS) as [MealType, string][]).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                className={`meal-type-btn ${mealType === key ? 'active' : ''}`}
                                onClick={() => setMealType(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Unified Search */}
                <div className="form-group">
                    <label>Sök recept eller råvara</label>
                    <input
                        type="text"
                        placeholder="Skriv för att söka..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Quick Meals Section */}
                {filteredQuickMeals.length > 0 && (
                    <div className="search-results proposals-results mb-4">
                        <p className="text-[10px] text-emerald-500 uppercase font-bold mb-2 tracking-wider">
                            {searchQuery ? '⚡ Snabbval Träffar' : '⚡ Mina Snabbval'}
                        </p>
                        {filteredQuickMeals.map(qm => (
                            <QuickMealRow
                                key={qm.id}
                                qm={qm}
                                onLogQuickMeal={onLogQuickMeal}
                            />
                        ))}
                    </div>
                )}


                {/* Proposals (Most/Recently Used) */}
                {!searchQuery && proposals.length > 0 && (
                    <div className="search-results proposals-results">
                        <p className="text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-wider">Ofta använda</p>
                        {proposals.map((result) => renderResultItem(result, 'prop'))}
                    </div>
                )}

                {/* Search Results */}
                {searchQuery && searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((result) => renderResultItem(result, 'search'))}
                    </div>
                )}

                {searchQuery && searchResults.length === 0 && (
                    <p className="no-results">Inga resultat för "{searchQuery}"</p>
                )}

                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
