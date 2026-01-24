import React, { useMemo } from "react";
import { StrengthWorkout } from "../../models/strengthTypes.ts";

interface ACWRGaugeProps {
  workouts: StrengthWorkout[];
}

interface ACWRData {
  acuteLoad: number; // Last 7 days
  chronicLoad: number; // 4-week rolling average
  ratio: number; // ACWR
  riskLevel: "low" | "optimal" | "high" | "very-high";
  message: string;
}

function calculateACWR(workouts: StrengthWorkout[]): ACWRData {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(now.getDate() - 28);

  let acuteLoad = 0;
  let chronicLoad = 0;

  workouts.forEach((w) => {
    const workoutDate = new Date(w.date);
    const volume = w.totalVolume || 0;

    if (workoutDate >= oneWeekAgo) {
      acuteLoad += volume;
    }
    if (workoutDate >= fourWeeksAgo) {
      chronicLoad += volume;
    }
  });

  // Chronic load is the 4-week average
  const chronicAvg = chronicLoad / 4;

  // Avoid division by zero
  const ratio = chronicAvg > 0 ? acuteLoad / chronicAvg : 0;

  // Determine risk level based on ACWR
  // <0.8 = Undertraining (low risk but suboptimal)
  // 0.8-1.3 = Optimal ("sweet spot")
  // 1.3-1.5 = Moderate injury risk
  // >1.5 = High injury risk
  let riskLevel: "low" | "optimal" | "high" | "very-high" = "optimal";
  let message = "";

  if (ratio < 0.8) {
    riskLevel = "low";
    message = "Underträning – du kan öka belastningen";
  } else if (ratio <= 1.3) {
    riskLevel = "optimal";
    message = "Optimal belastning – fortsätt så!";
  } else if (ratio <= 1.5) {
    riskLevel = "high";
    message = "Ökad skaderisk – var försiktig";
  } else {
    riskLevel = "very-high";
    message = "Hög skaderisk – överväg vila";
  }

  return {
    acuteLoad,
    chronicLoad: chronicAvg,
    ratio,
    riskLevel,
    message,
  };
}

export function ACWRGauge({ workouts }: ACWRGaugeProps) {
  const data = useMemo(() => calculateACWR(workouts), [workouts]);

  if (workouts.length < 7) {
    return (
      <div className="text-center text-slate-500 py-6">
        <p className="text-lg mb-1">⚖️</p>
        <p className="text-[10px] uppercase tracking-widest font-bold">
          Behöver minst 4 veckors data
        </p>
      </div>
    );
  }

  const { ratio, riskLevel, message, acuteLoad, chronicLoad } = data;

  // Color and styling based on risk level
  const colorConfig = {
    "low": {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      text: "text-blue-400",
      glow: "shadow-blue-500/20",
      icon: "❄️",
    },
    "optimal": {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
      glow: "shadow-emerald-500/20",
      icon: "✅",
    },
    "high": {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-400",
      glow: "shadow-amber-500/20",
      icon: "⚠️",
    },
    "very-high": {
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      text: "text-rose-400",
      glow: "shadow-rose-500/20",
      icon: "🔴",
    },
  };

  const config = colorConfig[riskLevel];

  // Calculate needle position (0 to 180 degrees)
  // Map ratio 0-2 to 0-180 degrees
  const clampedRatio = Math.min(Math.max(ratio, 0), 2);
  const needleAngle = (clampedRatio / 2) * 180 - 90; // -90 to 90 degrees

  return (
    <div
      className={`${config.bg} ${config.border} border rounded-2xl p-4 shadow-lg ${config.glow}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Workload Ratio
          </h3>
          <p className="text-[9px] text-slate-600 font-bold">
            ACWR (Akut:Kronisk)
          </p>
        </div>
        <span className="text-xl">{config.icon}</span>
      </div>

      {/* Gauge visualization */}
      <div className="relative h-20 mb-4">
        {/* Semi-circle gauge background */}
        <div className="absolute inset-x-0 bottom-0 h-16 overflow-hidden">
          <div className="relative w-full h-32">
            {/* Gradient arc */}
            <div
              className="absolute inset-0 rounded-t-full"
              style={{
                background:
                  "conic-gradient(from 180deg, #3b82f6 0deg, #10b981 72deg, #10b981 117deg, #f59e0b 144deg, #ef4444 180deg, transparent 180deg)",
              }}
            />
            {/* Inner cut-out */}
            <div className="absolute inset-4 bg-slate-900 rounded-t-full" />

            {/* Needle */}
            <div
              className="absolute bottom-0 left-1/2 w-1 h-12 origin-bottom transition-transform duration-700"
              style={{
                transform: `translateX(-50%) rotate(${needleAngle}deg)`,
              }}
            >
              <div
                className={`w-1 h-full ${
                  config.bg.replace("/10", "")
                } rounded-full`}
              />
            </div>

            {/* Center dot */}
            <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 bg-slate-800 rounded-full border-2 border-white/20" />
          </div>
        </div>

        {/* Ratio value */}
        <div className="absolute inset-0 flex items-center justify-center pt-4">
          <div className="text-center">
            <span className={`text-3xl font-black ${config.text}`}>
              {ratio.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase mb-3">
        <span>0</span>
        <span className="text-blue-400">0.8</span>
        <span className="text-emerald-400">1.0</span>
        <span className="text-amber-400">1.3</span>
        <span className="text-rose-400">2.0</span>
      </div>

      {/* Message */}
      <div
        className={`text-center text-[10px] font-bold uppercase tracking-wider ${config.text} mb-3`}
      >
        {message}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
        <div>
          <p className="text-[8px] text-slate-600 uppercase tracking-widest">
            Akut (7d)
          </p>
          <p className="text-sm font-bold text-white">
            {(acuteLoad / 1000).toFixed(1)}t
          </p>
        </div>
        <div>
          <p className="text-[8px] text-slate-600 uppercase tracking-widest">
            Kronisk (4v snitt)
          </p>
          <p className="text-sm font-bold text-white">
            {(chronicLoad / 1000).toFixed(1)}t
          </p>
        </div>
      </div>
    </div>
  );
}
