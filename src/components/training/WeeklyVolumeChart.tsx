import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StrengthWorkout } from "../../models/strengthTypes.ts";

interface WeeklyVolumeChartProps {
  workouts: StrengthWorkout[];
  setStartDate?: (d: string | null) => void;
  setEndDate?: (d: string | null) => void;
  fixedYear?: number;
  fixedDateRange?: { start: Date; end: Date };
}

export function WeeklyVolumeChart(
  { workouts, setStartDate, setEndDate, fixedYear, fixedDateRange }:
    WeeklyVolumeChartProps,
) {
  const [range, setRange] = useState<"3m" | "6m" | "12m" | "2025" | "all">(
    fixedYear || fixedDateRange ? "all" : "12m",
  ); // 'all' is placeholder if fixed is set
  const containerRef = useRef<HTMLDivElement>(null);
  const [pathData, setPathData] = useState<string>("");
  const dotRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [layoutTick, setLayoutTick] = useState(0);

  // Group workouts by week and FILL GAPS
  const weeklyData = useMemo(() => {
    if (workouts.length === 0) return [];

    const weeks: Record<string, number> = {};
    const sortedWorkouts = [...workouts].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

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
    let maxDate = getLocalMidnight(
      sortedWorkouts[sortedWorkouts.length - 1].date,
    );

    if (fixedDateRange) {
      minDate = getLocalMidnight(fixedDateRange.start);
      maxDate = getLocalMidnight(fixedDateRange.end);
    } else if (fixedYear) {
      minDate = new Date(fixedYear, 0, 1);
      const eoy = new Date(fixedYear, 11, 31);
      maxDate = eoy;
    } else if (range === "3m") {
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
      minDate = getLocalMidnight(sortedWorkouts[0].date);
    }

    const startOfFirstWeek = getSundayMidnight(minDate);
    let current = new Date(startOfFirstWeek);
    while (current <= maxDate) {
      weeks[getDateKey(current)] = 0;
      current.setDate(current.getDate() + 7);
    }

    workouts.forEach((w) => {
      const date = getLocalMidnight(w.date);
      if (date < minDate || date > maxDate) return;

      const weekStart = getSundayMidnight(date);
      const weekKey = getDateKey(weekStart);
      if (weeks[weekKey] !== undefined) {
        weeks[weekKey] += w.totalVolume;
      }
    });

    const data = Object.entries(weeks)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, volume]) => ({ week, volume }));

    return data.map((d, idx) => {
      const prev4 = data.slice(Math.max(0, idx - 3), idx + 1);
      const avg = prev4.reduce((sum, item) => sum + item.volume, 0) /
        prev4.length;
      return { ...d, rollingAvg: avg };
    });
  }, [workouts, range, fixedYear]);

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
  }, [weeklyData, range, workouts, layoutTick]);

  // Update path on resize
  useEffect(() => {
    const obs = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const maxVolume = Math.max(...weeklyData.map((d) => d.volume), 1) * 1.15;

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
      {!fixedYear && (
        <div className="flex gap-2 mb-2">
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
              className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all ${
                range === p.id
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-950 border-white/5 text-slate-500 hover:border-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={`w-full h-40 flex items-end relative ${barGapClass} overflow-visible`}
        ref={containerRef}
      >
        {/* Rolling Average Continuous Dashed Line */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
          <path
            d={pathData}
            stroke="rgba(59,130,246,0.5)"
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

          // Calculate Ranks (Gold, Silver, Bronze)
          // We treat current week normally for ranking, or exclude it? usually include.
          const sortedByVol = [...weeklyData]
            .map((d, i) => ({ ...d, originalIndex: i }))
            .filter((d) => d.volume > 0)
            .sort((a, b) => b.volume - a.volume);

          const goldIdx = sortedByVol[0]?.originalIndex;
          const silverIdx = sortedByVol[1]?.originalIndex;
          const bronzeIdx = sortedByVol[2]?.originalIndex;

          const renderGap = (
            indices: number[],
            yearMarkers: { index: number; year: number }[],
          ) => {
            if (indices.length === 0) {
              yearMarkers.forEach((ym) => {
                items.push(
                  <div
                    key={`year-${ym.year}`}
                    className="flex-shrink-0 w-[1px] h-full bg-blue-500/20 relative mx-0.5"
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-blue-500/50 px-1 bg-blue-500/10 rounded">
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
                  {yearMarkers.map((ym) => {
                    const relIndex = ym.index - indices[0];
                    const leftPos = (relIndex / indices.length) * 100;
                    return (
                      <div
                        key={`year-inner-${ym.year}`}
                        className="absolute top-0 bottom-0 w-[1px] bg-blue-500/20 z-0"
                        style={{ left: `${leftPos}%` }}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-blue-500/30 px-1 bg-blue-500/5 rounded">
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
                    const avgHeight = (d.rollingAvg / maxVolume) * 100;
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
                const marker = yearMarkers.find((ym) => ym.index === idx);
                if (marker) {
                  items.push(
                    <div
                      key={`year-${marker.year}`}
                      className="flex-shrink-0 w-[1px] h-full bg-blue-500/20 relative mx-0.5"
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-blue-500/50 px-1 bg-blue-500/10 rounded">
                        {marker.year}
                      </span>
                    </div>,
                  );
                }

                const d = weeklyData[idx];
                const avgHeight = (d.rollingAvg / maxVolume) * 100;
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
                      className="absolute w-6 h-6 rounded-full bg-transparent z-30 cursor-pointer pointer-events-auto flex items-center justify-center group/trend hover:bg-blue-400/5 transition-colors"
                      style={{
                        bottom: `${avgHeight}%`,
                        marginBottom: "16px",
                        transform: "translateY(50%) translateX(-50%)",
                        left: "50%",
                      }}
                    >
                      <div className="opacity-0 group-hover/trend:opacity-100 group-hover/cross:hidden transition-opacity absolute bottom-full mb-4 bg-slate-900 border border-blue-500/30 p-2 rounded-lg shadow-2xl z-50 pointer-events-none whitespace-nowrap">
                        <p className="text-[10px] font-black text-blue-400">
                          Trend:{" "}
                          {(d.rollingAvg / 1000).toLocaleString("sv-SE", {
                            maximumFractionDigits: 1,
                          })}t
                        </p>
                        <p className="text-[8px] text-slate-500 font-bold">
                          {weekLabel}
                        </p>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-20 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                    </div>
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover/cross:opacity-100 transition-opacity bg-slate-900 border border-white/10 p-1.5 rounded text-[8px] text-slate-400 z-50 whitespace-nowrap pointer-events-none shadow-2xl">
                      Ingen träning registrerad
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

          weeklyData.forEach(({ week, volume, rollingAvg }, i) => {
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

            if (volume === 0 && !isCurrentWeek) {
              gapBuffer.push(i);
            } else {
              renderGap(gapBuffer, pendingYearMarkers);
              gapBuffer = [];
              pendingYearMarkers = [];

              // Render Bar
              const heightPercentage = Math.min(
                (volume / maxVolume) * 100,
                100,
              );
              const avgHeight = (rollingAvg / maxVolume) * 100;

              // Format date range for tooltips
              const endDate = new Date(dateObj);
              endDate.setDate(endDate.getDate() + 6);
              const startStr = dateObj.toLocaleDateString("sv-SE", {
                day: "numeric",
                month: "short",
              });
              const endStr = endDate.toLocaleDateString("sv-SE", {
                day: "numeric",
                month: "short",
              });
              const fullLabel = `${startStr} – ${endStr}`;

              // Ranking Logic
              const rank = i === goldIdx
                ? 1
                : i === silverIdx
                ? 2
                : i === bronzeIdx
                ? 3
                : null;
              const isGold = rank === 1;
              const isSilver = rank === 2;
              const isBronze = rank === 3;

              let barColorClass =
                "bg-gradient-to-t from-emerald-500/80 to-emerald-400";
              let ringClass = ""; // For glow effects

              if (isGold) {
                barColorClass =
                  "bg-gradient-to-t from-amber-500 to-yellow-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]";
                ringClass = "ring-1 ring-yellow-300/50";
              } else if (isSilver) {
                barColorClass =
                  "bg-gradient-to-t from-slate-400 to-slate-200 shadow-[0_0_15px_rgba(148,163,184,0.5)]";
                ringClass = "ring-1 ring-slate-300/50";
              } else if (isBronze) {
                barColorClass =
                  "bg-gradient-to-t from-orange-700 to-orange-400 shadow-[0_0_15px_rgba(234,88,12,0.5)]";
                ringClass = "ring-1 ring-orange-400/50";
              } else if (isCurrentWeek) {
                barColorClass =
                  "bg-gradient-to-t from-purple-500 to-purple-400 animate-pulse";
              }

              items.push(
                <div
                  key={`bar-${i}`}
                  className="flex-1 min-w-[4px] max-w-[40px] flex flex-col items-center h-full justify-end group relative z-10 transition-all hover:z-50"
                >
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 p-3 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap min-w-[120px] scale-95 group-hover:scale-100 origin-bottom">
                    <div className="flex justify-between items-center mb-1 gap-4">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        {fullLabel}
                      </span>
                      {rank && (
                        <span
                          className={`text-[10px] font-black uppercase px-1.5 rounded ${
                            isGold
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : isSilver
                              ? "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                              : "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                          }`}
                        >
                          #{rank}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <p className="font-black text-white text-2xl leading-none">
                        {(volume / 1000).toLocaleString("sv-SE", {
                          maximumFractionDigits: 1,
                        })}
                      </p>
                      <span className="text-xs text-slate-500 font-medium">
                        ton
                      </span>
                    </div>
                    {rollingAvg > 0 && (
                      <div className="mt-1 pt-1 border-t border-white/5 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Snitt (4v):</span>
                        <span className="font-mono text-blue-400">
                          {(rollingAvg / 1000).toFixed(1)}t
                        </span>
                      </div>
                    )}
                    {isCurrentWeek && (
                      <div className="mt-1 text-[10px] text-purple-400 font-bold text-center animate-pulse">
                        Nuvarande vecka
                      </div>
                    )}
                  </div>

                  {/* Invisible Trend Hover Area */}
                  <div
                    ref={(el) => {
                      if (el) dotRefs.current.set(i, el);
                    }}
                    className="absolute w-6 h-6 rounded-full bg-transparent z-30 cursor-pointer pointer-events-auto flex items-center justify-center group/trend hover:bg-blue-400/5 transition-colors"
                    style={{
                      bottom: `${avgHeight}%`,
                      marginBottom: "16px",
                      transform: "translateY(50%)",
                    }}
                  >
                    <div className="opacity-0 group-hover/trend:opacity-100 transition-opacity absolute bottom-full mb-4 bg-slate-900 border border-blue-500/30 p-2 rounded-lg shadow-2xl z-50 pointer-events-none whitespace-nowrap">
                      <p className="text-[10px] font-black text-blue-400">
                        Trend: {(rollingAvg / 1000).toLocaleString("sv-SE", {
                          maximumFractionDigits: 1,
                        })}t
                      </p>
                      <p className="text-[8px] text-slate-500 font-bold">
                        {fullLabel}
                      </p>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-0 group-hover/trend:opacity-100 shadow-[0_0_8px_rgba(59,130,246,1)] transition-opacity" />
                  </div>

                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-[2px] transition-all duration-300 relative group-hover:scale-x-110 ${barColorClass} ${ringClass}`}
                    style={{ height: `${heightPercentage}%` }}
                  >
                    {/* Reflection/Shine */}
                    <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/30 to-transparent" />

                    {/* Rank Trophy */}
                    {(isGold || isSilver || isBronze) && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] drop-shadow-md filter">
                        {isGold ? "🥇" : isSilver ? "🥈" : "🥉"}
                      </div>
                    )}
                  </div>

                  {/* X-axis Label */}
                  {(isCurrentWeek || i === 0 ||
                    (containerWidth < 20 && i % 2 === 0)) && (
                    <div
                      className={`absolute top-full mt-2 text-[8px] font-bold whitespace-nowrap ${
                        isCurrentWeek ? "text-purple-400" : "text-slate-500"
                      }`}
                    >
                      {isCurrentWeek ? "V.NU" : startStr}
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
            <span className="w-2 h-2 rounded-[1px] bg-emerald-500"></span>
            Volym (Vecka)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-blue-500/50 border-t border-dashed border-blue-400">
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
