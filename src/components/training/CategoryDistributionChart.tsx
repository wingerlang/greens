/**
 * Category Distribution Chart
 * Shows the distribution of workout categories (Push/Pull/Legs/Mixed) over time.
 */

import React, { useMemo, useState } from "react";
import {
  type StrengthWorkout,
  type WorkoutCategory,
} from "../../models/strengthTypes.ts";
import {
  classifyWorkout,
  WORKOUT_CATEGORY_INFO,
} from "../../utils/workoutClassifier.ts";

interface CategoryDistributionChartProps {
  workouts: StrengthWorkout[];
  className?: string;
}

interface MonthData {
  monthKey: string; // YYYY-MM
  label: string; // "Jan", "Feb", etc.
  push: number;
  pull: number;
  legs: number;
  mixed: number;
  other: number;
  total: number;
}

export function CategoryDistributionChart(
  { workouts, className = "" }: CategoryDistributionChartProps,
) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Group workouts by month and count categories
  const monthlyData = useMemo(() => {
    if (workouts.length === 0) return [];

    // Sort workouts by date
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

    // Group by month
    const monthMap = new Map<string, MonthData>();

    sorted.forEach((w) => {
      const monthKey = w.date.substring(0, 7); // YYYY-MM
      const date = new Date(w.date);
      const label = date.toLocaleDateString("sv-SE", { month: "short" });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthKey,
          label,
          push: 0,
          pull: 0,
          legs: 0,
          mixed: 0,
          other: 0,
          total: 0,
        });
      }

      const category = w.workoutCategory || classifyWorkout(w);
      const data = monthMap.get(monthKey)!;
      data[category]++;
      data.total++;
    });

    return Array.from(monthMap.values());
  }, [workouts]);

  if (monthlyData.length < 2) {
    return null; // Need at least 2 months of data
  }

  // Chart dimensions - narrower but taller
  const width = 200;
  const height = 120;
  const padding = { left: 0, right: 0, top: 5, bottom: 20 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Take last 12 months max
  const displayData = monthlyData.slice(-12);
  const maxTotal = Math.max(...displayData.map((d) => d.total), 1);

  const categories: WorkoutCategory[] = ["push", "pull", "legs", "mixed"];
  const colors: Record<WorkoutCategory, string> = {
    push: "#fb923c", // orange-400
    pull: "#60a5fa", // blue-400
    legs: "#fb7185", // rose-400
    mixed: "#a78bfa", // violet-400
    other: "#94a3b8", // slate-400
  };

  // Calculate cumulative offsets for stacked area
  const getCumulativeHeight = (
    dataIndex: number,
    upToCategory: WorkoutCategory,
  ) => {
    const catIndex = categories.indexOf(upToCategory);
    let sum = 0;
    for (let i = 0; i <= catIndex; i++) {
      sum += displayData[dataIndex][categories[i]];
    }
    return (sum / maxTotal) * chartHeight;
  };

  // Calculate bar width
  const barWidth = chartWidth / displayData.length * 0.8;
  const barGap = chartWidth / displayData.length * 0.2;

  return (
    <div className={`bg-slate-800/30 rounded-xl p-3 w-1/2 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs">📊</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase">
            Fördelning/Månad
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: colors[cat] }}
              />
              <span className="text-[8px] text-slate-500 uppercase font-bold">
                {WORKOUT_CATEGORY_INFO[cat].labelSe}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-28"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Stacked bars for each month */}
          {displayData.map((data, dataIndex) => {
            const barX = padding.left + dataIndex * (barWidth + barGap) +
              barGap / 2;
            let currentY = padding.top + chartHeight;

            return (
              <g
                key={data.monthKey}
                onMouseEnter={() => setHoveredIndex(dataIndex)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {categories.map((cat) => {
                  const value = data[cat];
                  if (value === 0) return null;

                  const barHeight = (value / maxTotal) * chartHeight;
                  currentY -= barHeight;

                  return (
                    <rect
                      key={cat}
                      x={barX}
                      y={currentY}
                      width={barWidth}
                      height={barHeight}
                      fill={colors[cat]}
                      opacity={hoveredIndex === dataIndex ? 1 : 0.7}
                      rx={2}
                      className="transition-opacity duration-150"
                    />
                  );
                })}

                {/* Month label */}
                <text
                  x={barX + barWidth / 2}
                  y={height - 5}
                  textAnchor="middle"
                  className="text-[7px] fill-slate-600 uppercase"
                >
                  {data.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && displayData[hoveredIndex] && (
          <div
            className="absolute bg-slate-900 border border-white/10 rounded-lg p-2 text-[10px] shadow-xl z-10 pointer-events-none"
            style={{
              left: `${((hoveredIndex + 0.5) / displayData.length) * 100}%`,
              top: "0",
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-bold text-white mb-1">
              {displayData[hoveredIndex].monthKey}
            </div>
            <div className="space-y-0.5">
              {categories.map((cat) => {
                const val = displayData[hoveredIndex][cat];
                if (val === 0) return null;
                return (
                  <div key={cat} className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: colors[cat] }}
                    />
                    <span className="text-slate-400">
                      {WORKOUT_CATEGORY_INFO[cat].labelSe}:
                    </span>
                    <span className="text-white font-bold">{val}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/10 mt-1 pt-1 text-slate-500">
              Totalt:{" "}
              <span className="text-white font-bold">
                {displayData[hoveredIndex].total}
              </span>{" "}
              pass
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
