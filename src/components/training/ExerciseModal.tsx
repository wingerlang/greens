import React, { useEffect, useState } from "react";
import {
  ExerciseIntensity,
  ExerciseSubType,
  ExerciseType,
} from "../../models/types.ts";
import { useNavigate } from "react-router-dom";

const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
  { type: "running", icon: "🏃", label: "Löpning" },
  { type: "cycling", icon: "🚴", label: "Cykling" },
  { type: "strength", icon: "🏋️", label: "Styrka" },
  { type: "walking", icon: "🚶", label: "Promenad" },
  { type: "swimming", icon: "🏊", label: "Simning" },
  { type: "yoga", icon: "🧘", label: "Yoga" },
  { type: "hyrox", icon: "🦅", label: "Hyrox" },
  { type: "other", icon: "✨", label: "Annat" },
];

const INTENSITIES: {
  value: ExerciseIntensity;
  label: string;
  color: string;
}[] = [
  { value: "low", label: "Låg", color: "text-slate-400" },
  { value: "moderate", label: "Medel", color: "text-emerald-400" },
  { value: "high", label: "Hög", color: "text-rose-400" },
  { value: "ultra", label: "Max", color: "text-purple-400" },
];

interface ExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  smartInput: string;
  setSmartInput: (val: string) => void;
  effectiveExerciseType: ExerciseType;
  effectiveDuration: string;
  effectiveIntensity: ExerciseIntensity;
  exerciseForm: {
    type: ExerciseType;
    duration: string;
    intensity: ExerciseIntensity;
    notes: string;
    subType?: ExerciseSubType;
    tonnage?: string;
    distance?: string;
  };
  setExerciseForm: (val: any) => void;
  calculateCalories: (
    type: ExerciseType,
    duration: number,
    intensity: ExerciseIntensity,
  ) => number;
  isEditing?: boolean;
  onDelete?: () => void;
  activityId?: string | null;
}

