import React, { useEffect, useState } from "react";
import { ChevronRight, History, X, Zap } from "lucide-react";
import { type MealItem, type QuickMeal } from "../../models/types.ts";

interface CreateQuickMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  items: MealItem[];
  getItemName: (item: MealItem) => string;
  getItemNutrition: (
    item: MealItem,
  ) => { calories: number; protein: number; carbs: number; fat?: number };
  recentQuickMeals: QuickMeal[];
}

export function CreateQuickMealModal({
  isOpen,
  onClose,
  onSave,
  items,
  getItemName,
  getItemNutrition,
  recentQuickMeals,
}: CreateQuickMealModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      // Default name suggestion based on first item or count
      if (items.length === 1) {
        setName(getItemName(items[0]));
      } else {
        setName(`Kombination (${items.length} prod)`);
      }
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, items, getItemName]);

  if (!isOpen) return null;

  const totals = items.reduce((acc, item) => {
    const n = getItemNutrition(item);
    return {
      calories: acc.calories + n.calories,
      protein: acc.protein + n.protein,
      carbs: acc.carbs + n.carbs,
      fat: acc.fat + (n.fat || 0),
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
              <Zap size={24} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Spara som Snabbval
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Skapa en återanvändbar kombination
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Items Summary */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800/50">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Innehåll
              </span>
              <div className="flex items-center gap-3 text-[10px] font-black">
                <span className="text-emerald-500">
                  {Math.round(totals.calories)} kcal
                </span>
                <span className="text-rose-400">
                  {Math.round(totals.protein)}g P
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-slate-300 font-medium truncate">
                    {getItemName(item)}
                  </span>
                  <span className="text-slate-500 shrink-0 ml-2">
                    {item.type === "recipe"
                      ? `${item.servings}p`
                      : `${item.servings}g`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Input Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest ml-1">
              Namn på snabbvalet
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="t.ex. Frukostmacka standard"
              className="w-full bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-2xl px-4 py-3 text-white font-bold outline-none transition-all"
            />
          </div>

          {/* Recent Items */}
          {recentQuickMeals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                <History size={12} />
                <span>Senaste snabbval</span>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {recentQuickMeals.slice(0, 3).map((qm) => (
                  <div
                    key={qm.id}
                    className="flex items-center justify-between p-3 bg-slate-800/20 border border-slate-800 rounded-xl hover:border-slate-700 transition-all cursor-pointer group"
                    onClick={() => setName(qm.name)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">⚡</span>
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                        {qm.name}
                      </span>
                    </div>
                    <ChevronRight
                      size={14}
                      className="text-slate-600 group-hover:text-emerald-500 transition-all translate-x-0 group-hover:translate-x-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-800/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-800 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-[2] px-6 py-3 bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            Spara Snabbval
          </button>
        </div>
      </div>
    </div>
  );
}
