import React, { useEffect } from 'react';
import { type MealType, MEAL_TYPE_LABELS } from '../../models/types.ts';

interface QuickAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    mealType: MealType;
    setMealType: (type: MealType) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: any[];
    proposals: any[];
    quickAddServings: number;
    setQuickAddServings: (val: number) => void;
    handleQuickAdd: (type: 'recipe' | 'foodItem', id: string, defaultPortion?: number) => void;
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
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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
                        {proposals.map((result: any) => (
                            <div
                                key={`prop-${result.type}-${result.id}`}
                                className="search-result-item"
                            >
                                <div className="result-info">
                                    <span className="result-type">{result.type === 'recipe' ? '🍳' : '🥕'}</span>
                                    <div>
                                        <strong>{result.name}</strong>
                                        <small>{result.subtitle}</small>
                                    </div>
                                </div>
                                <div className="result-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleQuickAdd(result.type, result.id, (result as any).defaultPortion)}
                                    >
                                        + Lägg till
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search Results */}
                {searchQuery && searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((result: any) => (
                            <div
                                key={`${result.type}-${result.id}`}
                                className="search-result-item"
                            >
                                <div className="result-info">
                                    <span className="result-type">{result.type === 'recipe' ? '🍳' : '🥕'}</span>
                                    <div>
                                        <strong>{result.name}</strong>
                                        <small>{result.subtitle}</small>
                                    </div>
                                </div>
                                <div className="result-actions">
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
                                        onClick={() => handleQuickAdd(result.type, result.id, (result as any).defaultPortion)}
                                    >
                                        + Lägg till
                                    </button>
                                </div>
                            </div>
                        ))}
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
