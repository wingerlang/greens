import React, { useEffect, useState } from "react";
import { Settings, Trash2, X, Zap } from "lucide-react";
import { useData } from "../../context/DataContext.tsx";
import { getISODate } from "../../models/types.ts";

interface MeasurementEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  initialWeight?: string;
  initialWaist?: string;
  initialChest?: string;
}

export const MeasurementEntryModal: React.FC<MeasurementEntryModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  initialWeight = "",
  initialWaist = "",
  initialChest = "",
}) => {
  const {
    addWeightEntry,
    bulkAddWeightEntries,
    deleteWeightEntry,
    weightEntries,
  } = useData();
  const [tempWeight, setTempWeight] = useState(initialWeight);
  const [tempWaist, setTempWaist] = useState(initialWaist);
  const [tempChest, setTempChest] = useState(initialChest);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  // Reset state when opening/changing props
  useEffect(() => {
    if (isOpen) {
      setTempWeight(initialWeight);
      setTempWaist(initialWaist);
      setTempChest(initialChest);
      setShowBulkImport(false);
      setBulkInput("");
    }
  }, [isOpen, initialWeight, initialWaist, initialChest]);

  if (!isOpen) return null;

  const today = getISODate();
  const isToday = selectedDate === today;

  const getRelativeDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    const d = new Date(dateStr).toISOString().split("T")[0];
    if (d === today) return "Idag";
    const yesterday =
      new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (d === yesterday) return "Igår";

    // Calculate diff in days
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(d).getTime()) / 86400000,
    );
    if (diff < 7) return `${diff} dgr sen`;
    return dateStr;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(tempWeight.replace(",", "."));
    const waist = tempWaist
      ? parseFloat(tempWaist.replace(",", "."))
      : undefined;
    const chest = tempChest
      ? parseFloat(tempChest.replace(",", "."))
      : undefined;

    // Either weight or at least one measurement must be provided
    if (!isNaN(w) || waist !== undefined || chest !== undefined) {
      addWeightEntry(!isNaN(w) ? w : 0, selectedDate, waist, chest);
      onClose();
    }
  };

  const handleBulkImport = () => {
    const entries = bulkInput.split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // Split on tab, comma, or multiple spaces
        const parts = line.split(/[\t, ]+/);
        // Expect: Date Weight [Waist] [Chest]
        if (parts.length >= 2) {
          const date = parts[0];
          const weight = parseFloat(parts[1].replace(",", "."));
          const waist = parts.length > 2
            ? parseFloat(parts[2].replace(",", "."))
            : undefined;
          // Note: Basic parsing, might need to be more robust if chest is 2nd optional arg
          // If 4 parts: Date Weight Waist Chest? Or Date Weight Chest?
          // Let's assume standard format Date Weight Waist Chest for now
          const chest = parts.length > 3
            ? parseFloat(parts[3].replace(",", "."))
            : undefined;

          if (!isNaN(weight)) {
            return { date, weight, waist, chest };
          }
        }
        return null;
      })
      .filter((
        e,
      ): e is {
        date: string;
        weight: number;
        waist: number | undefined;
        chest: number | undefined;
      } => e !== null);

    if (entries.length > 0) {
      bulkAddWeightEntries(entries as any);
      setBulkInput("");
      setShowBulkImport(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] overflow-y-auto">
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                  Vägning & mätning
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkImport(!showBulkImport)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                  title="Bulk-import"
                >
                  <Zap
                    size={20}
                    className={showBulkImport ? "text-blue-500" : ""}
                  />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Date indicator - prominent when not today */}
            <div
              className={`mb-6 px-4 py-3 rounded-2xl border flex items-center gap-3 ${
                isToday
                  ? "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
                  : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
              }`}
            >
              <div className={`text-2xl ${isToday ? "opacity-50" : ""}`}>
                {isToday ? "📅" : "⏮️"}
              </div>
              <div>
                <div
                  className={`text-sm font-black ${
                    isToday
                      ? "text-slate-600 dark:text-slate-400"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {getRelativeDateLabel(selectedDate)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {new Date(selectedDate).toLocaleDateString("sv-SE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </div>
              </div>
              {!isToday && (
                <div className="ml-auto text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider bg-amber-100 dark:bg-amber-500/20 px-2 py-1 rounded-lg">
                  Historik
                </div>
              )}
            </div>

            {showBulkImport
              ? (
                <div className="space-y-4">
                  <textarea
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder="Klistra in data (Datum Vikt [Midja] [Bröst])..."
                    className="w-full h-32 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/20"
                  />
                  <p className="text-[10px] text-slate-400 px-1">
                    Format: YYYY-MM-DD Vikt(kg) [Midja(cm)] [Bröst(cm)]
                  </p>
                  <button
                    onClick={handleBulkImport}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-lg transition-all"
                  >
                    Importera Data
                  </button>
                </div>
              )
              : (
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Vikt (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        autoFocus
                        value={tempWeight}
                        onChange={(e) => setTempWeight(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-3xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 ring-blue-500/20"
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Midja (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tempWaist}
                        onChange={(e) => setTempWaist(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 ring-blue-500/20"
                        placeholder="-"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Bröst (cm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tempChest}
                        onChange={(e) => setTempChest(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 ring-blue-500/20"
                        placeholder="-"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Spara
                  </button>
                </form>
              )}

            <div className="mt-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">
                Historik (Senaste 5)
              </h3>
              <div className="space-y-2">
                {/* WeightEntries is sorted DESC (Newest First), so we just take top 5 */}
                {weightEntries.slice(0, 5).map((entry) => (
                  <div
                    key={entry.date}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl group transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">
                        {entry.date}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {entry.weight.toFixed(1)}{" "}
                          <span className="text-[10px] text-slate-400">kg</span>
                        </span>
                        {entry.waist && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700 mx-1">
                              |
                            </span>
                            <span className="text-sm font-bold text-emerald-500">
                              {entry.waist}{" "}
                              <span className="text-[10px] font-normal opacity-70">
                                cm (midja)
                              </span>
                            </span>
                          </>
                        )}
                        {entry.chest && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700 mx-1">
                              |
                            </span>
                            <span className="text-sm font-bold text-indigo-500">
                              {entry.chest}{" "}
                              <span className="text-[10px] font-normal opacity-70">
                                cm (bröst)
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempWeight(entry.weight.toString());
                          setTempWaist((entry.waist || "").toString());
                          setTempChest((entry.chest || "").toString());
                          setShowBulkImport(false);
                        }}
                        className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-500 transition-colors"
                        title="Redigera"
                      >
                        <Settings size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              "Vill du verkligen ta bort denna loggning?",
                            )
                          ) {
                            deleteWeightEntry(entry.id);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg text-rose-500 transition-colors"
                        title="Ta bort"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
