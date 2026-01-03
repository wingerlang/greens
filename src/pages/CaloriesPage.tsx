import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type MealType,
    type MealItem,
    type MealEntry,
    type PlannedMeal,
    getISODate,
} from '../models/types.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import { calculateAdaptiveGoals } from '../utils/performanceEngine.ts';
import { MacroSummary } from '../components/calories/MacroSummary.tsx';
import { MealTimeline } from '../components/calories/MealTimeline.tsx';
import { QuickAddModal } from '../components/calories/QuickAddModal.tsx';
import { NutritionBreakdownModal } from '../components/calories/NutritionBreakdownModal.tsx';
import { NutritionInsights } from '../components/calories/NutritionInsights.tsx';
import { MacroDistribution } from '../components/calories/MacroDistribution.tsx';
import { normalizeText } from '../utils/formatters.ts';
import { DatePicker } from '../components/shared/DatePicker.tsx';
import './CaloriesPage.css';

export function CaloriesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        foodItems,
        recipes,
        mealEntries,
        addMealEntry,
        updateMealEntry,
        deleteMealEntry,
        getMealEntriesForDate,
        updateVitals,
        calculateDailyNutrition,
        getRecipeWithNutrition,
        getFoodItem,
        getPlannedMealsForDate,
        getExercisesForDate,
        getVitalsForDate,
    } = useData();

    const { settings } = useSettings();

    // Initialize from URL or default to today
    const urlDate = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState(urlDate || getISODate());

    // Sync URL when date changes
    useEffect(() => {
        const current = searchParams.get('date');
        if (current !== selectedDate) {
            setSearchParams({ date: selectedDate });
        }
    }, [selectedDate, searchParams, setSearchParams]);

    const [isFormOpen, setIsFormOpen] = useState(false);

    // Smart meal type default based on time of day
    const getDefaultMealType = (): MealType => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 10) return 'breakfast';
        if (hour >= 10 && hour < 14) return 'lunch';
        if (hour >= 14 && hour < 20) return 'dinner';
        return 'snack';
    };

    const [mealType, setMealType] = useState<MealType>(getDefaultMealType());
    const [viewMode, setViewMode] = useState<'normal' | 'compact'>('compact');

    // Quick-add state
    const [searchQuery, setSearchQuery] = useState('');
    const [quickAddServings, setQuickAddServings] = useState(1);
    const [portionMode] = useState<'portions' | 'st' | 'grams'>('portions');

    // Nutrition breakdown modal state
    const [breakdownItem, setBreakdownItem] = useState<MealItem | null>(null);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const dailyEntries = useMemo(
        () => getMealEntriesForDate(selectedDate),
        [getMealEntriesForDate, selectedDate]
    );

    const dailyExercises = useMemo(
        () => getExercisesForDate(selectedDate),
        [getExercisesForDate, selectedDate]
    );

    // Vitals local state
    const currentVitals = useMemo(() => getVitalsForDate(selectedDate), [getVitalsForDate, selectedDate]);
    const [editing, setEditing] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");

    const handleCardClick = (type: string, currentValue: number) => {
        setEditing(type);
        setTempValue(currentValue.toString());
    };

    const handleSave = (type: string) => {
        const val = parseFloat(tempValue);
        if (!isNaN(val)) {
            updateVitals(selectedDate, { [type]: val });
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, type: string) => {
        if (e.key === 'Enter') handleSave(type);
        if (e.key === 'Escape') setEditing(null);
    };

    const dailyNutrition = useMemo(
        () => calculateDailyNutrition(selectedDate),
        [calculateDailyNutrition, selectedDate]
    );

    const entriesByMeal = useMemo(() => {
        const grouped: Record<MealType, MealEntry[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
            beverage: [],
        };
        dailyEntries.forEach((entry: MealEntry) => {
            grouped[entry.mealType].push(entry);
        });
        return grouped;
    }, [dailyEntries]);

    const searchResults = useMemo(() => {
        // normalizeText imported from utils/formatters.ts
        const query = normalizeText(searchQuery);
        if (!query) return [];

        const recipeResults = recipes
            .filter(r => normalizeText(r.name).includes(query))
            .slice(0, 5)
            .map(r => ({ type: 'recipe' as const, id: r.id, name: r.name, subtitle: `${r.servings} portioner` }));

        const foodResults = foodItems
            .filter(f => normalizeText(f.name).includes(query))
            .slice(0, 5)
            .map(f => ({
                type: 'foodItem' as const,
                id: f.id,
                name: f.name,
                subtitle: `${f.calories} kcal/100g`,
                defaultPortion: f.defaultPortionGrams
            }));

        return [...recipeResults, ...foodResults].slice(0, 8);
    }, [searchQuery, recipes, foodItems]);

    const proposals = useMemo(() => {
        const counts: Record<string, { type: 'recipe' | 'foodItem'; id: string; count: number; lastUsed: number }> = {};

        // Analyze last 30 days of entries (or all for simplicity)
        mealEntries.forEach(entry => {
            const time = new Date(entry.createdAt || entry.date).getTime();
            entry.items.forEach(item => {
                const key = `${item.type}-${item.referenceId}`;
                if (!counts[key]) {
                    counts[key] = { type: item.type, id: item.referenceId, count: 0, lastUsed: time };
                }
                counts[key].count++;
                counts[key].lastUsed = Math.max(counts[key].lastUsed, time);
            });
        });

        return Object.values(counts)
            .sort((a, b) => {
                // Combine frequency and recency
                // Score = count * factor + recency_bonus
                const aRecency = a.lastUsed;
                const bRecency = b.lastUsed;
                if (a.count !== b.count) return b.count - a.count;
                return bRecency - aRecency;
            })
            .slice(0, 10)
            .map(p => {
                if (p.type === 'recipe') {
                    const r = recipes.find(rec => rec.id === p.id);
                    return { type: 'recipe' as const, id: p.id, name: r?.name || 'Okänt recept', subtitle: 'Ofta använd' };
                } else {
                    const f = foodItems.find(fi => fi.id === p.id);
                    return { type: 'foodItem' as const, id: p.id, name: f?.name || 'Okänd råvara', subtitle: 'Ofta använd', defaultPortion: f?.defaultPortionGrams };
                }
            });
    }, [mealEntries, recipes, foodItems]);

    const handleQuickAdd = (type: 'recipe' | 'foodItem', id: string, defaultPortion?: number) => {
        let servingsValue = quickAddServings;

        if (type === 'foodItem') {
            if (portionMode === 'st' && defaultPortion) {
                servingsValue = defaultPortion * quickAddServings;
            } else if (portionMode === 'grams') {
                servingsValue = quickAddServings;
            } else {
                // Default 'portions' mode for food items
                // Use defaultPortion if available, otherwise assume 100g serving
                servingsValue = (defaultPortion || 100) * quickAddServings;
            }
        }

        addMealEntry({
            date: selectedDate,
            mealType,
            items: [{
                type,
                referenceId: id,
                servings: servingsValue,
            }],
        });

        setSearchQuery('');
        setQuickAddServings(1);
    };

    const handleDeleteEntry = (id: string) => {
        if (confirm('Ta bort denna måltid?')) {
            deleteMealEntry(id);
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === dailyEntries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(dailyEntries.map(e => e.id)));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Ta bort ${selectedIds.size} markerade måltider?`)) return;

        selectedIds.forEach(id => deleteMealEntry(id));
        setSelectedIds(new Set());
    };

    const getItemName = (item: MealItem): string => {
        if (item.type === 'recipe') {
            const recipe = recipes.find(r => r.id === item.referenceId);
            return recipe?.name || 'Okänt recept';
        } else {
            const food = foodItems.find(f => f.id === item.referenceId);
            return food?.name || 'Okänd råvara';
        }
    };

    const getItemCalories = (item: MealItem): number => {
        if (item.type === 'recipe') {
            const recipe = recipes.find(r => r.id === item.referenceId);
            if (recipe?.ingredientsText) {
                const estimate = calculateRecipeEstimate(recipe.ingredientsText, foodItems);
                return Math.round((estimate.calories / recipe.servings) * item.servings);
            }
            const recipeWithNutrition = getRecipeWithNutrition(item.referenceId);
            if (recipeWithNutrition) {
                return Math.round(recipeWithNutrition.nutritionPerServing.calories * item.servings);
            }
        } else {
            const food = getFoodItem(item.referenceId);
            if (food) {
                return Math.round(food.calories * (item.servings / 100));
            }
        }
        return 0;
    };

    const navigateDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(getISODate(date));
    };

    const isToday = selectedDate === getISODate();

    const plannedMeals = useMemo(
        () => getPlannedMealsForDate(selectedDate),
        [getPlannedMealsForDate, selectedDate]
    );

    const unloggedPlannedMeals = useMemo(() => {
        return plannedMeals.filter((pm: { mealType: MealType, meal: PlannedMeal }) => {
            const alreadyLogged = dailyEntries.some((entry: MealEntry) =>
                entry.mealType === pm.mealType &&
                entry.items.some((item: MealItem) => item.referenceId === pm.meal.recipeId)
            );
            return !alreadyLogged;
        });
    }, [plannedMeals, dailyEntries]);

    const handleLogPlannedMeal = (mType: MealType, recipeId: string) => {
        addMealEntry({
            date: selectedDate,
            mealType: mType,
            items: [{
                type: 'recipe',
                referenceId: recipeId,
                servings: 1,
            }],
        });
    };

    const handleLogAllPlanned = () => {
        unloggedPlannedMeals.forEach((pm: { mealType: MealType, meal: PlannedMeal }) => {
            handleLogPlannedMeal(pm.mealType, pm.meal.recipeId!);
        });
    };

    const goals = useMemo(() => {
        return calculateAdaptiveGoals(settings as any, dailyExercises);
    }, [settings, dailyExercises]);

    const [showInsights, setShowInsights] = useState(false);

    return (
        <div className="calories-page">
            <header className="page-header">
                <div>
                    <h1>Kalorier</h1>
                    <p className="page-subtitle">Logga måltider och följ dina makron</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`btn ${showInsights ? 'btn-primary' : 'btn-secondary'} btn-sm shadow-sm`}
                        onClick={() => setShowInsights(!showInsights)}
                    >
                        {showInsights ? '📉 Dölj Insikter' : '📈 Visa Trender'}
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>
                        + Logga måltid
                    </button>
                </div>
            </header>

            <div className="flex justify-center gap-2 mb-4">
                <button
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'compact' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                    onClick={() => setViewMode('compact')}
                >
                    📊 Kompakt
                </button>
                <button
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'normal' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                    onClick={() => setViewMode('normal')}
                >
                    📋 Detaljerad
                </button>
            </div>

            <DatePicker
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                showLabel={false}
            />

            {unloggedPlannedMeals.length > 0 && (
                <div className="planned-meals-banner">
                    <div className="banner-content">
                        <span className="banner-icon">📅</span>
                        <div className="banner-text">
                            <strong>{unloggedPlannedMeals.length} planerade måltid{unloggedPlannedMeals.length > 1 ? 'er' : ''}</strong>
                            <span className="banner-subtitle">
                                {unloggedPlannedMeals.map((pm: { mealType: MealType, meal: PlannedMeal }) => {
                                    const recipe = recipes.find(r => r.id === pm.meal.recipeId);
                                    return recipe?.name || 'Okänt recept';
                                }).join(', ')}
                            </span>
                        </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleLogAllPlanned}>
                        ✓ Logga alla
                    </button>
                </div>
            )}

            {goals.isAdapted && (
                <div className="mx-4 mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-xl">⚡</div>
                        <div>
                            <div className="text-sm font-black text-emerald-400">Performance Buffer Aktiv</div>
                            <div className="text-[10px] text-emerald-500/70 uppercase font-black tracking-widest">
                                {goals.extraCalories} extra kcal för återhämtning
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Ökad återhämtning</div>
                        <div className="text-xs font-bold text-white">+{Math.round(goals.extraCalories * 0.15 / 4)}g Protein</div>
                    </div>
                </div>
            )}

            {showInsights ? (
                <NutritionInsights onDateSelect={setSelectedDate} />
            ) : (
                <>
                    <MacroSummary nutrition={dailyNutrition} goals={goals} viewMode={viewMode} />
                    {dailyEntries.length > 0 && (
                        <MacroDistribution
                            entries={dailyEntries}
                            foodItems={foodItems}
                            recipes={recipes}
                        />
                    )}

                    {/* Vitals Summary */}
                    {/* Vitals Summary */}
                    <div className="mx-4 mt-6 p-4 bg-slate-900/50 border border-white/5 rounded-2xl grid grid-cols-3 gap-4">
                        {/* Water */}
                        <div
                            className="flex flex-col items-center cursor-pointer hover:bg-white/5 rounded-xl transition-colors p-2"
                            onClick={() => handleCardClick('water', currentVitals.water || 0)}
                        >
                            <span className="text-[10px] font-black uppercase text-slate-500 mb-1">Vatten</span>
                            <div className="flex items-center gap-1.5 h-8">
                                {editing === 'water' ? (
                                    <input
                                        autoFocus
                                        type="number"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onBlur={() => handleSave('water')}
                                        onKeyDown={(e) => handleKeyDown(e, 'water')}
                                        onClick={e => e.stopPropagation()}
                                        className="bg-slate-800 border-none rounded text-center font-bold text-white w-12 text-sm focus:ring-1 focus:ring-emerald-500"
                                    />
                                ) : (
                                    <>
                                        <span className="text-xl">💧</span>
                                        <span className="text-lg font-bold text-white">{currentVitals.water || 0}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Caffeine */}
                        <div
                            className="flex flex-col items-center cursor-pointer hover:bg-white/5 rounded-xl transition-colors p-2"
                            onClick={() => handleCardClick('caffeine', currentVitals.caffeine || 0)}
                        >
                            <span className="text-[10px] font-black uppercase text-slate-500 mb-1">Koffein</span>
                            <div className="flex items-center gap-1.5 h-8">
                                {editing === 'caffeine' ? (
                                    <input
                                        autoFocus
                                        type="number"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onBlur={() => handleSave('caffeine')}
                                        onKeyDown={(e) => handleKeyDown(e, 'caffeine')}
                                        onClick={e => e.stopPropagation()}
                                        className="bg-slate-800 border-none rounded text-center font-bold text-white w-12 text-sm focus:ring-1 focus:ring-emerald-500"
                                    />
                                ) : (
                                    <>
                                        <span className="text-xl">☕</span>
                                        <span className="text-lg font-bold text-white">{currentVitals.caffeine || 0}<span className="text-[10px] text-slate-500 ml-0.5">mg</span></span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Alcohol */}
                        <div
                            className="flex flex-col items-center cursor-pointer hover:bg-white/5 rounded-xl transition-colors p-2"
                            onClick={() => handleCardClick('alcohol', currentVitals.alcohol || 0)}
                        >
                            <span className="text-[10px] font-black uppercase text-slate-500 mb-1">Alkohol</span>
                            <div className="flex items-center gap-1.5 h-8">
                                {editing === 'alcohol' ? (
                                    <input
                                        autoFocus
                                        type="number"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onBlur={() => handleSave('alcohol')}
                                        onKeyDown={(e) => handleKeyDown(e, 'alcohol')}
                                        onClick={e => e.stopPropagation()}
                                        className="bg-slate-800 border-none rounded text-center font-bold text-white w-12 text-sm focus:ring-1 focus:ring-emerald-500"
                                    />
                                ) : (
                                    <>
                                        <span className="text-xl">🍷</span>
                                        <span className="text-lg font-bold text-white">{currentVitals.alcohol || 0}<span className="text-[10px] text-slate-500 ml-0.5">e</span></span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <MealTimeline
                viewMode={viewMode}
                dailyEntries={dailyEntries}
                entriesByMeal={entriesByMeal}
                getItemName={getItemName}
                getItemCalories={getItemCalories}
                updateMealEntry={updateMealEntry}
                handleDeleteEntry={handleDeleteEntry}
                setIsFormOpen={setIsFormOpen}
                setMealType={setMealType}
                setBreakdownItem={setBreakdownItem}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDeleteSelected={handleDeleteSelected}
            />

            {dailyExercises.length > 0 && (
                <section className="mt-8">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">Träningspass</h3>
                    <div className="space-y-2">
                        {dailyExercises.map(ex => (
                            <div key={ex.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <span className="text-xl">🏋️</span>
                                    <div>
                                        <div className="font-bold text-slate-200">{ex.type === 'running' ? 'Löpning' : ex.type === 'cycling' ? 'Cykling' : ex.type === 'strength' ? 'Styrka' : ex.type === 'walking' ? 'Promenad' : ex.type === 'swimming' ? 'Simning' : ex.type === 'yoga' ? 'Yoga' : 'Annat'}</div>
                                        <div className="text-[10px] text-slate-500">{ex.durationMinutes} min • {ex.intensity}</div>
                                    </div>
                                </div>
                                <span className="text-rose-400 font-black">-{ex.caloriesBurned} kcal</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <QuickAddModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                mealType={mealType}
                setMealType={setMealType}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                proposals={proposals}
                quickAddServings={quickAddServings}
                setQuickAddServings={setQuickAddServings}
                handleQuickAdd={handleQuickAdd}
            />

            <NutritionBreakdownModal
                item={breakdownItem}
                onClose={() => setBreakdownItem(null)}
                recipes={recipes}
                foodItems={foodItems}
                getFoodItem={getFoodItem}
            />
        </div>
    );
}
