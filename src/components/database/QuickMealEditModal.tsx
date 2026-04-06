import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { QuickMeal, MealItem } from '../../models/types.ts';
import { useData } from '../../context/DataContext.tsx';

interface QuickMealEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    quickMeal: QuickMeal;
}

export const QuickMealEditModal: React.FC<QuickMealEditModalProps> = ({
    isOpen,
    onClose,
    quickMeal
}) => {
    const { foodItems, recipes, updateQuickMeal } = useData();
    const [name, setName] = useState(quickMeal.name);
    const [items, setItems] = useState<MealItem[]>(quickMeal.items);

    const handleSave = () => {
        updateQuickMeal(quickMeal.id, { name, items });
        onClose();
    };

    const updateItemServings = (index: number, servings: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], servings };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const getItemName = (item: MealItem) => {
        if (item.type === 'foodItem') {
            return foodItems.find(f => f.id === item.referenceId)?.name || 'Okänd råvara';
        } else if (item.type === 'recipe') {
            return recipes.find(r => r.id === item.referenceId)?.name || 'Okänt recept';
        } else {
            return item.estimateDetails?.name || 'Uppskattning';
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Redigera Snabbval">
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Namn</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                </div>

                <div className="space-y-3">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500">Innehåll</label>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {items.map((item, index) => (
                            <div key={index} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-white/5">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-slate-200 truncate">{getItemName(item)}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-black">{item.type}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={item.servings}
                                        onChange={(e) => updateItemServings(index, Number(e.target.value))}
                                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-sm text-white font-mono"
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{item.type === 'foodItem' ? 'g' : 'port'}</span>
                                    <button
                                        onClick={() => removeItem(index)}
                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-xl transition-all"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                    >
                        Spara ändringar
                    </button>
                </div>
            </div>
        </Modal>
    );
};
