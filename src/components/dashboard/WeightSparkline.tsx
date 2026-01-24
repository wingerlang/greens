import React, { useState } from "react";

/**
 * Interactive weight trend sparkline chart.
 * Shows data points that can be hovered for details and clicked for editing.
 * Supports multiple metrics (weight, waist, chest).
 */
export const WeightSparkline = ({
  data,
  dates,
  onPointClick,
}: {
  data: { weight: number; waist?: number; chest?: number }[];
  dates: string[];
  onPointClick?: (index: number) => void;
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  if (data.length < 2) {
    return (
      <div className="h-[40px] w-full flex items-center justify-center text-[8px] text-slate-300 uppercase font-bold tracking-widest bg-slate-50/50 dark:bg-slate-800/20 rounded-xl">
        Trend saknas
      </div>
    );
  }

  // Collect values for dual scales
  const weightValues: number[] = [];
  const cmValues: number[] = [];

  data.forEach((d) => {
    if (d.weight && d.weight > 0) weightValues.push(d.weight);
    if (d.waist) cmValues.push(d.waist);
    if (d.chest) cmValues.push(d.chest);
  });

  if (weightValues.length === 0 && cmValues.length === 0) return null;

  // Weight Scale (Left Axis)
  const wMin = weightValues.length > 0 ? Math.min(...weightValues) : 70;
  const wMax = weightValues.length > 0 ? Math.max(...weightValues) : 80;
  const wPadding = weightValues.length > 0 ? (wMax - wMin) * 0.15 || 1 : 1;
  const wAdjMin = wMin - wPadding;
  const wAdjMax = wMax + wPadding;
  const wRange = wAdjMax - wAdjMin || 1;

  // CM Scale (Right Axis)
  const cmMin = cmValues.length > 0 ? Math.min(...cmValues) : 0;
  const cmMax = cmValues.length > 0 ? Math.max(...cmValues) : 100;
  const cmPadding = cmValues.length > 0 ? (cmMax - cmMin) * 0.15 || 5 : 5;
  const cmAdjMin = cmMin - cmPadding;
  const cmAdjMax = cmMax + cmPadding;
  const cmRange = cmAdjMax - cmAdjMin || 1;

  const width = 100;
  const heightFixed = 90;

  // Generate points helpers
  const getX = (i: number) => (i / (data.length - 1)) * width;

  // Y for Weight
  const getYWeight = (val: number) =>
    heightFixed - ((val - wAdjMin) / wRange) * heightFixed;

  // Y for CM
  const getYCm = (val: number) =>
    heightFixed - ((val - cmAdjMin) / cmRange) * heightFixed;

  const weightPoints = data.map((d, i) => {
    if (!d.weight || d.weight <= 0) return null;
    return { x: getX(i), y: getYWeight(d.weight), value: d.weight, index: i };
  }).filter((p) => p !== null) as {
    x: number;
    y: number;
    value: number;
    index: number;
  }[];

  const waistPoints = data.map((d, i) => {
    if (!d.waist) return null;
    return { x: getX(i), y: getYCm(d.waist), value: d.waist, index: i };
  }).filter((p) => p !== null) as {
    x: number;
    y: number;
    value: number;
    index: number;
  }[];

  const chestPoints = data.map((d, i) => {
    if (!d.chest) return null;
    return { x: getX(i), y: getYCm(d.chest), value: d.chest, index: i };
  }).filter((p) => p !== null) as {
    x: number;
    y: number;
    value: number;
    index: number;
  }[];

  const getPolyline = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid lines (Weight based - Left Side)
  const gridLines = [wAdjMin, wAdjMin + wRange / 2, wAdjMax].map((val, i) => {
    const relativeY = (val - wAdjMin) / wRange;
    const cmVal = cmAdjMin + (relativeY * cmRange);
    const y = heightFixed - relativeY * heightFixed;
    return {
      y,
      wLabel: val.toFixed(1),
      cmLabel: cmValues.length > 0 ? cmVal.toFixed(0) : "",
    };
  });

  return (
    <div
      className="w-full h-full px-1 group/sparkline relative"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${heightFixed}`}
        preserveAspectRatio="none"
        className={`w-full h-full overflow-visible`}
      >
        {/* Horizontal Grid Lines */}
        {gridLines.map((line, i) => (
          <g key={i} className="opacity-20">
            <line
              x1="0"
              y1={line.y}
              x2={width}
              y2={line.y}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2,2"
              className="text-slate-500"
            />
            <text
              x="-2"
              y={line.y}
              fontSize="3"
              className="fill-slate-400 font-bold text-right opacity-80"
              style={{ dominantBaseline: "middle", textAnchor: "end" }}
            >
              {line.wLabel}
            </text>
            {line.cmLabel && (
              <text
                x={width + 2}
                y={line.y}
                fontSize="3"
                className="fill-slate-400 font-bold text-left opacity-80"
                style={{ dominantBaseline: "middle", textAnchor: "start" }}
              >
                {line.cmLabel}
              </text>
            )}
          </g>
        ))}

        {/* Right Axis Title (if CM exists) */}
        {cmValues.length > 0 && (
          <text
            x={width + 2}
            y={-5}
            fontSize="3"
            className="fill-slate-400 font-black uppercase tracking-widest"
            style={{ textAnchor: "start" }}
          >
            CM
          </text>
        )}
        <text
          x="-2"
          y={-5}
          fontSize="3"
          className="fill-slate-400 font-black uppercase tracking-widest"
          style={{ textAnchor: "end" }}
        >
          KG
        </text>

        {/* Chest Line (Indigo) */}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          points={getPolyline(chestPoints)}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-indigo-500 drop-shadow-sm transition-all duration-500 opacity-60"
        />

        {/* Waist Line (Emerald) */}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          points={getPolyline(waistPoints)}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-500 drop-shadow-sm transition-all duration-500 opacity-80"
        />

        {/* Weight Line (Primary - Rose/Normal) */}
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points={getPolyline(weightPoints)}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-900 dark:text-white drop-shadow-sm transition-all duration-500"
        />

        {/* Interactive Data Points (Only for hover detection on all indices) */}
        {data.map((_, i) => {
          const x = (i / (data.length - 1)) * width;
          // Find y from weight, or first available metric
          const primaryY = weightPoints.find((p) => p.index === i)?.y ??
            waistPoints.find((p) => p.index === i)?.y ?? chestPoints.find((p) =>
              p.index === i
            )?.y ?? heightFixed / 2;

          return (
            <g
              key={i}
              className="cursor-pointer"
              onClick={() => onPointClick?.(i)}
              onMouseEnter={() => setHoveredIdx(i)}
            >
              {/* Tall hit area strip */}
              <rect
                x={x - (width / (data.length * 2))}
                y="0"
                width={width / (data.length)}
                height={heightFixed}
                fill="transparent"
              />

              {/* Dots for each metric at this index */}
              {weightPoints.find((p) => p.index === i) && (
                <circle
                  cx={weightPoints.find((p) => p.index === i)!.x}
                  cy={weightPoints.find((p) => p.index === i)!.y}
                  r={hoveredIdx === i ? "3" : "0"}
                  className="fill-slate-900 dark:fill-white transition-all duration-200"
                />
              )}
              {waistPoints.find((p) =>
                p.index === i
              ) && (
                <circle
                  cx={waistPoints.find((p) => p.index === i)!.x}
                  cy={waistPoints.find((p) => p.index === i)!.y}
                  r={hoveredIdx === i ? "2.5" : "0"}
                  className="fill-emerald-500 transition-all duration-200"
                />
              )}
              {chestPoints.find((p) => p.index === i) && (
                <circle
                  cx={chestPoints.find((p) => p.index === i)!.x}
                  cy={chestPoints.find((p) => p.index === i)!.y}
                  r={hoveredIdx === i ? "2.5" : "0"}
                  className="fill-indigo-500 transition-all duration-200"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover Tooltip/Card */}
      {hoveredIdx !== null && (
        <div
          className="absolute z-50 pointer-events-none bg-slate-900/95 dark:bg-white/95 backdrop-blur-md px-3 py-2.5 rounded-xl border border-white/10 dark:border-black/5 shadow-2xl flex flex-col gap-1 min-w-[100px]"
          style={{
            left: `${
              (hoveredIdx / (data.length > 1 ? data.length - 1 : 1)) * 100
            }%`, // Adjusted for single point
            top: "0",
            transform: `translate(${
              hoveredIdx > data.length / 2 ? "-100%" : "20%"
            }, -10%)`,
          }}
        >
          <div className="text-[10px] font-black text-white/50 dark:text-black/50 uppercase tracking-widest border-b border-white/10 dark:border-black/5 pb-1 mb-1">
            {dates[hoveredIdx]}
          </div>

          {data[hoveredIdx].weight !== undefined && (
            <div className="flex items-center justify-between gap-3 text-white dark:text-slate-900">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Vikt
              </span>
              <span className="text-sm font-black">
                {data[hoveredIdx].weight.toFixed(1)}{" "}
                <span className="text-[9px] opacity-50">kg</span>
              </span>
            </div>
          )}
          {data[hoveredIdx].waist !== undefined && (
            <div className="flex items-center justify-between gap-3 text-emerald-400 dark:text-emerald-600">
              <span className="text-[10px] uppercase font-bold opacity-70">
                Midja
              </span>
              <span className="text-sm font-black">
                {data[hoveredIdx].waist}{" "}
                <span className="text-[9px] opacity-50">cm</span>
              </span>
            </div>
          )}
          {data[hoveredIdx].chest !== undefined && (
            <div className="flex items-center justify-between gap-3 text-indigo-400 dark:text-indigo-600">
              <span className="text-[10px] uppercase font-bold opacity-70">
                Bröst
              </span>
              <span className="text-sm font-black">
                {data[hoveredIdx].chest}{" "}
                <span className="text-[9px] opacity-50">cm</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
