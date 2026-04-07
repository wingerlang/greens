import React, { useState, useEffect } from 'react';
import { ShoppingCart, Package, Info, Calculator } from 'lucide-react';
import { type FoodItem, type Unit, type PurchaseLog } from '../../../models/types.ts';
import { getCategoryEmoji } from '../OmniboxConstants.ts';

interface PurchaseModuleProps {
    intent: any;
    lockedFood: FoodItem | null;
    results: any[];
    selectedIndex: number;
    selectableItems: any[];
    onSelectFood: (food: FoodItem | null) => void;
    onLogPurchase: (data: Omit<PurchaseLog, 'id' | 'userId'>) => void;
}

export const PurchaseModule: React.FC<PurchaseModuleProps> = ({
    intent,
    lockedFood,
    results,
    selectedIndex,
    selectableItems,
    onSelectFood,
    onLogPurchase
}) => {
    // Draft states for refinement
    const [price, setPrice] = useState<number | undefined>(intent.data.price);
    const [packageSize, setPackageSize] = useState<number>(intent.data.packageSize || 1);
    const [quantity, setQuantity] = useState<number>(intent.data.quantity || 1);
    const [unit, setUnit] = useState<Unit>(intent.data.unit || 'g');
    const [store, setStore] = useState<string>('');
    const [date, setDate] = useState<string>(intent.date || new Date().toISOString().split('T')[0]);

    // Update local drafts if intent changes (and not manually edited)
    useEffect(() => {
        setPrice(intent.data.price);
        setPackageSize(intent.data.packageSize || lockedFood?.packageWeight || 1);
        setQuantity(intent.data.quantity || 1);
        setUnit(intent.data.unit || lockedFood?.unit || 'g');
        setDate(intent.date || new Date().toISOString().split('T')[0]);
    }, [intent.data, intent.date, lockedFood]);

    if (!lockedFood) {
        return (
            <div className="px-2 py-2">
                <div className="px-3 py-2 mb-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-400 text-sm">
                        <ShoppingCart size={16} />
                        <span className="font-bold">Logga inköp</span>
                        <span className="text-slate-400">Välj råvara nedan för att registrera köp</span>
                    </div>
                </div>

                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span>🔍</span> Matchande råvaror ({results.length})
                </div>

                {results.map((item, idx) => {
                    // Calculate global index for keyboard nav if needed
                    // In purchase mode, only purchaseResults are selectable
                    const isSelected = idx === selectedIndex;

                    return (
                        <div
                            key={item.id}
                            onClick={() => onSelectFood(item)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${isSelected
                                ? 'bg-blue-500/20 text-blue-400'
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
                                    <div className="text-[10px] text-slate-500 flex items-center gap-2 uppercase tracking-wide">
                                        {item.category || 'Övrigt'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {results.length === 0 && (
                    <div className="px-3 py-4 text-slate-500 italic text-sm text-center">
                        Inga exakta matchningar. Tryck ESC och sök efter råvaran först om den inte finns.
                    </div>
                )}
            </div>
        );
    }

    const totalQuantity = (quantity || 1) * (packageSize || 1);
    const unitPrice = price ? (price / totalQuantity) : 0;
    const displayUnitPrice = unit === 'kg' || unit === 'l' 
        ? `${unitPrice.toFixed(2)} kr/${unit}` 
        : unit === 'g' || unit === 'ml'
            ? `${(unitPrice * 1000).toFixed(2)} kr/kg`
            : `${unitPrice.toFixed(2)} kr/st`;

    return (
        <div className="p-4 space-y-4">
            {/* Header / Locked Food */}
            <div className="flex items-center gap-3 bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl">
                    {getCategoryEmoji(lockedFood.category)}
                </div>
                <div>
                    <div className="font-bold text-blue-400">{lockedFood.name}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide">{lockedFood.brand || lockedFood.category || 'Råvara'}</div>
                </div>
                <button 
                    onClick={() => onSelectFood(null)}
                    className="ml-auto text-slate-500 hover:text-white text-xs"
                >
                    Ändra
                </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Pris (SEK)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={price || ''}
                            onChange={(e) => setPrice(parseFloat(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="0"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">KR</div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                        {unit === 'pcs' ? 'Antal förp.' : 'Antal'}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(parseFloat(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">ST</div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                        {unit === 'pcs' ? 'Per förp. (st)' : 'Förp. storlek'}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={packageSize}
                            onChange={(e) => setPackageSize(parseFloat(e.target.value))}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <select 
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as Unit)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                        >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="ml">ml</option>
                            <option value="l">l</option>
                            <option value="pcs">st</option>
                        </select>
                    </div>
                    {/* Common Sizes Quick Select */}
                    {lockedFood.commonPackageSizes && lockedFood.commonPackageSizes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {[lockedFood.packageWeight, ...lockedFood.commonPackageSizes]
                                .filter((s): s is number => !!s)
                                .filter((s, i, arr) => arr.indexOf(s) === i)
                                .map(size => (
                                    <button
                                        key={size}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // Prevent stealing focus from Omnibox
                                            setPackageSize(size);
                                        }}
                                        className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${
                                            packageSize === size 
                                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                                                : 'bg-slate-800 border-white/5 text-slate-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                    >
                                        {size}{unit}
                                    </button>
                                ))
                            }
                        </div>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Butik (valfritt)</label>
                    <input
                        type="text"
                        value={store}
                        onChange={(e) => setStore(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="t.ex. Ica, Lidl..."
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Datum</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && price && price > 0) {
                                onLogPurchase({
                                    foodItemId: lockedFood!.id,
                                    price: price,
                                    quantity,
                                    packageSize,
                                    unit,
                                    store: store || undefined,
                                    date
                                });
                            }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                </div>
            </div>

            {/* Summary / Calculation */}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Calculator size={14} className="text-blue-500/70" />
                        <span>Beräknat jämförpris:</span>
                    </div>
                    <div className="text-lg font-bold text-white">
                        {displayUnitPrice}
                    </div>
                </div>
                <div className="text-[10px] text-slate-500 text-right mt-1">
                    {quantity > 1 ? `${quantity} x ${packageSize}${unit} = ` : ''} Totalt {totalQuantity}{unit} för {price || 0} kr
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                <button
                    onClick={() => onSelectFood(null)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all"
                >
                    Avbryt
                </button>
                <button
                    onClick={() => {
                        onLogPurchase({
                            foodItemId: lockedFood.id,
                            price: price || 0,
                            quantity,
                            packageSize,
                            unit,
                            store: store || undefined,
                            date
                        });
                    }}
                    disabled={!price}
                    className={`flex-[2] py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                        price 
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    <ShoppingCart size={18} />
                    Spara inköp
                </button>
            </div>
        </div>
    );
};
