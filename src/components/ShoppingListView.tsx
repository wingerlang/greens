import React, { useState } from 'react';
import { ShoppingItem } from '../hooks/useShoppingList.ts';
import { WEEKDAY_LABELS, MEAL_TYPE_LABELS } from '../models/types.ts';

interface ShoppingListViewProps {
    shoppingList: Record<string, ShoppingItem[]>;
    pantryItems: Set<string>;
    pantryQuantities?: Record<string, { quantity: number; unit: string }>;
    togglePantryItem: (item: string) => void;
    setPantryQuantity?: (itemName: string, quantity: number, unit: string) => void;
    totalItems: number;
    onCopy: () => Promise<boolean>;
    copyStatus?: 'idle' | 'copied' | 'error';
    formatQuantity?: (item: ShoppingItem) => string;
}

export function ShoppingListView({
    shoppingList,
    pantryItems,
    pantryQuantities = {},
    togglePantryItem,
    setPantryQuantity,
    totalItems,
    onCopy,
    copyStatus = 'idle',
    formatQuantity
}: ShoppingListViewProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [quantityInput, setQuantityInput] = useState<{ itemName: string; unit: string } | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);

    if (totalItems === 0 && Object.values(shoppingList).every(l => l.length === 0)) {
        return null;
    }

    // Handle name click - show usage modal
    const handleNameClick = (item: ShoppingItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedItem(item);
    };

    // Handle green button click - mark as owned
    const handleMarkOwned = (item: ShoppingItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const key = item.name.toLowerCase();

        if (e.shiftKey && setPantryQuantity) {
            // Shift+click: prompt for quantity
            setQuantityInput({ itemName: item.name, unit: item.unit || 'st' });
            setInputValue(item.quantity.toString());
        } else {
            // Normal click: just toggle
            togglePantryItem(key);
        }
    };

    // Save quantity input
    const handleSaveQuantity = () => {
        if (quantityInput && setPantryQuantity && inputValue) {
            const qty = parseFloat(inputValue);
            if (!isNaN(qty) && qty > 0) {
                setPantryQuantity(quantityInput.itemName, qty, quantityInput.unit);
            }
        }
        setQuantityInput(null);
        setInputValue('');
    };

    const getCopyButtonContent = () => {
        if (copyStatus === 'copied') {
            return '✓ Kopierat!';
        }
        if (copyStatus === 'error') {
            return '✗ Fel';
        }
        return '📋 Kopiera';
    };

    const getCopyButtonClass = () => {
        const base = "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border transition-all active:scale-95";
        if (copyStatus === 'copied') {
            return `${base} bg-emerald-500 text-white border-emerald-400`;
        }
        if (copyStatus === 'error') {
            return `${base} bg-rose-500/20 text-rose-400 border-rose-500/30`;
        }
        return `${base} bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700`;
    };

    return (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-xl shadow-inner shadow-emerald-500/5">🛒</div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Inköpslista</h2>
                        <div className="text-sm text-slate-400 font-medium flex items-center gap-2">
                            <span>{totalItems} varor att köpa</span>
                            {pantryItems.size > 0 && <span className="w-1 h-1 rounded-full bg-slate-600" />}
                            {pantryItems.size > 0 && <span>{pantryItems.size} har du hemma</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {pantryItems.size > 0 && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-sm">
                            Sparar pengar & miljö! 🌱
                        </span>
                    )}
                    <button
                        className={getCopyButtonClass()}
                        onClick={onCopy}
                        title="Kopiera listan"
                    >
                        {getCopyButtonContent()}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                {Object.entries(shoppingList).map(([storageType, items]) => {
                    const storageLabels: Record<string, string> = {
                        fresh: '🥬 Frukt & Grönt',
                        frozen: '❄️ Frys',
                        pantry: '🏠 Skafferi',
                    };
                    const filteredItems = items.filter(
                        item => !pantryItems.has(item.name.toLowerCase())
                    );

                    if (filteredItems.length === 0) return null;

                    return (
                        <div key={storageType} className="flex flex-col gap-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{storageLabels[storageType] || storageType}</h3>
                            <div className="flex flex-col gap-2">
                                {filteredItems.map((item, idx) => {
                                    const qty = formatQuantity ? formatQuantity(item) : '';
                                    const owned = pantryQuantities[item.name.toLowerCase()];
                                    return (
                                        <div
                                            key={idx}
                                            className="group flex items-center justify-between p-2.5 bg-slate-800/40 border border-transparent hover:border-cyan-500/30 hover:bg-slate-800/60 rounded-xl transition-all"
                                        >
                                            <div
                                                className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                                                onClick={(e) => handleNameClick(item, e)}
                                                title="Klicka för att se var och när ingrediensen används"
                                            >
                                                <span className="text-sm text-slate-200 font-medium pl-1 truncate hover:text-cyan-400 transition-colors">{item.name}</span>
                                                <div className="flex gap-1.5 whitespace-nowrap overflow-hidden">
                                                    {qty && (
                                                        <span className="text-[10px] text-slate-500 font-semibold">{qty}</span>
                                                    )}
                                                    {owned && (
                                                        <span className="text-[10px] text-emerald-500 font-semibold">
                                                            (Har: {owned.quantity})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                                                onClick={(e) => handleMarkOwned(item, e)}
                                                title="Markera som köpt (Shift+klick för mängd)"
                                            >
                                                ✓
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Har hemma section */}
                {(() => {
                    // Collect items with their storage type
                    const storageIcons: Record<string, string> = {
                        fresh: '🥬',
                        frozen: '❄️',
                        pantry: '🏠',
                    };
                    const ownedItemsWithType: Array<{ name: string; storageType: string }> = [];
                    Object.entries(shoppingList).forEach(([storageType, items]) => {
                        items.forEach(item => {
                            if (pantryItems.has(item.name.toLowerCase())) {
                                ownedItemsWithType.push({ name: item.name, storageType });
                            }
                        });
                    });

                    if (ownedItemsWithType.length === 0) return null;

                    return (
                        <div className="flex flex-col gap-3 opacity-60 hover:opacity-100 transition-opacity">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">✓ Har hemma</h3>
                            <div className="flex flex-col gap-2">
                                {ownedItemsWithType.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="group flex items-center justify-between p-2.5 bg-slate-800/20 border border-dashed border-slate-800 hover:border-slate-600 rounded-xl cursor-pointer transition-all"
                                        onClick={() => togglePantryItem(item.name.toLowerCase())}
                                    >
                                        <span className="text-sm text-slate-500 pl-1 flex items-center gap-2">
                                            <span className="opacity-50 text-xs">{storageIcons[item.storageType]}</span>
                                            <span className="line-through">{item.name}</span>
                                        </span>
                                        <span
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700/50 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200 transition-all"
                                        >
                                            ↩
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Quantity Input Modal */}
            {quantityInput && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setQuantityInput(null)}>
                    <div
                        className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold text-white mb-4">
                            Hur mycket {quantityInput.itemName} har du?
                        </h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="number"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-lg focus:outline-none focus:border-emerald-500"
                                placeholder="Mängd"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveQuantity();
                                    if (e.key === 'Escape') setQuantityInput(null);
                                }}
                            />
                            <span className="px-4 py-2 bg-slate-700 rounded-lg text-slate-300 font-medium">
                                {quantityInput.unit}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setQuantityInput(null)}
                                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl font-semibold transition-all"
                            >
                                Avbryt
                            </button>
                            <button
                                onClick={handleSaveQuantity}
                                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-semibold transition-all"
                            >
                                Spara
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ingredient Usage Modal */}
            {selectedItem && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedItem(null)}
                >
                    <div
                        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                🥦 {selectedItem.name}
                            </h2>
                            <button
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-xl"
                                onClick={() => setSelectedItem(null)}
                            >
                                ×
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {/* Total needed */}
                            <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                                <div className="text-sm text-slate-400">Totalt behov:</div>
                                <div className="text-xl font-bold text-cyan-400">
                                    {selectedItem.quantity} {selectedItem.unit}
                                </div>
                            </div>

                            {/* Usage breakdown */}
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                Används i {selectedItem.usages?.length || 0} recept
                            </h3>
                            <div className="flex flex-col gap-2">
                                {selectedItem.usages?.map((usage, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700"
                                    >
                                        <div>
                                            <div className="text-sm font-medium text-white">
                                                {usage.recipeName}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                📅 {WEEKDAY_LABELS[usage.day]} • {MEAL_TYPE_LABELS[usage.meal]}
                                            </div>
                                        </div>
                                        <div className="text-sm font-bold text-emerald-400">
                                            {usage.quantity} {usage.unit}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer - Har hemma button */}
                        <div className="p-4 border-t border-slate-700 bg-slate-800">
                            <button
                                onClick={() => {
                                    togglePantryItem(selectedItem.name.toLowerCase());
                                    setSelectedItem(null);
                                }}
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                ✓ Markera som "Har hemma"
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
