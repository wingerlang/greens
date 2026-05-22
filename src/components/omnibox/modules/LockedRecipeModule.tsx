import React from 'react';
import { Recipe, MealType } from '../../../models/types.ts';
import { ArrowRight, Utensils, Calendar, Minus, Plus } from 'lucide-react';
import { RecipeNutritionPreview } from '../../shared/RecipeNutritionPreview.tsx';

interface LockedRecipeModuleProps {
    lockedRecipe: Recipe & { 
        totals?: { calories: number, protein: number, carbs: number, fat: number }, 
        summary?: string,
        usageStats?: { count: number, lastUsed: string } | null
    };
    draftRecipeMealType: MealType | null;
    draftRecipeDate: string | null;
    draftRecipeServings: number;
    setDraftRecipeMealType: (type: MealType | null) => void;
    setDraftRecipeDate: (date: string | null) => void;
    setDraftRecipeServings: (servings: number) => void;
    setLockedRecipe: (recipe: any | null) => void;
    handleLockedRecipeAction: () => void;
}

export const LockedRecipeModule: React.FC<LockedRecipeModuleProps> = ({
    lockedRecipe,
    draftRecipeMealType,
    draftRecipeDate,
    draftRecipeServings,
    setDraftRecipeMealType,
    setDraftRecipeDate,
    setDraftRecipeServings,
    setLockedRecipe,
    handleLockedRecipeAction
}) => {
    // totals are already per-serving (computed in recipeResults)
    const perServingCal = lockedRecipe.totals?.calories || 0;
    const perServingProtein = lockedRecipe.totals?.protein || 0;
    const perServingCarbs = lockedRecipe.totals?.carbs || 0;
    const perServingFat = lockedRecipe.totals?.fat || 0;

    // Multiply by how many portions the user wants to log
    const displayCalories = Math.round(perServingCal * draftRecipeServings);
    const displayProtein = Math.round(perServingProtein * draftRecipeServings);
    const displayCarbs = Math.round(perServingCarbs * draftRecipeServings);
    const displayFat = Math.round(perServingFat * draftRecipeServings);

    const totalRecipeServings = lockedRecipe.servings || 1;
    const recipeTotalWeight = lockedRecipe.totalWeight || 0;
    const weightPerServing = recipeTotalWeight > 0 ? recipeTotalWeight / totalRecipeServings : 0;

    const [inputUnit, setInputUnit] = React.useState<'port' | 'g'>('port');

    // When the component opens, if NLP set draft servings that maps to a nice gram amount, 
    // or if the user typically logs in grams, we can let user toggle.

    const displayValue = inputUnit === 'g' && weightPerServing > 0 
        ? Math.round(draftRecipeServings * weightPerServing) 
        : Number(draftRecipeServings.toFixed(2));

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value === '' ? 1 : parseFloat(e.target.value);
        if (isNaN(val)) val = 1;
        if (val <= 0) val = 1;
        
        if (inputUnit === 'g' && weightPerServing > 0) {
            setDraftRecipeServings(val / weightPerServing);
        } else {
            setDraftRecipeServings(val);
        }
    };

    return (
        <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="px-3 py-2 bg-indigo-500/10 border-l-4 border-indigo-500 rounded-r-lg flex items-center gap-2">
                <span className="text-lg">📖</span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Logga Recept</span>
                <button
                    onClick={() => { setLockedRecipe(null); }}
                    className="ml-auto text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-white/10 px-2 py-0.5 rounded-full"
                >
                    ✕ Ångra
                </button>
            </div>

            {/* Recipe Display */}
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
                <div className="w-16 h-16 rounded-xl bg-indigo-500/20 flex items-center justify-center text-3xl">
                    📖
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white italic">{lockedRecipe.name}</h3>
                        {lockedRecipe.usageStats && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                {lockedRecipe.usageStats.count}x loggad
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        Receptet ger {totalRecipeServings} portioner
                    </div>
                </div>
            </div>

            {/* Editable Fields Row */}
            <div className="grid grid-cols-3 gap-3">
                {/* Quantity to log */}
                <div className="bg-slate-800/50 rounded-xl p-3 border border-indigo-500/20">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 block">Mängd</label>
                        {recipeTotalWeight > 0 && (
                            <button 
                                onClick={() => setInputUnit(prev => prev === 'g' ? 'port' : 'g')}
                                className="text-[10px] font-bold uppercase text-indigo-400 hover:text-indigo-300"
                            >
                                Byt till {inputUnit === 'g' ? 'portioner' : 'gram'}
                            </button>
                        )}
                    </div>
                    <div className="flex items-baseline gap-1">
                        <input
                            type="number"
                            value={displayValue || (displayValue === 0 ? '0' : '')}
                            onChange={handleValueChange}
                            className="w-full text-2xl font-black bg-transparent border-b-2 border-indigo-500/30 focus:border-indigo-400 outline-none text-white transition-colors"
                        />
                        <span className="text-sm font-bold text-slate-400">
                            {inputUnit === 'g' ? 'g' : 'port'}
                        </span>
                    </div>
                </div>

                {/* Meal Type */}
                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                    <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Måltid</label>
                    <div className="flex items-center gap-2">
                        <Utensils size={14} className="text-indigo-400" />
                        <select
                            value={draftRecipeMealType || ''}
                            onChange={(e) => setDraftRecipeMealType(e.target.value as MealType)}
                            className="w-full text-sm font-bold bg-transparent text-white outline-none cursor-pointer [&>option]:bg-slate-800"
                        >
                            <option value="">Auto</option>
                            <option value="breakfast">🌅 Frukost</option>
                            <option value="lunch">☀️ Lunch</option>
                            <option value="dinner">🌙 Middag</option>
                            <option value="evening_meal">🍵 Kvällsmål</option>
                            <option value="snack">🍎 Mellanmål</option>
                        </select>
                    </div>
                </div>

                {/* Date */}
                <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                    <label className="text-[10px] font-bold uppercase text-slate-500 mb-1 block">Datum</label>
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-indigo-400" />
                        <select
                            value={draftRecipeDate || ''}
                            onChange={(e) => setDraftRecipeDate(e.target.value || null)}
                            className="w-full text-sm font-bold bg-transparent text-white outline-none cursor-pointer [&>option]:bg-slate-800"
                        >
                            <option value={new Date().toISOString().split('T')[0]}>📅 Idag</option>
                            <option value={new Date(Date.now() - 86400000).toISOString().split('T')[0]}>⏪ Igår</option>
                            <option value={new Date(Date.now() + 86400000).toISOString().split('T')[0]}>⏩ Imorgon</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Shared Nutrition Preview Component */}
            <RecipeNutritionPreview
                servings={draftRecipeServings}
                totalCalories={perServingCal * totalRecipeServings}
                totalProtein={perServingProtein * totalRecipeServings}
                totalCarbs={perServingCarbs * totalRecipeServings}
                totalFat={perServingFat * totalRecipeServings}
                totalWeight={(lockedRecipe.totalWeight || 0)} // totalWeight is already the whole recipe weight? 
                recipeServings={totalRecipeServings}
            />

            {/* Action Button */}
            <button
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                onClick={handleLockedRecipeAction}
            >
                <span>Logga {inputUnit === 'g' ? `${displayValue}g` : `${draftRecipeServings === 1 ? '1 portion' : `${draftRecipeServings % 1 === 0 ? draftRecipeServings : draftRecipeServings.toFixed(1)} portioner`}`}</span>
                <ArrowRight size={18} />
            </button>
        </div>
    );
};
