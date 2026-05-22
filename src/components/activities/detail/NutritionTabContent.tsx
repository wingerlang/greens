import React, { useState, useMemo } from 'react';
import { 
    type MealEntry, 
    type MealItem, 
    type FoodItem, 
    type RecipeWithNutrition, 
    type MealType, 
    type TrainingNutritionDetails,
    generateId,
    getISODate
} from '../../../models/types.ts';
import { 
    Zap, 
    Plus, 
    Trash2, 
    Clock, 
    Check, 
    Search, 
    Dumbbell, 
    Coffee, 
    GlassWater 
} from 'lucide-react';
import { normalizeText } from '../../../utils/formatters.ts';

interface NutritionTabContentProps {
    activityId: string;
    activityDate: string;
    mealEntries: MealEntry[];
    foodItems: FoodItem[];
    recipes: RecipeWithNutrition[];
    addMealEntry: (entry: Omit<MealEntry, 'id' | 'createdAt'>) => void;
    deleteMealEntry: (id: string) => void;
    updateMealEntry: (id: string, data: Partial<MealEntry>) => void;
    activityCalories?: number;
}

export function NutritionTabContent({
    activityId,
    activityDate,
    mealEntries,
    foodItems,
    recipes,
    addMealEntry,
    deleteMealEntry,
    updateMealEntry,
    activityCalories = 0
}: NutritionTabContentProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [selectedTiming, setSelectedTiming] = useState<'before' | 'during' | 'after'>('during');

    const activityMeals = useMemo(() => {
        return mealEntries.filter(m => m.trainingNutrition?.activityId === activityId);
    }, [mealEntries, activityId]);

    const searchResults = useMemo(() => {
        const query = normalizeText(searchQuery);
        if (!query) return [];

        const recipeResults = recipes
            .filter(r => normalizeText(r.name).includes(query))
            .slice(0, 5)
            .map(r => ({ type: 'recipe' as const, id: r.id, name: r.name, calories: r.nutritionPerServing?.calories || 0 }));

        const foodResults = foodItems
            .filter(f => normalizeText(f.name).includes(query))
            .slice(0, 5)
            .map(f => ({ type: 'foodItem' as const, id: f.id, name: f.name, calories: f.calories || 0 }));

        return [...recipeResults, ...foodResults];
    }, [searchQuery, recipes, foodItems]);

    const handleAddNutrition = (item: { type: 'recipe' | 'foodItem', id: string, name: string }) => {
        const mealItem: MealItem = {
            type: item.type,
            referenceId: item.id,
            servings: item.type === 'recipe' ? 1 : 100, // Default 1 portion or 100g
        };

        addMealEntry({
            date: activityDate.split('T')[0],
            mealType: 'training_nutrition',
            items: [mealItem],
            title: `⚡ ${item.name}`,
            trainingNutrition: {
                activityId,
                timing: selectedTiming
            }
        });

        setIsAdding(false);
        setSearchQuery('');
    };

    const timingLabels = {
        before: 'Före pass',
        during: 'Under pass',
        after: 'Efter pass'
    };

    const totals = useMemo(() => {
        let calories = 0;
        let protein = 0;
        let carbs = 0;

        activityMeals.forEach(meal => {
            meal.items.forEach(item => {
                if (item.type === 'foodItem') {
                    const food = foodItems.find(f => f.id === item.referenceId);
                    if (food) {
                        const ratio = (item.servings || 0) / 100;
                        calories += (food.calories || 0) * ratio;
                        protein += (food.protein || 0) * ratio;
                        carbs += (food.carbs || 0) * ratio;
                    }
                } else if (item.type === 'recipe') {
                    const recipe = recipes.find(r => r.id === item.referenceId);
                    if (recipe && recipe.nutritionPerServing) {
                        const ratio = (item.servings || 0);
                        calories += (recipe.nutritionPerServing.calories || 0) * ratio;
                        protein += (recipe.nutritionPerServing.protein || 0) * ratio;
                        carbs += (recipe.nutritionPerServing.carbs || 0) * ratio;
                    }
                }
            });
        });

        return { calories, protein, carbs };
    }, [activityMeals, foodItems, recipes]);

    const intakePercentage = activityCalories > 0 ? (totals.calories / activityCalories) * 100 : 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 flex flex-wrap gap-10 items-center">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                        <Zap size={32} />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Pass-Energi</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{Math.round(totals.calories)}</span>
                            <span className="text-xs font-bold text-slate-500 uppercase">kcal</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-10">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Kolhydrater</span>
                        <span className="text-lg font-black text-slate-200">{Math.round(totals.carbs)}g</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Protein</span>
                        <span className="text-lg font-black text-slate-200">{Math.round(totals.protein)}g</span>
                    </div>
                    {activityCalories > 0 && (
                        <div className="flex flex-col border-l border-white/10 pl-10">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Bränsle-grad</span>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-lg font-black ${intakePercentage > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {intakePercentage.toFixed(0)}%
                                </span>
                                <span className="text-[10px] font-bold text-slate-600 uppercase">av förbränning</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Coffee size={16} className="text-slate-400" /> Loggade måltider
                </h3>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-[10px] font-black uppercase bg-fuchsia-500 text-white px-3 py-1.5 rounded-lg hover:bg-fuchsia-400 transition-all flex items-center gap-1.5"
                    >
                        <Plus size={14} /> Lägg till
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="bg-slate-900/50 border border-fuchsia-500/30 rounded-2xl p-4 space-y-4 animate-in zoom-in-95">
                    <div className="flex items-center gap-2">
                        {(['before', 'during', 'after'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setSelectedTiming(t)}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedTiming === t 
                                    ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20' 
                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                            >
                                {timingLabels[t]}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            autoFocus
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Sök gel, sportdryck, banan..."
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:border-fuchsia-500/50 outline-none transition-all"
                        />
                    </div>

                    {searchResults.length > 0 && (
                        <div className="space-y-1">
                            {searchResults.map(result => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleAddNutrition(result)}
                                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/50 hover:bg-fuchsia-500/10 border border-white/5 hover:border-fuchsia-500/30 transition-all group"
                                >
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-slate-200 group-hover:text-fuchsia-400">{result.name}</p>
                                        <p className="text-[10px] text-slate-500 font-mono">{result.calories} kcal</p>
                                    </div>
                                    <Plus size={16} className="text-slate-600 group-hover:text-fuchsia-400" />
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => setIsAdding(false)}
                        className="w-full py-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        Avbryt
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {activityMeals.length === 0 && !isAdding ? (
                    <div className="text-center py-12 bg-slate-900/20 rounded-3xl border border-dashed border-white/5">
                        <div className="bg-slate-800/50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-600">
                            <Coffee size={24} />
                        </div>
                        <p className="text-sm font-bold text-slate-400">Ingen nutrition loggad för detta pass</p>
                        <p className="text-xs text-slate-600 mt-1">Logga gel, sportdryck eller återhämtning här.</p>
                    </div>
                ) : (
                    activityMeals.map(meal => (
                        <div key={meal.id} className="group relative bg-slate-900/40 border border-white/5 rounded-2xl p-4 hover:border-fuchsia-500/30 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                        meal.trainingNutrition?.timing === 'before' ? 'bg-amber-500/10 text-amber-500' :
                                        meal.trainingNutrition?.timing === 'during' ? 'bg-fuchsia-500/10 text-fuchsia-500' :
                                        'bg-emerald-500/10 text-emerald-500'
                                    }`}>
                                        {meal.trainingNutrition?.timing === 'before' ? <Clock size={20} /> :
                                         meal.trainingNutrition?.timing === 'during' ? <Zap size={20} /> :
                                         <Check size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                {timingLabels[meal.trainingNutrition?.timing || 'during']}
                                            </span>
                                            <span className="text-[10px] text-slate-700 font-mono">
                                                {new Date(meal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-black text-white">{meal.title?.replace('⚡ ', '')}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            {meal.items.map((item, idx) => (
                                                <span key={idx} className="text-[10px] text-slate-400 font-medium">
                                                    {item.servings}{item.type === 'foodItem' ? 'g' : ' st'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => deleteMealEntry(meal.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Quick Presets for common training fuel */}
            {!isAdding && (
                <div className="pt-4 border-t border-white/5">
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-3">Snabbval</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { name: 'Gel', icon: '⚡', id: 'gel' },
                            { name: 'Sportdryck', icon: '🥤', id: 'drink' },
                            { name: 'Banan', icon: '🍌', id: 'banana' },
                            { name: 'Återhämtning', icon: '🥛', id: 'recovery' }
                        ].map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    setSearchQuery(preset.name);
                                    setIsAdding(true);
                                }}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-900/40 border border-white/5 hover:border-white/20 transition-all group"
                            >
                                <span className="text-xl group-hover:scale-110 transition-transform">{preset.icon}</span>
                                <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-slate-200">{preset.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
