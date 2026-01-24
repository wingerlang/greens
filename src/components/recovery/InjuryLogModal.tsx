import React, { useState } from "react";
import {
  BodyPart,
  InjuryLog,
  InjuryStatus,
  InjuryType,
  PainLevel,
} from "../../models/types.ts";
import { useData } from "../../context/DataContext.tsx";

interface InjuryLogModalProps {
  bodyPart: BodyPart;
  onClose: () => void;
  existingLog?: InjuryLog;
}

export function InjuryLogModal(
  { bodyPart, onClose, existingLog }: InjuryLogModalProps,
) {
  const { addInjuryLog, updateInjuryLog, deleteInjuryLog } = useData();

  // Form State
  const [severity, setSeverity] = useState<PainLevel>(
    existingLog?.severity || 5,
  );
  const [type, setType] = useState<InjuryType>(existingLog?.type || "soreness");
  const [status, setStatus] = useState<InjuryStatus>(
    existingLog?.status || "active",
  );
  const [side, setSide] = useState<"left" | "right" | "both" | "center">(
    existingLog?.side || "right",
  );
  const [notes, setNotes] = useState(existingLog?.notes || "");

  const handleSave = () => {
    if (existingLog) {
      updateInjuryLog(existingLog.id, { severity, type, status, side, notes });
    } else {
      addInjuryLog({
        bodyPart,
        severity,
        type,
        status,
        side,
        notes,
        date: new Date().toISOString().split("T")[0],
        userId: "user-1", // Fallback
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (existingLog) {
      deleteInjuryLog(existingLog.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white capitalize flex items-center gap-2">
              🩹 {bodyPart.replace("_", " ")}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Severity Slider */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-slate-400 text-sm font-bold uppercase">
                  Smärtnivå
                </label>
                <span
                  className={`text-2xl font-black ${
                    severity > 7
                      ? "text-rose-500"
                      : severity > 4
                      ? "text-amber-500"
                      : "text-emerald-500"
                  }`}
                >
                  {severity}/10
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={severity}
                onChange={(e) =>
                  setSeverity(parseInt(e.target.value) as PainLevel)}
                className="w-full h-3 bg-slate-800 rounded-full appearance-none accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase mt-1">
                <span>Lätt känning</span>
                <span>Smärtsamt</span>
                <span>Outhärdligt</span>
              </div>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase block mb-2">
                  Typ
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as InjuryType)}
                  className="w-full bg-slate-800 border-none rounded-lg p-3 text-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="soreness">Träningsvärk</option>
                  <option value="pain">Smärta</option>
                  <option value="tightness">Stelhet</option>
                  <option value="injury">Akut Skada</option>
                  <option value="fatigue">Utmattning</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase block mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InjuryStatus)}
                  className="w-full bg-slate-800 border-none rounded-lg p-3 text-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Aktiv</option>
                  <option value="recovering">Återhämtar</option>
                  <option value="healed">Läkt (Arkivera)</option>
                  <option value="chronic">Kronisk</option>
                </select>
              </div>
            </div>

            {/* Side Selector */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase block mb-2">
                Sida
              </label>
              <div className="flex bg-slate-800 rounded-lg p-1">
                {["left", "right", "both", "center"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s as any)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${
                      side === s
                        ? "bg-indigo-500 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {s === "left"
                      ? "Vänster"
                      : s === "right"
                      ? "Höger"
                      : s === "both"
                      ? "Båda"
                      : "Center"}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase block mb-2">
                Anteckningar
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="T.ex. Kändes vid knäböj..."
                className="w-full bg-slate-800 border-none rounded-lg p-3 text-white placeholder-slate-600 h-24 resize-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-2">
              {existingLog && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-bold transition-colors"
                >
                  Radera
                </button>
              )}
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20"
              >
                {existingLog ? "Uppdatera" : "Logga Skada"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
