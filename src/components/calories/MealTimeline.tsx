import React, { useState } from 'react';
import { X, Info, ArrowRightLeft } from 'lucide-react';
import {
    type MealEntry,
    type MealType,
    type MealItem,
    MEAL_TYPE_LABELS
} from '../../models/types.ts';
import { ConfirmModal } from '../shared/ConfirmModal.tsx';
import { NutritionLabel } from '../shared/NutritionLabel.tsx';

interface MealTimelineProps {
    viewMode: 'normal' | 'compact';
    dailyEntries: MealEntry[];
    entriesByMeal: Record<MealType, MealEntry[]>;
    getItemName: (item: MealItem) => string;
    getItemCalories: (item: MealItem) => number;
    getItemNutrition?: (item: MealItem) => { calories: number; protein: number; carbs: number; fat?: number };
    getItemBrand?: (item: MealItem) => string | undefined;
    updateMealEntry: (id: string, data: Partial<MealEntry>) => void;
    handleDeleteEntry: (id: string) => void;
    setIsFormOpen: (open: boolean) => void;
    setMealType: (type: MealType) => void;
    setBreakdownItem: (item: MealItem | null) => void;
    onReplaceItem?: (item: MealItem, entryId: string) => void;
    // Bulk selection
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectAll: () => void;
    onDeleteSelected: () => void;
}

