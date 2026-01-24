import React, { useEffect, useState } from "react";
import {
  GRANULAR_MUSCLES,
  MUSCLE_DISPLAY_NAMES,
} from "../../data/muscleList.ts";
import { type MuscleGroup } from "../../models/strengthTypes.ts";

interface ExerciseMapperModuleProps {
  unmapped: string[];
  onSave: (exerciseName: string, muscleGroup: MuscleGroup) => Promise<void>;
}

export function ExerciseMapperModule(
  { unmapped, onSave }: ExerciseMapperModuleProps,
) {
  const [assignments, setAssignments] = useState<Record<string, MuscleGroup>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);

  // If no unmapped exercises, show nothing or success message
  if (unmapped.length === 0) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
        <p className="text-emerald-400 font-medium">
          ✨ Alla övningar är mappade!
        </p>
        <p className="text-slate-400 text-sm mt-1">
          Systemet kan analysera all din data korrekt.
        </p>
      </div>
    );
  }

  const handleAssign = (name: string, muscle: MuscleGroup) => {
    setAssignments((prev) => ({
      ...prev,
      [name]: muscle,
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Process sequentially to avoid race conditions or API limits
      for (const [name, muscle] of Object.entries(assignments)) {
        await onSave(name, muscle);
      }
      // Clear local state for saved items (parent will likely refetch)
      setAssignments({});
    } catch (error) {
      console.error("Failed to save mappings", error);
      alert("Ett fel uppstod när mappningar skulle sparas.");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = Object.keys(assignments).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white">Omappade Övningar</h3>
          <p className="text-xs text-slate-400">
            {unmapped.length} övningar saknar muskelgrupp.
          </p>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
          >
            {isSaving ? "Sparar..." : `Spara (${pendingCount})`}
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {unmapped.map((name) => (
          <div
            key={name}
            className="flex items-center justify-between gap-4 bg-slate-800/50 p-3 rounded-lg border border-white/5"
          >
            <span
              className="text-sm font-medium text-slate-200 truncate flex-1"
              title={name}
            >
              {name}
            </span>

            <select
              className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-md px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-40"
              value={assignments[name] || ""}
              onChange={(e) =>
                handleAssign(name, e.target.value as MuscleGroup)}
            >
              <option value="" disabled>Välj muskel...</option>
              {GRANULAR_MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_DISPLAY_NAMES[m]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
