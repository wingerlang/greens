import React from 'react';
import {
    type MealEntry,
    type MealType,
    type MealItem,
    MEAL_TYPE_LABELS
} from '../../models/types.ts';

interface MealTimelineProps {
    viewMode: 'normal' | 'compact';
    dailyEntries: MealEntry[];
    entriesByMeal: Record<MealType, MealEntry[]>;
    getItemName: (item: MealItem) => string;
    getItemCalories: (item: MealItem) => number;
    updateMealEntry: (id: string, data: Partial<MealEntry>) => void;
    handleDeleteEntry: (id: string) => void;
    setIsFormOpen: (open: boolean) => void;
    setMealType: (type: MealType) => void;
    setBreakdownItem: (item: MealItem | null) => void;
}

export function MealTimeline({
    viewMode,
    dailyEntries,
    entriesByMeal,
    getItemName,
    getItemCalories,
    updateMealEntry,
    handleDeleteEntry,
    setIsFormOpen,
    setMealType,
    setBreakdownItem,
}: MealTimelineProps) {
    if (viewMode === 'compact') {
        return (
            <div className="flex flex-col gap-1.5 bg-slate-800/30 rounded-xl p-3 border border-slate-700/50">
                {dailyEntries.length === 0 ? (
                    <div className="text-center text-slate-500 py-4">
                        <span>Inga måltider loggade</span>
                        <button
                            className="ml-3 text-emerald-400 hover:text-emerald-300"
                            onClick={() => setIsFormOpen(true)}
                        >
                            + Lägg till
                        </button>
                    </div>
                ) : (
                    <>
                        {dailyEntries.map((entry: MealEntry) => (
                            <div
                                key={entry.id}
                                className="group flex items-center justify-between py-2 px-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-all"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-[10px] uppercase text-slate-500 w-16 shrink-0">
                                        {MEAL_TYPE_LABELS[entry.mealType]}
                                    </span>
                                    <span className="text-sm text-slate-200 truncate">
                                        {entry.items.map((item: MealItem) => getItemName(item)).join(', ')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {entry.items.map((item: MealItem, idx: number) => (
                                        <PortionControls
                                            key={idx}
                                            item={item}
                                            onUpdate={(newServings) => {
                                                updateMealEntry(entry.id, {
                                                    items: entry.items.map((it, i) =>
                                                        i === idx ? { ...it, servings: newServings } : it
                                                    )
                                                });
                                            }}
                                            isCompact
                                        />
                                    ))}
                                    {entry.items.length > 0 && (
                                        <button
                                            className="text-sm font-medium text-emerald-400 ml-2 hover:text-emerald-300 hover:underline cursor-pointer transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setBreakdownItem(entry.items[0]);
                                            }}
                                        >
                                            {entry.items.reduce((sum, item) => sum + getItemCalories(item), 0)} kcal
                                        </button>
                                    )}
                                    <button
                                        className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteEntry(entry.id)}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        ))}
                        <TimelineActions setIsFormOpen={setIsFormOpen} />
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="meals-timeline">
            {(Object.entries(entriesByMeal) as [MealType, MealEntry[]][]).map(([mealTypeKey, entries]) => (
                <div key={mealTypeKey} className="meal-section">
                    <h3 className="meal-title">
                        <span className="meal-icon">
                            {mealTypeKey === 'breakfast' && '🌅'}
                            {mealTypeKey === 'lunch' && '☀️'}
                            {mealTypeKey === 'dinner' && '🌙'}
                            {mealTypeKey === 'snack' && '🍎'}
                            {mealTypeKey === 'beverage' && '🥤'}
                        </span>
                        {MEAL_TYPE_LABELS[mealTypeKey]}
                    </h3>
                    {entries.length === 0 ? (
                        <div className="meal-empty">
                            <span>Inga måltider</span>
                            <button
                                className="btn btn-ghost"
                                onClick={() => {
                                    setMealType(mealTypeKey);
                                    setIsFormOpen(true);
                                }}
                            >
                                + Lägg till
                            </button>
                        </div>
                    ) : (
                        <div className="meal-entries">
                            {entries.map((entry: MealEntry) => (
                                <div key={entry.id} className="meal-entry">
                                    {entry.items.map((item: MealItem, idx: number) => (
                                        <div key={idx} className="entry-item">
                                            <div className="entry-info">
                                                <span className="entry-name">{getItemName(item)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <PortionControls
                                                    item={item}
                                                    onUpdate={(newServings) => {
                                                        updateMealEntry(entry.id, {
                                                            items: entry.items.map((it, i) =>
                                                                i === idx ? { ...it, servings: newServings } : it
                                                            )
                                                        });
                                                    }}
                                                />
                                                <button
                                                    className="entry-calories ml-2 hover:text-emerald-300 hover:underline cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBreakdownItem(item);
                                                    }}
                                                >
                                                    {getItemCalories(item)} kcal
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        className="btn-delete"
                                        onClick={() => handleDeleteEntry(entry.id)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function PortionControls({
    item,
    onUpdate,
    isCompact = false
}: {
    item: MealItem,
    onUpdate: (val: number) => void,
    isCompact?: boolean
}) {
    const step = item.type === 'recipe' ? 0.25 : 25;
    const gramsPerPortion = item.type === 'recipe' ? 300 : 1;
    const currentGrams = Math.round(item.servings * gramsPerPortion);

    return (
        <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'}`}>
            <button
                className={`${isCompact ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-sm'} flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200`}
                onClick={() => onUpdate(Math.max(step, item.servings - step))}
            >
                −
            </button>
            <div className={`flex flex-col items-center ${isCompact ? 'min-w-[50px]' : 'min-w-[60px]'}`}>
                <span className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-200 font-medium`}>
                    {item.type === 'recipe' ? `${item.servings} port` : `${item.servings}g`}
                </span>
                {item.type === 'recipe' && (
                    <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-slate-500`}>
                        ≈{currentGrams}g
                    </span>
                )}
            </div>
            <button
                className={`${isCompact ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-sm'} flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200`}
                onClick={() => onUpdate(item.servings + step)}
            >
                +
            </button>
        </div>
    );
}

function TimelineActions({ setIsFormOpen }: { setIsFormOpen: (open: boolean) => void }) {
    return (
        <div className="flex items-center justify-center gap-3 mt-2">
            <button
                className="flex items-center justify-center gap-2 py-2 px-4 text-sm bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
                onClick={() => setIsFormOpen(true)}
            >
                + Lägg till måltid
            </button>
            <button
                className="flex items-center justify-center gap-2 py-2 px-4 text-sm bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg transition-all"
                onClick={() => alert('Synka mellanmål till veckoplanering - kommer snart!')}
                title="Spara dagens mellanmål till veckovyn"
            >
                📅 Spara mellanmål
            </button>
        </div>
    );
}