export function MealTimeline({
    viewMode,
    dailyEntries,
    entriesByMeal,
    getItemName,
    getItemCalories,
    getItemNutrition,
    getItemBrand,
    updateMealEntry,
    handleDeleteEntry,
    setIsFormOpen,
    setMealType,
    setBreakdownItem,
    onReplaceItem,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onDeleteSelected,
}: MealTimelineProps) {
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; entryId: string | null }>({ isOpen: false, entryId: null });

    const handleDelete = (id: string) => {
        setDeleteConfirm({ isOpen: true, entryId: id });
    };

    const confirmDelete = () => {
        if (deleteConfirm.entryId) {
            handleDeleteEntry(deleteConfirm.entryId);
        }
    };

    if (viewMode === 'compact') {
        return (
            <>
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
                            {/* Bulk actions bar */}
                            <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-slate-700/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.size === dailyEntries.length && dailyEntries.length > 0}
                                        onChange={onSelectAll}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                                    />
                                    <span className="text-xs text-slate-400">
                                        {selectedIds.size > 0 ? `${selectedIds.size} markerade` : 'Markera alla'}
                                    </span>
                                </label>
                                {selectedIds.size > 0 && (
                                    <button
                                        onClick={onDeleteSelected}
                                        className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors font-bold"
                                    >
                                        🗑️ Ta bort ({selectedIds.size})
                                    </button>
                                )}
                            </div>

                            {dailyEntries.map((entry: MealEntry) => (
                                <div
                                    key={entry.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('entryId', entry.id);
                                        e.dataTransfer.effectAllowed = 'move';
                                        (e.currentTarget as HTMLElement).classList.add('opacity-50');
                                    }}
                                    onDragEnd={(e) => {
                                        (e.currentTarget as HTMLElement).classList.remove('opacity-50');
                                    }}
                                    className={`group flex items-center justify-between py-2 px-3 rounded-lg transition-all cursor-move ${selectedIds.has(entry.id)
                                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                                        : 'bg-slate-800/50 hover:bg-slate-800'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(entry.id)}
                                            onChange={() => onToggleSelect(entry.id)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50 shrink-0"
                                        />
                                        <span className="text-[10px] uppercase text-slate-500 w-16 shrink-0">
                                            {MEAL_TYPE_LABELS[entry.mealType]}
                                        </span>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm text-slate-200 truncate">
                                                {entry.items.map((item: MealItem) => getItemName(item)).join(', ')}
                                            </span>
                                            {entry.items.length > 0 && getItemBrand?.(entry.items[0]) && (
                                                <span className="text-[10px] text-slate-500">
                                                    {getItemBrand(entry.items[0])}
                                                </span>
                                            )}
                                        </div>
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
                                            <>
                                                {/* Info button */}
                                                <button
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBreakdownItem(entry.items[0]);
                                                    }}
                                                    title="Mer info"
                                                >
                                                    <Info size={14} />
                                                </button>
                                                {/* Kcal display */}
                                                <span className="text-sm font-medium text-emerald-400 min-w-[60px] text-right">
                                                    {entry.items.reduce((sum, item) => sum + getItemCalories(item), 0)} kcal
                                                </span>
                                            </>
                                        )}
                                        {/* Delete button - larger X */}
                                        <button
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => handleDelete(entry.id)}
                                            title="Ta bort"
                                        >
                                            <X size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <TimelineActions setIsFormOpen={setIsFormOpen} />
                        </>
                    )}
                </div>
                <ConfirmModal
                    isOpen={deleteConfirm.isOpen}
                    onClose={() => setDeleteConfirm({ isOpen: false, entryId: null })}
                    onConfirm={confirmDelete}
                    title="Ta bort måltid"
                    message="Är du säker på att du vill ta bort denna måltid? Detta går inte att ångra."
                    confirmText="Ta bort"
                    variant="danger"
                />
            </>
        );
    }

    return (
        <>
            <div className="meals-timeline">
                {(Object.entries(entriesByMeal) as [MealType, MealEntry[]][]).map(([mealTypeKey, entries]) => (
                    <div
                        key={mealTypeKey}
                        className="meal-section transition-colors duration-200"
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            (e.currentTarget as HTMLElement).classList.add('bg-emerald-500/5');
                            (e.currentTarget as HTMLElement).classList.add('border-emerald-500/30');
                        }}
                        onDragLeave={(e) => {
                            (e.currentTarget as HTMLElement).classList.remove('bg-emerald-500/5');
                            (e.currentTarget as HTMLElement).classList.remove('border-emerald-500/30');
                        }}
                        onDrop={(e) => {
                            (e.currentTarget as HTMLElement).classList.remove('bg-emerald-500/5');
                            (e.currentTarget as HTMLElement).classList.remove('border-emerald-500/30');
                            const entryId = e.dataTransfer.getData('entryId');
                            if (entryId) {
                                updateMealEntry(entryId, { mealType: mealTypeKey });
                            }
                        }}
                    >
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
                                    <div
                                        key={entry.id}
                                        className="meal-entry group cursor-move transition-all active:scale-[0.98]"
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('entryId', entry.id);
                                            e.dataTransfer.effectAllowed = 'move';
                                            setTimeout(() => (e.target as HTMLElement).classList.add('opacity-40'), 0);
                                        }}
                                        onDragEnd={(e) => {
                                            (e.target as HTMLElement).classList.remove('opacity-40');
                                        }}
                                    >
                                        {entry.items.map((item: MealItem, idx: number) => {
                                            const brand = getItemBrand?.(item);
                                            const nutrition = getItemNutrition?.(item);

                                            return (
                                                <div key={idx} className="entry-item">
                                                    <div className="entry-info flex items-center gap-2">
                                                        <span className="entry-name">{getItemName(item)}</span>
                                                        {brand && (
                                                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                                                {brand}
                                                            </span>
                                                        )}
                                                        {/* Quick actions */}
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBreakdownItem(item);
                                                                }}
                                                                title="Mer info"
                                                            >
                                                                <Info size={14} />
                                                            </button>
                                                            {onReplaceItem && (
                                                                <button
                                                                    className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onReplaceItem(item, entry.id);
                                                                    }}
                                                                    title="Ersätt med annan"
                                                                >
                                                                    <ArrowRightLeft size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
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
                                                        {nutrition ? (
                                                            <NutritionLabel
                                                                calories={nutrition.calories}
                                                                protein={nutrition.protein}
                                                                carbs={nutrition.carbs}
                                                                variant="compact"
                                                                size="sm"
                                                            />
                                                        ) : (
                                                            <button
                                                                className="entry-calories ml-2 hover:text-emerald-300 hover:underline cursor-pointer"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setBreakdownItem(item);
                                                                }}
                                                            >
                                                                {getItemCalories(item)} kcal
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Delete button - larger and always visible on hover */}
                                        <button
                                            className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => handleDelete(entry.id)}
                                            title="Ta bort"
                                        >
                                            <X size={20} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, entryId: null })}
                onConfirm={confirmDelete}
                title="Ta bort måltid"
                message="Är du säker på att du vill ta bort denna måltid? Detta går inte att ångra."
                confirmText="Ta bort"
                variant="danger"
            />
        </>
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
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const step = item.type === 'recipe' ? 0.25 : 25;
    const gramsPerPortion = item.type === 'recipe' ? 300 : 1;
    const currentGrams = Math.round(item.servings * gramsPerPortion);

    const handleInputSubmit = () => {
        const val = parseFloat(inputValue);
        if (!isNaN(val) && val > 0) {
            onUpdate(item.type === 'recipe' ? val : val);
        }
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <input
                type="number"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleInputSubmit}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInputSubmit();
                    if (e.key === 'Escape') setIsEditing(false);
                }}
                className={`${isCompact ? 'w-12 text-xs' : 'w-16 text-sm'} px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-center text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none`}
                placeholder={String(item.servings)}
            />
        );
    }

    return (
        <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'}`}>
            <button
                className={`${isCompact ? 'w-5 h-5 text-xs' : 'w-6 h-6 text-sm'} flex items-center justify-center rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200`}
                onClick={() => onUpdate(Math.max(step, item.servings - step))}
            >
                −
            </button>
            <button
                className={`flex flex-col items-center ${isCompact ? 'min-w-[50px]' : 'min-w-[60px]'} hover:bg-slate-700/50 rounded px-1 py-0.5 transition-colors cursor-text`}
                onClick={() => {
                    setInputValue(String(item.servings));
                    setIsEditing(true);
                }}
                title="Klicka för att redigera"
            >
                <span className={`${isCompact ? 'text-xs' : 'text-sm'} text-slate-200 font-medium`}>
                    {item.type === 'recipe' ? `${item.servings} port` : `${item.servings}g`}
                </span>
                {item.type === 'recipe' && (
                    <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-slate-500`}>
                        ≈{currentGrams}g
                    </span>
                )}
            </button>
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
