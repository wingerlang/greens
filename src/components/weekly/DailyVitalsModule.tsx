import React, { useMemo, useState } from "react";
import { DailyVitals as DailyVitalsType } from "../../models/types.ts";
import { useData } from "../../context/DataContext.tsx";
import { useSettings } from "../../context/SettingsContext.tsx";
import { analyzeSleep, getRecentVitals } from "../../utils/vitalsUtils.ts";

interface DailyVitalsProps {
  vitals: DailyVitalsType;
  onUpdate: (updates: Partial<DailyVitalsType>) => void;
}

export function DailyVitalsModule({ vitals, onUpdate }: DailyVitalsProps) {
  const { dailyVitals } = useData();
  const { settings } = useSettings();
  const [showAnalysis, setShowAnalysis] = useState(false);

  const recentVitals = useMemo(() => getRecentVitals(dailyVitals, 7), [
    dailyVitals,
  ]);
  const sleepInfo = useMemo(() => analyzeSleep(vitals.sleep), [vitals.sleep]);

  const waterGoal = settings.dailyWaterGoal || 8;

  // Water logic
  const handleWaterClick = (count: number) => {
    if (vitals.water === count) {
      onUpdate({ water: count - 1 });
    } else {
      onUpdate({ water: count });
    }
  };

  // Caffeine logic - increments water too by default
  const handleCaffeine = (type: "coffee" | "nocco" | "tea") => {
    const currentCaffeine = vitals.caffeine || 0;
    onUpdate({
      caffeine: currentCaffeine + 1,
      water: vitals.water + 1, // Coffee is mostly water
    });
  };

  // Sleep logic
  const handleSleepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ sleep: parseFloat(e.target.value) || 0 });
  };

  const sleepColorMap: Record<string, any> = {
    rose: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20",
      accent: "accent-rose-500",
      hover: "hover:accent-rose-400",
      bar: "bg-rose-500/40",
    },
    amber: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      accent: "accent-amber-500",
      hover: "hover:accent-amber-400",
      bar: "bg-amber-500/40",
    },
    emerald: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      accent: "accent-emerald-500",
      hover: "hover:accent-emerald-400",
      bar: "bg-emerald-500/40",
    },
  };
  const sleepClasses = sleepColorMap[sleepInfo.color];

  return (
    <div className="daily-vitals-module mt-4 pt-4 border-t border-white/5 space-y-4">
      {/* Minimal Header with Analysis Toggle */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
          Bio-Vitals
        </span>
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="text-[9px] font-bold text-emerald-400/60 hover:text-emerald-400 transition-colors uppercase tracking-widest"
        >
          {showAnalysis ? "Dölj Analys" : "Visa Analys"}
        </button>
      </div>

      {/* Analysis Section (Expandable) */}
      {showAnalysis && (
        <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${sleepClasses.bg} ${sleepClasses.text}`}
            >
              {sleepInfo.status}
            </span>
            <p className="text-[10px] text-slate-400 leading-relaxed italic">
              {sleepInfo.description}
            </p>
          </div>
        </div>
      )}

      {/* Water & Caffeine Row */}
      {(settings.showWater !== false) && (
        <div className="flex gap-4">
          {/* Water (Slimmer) */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-end px-1">
              <span className="text-[10px] font-bold text-sky-400 flex items-center gap-1">
                💧 {vitals.water}
                <span className="opacity-40">/{waterGoal}</span>
              </span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  onClick={() => handleWaterClick(i)}
                  className={`h-1.5 flex-1 rounded-full cursor-pointer transition-all ${
                    vitals.water >= i
                      ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]"
                      : "bg-slate-800"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Caffeine (New) */}
          <div className="w-24 space-y-2">
            <div className="flex justify-between items-end px-1">
              <span className="text-[10px] font-bold text-amber-400">
                ⚡ {vitals.caffeine || 0}
              </span>
            </div>
            <div className="flex gap-1 justify-end">
              <button
                onClick={() => handleCaffeine("coffee")}
                className="text-xs hover:scale-110 transition-transform"
                title="Kaffe"
              >
                ☕
              </button>
              <button
                onClick={() => handleCaffeine("nocco")}
                className="text-xs hover:scale-110 transition-transform"
                title="Nocco"
              >
                🥤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleep Slider (Slimmer) */}
      <div className="space-y-2">
        <div className="flex justify-between items-end px-1">
          <span className="text-[10px] font-bold text-slate-400">SÖMN</span>
          <span className={`text-xs font-black ${sleepClasses.text}`}>
            {vitals.sleep.toFixed(1)}h
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="12"
          step="0.5"
          value={vitals.sleep}
          onChange={handleSleepChange}
          className={`w-full h-1 bg-slate-800/50 rounded-lg appearance-none cursor-pointer ${sleepClasses.accent} ${sleepClasses.hover} transition-all`}
        />
      </div>

      {/* Mini Trend - Combined & Compact */}
      <div className="h-6 flex items-end gap-1 px-1 opacity-50 hover:opacity-100 transition-opacity">
        {recentVitals.map((day, i) => (
          <div
            key={i}
            className="flex-1 h-full flex flex-col justify-end gap-[1px]"
          >
            <div
              className="w-full bg-sky-400/40 rounded-t-[1px]"
              style={{
                height: `${
                  Math.min(100, (day.vitals.water / waterGoal) * 100)
                }%`,
              }}
            />
            <div
              className="w-full bg-indigo-400/40 rounded-t-[1px]"
              style={{
                height: `${Math.min(100, (day.vitals.sleep / 12) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
