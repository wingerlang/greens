import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface WeeklyDistanceData {
  week: string;
  distance: number;
  duration: number;
  calories: number;
  count: number;
}

interface WeeklyDistanceChartProps {
  data: WeeklyDistanceData[];
  setStartDate?: (d: string | null) => void;
  setEndDate?: (d: string | null) => void;
}

export function WeeklyDistanceChart(
  { data, setStartDate, setEndDate }: WeeklyDistanceChartProps,
) {
  const [range, setRange] = useState<"3m" | "6m" | "12m" | "2025" | "all">(
    "12m",
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [pathData, setPathData] = useState<string>("");
  const dotRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [layoutTick, setLayoutTick] = useState(0);

  // Group workouts by week and FILL GAPS
  const weeklyData = useMemo(() => {
    if (data.length === 0) return [];

    const weeks: Record<string, WeeklyDistanceData> = {};
    const sortedData = [...data].sort((a, b) => a.week.localeCompare(b.week));

    const getLocalMidnight = (d: string | Date) => {
      const date = new Date(d);
      if (typeof d === "string" && d.length === 10) {
        const [y, m, day] = d.split("-").map(Number);
        return new Date(y, m - 1, day);
      }
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };

    const getDateKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const getSundayMidnight = (d: Date) => {
      const res = new Date(d);
      res.setDate(res.getDate() - res.getDay());
      res.setHours(0, 0, 0, 0);
      return res;
    };

    const now = getLocalMidnight(new Date());
    let minDate: Date;
    let maxDate = getLocalMidnight(sortedData[sortedData.length - 1].week);

    if (range === "3m") {
      minDate = new Date(now);
      minDate.setMonth(now.getMonth() - 3);
    } else if (range === "6m") {
      minDate = new Date(now);
      minDate.setMonth(now.getMonth() - 6);
    } else if (range === "12m") {
      minDate = new Date(now);
      minDate.setMonth(now.getMonth() - 12);
    } else if (range === "2025") {
      minDate = new Date(2025, 0, 1);
      const eoy = new Date(2025, 11, 31);
      maxDate = now < eoy ? now : eoy;
    } else {
      minDate = getLocalMidnight(sortedData[0].week);
    }

    const startOfFirstWeek = getSundayMidnight(minDate);
    let current = new Date(startOfFirstWeek);
    while (current <= maxDate) {
      weeks[getDateKey(current)] = {
        week: getDateKey(current),
        distance: 0,
        duration: 0,
        calories: 0,
        count: 0,
      };
      current.setDate(current.getDate() + 7);
    }

    data.forEach((d) => {
      if (weeks[d.week]) {
        weeks[d.week] = d;
      } else {
        // Check if it fits in range (might be slight mismatch due to week start calc)
        // Ideally we trust the input data but for the gap filling we need to align keys
        // For now, if exact key match fails, we check surrounding
        const dDate = new Date(d.week);
        const aligned = getSundayMidnight(dDate);
        const key = getDateKey(aligned);
        if (weeks[key]) {
          weeks[key] = {
            ...d,
            week: key, // re-align key
          };
        }
      }
    });

    const filledData = Object.values(weeks)
      .sort((a, b) => a.week.localeCompare(b.week))
      .map((d) => ({ ...d }));

    return filledData.map((d, idx) => {
      const prev4 = filledData.slice(Math.max(0, idx - 3), idx + 1);
      const avg = prev4.reduce((sum, item) => sum + item.distance, 0) /
        prev4.length;
      return { ...d, rollingAvg: avg };
    });
  }, [data, range]);

  // Calculate Trend Line Path
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pts: { x: number; y: number }[] = [];

    weeklyData.forEach((d, i) => {
      const dot = dotRefs.current.get(i);
      if (dot) {
        const rect = dot.getBoundingClientRect();
        const x = rect.left - containerRect.left + rect.width / 2;
        const y = rect.top - containerRect.top + rect.height / 2;
        pts.push({ x, y });
      }
    });

    if (pts.length > 1) {
      setPathData(`M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")}`);
    } else {
      setPathData("");
    }
  }, [weeklyData, range, layoutTick]);

  // Update path on resize
  useEffect(() => {
    const obs = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const maxDistance = Math.max(...weeklyData.map((d) => d.distance), 1) * 1.15;

  if (weeklyData.length === 0) {
    return (
      <p className="text-slate-500">Inte nog med data för att visa trend.</p>
    );
  }

  const containerWidth = weeklyData.length;
  const barGapClass = containerWidth > 150
    ? "gap-0.5"
    : containerWidth > 75
    ? "gap-1"
    : "gap-1.5 md:gap-2";

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-2 overflow-x-auto pb-2 custom-scrollbar">
        {[
          {
            id: "3m",
            label: "3 mån",
            start: () => {
              const d = new Date();
              d.setMonth(d.getMonth() - 3);
              return d.toISOString().split("T")[0];
            },
          },
          {
            id: "6m",
            label: "6 mån",
            start: () => {
              const d = new Date();
              d.setMonth(d.getMonth() - 6);
              return d.toISOString().split("T")[0];
            },
          },
          {
            id: "12m",
            label: "12 mån",
            start: () => {
              const d = new Date();
              d.setMonth(d.getMonth() - 12);
              return d.toISOString().split("T")[0];
            },
          },
          {
            id: "2025",
            label: "2025",
            start: () => "2025-01-01",
            end: () => "2025-12-31",
          },
          { id: "all", label: "Alla", start: () => null, end: () => null },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setRange(p.id as any);
              setStartDate?.(p.start());
              setEndDate?.(p.end?.() || null);
            }}
            className={`flex-shrink-0 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all ${
              range === p.id
                ? "bg-sky-600 border-sky-500 text-white"
                : "bg-slate-950 border-white/5 text-slate-500 hover:border-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        className={`w-full h-40 flex items-end relative ${barGapClass} overflow-visible`}
        ref={containerRef}
      >
        {/* Rolling Average Continuous Dashed Line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
          <path
            d={pathData}
            stroke="rgba(14, 165, 233, 0.5)" // Sky-500
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="8 6"
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>

        {(() => {
          const items: React.ReactNode[] = [];
          dotRefs.current.clear();
          let gapBuffer: number[] = [];
          let pendingYearMarkers: { index: number; year: number }[] = [];

          const renderGap = (
            indices: number[],
            yearMarkers: { index: number; year: number }[],
          ) => {
            if (indices.length === 0) {
              // If no gap but we have year markers, render them now
              yearMarkers.forEach((ym) => {
                items.push(
                  <div
                    key={`year-${ym.year}`}
                    className="flex-shrink-0 w-[1px] h-full bg-sky-500/20 relative mx-0.5"
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-sky-500/50 px-1 bg-sky-500/10 rounded">
                      {ym.year}
                    </span>
                  </div>,
                );
              });
              return;
            }

            const hasBarsBefore = items.some((item) =>
              React.isValidElement(item) && String(item.key).includes("bar")
            );
            const isLeadingGap = !hasBarsBefore;
            const shouldSuppress = isLeadingGap &&
              (range === "all" || range === "12m" || range === "3m" ||
                range === "6m");

            if (shouldSuppress) return;

            if (indices.length >= 4) {
              items.push(
                <div
                  key={`break-${indices[0]}`}
                  className="flex-shrink-0 flex flex-col items-center justify-center min-w-[32px] md:min-w-[40px] h-full border-x border-white/5 bg-slate-800/10 rounded-sm relative group/break"
                >
                  {/* Year Markers inside long gaps */}
                  {yearMarkers.map((ym) => {
                    const relIndex = ym.index - indices[0];
                    const leftPos = (relIndex / indices.length) * 100;
                    return (
                      <div
                        key={`year-inner-${ym.year}`}
                        className="absolute top-0 bottom-0 w-[1px] bg-sky-500/20 z-0"
                        style={{ left: `${leftPos}%` }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-sky-500/30 px-1 bg-sky-500/5 rounded">
                          {ym.year}
                        </span>
                      </div>
                    );
                  })}
                  <div className="text-[8px] text-amber-500/60 font-black uppercase tracking-widest whitespace-nowrap z-10">
                    ← {indices.length} v →
                  </div>
                  {indices.map((idx, step) => {
                    const d = weeklyData[idx];
                    const avgHeight = (d.rollingAvg / maxDistance) * 100;
                    return (
                      <div
                        key={`break-dot-${idx}`}
                        ref={(el) => {
                          if (el) dotRefs.current.set(idx, el);
                        }}
                        className="absolute w-1 h-1 pointer-events-none opacity-0"
                        style={{
                          bottom: `${avgHeight}%`,
                          marginBottom: "16px",
                          left: `${(step / (indices.length - 1 || 1)) * 100}%`,
                        }}
                      />
                    );
                  })}
                  <div className="h-4" />
                </div>,
              );
            } else {
              indices.forEach((idx, iInGap) => {
                // Check if a year marker belongs BEFORE this index
                const marker = yearMarkers.find((ym) => ym.index === idx);
                if (marker) {
                  items.push(
                    <div
                      key={`year-${marker.year}`}
                      className="flex-shrink-0 w-[1px] h-full bg-sky-500/20 relative mx-0.5"
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-sky-500/50 px-1 bg-sky-500/10 rounded">
                        {marker.year}
                      </span>
                    </div>,
                  );
                }

                const d = weeklyData[idx];
                const avgHeight = (d.rollingAvg / maxDistance) * 100;
                const dateObj = new Date(d.week);
                const weekLabel = dateObj.toLocaleDateString("sv-SE", {
                  day: "numeric",
                  month: "short",
                });

                items.push(
                  <div
                    key={`cross-${idx}`}
                    className="flex-1 min-w-[2px] max-w-[40px] flex flex-col items-center h-full justify-end group/cross relative"
                  >
                    <div
                      ref={(el) => {
                        if (el) dotRefs.current.set(idx, el);
                      }}
                      className="absolute w-6 h-6 rounded-full bg-transparent z-30 cursor-pointer pointer-events-auto flex items-center justify-center group/trend hover:bg-sky-400/5 transition-colors"
                      style={{
                        bottom: `${avgHeight}%`,
                        marginBottom: "16px",
                        transform: "translateY(50%) translateX(-50%)",
                        left: "50%",
                      }}
                    >
                      <div className="opacity-0 group-hover/trend:opacity-100 group-hover/cross:hidden transition-opacity absolute bottom-full mb-4 bg-slate-900 border border-sky-500/30 p-2 rounded-lg shadow-2xl z-50 pointer-events-none whitespace-nowrap">
                        <p className="text-[10px] font-black text-sky-400">
                          Trend: {d.rollingAvg.toLocaleString("sv-SE", {
                            maximumFractionDigits: 1,
                          })} km
                        </p>
                        <p className="text-[8px] text-slate-500 font-bold">
                          {weekLabel}
                        </p>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400 opacity-20 shadow-[0_0_8px_rgba(14,165,233,0.4)]" />
                    </div>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover/cross:opacity-100 transition-opacity bg-slate-900 border border-white/10 p-1.5 rounded text-[8px] text-slate-400 z-50 whitespace-nowrap pointer-events-none shadow-2xl">
                      Ingen träning
                    </div>
                    <div className="h-4 flex items-center justify-center">
                      <span className="text-[10px] text-red-500/30 font-bold group-hover/cross:text-red-500 transition-colors">
                        ×
                      </span>
                    </div>
                  </div>,
                );
              });
            }
          };

          weeklyData.forEach(({ week, distance, rollingAvg }, i) => {
            const isCurrentWeek = i === weeklyData.length - 1;
            const dateObj = new Date(week);
            const currYear = dateObj.getFullYear();
            const prevYear = i > 0
              ? new Date(weeklyData[i - 1].week).getFullYear()
              : currYear;
            const isYearBreak = currYear !== prevYear;

            if (isYearBreak) {
              pendingYearMarkers.push({ index: i, year: currYear });
            }

            if (distance === 0 && !isCurrentWeek) {
              gapBuffer.push(i);
            } else {
              renderGap(gapBuffer, pendingYearMarkers);
              gapBuffer = [];
              pendingYearMarkers = [];

              // Render Bar
              const heightPercentage = Math.min(
                (distance / maxDistance) * 100,
                100,
              );
              const avgHeight = (rollingAvg / maxDistance) * 100;
              const weekLabel = dateObj.toLocaleDateString("sv-SE", {
                day: "numeric",
                month: "short",
              });
              const d = weeklyData[i];

              items.push(
                <div
                  key={`bar-${i}`}
                  className="flex-1 min-w-[4px] max-w-[40px] flex flex-col items-center h-full justify-end group relative z-10"
                >
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 p-2.5 rounded-xl shadow-2xl z-50 pointer-events-none whitespace-nowrap text-center">
                    <p className="font-black text-white text-lg leading-none">
                      {distance.toFixed(1)} km
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-1 mb-1">
                      <p className="text-[10px] text-slate-400">
                        {Math.round(d.duration / 60)}h {d.duration % 60}m
                      </p>
                      <span className="w-0.5 h-2 bg-white/10"></span>
                      <p className="text-[10px] text-slate-400">
                        {d.count} pass
                      </p>
                    </div>
                    <p className="text-[9px] text-sky-400 font-bold uppercase">
                      {weekLabel}
                    </p>
                  </div>

                  {/* Invisible Trend Hover Area */}
                  <div
                    ref={(el) => {
                      if (el) dotRefs.current.set(i, el);
                    }}
                    className="absolute w-6 h-6 rounded-full bg-transparent z-30 cursor-pointer pointer-events-auto flex items-center justify-center group/trend hover:bg-sky-400/5 transition-colors"
                    style={{
                      bottom: `${avgHeight}%`,
                      marginBottom: "16px",
                      transform: "translateY(50%)",
                    }}
                  >
                    <div className="opacity-0 group-hover/trend:opacity-100 transition-opacity absolute bottom-full mb-4 bg-slate-900 border border-sky-500/30 p-2 rounded-lg shadow-2xl z-50 pointer-events-none whitespace-nowrap">
                      <p className="text-[10px] font-black text-sky-400">
                        Trend: {rollingAvg.toLocaleString("sv-SE", {
                          maximumFractionDigits: 1,
                        })} km
                      </p>
                      <p className="text-[8px] text-slate-500 font-bold">
                        {weekLabel}
                      </p>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 opacity-0 group-hover/trend:opacity-100 shadow-[0_0_8px_rgba(14,165,233,1)] transition-opacity" />
                  </div>

                  {/* Bar */}
                  <div
                    className="w-full bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-[1px] hover:from-sky-500 hover:to-sky-300 transition-all duration-300 relative"
                    style={{ height: `${heightPercentage}%` }}
                  >
                    {/* Reflection/Shine */}
                    <div className="absolute top-0 left-0 right-0 h-[10%] bg-gradient-to-b from-white/20 to-transparent" />
                  </div>

                  {/* X-axis Label (only for sparse views or first/last) */}
                  {(containerWidth < 20 ||
                    i % Math.ceil(containerWidth / 8) === 0) && (
                    <div className="absolute top-full mt-2 text-[8px] font-bold text-slate-500 whitespace-nowrap">
                      {weekLabel}
                    </div>
                  )}
                </div>,
              );
            }
          });

          // Render trailing gap if any
          if (gapBuffer.length > 0) {
            renderGap(gapBuffer, pendingYearMarkers);
          }

          return items;
        })()}
      </div>
      {/* Legend / Info */}
      <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase tracking-widest pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-[1px] bg-sky-500"></span>
            Distans (Vecka)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-sky-500/50 border-t border-dashed border-sky-400">
            </span>
            Snitt (4v)
          </span>
        </div>
        <div>
          {weeklyData.length} veckor
        </div>
      </div>
    </div>
  );
}
