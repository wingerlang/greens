import React, { useState } from 'react';
import { ShoppingItem } from '../hooks/useShoppingList.ts';

interface ShoppingListViewProps {
    shoppingList: Record<string, ShoppingItem[]>;
    pantryItems: Set<string>;
    togglePantryItem: (item: string) => void;
    totalItems: number;
    onCopy: () => Promise<boolean>;
    copyStatus?: 'idle' | 'copied' | 'error';
    formatQuantity?: (item: ShoppingItem) => string;
}

export function ShoppingListView({
    shoppingList,
    pantryItems,
    togglePantryItem,
    totalItems,
    onCopy,
    copyStatus = 'idle',
    formatQuantity
}: ShoppingListViewProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (totalItems === 0 && Object.values(shoppingList).every(l => l.length === 0)) {
        return null;
    }

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
                                    return (
                                        <div
                                            key={idx}
                                            className="group flex items-center justify-between p-2.5 bg-slate-800/40 border border-transparent hover:border-emerald-500/30 hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
                                            onClick={() => togglePantryItem(item.name.toLowerCase())}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm text-slate-200 font-medium pl-1">{item.name}</span>
                                                {qty && (
                                                    <span className="text-xs text-slate-500 pl-1">{qty}</span>
                                                )}
                                            </div>
                                            <span
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all"
                                            >
                                                ✓
                                            </span>
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
        </section>
    );
}
