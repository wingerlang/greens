import React, { useState } from "react";
import { ArrowRightLeft, Info, X } from "lucide-react";
import {
  MEAL_TYPE_COLORS,
  MEAL_TYPE_LABELS,
  type MealEntry,
  type MealItem,
  type MealType,
} from "../../models/types.ts";
import { ConfirmModal } from "../shared/ConfirmModal.tsx";
import { NutritionLabel } from "../shared/NutritionLabel.tsx";

interface MealTimelineProps {
  viewMode: "normal" | "compact";
  dailyEntries: MealEntry[];
  entriesByMeal: Record<MealType, MealEntry[]>;
  getItemName: (item: MealItem) => string;
  getItemCalories: (item: MealItem) => number;
  getItemNutrition?: (
    item: MealItem,
  ) => { calories: number; protein: number; carbs: number; fat?: number };
  getItemBrand?: (item: MealItem) => string | undefined;
  updateMealEntry: (id: string, data: Partial<MealEntry>) => void;
  handleDeleteEntry: (id: string) => void;
  setIsFormOpen: (open: boolean) => void;
  setMealType: (type: MealType) => void;
  setBreakdownItem: (item: MealItem | null) => void;
  onReplaceItem?: (item: MealItem, entryId: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onCreateQuickMeal?: () => void;
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
  onCreateQuickMeal,
}: MealTimelineProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<
    { isOpen: boolean; entryId: string | null }
  >({
    isOpen: false,
    entryId: null,
  });
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null); // entryId-itemIndex

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, entryId: id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.entryId) {
      handleDeleteEntry(deleteConfirm.entryId);
      setDeleteConfirm({ isOpen: false, entryId: null });
    }
  };

  const renderEntryRow = (entry: MealEntry, isCompact: boolean) => {
    const multiplier = entry.pieces ?? 1;
    const totalNutrition = entry.items.reduce((acc, item) => {
      const n = getItemNutrition?.(item) ||
        { calories: getItemCalories(item), protein: 0, carbs: 0, fat: 0 };
      return {
        calories: acc.calories + (n.calories * multiplier),
        protein: acc.protein + (n.protein * multiplier),
        carbs: acc.carbs + (n.carbs * multiplier),
        fat: acc.fat + ((n.fat || 0) * multiplier),
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const firstItem = entry.items[0];

    return (
      <div
        key={entry.id}
        className={`group relative flex items-center justify-between p-3 bg-slate-900/40 border rounded-2xl hover:border-white/10 transition-all gap-4 ${
          isCompact ? "" : "mb-2"
        } cursor-move ${
          (entry as any).snabbvalId || entry.title?.includes("⚡") ||
            entry.title?.startsWith("×") ||
            (entry.title && entry.items.length > 1)
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-white/5"
        }`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("entryId", entry.id);
          e.dataTransfer.effectAllowed = "move";
          (e.currentTarget as HTMLElement).style.opacity = "0.5";
        }}
        onDragEnd={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = "1";
        }}
      >
        {/* Left: Name + Brand + Time */}
        <div
          className="flex items-center gap-3 min-w-0"
          style={{ flex: "0 0 32%" }}
        >
          {isCompact && (
            <input
              type="checkbox"
              checked={selectedIds.has(entry.id)}
              onChange={() => onToggleSelect(entry.id)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50 shrink-0"
            />
          )}
          {isCompact && (
            <div className="flex flex-col items-center w-10 shrink-0">
              <span
                className={`text-[8px] uppercase font-black px-1 rounded ${
                  MEAL_TYPE_COLORS[entry.mealType]
                }`}
              >
                {MEAL_TYPE_LABELS[entry.mealType].split(" ")[0].substring(0, 3)}
              </span>
              <span className="text-[9px] text-slate-600 font-mono">
                {new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          <div className="flex flex-col min-w-0">
            {entry.title && (
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block leading-none mb-0.5">
                {(entry as any).snabbvalId && "⚡ "}
                {entry.title}
              </span>
            )}

            <div
              className={`text-sm flex flex-wrap gap-x-1 ${
                entry.title
                  ? "text-slate-400 font-medium"
                  : "text-slate-200 font-bold"
              } truncate`}
            >
              {entry.items.map((item, idx) => {
                const name = getItemName(item);
                const isLast = idx === entry.items.length - 1;
                return (
                  <span
                    key={idx}
                    className={`transition-colors cursor-help px-0.5 rounded ${
                      activeItemKey === `${entry.id}-${idx}`
                        ? "text-emerald-400 font-bold bg-emerald-500/20"
                        : "hover:text-emerald-400 hover:bg-emerald-500/10"
                    }`}
                  >
                    {name}
                    {!isLast && ","}
                  </span>
                );
              })}
            </div>
            {firstItem && getItemBrand?.(firstItem) && (
              <span className="text-[10px] text-slate-500 font-medium tracking-tight">
                {getItemBrand(firstItem)}
              </span>
            )}
            {!isCompact && (
              <span className="text-[10px] text-slate-600 font-medium md:hidden">
                {new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Center: Protein, Carbs, Fat - Centered in whole row */}
        <div className="hidden sm:flex flex-1 justify-center items-center gap-6 text-[10px] font-black uppercase tracking-tight whitespace-nowrap overflow-hidden px-4">
          <span className="text-rose-400" title="Protein">
            🌱 {Math.round(totalNutrition.protein)}g
          </span>
          <span className="text-indigo-400" title="Kolhydrater">
            🍞 {Math.round(totalNutrition.carbs)}g
          </span>
          <span className="text-orange-400" title="Fett">
            🥑 {Math.round(totalNutrition.fat)}g
          </span>
        </div>

        {/* Right: Controls, Kcal, Info, X */}
        <div
          className="flex items-center gap-3 shrink-0"
          style={{ flex: "0 0 35%", justifyContent: "flex-end" }}
        >
          {/* Pieces Stepper for Snabbvals - Show if snabbvalId exists or pieces > 0 */}
          {(entry.snabbvalId || (entry.pieces && entry.pieces > 0)) && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
              <button
                className="w-5 h-5 flex items-center justify-center rounded-sm bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  updateMealEntry(entry.id, {
                    pieces: Math.max(1, (entry.pieces || 1) - 1),
                  });
                }}
              >
                −
              </button>
              <span className="text-[10px] font-black text-emerald-400 whitespace-nowrap">
                {entry.pieces || 1}st
              </span>
              <button
                className="w-5 h-5 flex items-center justify-center rounded-sm bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  updateMealEntry(entry.id, {
                    pieces: (entry.pieces || 1) + 1,
                  });
                }}
              >
                +
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 scale-90 origin-right">
            {entry.items.map((item, idx) => (
              <PortionControls
                key={idx}
                item={item}
                onUpdate={(newServings) => {
                  updateMealEntry(entry.id, {
                    items: entry.items.map((it, i) =>
                      i === idx ? { ...it, servings: newServings } : it
                    ),
                  });
                }}
                onActive={(active) =>
                  setActiveItemKey(active ? `${entry.id}-${idx}` : null)}
                isCompact
              />
            ))}
          </div>

          {/* Calories - Green as requested */}
          <span className="text-sm font-black text-emerald-500 min-w-[55px] text-right">
            {Math.round(totalNutrition.calories)}{" "}
            <span className="text-[10px] uppercase opacity-70">kcal</span>
            {entry.items.some((it) => it.type === "estimate") &&
              entry.items.find((it) => it.type === "estimate")
                ?.estimateDetails &&
              (
                <div className="text-[9px] text-slate-500 font-medium leading-none mt-0.5">
                  {entry.items.find((it) => it.type === "estimate")
                    ?.estimateDetails?.caloriesMin}-{entry.items.find((it) =>
                      it.type === "estimate"
                    )?.estimateDetails?.caloriesMax}
                </div>
              )}
          </span>

          {/* Action buttons (Info, Ersätt, Delete) */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
              onClick={(e) => {
                e.stopPropagation();
                setBreakdownItem(firstItem);
              }}
              title="Mer info"
            >
              <Info size={14} />
            </button>
            {entry.mealType === "snack" && (
              <button
                className={`p-1.5 rounded-lg transition-colors ${
                  totalNutrition.calories > 400
                    ? "text-amber-400 hover:bg-amber-400/10"
                    : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateMealEntry(entry.id, { mealType: "lunch" });
                }}
                title="Flytta till lunch"
              >
                <ArrowRightLeft size={14} className="-rotate-45" />
              </button>
            )}
            {onReplaceItem && firstItem && (
              <button
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onReplaceItem(firstItem, entry.id);
                }}
                title="Ersätt"
              >
                <ArrowRightLeft size={14} />
              </button>
            )}
            <button
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              onClick={() => handleDelete(entry.id)}
              title="Ta bort"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (viewMode === "compact") {
    return (
      <>
        <div className="flex flex-col gap-1.5 bg-slate-800/20 rounded-2xl p-3 border border-slate-700/30">
          {dailyEntries.length === 0
            ? (
              <div className="text-center text-slate-500 py-12">
                <span className="block mb-2 text-lg">🍽️</span>
                <span className="text-sm font-medium">
                  Inga måltider loggade idag
                </span>
                <button
                  className="block mx-auto mt-4 py-2 px-6 text-xs font-black uppercase tracking-widest bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all"
                  onClick={() => setIsFormOpen(true)}
                >
                  + Logga Första
                </button>
              </div>
            )
            : (
              <>
                {/* Bulk actions bar */}
                <div className="flex items-center justify-between px-3 py-2 mb-2 border-b border-slate-700/50">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === dailyEntries.length &&
                        dailyEntries.length > 0}
                      onChange={onSelectAll}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                      {selectedIds.size > 0
                        ? `${selectedIds.size} markerade`
                        : "Markera alla"}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && onCreateQuickMeal && (
                      <button
                        onClick={onCreateQuickMeal}
                        className="text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors font-bold flex items-center gap-1"
                      >
                        <span>⚡</span> Spara som Snabbval
                      </button>
                    )}
                    {selectedIds.size > 0 && (
                      <button
                        onClick={onDeleteSelected}
                        className="text-xs px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors font-bold"
                      >
                        Ta bort ({selectedIds.size})
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="space-y-1"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    const entryId = e.dataTransfer.getData("entryId");
                    // In compact mode, we might want to toggle the mealType if dropped on a specific area,
                    // but for now, we just ensure it doesn't break.
                    // If we had mealType targets in compact mode, we would use them here.
                    console.log("Dropped in compact list:", entryId);
                  }}
                >
                  {dailyEntries.map((entry) => renderEntryRow(entry, true))}
                </div>
                <TimelineActions setIsFormOpen={setIsFormOpen} />
              </>
            )}
        </div>
        <ConfirmModal
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, entryId: null })}
          onConfirm={confirmDelete}
          title="Ta bort måltid"
          message="Dessa poster kommer att raderas permanent."
          confirmText="Ta bort"
          variant="danger"
        />
      </>
    );
  }

  // Normal view (Detailed Sections)
  return (
    <div className="meals-timeline flex flex-col gap-8">
      {(Object.entries(entriesByMeal) as [MealType, MealEntry[]][]).map((
        [mealTypeKey, entries],
      ) => (
        <div
          key={mealTypeKey}
          className="meal-section"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            (e.currentTarget as HTMLElement).classList.add(
              "bg-emerald-500/10",
              "ring-2",
              "ring-emerald-500/30",
              "ring-inset",
            );
          }}
          onDragLeave={(e) => {
            (e.currentTarget as HTMLElement).classList.remove(
              "bg-emerald-500/10",
              "ring-2",
              "ring-emerald-500/30",
              "ring-inset",
            );
          }}
          onDrop={(e) => {
            (e.currentTarget as HTMLElement).classList.remove(
              "bg-emerald-500/10",
              "ring-2",
              "ring-emerald-500/30",
              "ring-inset",
            );
            const entryId = e.dataTransfer.getData("entryId");
            if (entryId) {
              updateMealEntry(entryId, { mealType: mealTypeKey });
            }
          }}
        >
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-4">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                <span className="text-lg">
                  {mealTypeKey === "breakfast" && "🌅"}
                  {mealTypeKey === "lunch" && "☀️"}
                  {mealTypeKey === "dinner" && "🌙"}
                  {mealTypeKey === "snack" && "🍎"}
                  {mealTypeKey === "beverage" && "🥤"}
                  {mealTypeKey === "estimate" && "🤷"}
                </span>
                {MEAL_TYPE_LABELS[mealTypeKey]}
              </h3>
              {entries.length > 0 && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left duration-500">
                  <div className="h-4 w-[1px] bg-slate-800" />
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-tighter">
                    <span className="text-emerald-500">
                      {Math.round(entries.reduce((sum, e) => {
                        const mult = e.pieces || 1;
                        return sum + e.items.reduce((acc, it) =>
                          acc + (getItemCalories(it) * mult), 0);
                      }, 0))} kcal
                    </span>
                    <span className="text-rose-400">
                      🌱 {Math.round(entries.reduce((sum, e) => {
                        const mult = e.pieces || 1;
                        return sum + e.items.reduce(
                          (acc, it) =>
                            acc +
                            ((getItemNutrition?.(it).protein || 0) * mult),
                          0,
                        );
                      }, 0))}g
                    </span>
                  </div>
                </div>
              )}
            </div>
            {entries.length === 0 && (
              <button
                className="text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-400"
                onClick={() => {
                  setMealType(mealTypeKey);
                  setIsFormOpen(true);
                }}
              >
                + Lägg till
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {entries.length === 0
              ? (
                <div className="p-8 border border-dashed border-slate-700/50 rounded-2xl text-center text-slate-600 text-xs italic">
                  Sektionen är tom
                </div>
              )
              : (
                entries.map((entry) => renderEntryRow(entry, false))
              )}
          </div>
        </div>
      ))}

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, entryId: null })}
        onConfirm={confirmDelete}
        title="Ta bort måltid"
        message="Är du säker på att du vill ta bort denna måltid?"
        confirmText="Ta bort"
        variant="danger"
      />
    </div>
  );
}

// Sub-components
function PortionControls({
  item,
  onUpdate,
  onActive,
  isCompact = false,
}: {
  item: MealItem;
  onUpdate: (val: number) => void;
  onActive?: (active: boolean) => void;
  isCompact?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const isSubmitting = React.useRef(false); // Ref to track submission to avoid double calls (e.g. Enter + Blur)

  const step = item.type === "recipe" ? 0.25 : 25;

  const handleInputSubmit = () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    const val = parseFloat(inputValue);
    if (!isNaN(val) && val > 0) {
      onUpdate(val);
    }
    setIsEditing(false);
    onActive?.(false);

    // Reset the submission flag after the component has updated/unmounted or after a small delay
    setTimeout(() => {
      isSubmitting.current = false;
    }, 100);
  };

  if (isEditing) {
    return (
      <input
        type="number"
        autoFocus
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleInputSubmit}
        onMouseEnter={() => onActive?.(true)}
        onMouseLeave={() => !isEditing && onActive?.(false)}
        onFocus={() => onActive?.(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleInputSubmit();
          if (e.key === "Escape") setIsEditing(false);
        }}
        className={`${
          isCompact ? "w-12 text-xs" : "w-16 text-sm"
        } px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-center text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none`}
        placeholder={String(item.servings)}
      />
    );
  }

  return (
    <div
      className={`flex items-center ${isCompact ? "gap-1" : "gap-2"}`}
      onMouseEnter={() => onActive?.(true)}
      onMouseLeave={() => !isEditing && onActive?.(false)}
    >
      <button
        className={`${
          isCompact ? "w-5 h-5 text-sm" : "w-6 h-6 text-sm"
        } flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors cursor-pointer`}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(Math.max(step, item.servings - step));
        }}
      >
        −
      </button>
      <button
        className={`flex flex-col items-center justify-center ${
          isCompact ? "min-w-[50px]" : "min-w-[60px]"
        } hover:bg-slate-700/30 rounded px-1 transition-colors cursor-text`}
        onClick={(e) => {
          e.stopPropagation();
          setInputValue(String(item.servings));
          setIsEditing(true);
          onActive?.(true);
        }}
      >
        <span
          className={`${
            isCompact ? "text-[10px]" : "text-xs"
          } text-slate-200 font-bold`}
        >
          {item.type === "recipe" ? `${item.servings} p` : `${item.servings}g`}
        </span>
      </button>
      <button
        className={`${
          isCompact ? "w-5 h-5 text-sm" : "w-6 h-6 text-sm"
        } flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors cursor-pointer`}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(item.servings + step);
        }}
      >
        +
      </button>
    </div>
  );
}

function TimelineActions(
  { setIsFormOpen }: { setIsFormOpen: (open: boolean) => void },
) {
  return (
    <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-slate-700/30">
      <button
        className="py-2.5 px-8 text-xs font-black uppercase tracking-[2px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all hover:scale-105"
        onClick={() => setIsFormOpen(true)}
      >
        + Logga Punkt
      </button>
    </div>
  );
}
