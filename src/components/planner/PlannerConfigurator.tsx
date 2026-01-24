import React from "react";
import { PlannerConfig } from "../../hooks/useWeeklyPlanner.ts";
import {
  Activity,
  BarChart3,
  Dumbbell,
  RefreshCw,
  Sliders,
  Zap,
} from "lucide-react";

interface PlannerConfiguratorProps {
  config: PlannerConfig;
  setConfig: React.Dispatch<React.SetStateAction<PlannerConfig>>;
  onGenerate: () => void;
  onSmartIncrease: () => void;
}

export function PlannerConfigurator(
  { config, setConfig, onGenerate, onSmartIncrease }: PlannerConfiguratorProps,
) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Sliders size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Veckoplanering
            </h2>
            <p className="text-xs text-slate-500">
              Konfigurera din ideala träningsvecka
            </p>
          </div>
        </div>

        {/* Main Inputs */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Total Volym (km)
            </label>
            <input
              type="number"
              value={config.weeklyVolumeKm}
              onChange={(e) =>
                setConfig({
                  ...config,
                  weeklyVolumeKm: Number(e.target.value),
                })}
              className="w-full bg-slate-800 border-none rounded-xl py-3 px-4 text-white font-black text-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Antal Löppass
            </label>
            <div className="flex items-center gap-2 bg-slate-800 rounded-xl p-1">
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    runSessions: Math.max(1, config.runSessions - 1),
                  })}
                className="w-8 h-full rounded-lg hover:bg-white/5 text-slate-400 flex items-center justify-center"
              >
                -
              </button>
              <span className="flex-1 text-center font-black text-white">
                {config.runSessions}
              </span>
              <button
                onClick={() =>
                  setConfig({ ...config, runSessions: config.runSessions + 1 })}
                className="w-8 h-full rounded-lg hover:bg-white/5 text-slate-400 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Långpass Ratio</span>
              <span className="text-white">
                {Math.round(config.longRunRatio * 100)}%
              </span>
            </label>
            <input
              type="range"
              min="0.2"
              max="0.5"
              step="0.05"
              value={config.longRunRatio}
              onChange={(e) =>
                setConfig({ ...config, longRunRatio: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Styrkepass
            </label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() =>
                    setConfig({ ...config, strengthSessions: num })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    config.strengthSessions === num
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                      : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onGenerate}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-sm"
          >
            <RefreshCw size={18} />
            Generera Förslag
          </button>

          <button
            onClick={onSmartIncrease}
            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-2xl border border-emerald-500/20 flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest"
          >
            <Zap size={14} />
            Smart Increase (+10%)
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Activity size={16} />
          </div>
          <div>
            <span className="block text-xl font-black text-white italic">
              {Math.round(config.weeklyVolumeKm)}
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">
              km Totalt
            </span>
          </div>
        </div>
        <div className="bg-slate-900 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center">
            <Dumbbell size={16} />
          </div>
          <div>
            <span className="block text-xl font-black text-white italic">
              {config.strengthSessions}
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">
              Styrkepass
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
