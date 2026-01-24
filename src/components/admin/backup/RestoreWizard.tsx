import React, { useState } from "react";
import type {
  BackupEntityCounts,
  BackupSnapshot,
} from "../../../models/backup.ts";
import { backupService } from "../../../services/backupService.ts";

interface RestoreWizardProps {
  snapshot: BackupSnapshot;
  onConfirm: (
    mode: "FULL" | "SELECTIVE",
    categories?: (keyof BackupEntityCounts)[],
  ) => void;
  onCancel: () => void;
}

const CATEGORY_OPTIONS: {
  key: keyof BackupEntityCounts;
  label: string;
  icon: string;
}[] = [
  { key: "meals", label: "Måltider", icon: "🍽️" },
  { key: "exercises", label: "Aktiviteter", icon: "🏃" },
  { key: "weights", label: "Vägningar", icon: "⚖️" },
  { key: "recipes", label: "Recept", icon: "📖" },
  { key: "foodItems", label: "Råvaror", icon: "🥕" },
  { key: "weeklyPlans", label: "Veckoplaneringar", icon: "📅" },
  { key: "goals", label: "Mål", icon: "🎯" },
  { key: "periods", label: "Träningsperioder", icon: "📊" },
  { key: "strengthSessions", label: "Styrkepass", icon: "💪" },
  { key: "sleepSessions", label: "Sömnsessioner", icon: "😴" },
  { key: "bodyMeasurements", label: "Kroppsmått", icon: "📏" },
  { key: "vitals", label: "Dagliga värden", icon: "💧" },
];

export function RestoreWizard(
  { snapshot, onConfirm, onCancel }: RestoreWizardProps,
) {
  const [mode, setMode] = useState<"FULL" | "SELECTIVE" | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<
    Set<keyof BackupEntityCounts>
  >(new Set());
  const [confirmStep, setConfirmStep] = useState(false);

  const toggleCategory = (cat: keyof BackupEntityCounts) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCategories(
      new Set(
        CATEGORY_OPTIONS.filter((c) => snapshot.entityCounts[c.key] > 0).map(
          (c) => c.key,
        ),
      ),
    );
  };

  const selectNone = () => {
    setSelectedCategories(new Set());
  };

  const handleConfirm = () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    if (mode === "FULL") {
      onConfirm("FULL");
    } else if (mode === "SELECTIVE") {
      onConfirm("SELECTIVE", Array.from(selectedCategories));
    }
  };

  const canProceed = mode === "FULL" ||
    (mode === "SELECTIVE" && selectedCategories.size > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Återställ Backup</h3>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(snapshot.timestamp).toLocaleString("sv-SE")} •{" "}
                {backupService.formatBytes(snapshot.size)}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!confirmStep
            ? (
              <>
                {/* Mode Selection */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white">
                    Välj återställningsläge
                  </h4>

                  <button
                    onClick={() => {
                      setMode("FULL");
                      setConfirmStep(false);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      mode === "FULL"
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <div className="text-2xl">🔄</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">
                        Full återställning
                      </div>
                      <div className="text-xs text-slate-400">
                        Ersätt ALL data med denna backup
                      </div>
                    </div>
                    {mode === "FULL" && (
                      <span className="text-indigo-400">✓</span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setMode("SELECTIVE");
                      setConfirmStep(false);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      mode === "SELECTIVE"
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                    }`}
                  >
                    <div className="text-2xl">🎯</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">
                        Selektiv återställning
                      </div>
                      <div className="text-xs text-slate-400">
                        Välj vilka kategorier som ska återställas
                      </div>
                    </div>
                    {mode === "SELECTIVE" && (
                      <span className="text-indigo-400">✓</span>
                    )}
                  </button>
                </div>

                {/* Category Selection (for SELECTIVE mode) */}
                {mode === "SELECTIVE" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">
                        Välj kategorier
                      </h4>
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={selectAll}
                          className="text-indigo-400 hover:underline"
                        >
                          Markera alla
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          onClick={selectNone}
                          className="text-slate-400 hover:underline"
                        >
                          Avmarkera alla
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORY_OPTIONS.map((cat) => {
                        const count = snapshot.entityCounts[cat.key];
                        const isDisabled = count === 0;
                        const isSelected = selectedCategories.has(cat.key);

                        return (
                          <button
                            key={cat.key}
                            onClick={() =>
                              !isDisabled && toggleCategory(cat.key)}
                            disabled={isDisabled}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                              isDisabled
                                ? "border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed"
                                : isSelected
                                ? "border-indigo-500 bg-indigo-500/10"
                                : "border-white/10 bg-white/[0.02] hover:bg-white/5"
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-white truncate">
                                {cat.label}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {count} objekt
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-indigo-400 text-sm">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {selectedCategories.size > 0 && (
                      <div className="text-xs text-slate-400 text-center">
                        {selectedCategories.size}{" "}
                        kategori{selectedCategories.size > 1 ? "er" : ""} vald
                      </div>
                    )}
                  </div>
                )}
              </>
            )
            : (
              /* Confirmation Step */
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="text-5xl mb-4">⚠️</div>
                  <h4 className="text-lg font-bold text-white mb-2">
                    Bekräfta återställning
                  </h4>
                  <p className="text-sm text-slate-400">
                    {mode === "FULL"
                      ? "ALL nuvarande data kommer att ersättas med denna backup."
                      : `${selectedCategories.size} kategori${
                        selectedCategories.size > 1 ? "er" : ""
                      } kommer att återställas.`}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <span>🛡️</span>
                    <span className="font-medium">
                      En säkerhetskopia skapas automatiskt
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400/60 mt-1 ml-6">
                    Du kan alltid ångra denna återställning
                  </p>
                </div>

                {mode === "SELECTIVE" && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-xs text-slate-500 mb-2">
                      Kategorier som återställs:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(selectedCategories).map((cat) => {
                        const option = CATEGORY_OPTIONS.find((c) =>
                          c.key === cat
                        );
                        return (
                          <span
                            key={cat}
                            className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs"
                          >
                            {option?.icon} {option?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          {confirmStep && (
            <button
              onClick={() => setConfirmStep(false)}
              className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors text-sm"
            >
              ← Tillbaka
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            Avbryt
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canProceed}
            className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              canProceed
                ? confirmStep
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-indigo-500 hover:bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            {confirmStep ? "🔄 Återställ nu" : "Fortsätt →"}
          </button>
        </div>
      </div>
    </div>
  );
}
