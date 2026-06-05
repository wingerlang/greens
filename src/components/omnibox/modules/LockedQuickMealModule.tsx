import React from 'react';
import { MealType } from '../../../models/types.ts';
import { ArrowRight } from 'lucide-react';
import { NutritionLabel } from '../../shared/NutritionLabel.tsx';

interface LockedQuickMealModuleProps {
    lockedQuickMeal: any;
    draftQuickMealMealType: MealType | null;
    draftQuickMealDate: string | null;
    draftQuickMealPieces: number;
    setDraftQuickMealMealType: (type: MealType | null) => void;
    setDraftQuickMealDate: (date: string | null) => void;
    setDraftQuickMealPieces: (pieces: number) => void;
    setLockedQuickMeal: (meal: any | null) => void;
    handleSaveComboAsQuickMeal: (meal: any) => void;
    handleLockedQuickMealAction: () => void;
}

export const LockedQuickMealModule: React.FC<LockedQuickMealModuleProps> = ({
    lockedQuickMeal,
    draftQuickMealMealType,
    draftQuickMealDate,
    draftQuickMealPieces,
    setDraftQuickMealMealType,
    setDraftQuickMealDate,
    setDraftQuickMealPieces,
    setLockedQuickMeal,
    handleSaveComboAsQuickMeal,
    handleLockedQuickMealAction
}) => {
    return (
        <div className="p-4 space-y-4">
            <div className="px-3 py-2 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-lg flex items-center gap-2">
                <span className="text-lg">{lockedQuickMeal.itemType === 'savedEstimate' ? '🧮' : '⚡'}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Logga {lockedQuickMeal.itemType === 'savedEstimate' ? 'Estimering' : 'Snabbval'}</span>
                <button
                    onClick={() => { setLockedQuickMeal(null); setDraftQuickMealMealType(null); setDraftQuickMealDate(null); }}
                    className="ml-auto text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-white/10 px-2 py-0.5 rounded-full"
                >
                    ✕ Ångra
                </button>
            </div>

            {/* Quick Meal Display */}
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
                <div className="w-16 h-16 rounded-xl bg-amber-500/20 flex items-center justify-center text-3xl">
                    {lockedQuickMeal.itemType === 'savedEstimate' ? '🧮' : '⚡'}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">{lockedQuickMeal.name}</h3>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 truncate max-w-[200px] sm:max-w-xs">{lockedQuickMeal.summary}</div>
                    {lockedQuickMeal.usageStats && (
                        <div className="text-[10px] font-bold text-emerald-400 mt-1 uppercase tracking-wider">
                            🔄 Loggad {lockedQuickMeal.usageStats.count} ggr
                        </div>
                    )}
                </div>
            </div>

            {/* Editable Fields Row */}
            <div className="grid grid-cols-3 gap-3">
                {/* Antal */}
                <div className="bg-slate-800/50 rounded-xl p-3">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Antal</label>
                    <div className="flex items-center">
                        <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={draftQuickMealPieces || (draftQuickMealPieces === 0 ? '0' : '')}
                            onChange={(e) => {
                                let val = e.target.value === '' ? 1 : parseFloat(e.target.value);
                                if (isNaN(val) || val <= 0) val = 1;
                                setDraftQuickMealPieces(val);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleLockedQuickMealAction();
                                }
                            }}
                            className="w-full text-lg font-bold bg-transparent text-white outline-none"
                        />
                        <span className="text-sm font-bold text-slate-500 ml-1">st</span>
                    </div>
                </div>

                {/* Meal Type */}
                <div className="bg-slate-800/50 rounded-xl p-3">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Måltid</label>
                    <select
                        value={draftQuickMealMealType || ''}
                        onChange={(e) => setDraftQuickMealMealType(e.target.value as MealType)}
                        className="w-full text-lg font-bold bg-transparent text-white outline-none cursor-pointer [&>option]:bg-slate-800"
                    >
                        <option value="">Auto</option>
                        <option value="breakfast">🌅 Frukost</option>
                        <option value="lunch">☀️ Lunch</option>
                        <option value="dinner">🌙 Middag</option>
                        <option value="evening_meal">🍵 Kvällsmål</option>
                        <option value="snack">🍎 Mellanmål</option>
                        <option value="beverage">🥤 Dryck</option>
                    </select>
                </div>

                {/* Date */}
                <div className="bg-slate-800/50 rounded-xl p-3">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Datum</label>
                    <select
                        value={draftQuickMealDate || ''}
                        onChange={(e) => setDraftQuickMealDate(e.target.value || null)}
                        className="w-full text-lg font-bold bg-transparent text-white outline-none cursor-pointer [&>option]:bg-slate-800"
                    >
                        <option value={new Date().toISOString().split('T')[0]}>📅 Idag</option>
                        <option value={new Date(Date.now() - 86400000).toISOString().split('T')[0]}>⏪ Igår</option>
                        <option value={new Date(Date.now() + 86400000).toISOString().split('T')[0]}>⏩ Imorgon</option>
                        {draftQuickMealDate &&
                            draftQuickMealDate !== new Date().toISOString().split('T')[0] &&
                            draftQuickMealDate !== new Date(Date.now() - 86400000).toISOString().split('T')[0] &&
                            draftQuickMealDate !== new Date(Date.now() + 86400000).toISOString().split('T')[0] && (
                                <option value={draftQuickMealDate}>📅 {draftQuickMealDate}</option>
                            )}
                    </select>
                </div>
            </div>

            {/* Calculated Nutrients Preview */}
            {lockedQuickMeal.totals && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 rounded-xl">
                    <NutritionLabel
                        calories={(lockedQuickMeal.totals.calories || 0) * (draftQuickMealPieces || 1)}
                        protein={(lockedQuickMeal.totals.protein || 0) * (draftQuickMealPieces || 1)}
                        carbs={(lockedQuickMeal.totals.carbs || 0) * (draftQuickMealPieces || 1)}
                        fat={(lockedQuickMeal.totals.fat || 0) * (draftQuickMealPieces || 1)}
                        variant="compact"
                        size="md"
                    />
                    <div className="text-xs text-slate-500">
                        Totalt
                    </div>
                </div>
            )}

            {lockedQuickMeal.id.startsWith('combo-') && (
                <button
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl border border-amber-500/30 flex items-center justify-center gap-2 mb-2 transition-colors text-sm"
                    onClick={() => handleSaveComboAsQuickMeal(lockedQuickMeal)}
                >
                    <span>💾 Spara som snabbmål</span>
                </button>
            )}

            {/* Action Button */}
            <button
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                onClick={handleLockedQuickMealAction}
            >
                <span>Logga {lockedQuickMeal.itemType === 'savedEstimate' ? 'Estimering' : 'Snabbval'}</span>
                <ArrowRight size={16} />
            </button>

            {/* Hint for continuing to type */}
            <div className="text-center text-[10px] text-slate-500 mt-2">
                💡 Fortsätt skriva för att byta måltid (t.ex. "frukost igår")
            </div>
        </div>
    );
};