export function ExerciseModal({
  isOpen,
  onClose,
  onSave,
  smartInput,
  setSmartInput,
  effectiveExerciseType,
  effectiveDuration,
  effectiveIntensity,
  exerciseForm,
  setExerciseForm,
  calculateCalories,
  isEditing,
  onDelete,
  activityId,
}: ExerciseModalProps) {
  const navigate = useNavigate();

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {isEditing ? "Redigera Träning" : "Logga Träning"}
          </h2>
          <button
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={onClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 custom-scrollbar">
          <form onSubmit={onSave} className="space-y-8">
            {/* Smart Input field */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-emerald-500">✨</span>
                  Magic Input
                </span>
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={smartInput}
                  onChange={(e) => setSmartInput(e.target.value)}
                  placeholder='T.ex. "5km löpning 25min hög intensitet"'
                  className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 pl-5 text-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                  autoFocus
                />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
              </div>

              {/* Smart Preview */}
              {smartInput && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                        {EXERCISE_TYPES.find((t) =>
                          t.type === effectiveExerciseType
                        )?.icon}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {EXERCISE_TYPES.find((t) =>
                            t.type === effectiveExerciseType
                          )?.label}
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span
                            className={`${
                              INTENSITIES.find((i) =>
                                i.value === effectiveIntensity
                              )?.color
                            }`}
                          >
                            {INTENSITIES.find((i) =>
                              i.value === effectiveIntensity
                            )?.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">
                          {effectiveDuration} min
                          {exerciseForm.distance
                            ? ` • ${exerciseForm.distance} km`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right px-3 py-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="text-sm font-black text-emerald-500">
                        {Math.round(
                          calculateCalories(
                            effectiveExerciseType,
                            parseInt(effectiveDuration) || 0,
                            effectiveIntensity,
                          ),
                        )}
                      </div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        kcal
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-slate-200 dark:border-slate-800">
                </div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Eller välj manuellt
                </span>
              </div>
            </div>

            {/* Type Selection */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {EXERCISE_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                    effectiveExerciseType === t.type
                      ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-lg transform scale-105"
                      : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => {
                    setExerciseForm({ ...exerciseForm, type: t.type });
                    setSmartInput("");
                  }}
                >
                  <span className="text-2xl">{t.icon}</span>
                  {effectiveExerciseType === t.type && (
                    <span className="text-[9px] font-bold animate-in fade-in zoom-in">
                      {t.label}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-12 gap-4">
              {/* Duration */}
              <div className="col-span-1 sm:col-span-4 space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Tid (min)
                </label>
                <input
                  type="number"
                  value={effectiveDuration}
                  onChange={(e) => {
                    setExerciseForm({
                      ...exerciseForm,
                      duration: e.target.value,
                    });
                    setSmartInput("");
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-bold text-center focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none transition-all"
                />
              </div>

              {/* Distance (Conditional) */}
              {["running", "cycling", "walking", "swimming"].includes(
                effectiveExerciseType,
              ) && (
                <div className="col-span-1 sm:col-span-4 space-y-1.5 animate-in fade-in slide-in-from-left-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                    Distans (km)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="-"
                      value={exerciseForm.distance || ""}
                      onChange={(e) => {
                        setExerciseForm({
                          ...exerciseForm,
                          distance: e.target.value,
                        });
                        setSmartInput("");
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-bold text-center focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Intensity */}
              <div
                className={`col-span-2 ${
                  ["running", "cycling", "walking", "swimming"].includes(
                      effectiveExerciseType,
                    )
                    ? "sm:col-span-4"
                    : "sm:col-span-8"
                } space-y-1.5`}
              >
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Intensitet
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  {INTENSITIES.map((i) => (
                    <button
                      key={i.value}
                      type="button"
                      onClick={() => {
                        setExerciseForm({
                          ...exerciseForm,
                          intensity: i.value,
                        });
                        setSmartInput("");
                      }}
                      title={i.label}
                      className={`rounded-lg py-2 text-xs font-bold transition-all ${
                        effectiveIntensity === i.value
                          ? "bg-white dark:bg-slate-800 shadow-sm " + i.color
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Extra Options (Collapsible-ish feel) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Kategori
                </label>
                <div className="relative">
                  <select
                    value={exerciseForm.subType || "default"}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        subType: e.target.value as ExerciseSubType,
                      })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-700 dark:text-slate-300 text-sm font-medium appearance-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none cursor-pointer"
                  >
                    <option value="default">Standard</option>
                    <option value="interval">⚡️ Intervaller</option>
                    <option value="long-run">🏔️ Långpass</option>
                    <option value="race">🏆 Tävling</option>
                    <option value="tonnage">🏋️ Styrka (Tonnage)</option>
                    <option value="competition">🏅 Tävlingsmoment</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </div>

              {effectiveExerciseType === "strength" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-right-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                    Total Volym (kg)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={exerciseForm.tonnage || ""}
                    onChange={(e) =>
                      setExerciseForm({
                        ...exerciseForm,
                        tonnage: e.target.value,
                      })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                Anteckningar
              </label>
              <textarea
                rows={2}
                value={exerciseForm.notes}
                onChange={(e) =>
                  setExerciseForm({ ...exerciseForm, notes: e.target.value })}
                placeholder="Hur kändes det? Några detaljer?"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-700 dark:text-slate-300 resize-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 outline-none text-sm"
              />
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              {isEditing && (
                <button
                  type="button"
                  className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-colors text-sm font-bold flex items-center gap-2"
                  onClick={() => {
                    if (confirm("Ta bort detta pass?")) onDelete?.();
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  <span>Radera</span>
                </button>
              )}

              <div className="flex items-center gap-3 ml-auto w-full sm:w-auto">
                <button
                  type="button"
                  className="flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={onClose}
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black tracking-wide hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  {isEditing ? "Spara Ändringar" : "Spara Passet"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export { EXERCISE_TYPES, INTENSITIES };
