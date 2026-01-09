import React from 'react';
import { Coffee } from 'lucide-react';
import type { CaffeineCardProps } from '../dashboard.types.ts';

/**
 * Caffeine intake tracking card.
 * Shows current caffeine in mg with quick-add buttons for coffee and energy drinks.
 */
export const CaffeineCard = ({
    density,
    caffeineLimit,
    currentCaffeine,
    isEditing,
    tempValue,
    onCardClick,
    onValueChange,
    onSave,
    onCancel,
    onKeyDown,
    onQuickAdd
}: CaffeineCardProps) => {
    const isCaffHigh = currentCaffeine >= caffeineLimit;
    const isCaffWarning = !isCaffHigh && currentCaffeine >= caffeineLimit * 0.7;

    const handleQuickAdd = (amount: number, type: 'coffee' | 'nocco') => {
        onQuickAdd(amount, type);
        onSave(); // Close editing mode
    };

    return (
        <div
            onClick={onCardClick}
            className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm hover:scale-[1.02] transition-all cursor-pointer overflow-hidden relative ${isCaffHigh ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' : isCaffWarning ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
        >
            <Coffee className="absolute -bottom-4 -right-4 w-24 h-24 text-amber-500/5 dark:text-amber-400/10 pointer-events-none transform -rotate-12 transition-all group-hover:scale-110" />

            <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'}`}>
                <div className={`p-1.5 rounded-full ${isCaffHigh ? 'bg-rose-100 text-rose-600' : isCaffWarning ? 'bg-amber-100 text-amber-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                    <Coffee className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Koffein</span>
            </div>
            <div className="flex-1">
                {isEditing ? (
                    <div className="flex flex-col gap-2 pt-1" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-baseline gap-1">
                                <input
                                    autoFocus
                                    type="number"
                                    value={tempValue}
                                    onChange={(e) => onValueChange(e.target.value)}
                                    // Removed onBlur={onSave} to avoid double-firing with cancel button
                                    onKeyDown={onKeyDown}
                                    className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-lg font-bold text-slate-900 dark:text-white p-1 w-16 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Mg</span>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSave(); }}
                                    className="p-1 px-2 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600 transition-colors"
                                >
                                    Spara
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
                                    className="p-1 px-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Avbryt
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(80, 'coffee'); }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">+☕</button>
                            <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(180, 'nocco'); }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors">+🥤</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline gap-1">
                            <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${isCaffHigh ? 'text-rose-600' : isCaffWarning ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{currentCaffeine}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Mg</span>
                        </div>
                        <div className={`mt-2 flex gap-1 ${density === 'compact' || density === 'slim' ? 'opacity-0 h-0 hidden' : 'opacity-100'}`}>
                            <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(80, 'coffee'); }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">+☕</button>
                            <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(180, 'nocco'); }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors">+🥤</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
