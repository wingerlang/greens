// Weight History Section with chart and export
import React, { useEffect, useState } from "react";
import { useWeightHistory } from "../hooks/useWeightHistory.ts";
import { profileService } from "../../../services/profileService.ts";

interface WeightHistorySectionProps {
  currentWeight: number;
  targetWeight: number;
}

export function WeightHistorySection(
  { currentWeight, targetWeight }: WeightHistorySectionProps,
) {
  const { history, loading, logWeight } = useWeightHistory();
  const [newWeight, setNewWeight] = useState("");
  const [newDate, setNewDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const handleLogWeight = async () => {
    if (!newWeight) return;
    await logWeight(Number(newWeight), newDate);
    setNewWeight("");
  };

  const handleExport = async () => {
    const data = await profileService.exportData();
    if (data) {
      profileService.downloadExport(data);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-500 text-center py-4">
        Laddar vikthistorik...
      </div>
    );
  }

  // Sparkline data
  const chartData = history.slice(-30);
  const minWeight = chartData.length > 0
    ? Math.min(...chartData.map((h) => h.weight))
    : 0;
  const maxWeight = chartData.length > 0
    ? Math.max(...chartData.map((h) => h.weight))
    : 100;
  const range = maxWeight - minWeight || 1;

  return (
    <div className="space-y-4">
      {/* Sparkline Chart */}
      {chartData.length > 1 && (
        <div className="bg-slate-800/50 rounded-xl p-4">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>{maxWeight.toFixed(1)} kg</span>
            <span>Senaste 30 mätningar</span>
          </div>
          <div className="h-20 flex items-end gap-0.5">
            {chartData.map((h, i) => {
              const height = ((h.weight - minWeight) / range) * 100;
              const isLatest = i === chartData.length - 1;
              return (
                <div
                  key={`${h.date}-${i}`}
                  className={`flex-1 rounded-t ${
                    isLatest ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${h.weight} kg - ${h.date}`}
                />
              );
            })}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {minWeight.toFixed(1)} kg
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-slate-500 text-xs uppercase">Nuvarande</div>
          <div className="text-white text-xl font-bold">{currentWeight} kg</div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-slate-500 text-xs uppercase">Mål</div>
          <div className="text-amber-400 text-xl font-bold">
            {targetWeight} kg
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 text-center">
          <div className="text-slate-500 text-xs uppercase">Kvar</div>
          <div
            className={`text-xl font-bold ${
              currentWeight <= targetWeight
                ? "text-emerald-400"
                : "text-red-400"
            }`}
          >
            {Math.abs(currentWeight - targetWeight).toFixed(1)} kg
          </div>
        </div>
      </div>

      {/* Add Weight */}
      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          placeholder="Ny vikt (kg)"
          value={newWeight}
          onChange={(e) => setNewWeight(e.target.value)}
          className="flex-1 bg-slate-800 rounded-lg p-2 text-white border border-white/10 text-sm"
        />
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="bg-slate-800 rounded-lg p-2 text-white border border-white/10 text-sm"
        />
        <button
          onClick={handleLogWeight}
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600"
        >
          + Logga
        </button>
      </div>

      {/* History Table */}
      {history.length > 0 && (
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase">
                <th className="text-left p-2">Datum</th>
                <th className="text-right p-2">Vikt</th>
                <th className="text-right p-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {history.slice().reverse().slice(0, 10).map((h, i, arr) => {
                const prev = arr[i + 1];
                const delta = prev ? h.weight - prev.weight : 0;
                return (
                  <tr
                    key={`${h.date}-${i}`}
                    className="border-t border-white/5"
                  >
                    <td className="p-2 text-slate-400">
                      {new Date(h.date).toLocaleDateString("sv-SE")}
                    </td>
                    <td className="p-2 text-right text-white font-medium">
                      {h.weight} kg
                    </td>
                    <td
                      className={`p-2 text-right ${
                        delta < 0
                          ? "text-emerald-400"
                          : delta > 0
                          ? "text-red-400"
                          : "text-slate-500"
                      }`}
                    >
                      {delta !== 0
                        ? (delta > 0 ? "+" : "") + delta.toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        className="w-full py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-700 flex items-center justify-center gap-2"
      >
        📤 Exportera all data (JSON)
      </button>
    </div>
  );
}
