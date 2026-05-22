import React from 'react';
import { FoodItem, MealType } from '../../../models/types.ts';
import { Info, ArrowRight } from 'lucide-react';
import { NutritionLabel } from '../../shared/NutritionLabel.tsx';
import { getCategoryEmoji, canLogAsCooked } from '../OmniboxConstants.ts';

interface LockedFoodModuleProps {
    lockedFood: FoodItem & { usageStats?: { count: number; avgGrams: number; lastUsed: string; frequentGrams?: number } };
    draftFoodQuantity: number | null;
    draftFoodMealType: MealType | null;
    draftFoodDate: string | null;
    draftLogAsCooked: boolean;
    setDraftFoodQuantity: (qty: number | null) => void;
    setDraftFoodMealType: (type: MealType | null) => void;
    setDraftFoodDate: (date: string | null) => void;
    setDraftLogAsCooked: (isCooked: boolean) => void;
    setLockedFood: (food: any | null) => void;
    handleLockedFoodAction: () => void;
    onOpenNutrition?: (item: any) => void;
    onClose: () => void;
    navigate: (path: string) => void;
}

export const LockedFoodModule: React.FC<LockedFoodModuleProps> = ({
    lockedFood,
    draftFoodQuantity,
    draftFoodMealType,
    draftFoodDate,
    draftLogAsCooked,
    setDraftFoodQuantity,
    setDraftFoodMealType,
    setDraftFoodDate,
    setDraftLogAsCooked,
    setLockedFood,
    handleLockedFoodAction,
    onOpenNutrition,
    onClose,
    navigate
}) => {
    return (
        <div className="p-4 space-y-4">
            <div className="px-3 py-2 bg-emerald-500/10 border-l-4 border-emerald-500 rounded-r-lg flex items-center gap-2">
                <span className="text-lg">{getCategoryEmoji(lockedFood.category)}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Logga Mat</span>
                <button
                    onClick={() => { setLockedFood(null); setDraftFoodQuantity(null); setDraftFoodMealType(null); setDraftFoodDate(null); }}
                    className="ml-auto text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-white/10 px-2 py-0.5 rounded-full"
                >
                    ✕ Ångra
                </button>
            </div>

            {/* Food Item Display */}
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
                <div className="w-16 h-16 rounded-xl bg-emerald-500/20 flex items-center justify-center text-3xl">
                    {getCategoryEmoji(lockedFood.category)}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">{lockedFood.name}</h3>
                        {lockedFood.brand && (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
                                {lockedFood.brand}
                            </span>
                        )}
                        <button
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 ml-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenNutrition) {
                                    onOpenNutrition({
                                        type: 'foodItem',
                                        referenceId: lockedFood.id,
                                        servings: draftFoodQuantity || 100 // Use draft quantity if set
                                    });
                                } else {
                                    navigate(`/calories?date=${new Date().toISOString().split('T')[0]}&breakdown=${lockedFood.id}`);
                                }
                                onClose();
                            }}
                            title="Mer info"
                        >
                            <Info size={16} />
                        </button>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                        <span className="uppercase">{lockedFood.category || 'Livsmedel'}</span>
                        {lockedFood.usageStats && (
                            <>
                                <span className="text-slate-600">•</span>
                                <span className="text-emerald-500/70">{lockedFood.usageStats.count}x loggad</span>
                                <span className="text-slate-600">•</span>
                                <span>snitt {Math.round(lockedFood.usageStats.avgGrams)}g</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Editable Fields Row */}
            <div className="grid grid-cols-3 gap-3">
                {/* Quantity */}
                <div className="bg-slate-800/50 rounded-xl p-3">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Mängd</label>
                    <div className="flex items-baseline gap-1">
                        <input
                            type="number"
                            value={draftFoodQuantity ?? ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                setDraftFoodQuantity(val === 0 ? 1 : val);
                            }}
                            className="w-full text-2xl font-black bg-transparent border-b-2 border-slate-600 focus:border-emerald-500 outline-none text-white"
                            placeholder={String(lockedFood.usageStats?.frequentGrams || lockedFood.usageStats?.avgGrams || 100)}
                        />
                        <span className="text-sm font-bold text-slate-400">g</span>
                    </div>
                    {!!lockedFood.defaultPortionGrams && (
                        <div className="text-[8px] text-emerald-500/60 mt-1 font-black uppercase tracking-tighter">
                            1 st = {lockedFood.defaultPortionGrams}g
                        </div>
                    )}
                </div>

                {/* Meal Type */}
                <div className="bg-slate-800/50 rounded-xl p-3">
                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Måltid</label>
                    <select
                        value={draftFoodMealType || ''}
                        onChange={(e) => setDraftFoodMealType(e.target.value as MealType)}
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
                        value={draftFoodDate || ''}
                        onChange={(e) => setDraftFoodDate(e.target.value || null)}
                        className="w-full text-lg font-bold bg-transparent text-white outline-none cursor-pointer [&>option]:bg-slate-800"
                    >
                        <option value={new Date().toISOString().split('T')[0]}>📅 Idag</option>
                        <option value={new Date(Date.now() - 86400000).toISOString().split('T')[0]}>⏪ Igår</option>
                        <option value={new Date(Date.now() + 86400000).toISOString().split('T')[0]}>⏩ Imorgon</option>
                        {draftFoodDate &&
                            draftFoodDate !== new Date().toISOString().split('T')[0] &&
                            draftFoodDate !== new Date(Date.now() - 86400000).toISOString().split('T')[0] &&
                            draftFoodDate !== new Date(Date.now() + 86400000).toISOString().split('T')[0] && (
                                <option value={draftFoodDate}>📅 {draftFoodDate}</option>
                            )}
                    </select>
                </div>
            </div>

            {/* Cooked Toggle - only show for cookable items */}
            {canLogAsCooked(lockedFood).canCook && (
                <button
                    type="button"
                    onClick={() => setDraftLogAsCooked(!draftLogAsCooked)}
                    className={`w-full py-3 rounded-xl flex items-center justify-center gap-3 font-bold text-sm transition-all ${draftLogAsCooked
                        ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/50'
                        : 'bg-slate-800/50 text-slate-400 border-2 border-transparent hover:bg-slate-700/50'
                        }`}
                >
                    <span className="text-2xl">🍳</span>
                    <span>{draftLogAsCooked ? 'Loggas som kokt vikt' : 'Logga som kokt?'}</span>
                    {draftLogAsCooked && (
                        <span className="text-xs bg-amber-500/30 px-2 py-0.5 rounded-full">
                            kcal ÷ {canLogAsCooked(lockedFood).effectiveYieldFactor}
                        </span>
                    )}
                </button>
            )}

            {/* Calculated Nutrients Preview */}
            {(() => {
                const qty = draftFoodQuantity ?? 100;
                const { canCook, effectiveYieldFactor } = canLogAsCooked(lockedFood);
                const isCooked = draftLogAsCooked && canCook;
                const multiplier = isCooked ? 1 / effectiveYieldFactor : 1;
                return (
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 rounded-xl">
                        <NutritionLabel
                            calories={lockedFood.calories * qty / 100 * multiplier}
                            protein={lockedFood.protein * qty / 100 * multiplier}
                            carbs={(lockedFood.carbs || 0) * qty / 100 * multiplier}
                            variant="compact"
                            size="md"
                        />
                        <div className="text-xs text-slate-500">
                            {isCooked ? `för ${qty}g kokt` : `för ${qty}g`}
                        </div>
                    </div>
                );
            })()}

            {/* Action Button */}
            <button
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                onClick={handleLockedFoodAction}
            >
                <span>Logga {lockedFood.name}</span>
                <ArrowRight size={16} />
            </button>

            {/* View Details & History Link */}
            <button
                onClick={() => {
                    navigate(`/database?id=${lockedFood.id}`);
                    onClose();
                }}
                className="w-full py-2 text-center text-slate-400 hover:text-white text-xs underline underline-offset-4"
            >
                📋 Visa alla detaljer & logghistorik →
            </button>

            {/* Hint for continuing to type */}
            <div className="text-center text-[10px] text-slate-500">
                💡 Fortsätt skriva för att ändra mängd, måltid eller datum (t.ex. "120g mellanmål igår")
            </div>
        </div>
    );
};
