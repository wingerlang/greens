import React, { useEffect, useState } from 'react';
import { type MealType, type FoodCategory, MEAL_TYPE_LABELS } from '../../models/types.ts';

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

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal quick-add-modal" onClick={(e) => e.stopPropagation()}>
                <h2>🔍 Sök och lägg till</h2>

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
