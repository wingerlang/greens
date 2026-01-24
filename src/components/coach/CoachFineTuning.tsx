import React, { useEffect, useState } from "react";
import { useData } from "../../context/DataContext.tsx";
import { DEFAULT_FINE_TUNING, FineTuningConfig } from "../../models/types.ts";

interface CoachFineTuningProps {
  onSave?: () => void;
}

export function CoachFineTuning({ onSave }: CoachFineTuningProps) {
  const { coachConfig, updateCoachConfig } = useData();

  const [config, setConfig] = useState<FineTuningConfig>(
    coachConfig?.fineTuning || DEFAULT_FINE_TUNING,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (coachConfig?.fineTuning) {
      setConfig(coachConfig.fineTuning);
    }
  }, [coachConfig?.fineTuning]);

  const handleSave = () => {
    updateCoachConfig({ fineTuning: config });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave?.();
  };

  const WEEKDAYS = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

  const toggleStrengthDay = (day: number) => {
    setConfig((prev) => ({
      ...prev,
      strengthDays: prev.strengthDays.includes(day)
        ? prev.strengthDays.filter((d) => d !== day)
        : [...prev.strengthDays, day],
    }));
  };

  return (
    <div className="coach-fine-tuning space-y-5">
      {/* Sessions Per Week */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Pass per vecka
          </label>
          <span className="text-xl font-black text-emerald-400">
            {config.sessionsPerWeek}
          </span>
        </div>
        <input
          type="range"
          min="2"
          max="7"
          value={config.sessionsPerWeek}
          onChange={(e) =>
            setConfig({ ...config, sessionsPerWeek: parseInt(e.target.value) })}
          className="w-full accent-emerald-500"
        />
        <div className="flex justify-between text-[8px] text-slate-600 font-bold mt-1">
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
          <span>6</span>
          <span>7</span>
        </div>
      </div>

      {/* Load Index */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Belastningsindex
          </label>
          <span
            className={`text-xl font-black ${
              config.loadIndex <= 3
                ? "text-emerald-400"
                : config.loadIndex <= 6
                ? "text-amber-400"
                : "text-rose-400"
            }`}
          >
            {config.loadIndex}/10
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={config.loadIndex}
          onChange={(e) =>
            setConfig({ ...config, loadIndex: parseInt(e.target.value) })}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[8px] text-slate-600 font-bold mt-1">
          <span>Lätt</span>
          <span>Måttlig</span>
          <span>Tuff</span>
        </div>
      </div>

      {/* Long Run % */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Långpass-andel
          </label>
          <span className="text-xl font-black text-blue-400">
            {config.longRunPercentage}%
          </span>
        </div>
        <input
          type="range"
          min="15"
          max="40"
          value={config.longRunPercentage}
          onChange={(e) =>
            setConfig({
              ...config,
              longRunPercentage: parseInt(e.target.value),
            })}
          className="w-full accent-blue-500"
        />
        <p className="text-[9px] text-slate-500 mt-2 italic">
          % av veckovolymen på långpasset
        </p>
      </div>

      {/* Easy Pace Adjustment */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Lugnt tempo-justering
          </label>
          <span className="text-lg font-black text-indigo-400">
            {config.easyPaceAdjustmentSec > 0 ? "+" : ""}
            {config.easyPaceAdjustmentSec}s/km
          </span>
        </div>
        <input
          type="range"
          min="-30"
          max="30"
          value={config.easyPaceAdjustmentSec}
          onChange={(e) =>
            setConfig({
              ...config,
              easyPaceAdjustmentSec: parseInt(e.target.value),
            })}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-[8px] text-slate-600 font-bold mt-1">
          <span>Snabbare</span>
          <span>Standard</span>
          <span>Lugnare</span>
        </div>
      </div>

      {/* Quality Session Ratio */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Kvalitetspass-andel
          </label>
          <span className="text-lg font-black text-rose-400">
            {Math.round(config.qualitySessionRatio * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="40"
          value={Math.round(config.qualitySessionRatio * 100)}
          onChange={(e) =>
            setConfig({
              ...config,
              qualitySessionRatio: parseInt(e.target.value) / 100,
            })}
          className="w-full accent-rose-500"
        />
        <p className="text-[9px] text-slate-500 mt-2 italic">
          Intervaller, tempo, repetitioner
        </p>
      </div>

      {/* Strength Integration */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
        <div className="flex justify-between items-center mb-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Inkludera styrka
          </label>
          <button
            onClick={() =>
              setConfig({
                ...config,
                includeStrength: !config.includeStrength,
              })}
            className={`w-12 h-6 rounded-full transition-all ${
              config.includeStrength ? "bg-emerald-500" : "bg-slate-700"
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${
                config.includeStrength ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {config.includeStrength && (
          <div className="flex gap-1.5 flex-wrap">
            {WEEKDAYS.map((day, i) => (
              <button
                key={i}
                onClick={() => toggleStrengthDay(i)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                  config.strengthDays.includes(i)
                    ? "bg-violet-500 text-white"
                    : "bg-slate-800 text-slate-500 hover:text-white"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tempo Intensity */}
      <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
          Tempo-intensitet
        </label>
        <div className="flex gap-2">
          {(["conservative", "moderate", "aggressive"] as const).map(
            (level) => (
              <button
                key={level}
                onClick={() => setConfig({ ...config, tempoIntensity: level })}
                className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                  config.tempoIntensity === level
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-800 text-slate-500 hover:text-white"
                }`}
              >
                {level === "conservative"
                  ? "Försiktig"
                  : level === "moderate"
                  ? "Måttlig"
                  : "Aggressiv"}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-2">
        {saved && (
          <span className="text-emerald-400 font-black text-[10px] uppercase animate-bounce self-center">
            ✓ Sparat!
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2.5 bg-emerald-500 text-slate-950 font-black rounded-xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-[10px] active:scale-95"
        >
          Spara Finjustering
        </button>
      </div>
    </div>
  );
}
