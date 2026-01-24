import React, { useEffect, useState } from "react";
import {
  ExerciseType,
  GoalPeriod,
  GoalTarget,
  PerformanceGoal,
  PerformanceGoalType,
} from "../../models/types.ts";

interface CycleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycle: any;
  onSave: (cycleId: string, updates: any) => void;
  onDelete: (cycleId: string) => void;
  exercises: any[];
  nutrition: any[];
  onAddGoal?: (goal: Omit<PerformanceGoal, "id" | "createdAt">) => void;
}

export function CycleDetailModal({
  isOpen,
  onClose,
  cycle,
  onSave,
  onDelete,
  exercises,
  nutrition,
  onAddGoal,
}: CycleDetailModalProps) {
  const [form, setForm] = useState({
    name: "",
    goal: "neutral",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (cycle) {
      setForm({
        name: cycle.name,
        goal: cycle.goal,
        startDate: cycle.startDate,
        endDate: cycle.endDate || "",
      });
    }
  }, [cycle]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !cycle) return null;

  // Calculate stats for this cycle
  const cycleExercises = exercises.filter((e) => {
    const d = new Date(e.date);
    const start = new Date(cycle.startDate);
    const end = cycle.endDate ? new Date(cycle.endDate) : new Date();
    return d >= start && d <= end;
  });

  const totalVolume =
    cycleExercises.reduce((acc, e) => acc + (e.tonnage || 0), 0) / 1000;
  const workoutCount = cycleExercises.length;

  // Avg Calories
  const cycleNutrition = nutrition.filter((n) => {
    const d = new Date(n.date);
    const start = new Date(cycle.startDate);
    const end = cycle.endDate ? new Date(cycle.endDate) : new Date();
    return d >= start && d <= end;
  });

  const avgCalories = cycleNutrition.length > 0
    ? Math.round(
      cycleNutrition.reduce((acc, n) => acc + n.calories, 0) /
        cycleNutrition.length,
    )
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(cycle.id, form);
    onClose();
  };

  return (
    <div
      className="modal-overlay backdrop-blur-md bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="modal-content max-w-lg w-full bg-slate-900 border border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`p-6 text-center border-b border-white/5 bg-gradient-to-br ${
            form.goal === "deff"
              ? "from-rose-500/20"
              : form.goal === "bulk"
              ? "from-emerald-500/20"
              : "from-blue-500/20"
          } to-slate-900`}
        >
          <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
            Redigera Period
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Namn
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-white/30 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Mål
              </label>
              <select
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-white/30 outline-none appearance-none"
              >
                <option value="neutral">Balans / Neutral</option>
                <option value="deff">Deff (Viktnedgång)</option>
                <option value="bulk">Bulk (Uppbyggnad)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Start
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-white/30 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-500">
                Slut
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-white/30 outline-none"
              />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="bg-white/5 rounded-xl p-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-black text-rose-400">
                {avgCalories || "-"}
              </div>
              <div className="text-[9px] uppercase text-slate-500 font-bold">
                Snitt Kcal
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-blue-400">
                {workoutCount}
              </div>
              <div className="text-[9px] uppercase text-slate-500 font-bold">
                Pass
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-400">
                {totalVolume.toFixed(1)}
              </div>
              <div className="text-[9px] uppercase text-slate-500 font-bold">
                Ton
              </div>
            </div>
          </div>

          {/* Quick Goal Add */}
          {onAddGoal && (
            <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20">
              <label className="text-[10px] uppercase font-bold text-emerald-400 block mb-2">
                ✨ Lägg till Mål för denna Period
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="t.ex. '3x styrka/vecka' eller '50km/vecka'"
                  className="flex-1 bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-white text-sm outline-none focus:border-emerald-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const input = (e.target as HTMLInputElement).value.trim()
                        .toLowerCase();
                      if (!input) return;

                      let goalType: PerformanceGoalType = "frequency";
                      let period: GoalPeriod = "weekly";
                      let exType: ExerciseType = "strength";
                      let count = 3;
                      let value = 0;
                      let unit = "sessions";

                      const freqMatch = input.match(
                        /(\d+)\s*x?\s*(löpning|styrka|cykling|promenad|simning|yoga)/,
                      );
                      if (freqMatch) {
                        count = parseInt(freqMatch[1]);
                        const typeMap: Record<string, ExerciseType> = {
                          "löpning": "running",
                          "styrka": "strength",
                          "cykling": "cycling",
                          "promenad": "walking",
                          "simning": "swimming",
                          "yoga": "yoga",
                        };
                        exType = typeMap[freqMatch[2]] || "strength";
                      }

                      const volMatch = input.match(
                        /(\d+(?:[.,]\d+)?)\s*(km|ton|kcal)/,
                      );
                      if (volMatch) {
                        value = parseFloat(volMatch[1].replace(",", "."));
                        unit = volMatch[2];
                        if (unit === "km") goalType = "distance";
                        else if (unit === "ton") goalType = "tonnage";
                        else if (unit === "kcal") goalType = "calories";
                      }

                      if (
                        input.includes("/dag") || input.includes("om dagen")
                      ) period = "daily";

                      onAddGoal({
                        name: input,
                        type: goalType,
                        period,
                        targets: [{
                          exerciseType: goalType === "frequency"
                            ? exType
                            : undefined,
                          count: goalType === "frequency" ? count : undefined,
                          value: goalType !== "frequency" ? value : undefined,
                          unit,
                        }],
                        cycleId: cycle.id,
                        startDate: cycle.startDate,
                      });

                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
              <p className="text-[9px] text-slate-500 mt-2">
                Tryck Enter för att lägga till. Målet kopplas automatiskt till
                perioden.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-rose-900/30 text-rose-400 font-bold text-xs uppercase tracking-wider transition-all"
              onClick={() => {
                if (
                  confirm("Är du säker på att du vill radera denna period?")
                ) {
                  onDelete(cycle.id);
                  onClose();
                }
              }}
            >
              Radera
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all"
            >
              Spara Ändringar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
