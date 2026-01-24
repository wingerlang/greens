import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMuscleLoadAnalysis } from "../../hooks/useMuscleLoadAnalysis.ts";
import exercisesData from "../../../data/exercises.json";
import musclesData from "../../../data/muscles.json";

// Types
import { MuscleHierarchy } from "../../models/muscle.ts";
const muscleHierarchy = musclesData as MuscleHierarchy;
const allExercises = exercisesData.exercises;

// Flat list of muscles for selector
const allMuscles = muscleHierarchy.categories.flatMap((c) =>
  c.groups.flatMap((g) =>
    g.children?.map((m) => ({
      id: m.id,
      name: m.name,
      group: g.name,
    })) || []
  )
);

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, allData } = props;
  const data = allData?.find((d: any) => d.date === payload.value);

  if (data?.isGap) {
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={12}
          fill="#fbbf24"
          fontSize={14}
          textAnchor="middle"
          fontWeight="black"
        >
          ⚡
        </text>
        <text
          x={0}
          y={26}
          fill="#fbbf24"
          fontSize={9}
          textAnchor="middle"
          fontWeight="bold"
        >
          {data.gapLabel}
        </text>
      </g>
    );
  }

  // For non-gap ticks, we should avoid showing every single one if they are too many
  // But Recharts 'interval' logic usually handles this.
  // If we use interval={0}, we must manually hide some.
  // However, the user wants the GAP always visible.

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={15} fill="#94a3b8" fontSize={10} textAnchor="middle">
        {payload.value.slice(5)}
      </text>
    </g>
  );
};

export const LoadAnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL State
  const muscleId = searchParams.get("muscle");
  const exerciseId = searchParams.get("exercise");

  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(muscleId);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(
    exerciseId,
  );

  // Range selection state
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(
    null,
  );
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [rollingPeriod, setRollingPeriod] = useState<"day" | "week" | "month">(
    "day",
  );
  const [intensityThreshold, setIntensityThreshold] = useState(0.7);
  const [showTrend, setShowTrend] = useState(true);
  const [hiddenMetrics, setHiddenMetrics] = useState<Set<string>>(new Set());

  const scrollToDate = (date: string) => {
    setSelectedStartDate(date);
    setSelectedEndDate(date);
    const element = document.getElementById(`session-${date}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const toggleMetric = (props: any) => {
    const { dataKey } = props;
    setHiddenMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };

  const { stats, isLoading } = useMuscleLoadAnalysis(
    selectedMuscle,
    selectedExercise,
    intensityThreshold,
  );

  // Compute rolling average data based on period
  const chartDataWithRolling = useMemo(() => {
    if (!stats?.chartData) return [];

    const windowSize = rollingPeriod === "week" ? 7 : 30;
    const rolling = stats.chartData.map((point, idx, arr) => {
      if (rollingPeriod === "day") return point;
      const windowStart = Math.max(0, idx - windowSize + 1);
      const window = arr.slice(windowStart, idx + 1);

      // Volume is Summed for the period
      const sumLoad = window.reduce((sum, p) => sum + p.load, 0);
      const sumHard = window.reduce((sum, p) => sum + (p.hardVolume || 0), 0);
      const sumLight = window.reduce((sum, p) => sum + (p.lightVolume || 0), 0);

      // e1RM and Max Weight are Rolling MAX
      const maxE1rmPoint = window.reduce(
        (prev, curr) => (curr.e1rm > prev.e1rm ? curr : prev),
        window[0],
      );
      const maxWeightPoint = window.reduce(
        (prev, curr) => (curr.maxWeight > prev.maxWeight ? curr : prev),
        window[0],
      );

      return {
        ...point,
        load: Math.round(sumLoad),
        hardVolume: Math.round(sumHard),
        lightVolume: Math.round(sumLight),
        e1rm: maxE1rmPoint.e1rm,
        maxWeight: maxWeightPoint.maxWeight,
      };
    });

    // Compression: Collapse gaps > 21 days
    // We use RAW LOAD (stats.chartData) to identify gaps, so rolling averages don't hide them
    const GAP_THRESHOLD = 21;
    const compressed: any[] = [];
    let i = 0;
    while (i < rolling.length) {
      const rawPoint = stats.chartData[i];
      if (rawPoint.load > 0) {
        compressed.push(rolling[i]);
        i++;
      } else {
        let j = i;
        while (j < rolling.length && stats.chartData[j].load === 0) {
          j++;
        }
        const gapSize = j - i;
        if (gapSize > GAP_THRESHOLD) {
          // Keep small buffer of zeros at start/end
          compressed.push(rolling[i]);
          compressed.push(rolling[i + 1]);

          const months = Math.floor(gapSize / 30);
          const weeks = Math.round((gapSize % 30) / 7);
          let label = months > 0 ? `${months} mån` : "";
          if (weeks > 0) label += (label ? " " : "") + `${weeks} v`;
          if (!label) label = `${gapSize} d`;

          compressed.push({
            date: `gap-${rolling[i + 2].date}`,
            isGap: true,
            gapLabel: label,
            load: 0,
            e1rm: rolling[i + 1].e1rm,
            e1rmTrend: rolling[i + 1].e1rmTrend,
            maxWeight: rolling[i + 1].maxWeight,
          });

          if (j - 2 > i + 1) {
            compressed.push(rolling[j - 2]);
            compressed.push(rolling[j - 1]);
          }
        } else {
          for (let k = i; k < j; k++) {
            compressed.push(rolling[k]);
          }
        }
        i = j;
      }
    }
    return compressed;
  }, [stats?.chartData, rollingPeriod]);

  const displayData = useMemo(() => {
    if (!chartDataWithRolling.length) return [];
    return chartDataWithRolling.filter((p) => {
      if (p.isGap) {
        const actualDate = p.date.replace("gap-", "");
        if (selectedStartDate && actualDate < selectedStartDate) return false;
        if (selectedEndDate && actualDate > selectedEndDate) return false;
        return true;
      }
      if (selectedStartDate && p.date < selectedStartDate) return false;
      if (selectedEndDate && p.date > selectedEndDate) return false;
      return true;
    });
  }, [chartDataWithRolling, selectedStartDate, selectedEndDate]);

  const brushIndices = useMemo(() => {
    if (!chartDataWithRolling.length) {
      return { start: 0, end: chartDataWithRolling.length - 1 };
    }
    let start = 0;
    let end = chartDataWithRolling.length - 1;

    if (selectedStartDate) {
      const idx = chartDataWithRolling.findIndex((d) =>
        (d.isGap ? d.date.replace("gap-", "") : d.date) >= selectedStartDate
      );
      if (idx !== -1) start = idx;
    }
    if (selectedEndDate) {
      const idx = chartDataWithRolling.findIndex((d) =>
        (d.isGap ? d.date.replace("gap-", "") : d.date) > selectedEndDate
      );
      if (idx !== -1) end = Math.max(0, idx - 1);
      else end = chartDataWithRolling.length - 1;
    }

    return { start, end };
  }, [chartDataWithRolling, selectedStartDate, selectedEndDate]);

  const filteredSummary = useMemo(() => {
    if (!stats?.chartData) return null;
    const points = stats.chartData.filter((p) => {
      if (selectedStartDate && p.date < selectedStartDate) return false;
      if (selectedEndDate && p.date > selectedEndDate) return false;
      return true;
    });

    const hardTonnage = points.reduce(
      (acc, curr) => acc + (curr.hardVolume || 0),
      0,
    );
    const totalTonnage = points.reduce(
      (acc, curr) => acc + (curr.load || 0),
      0,
    );

    // Find best e1RM in range
    const bestE1rm = points.reduce(
      (max, p) => (p.e1rm > max ? p.e1rm : max),
      0,
    );

    // Calculate frequency for this range
    const sessions = points.filter((p) => p.load > 0).length;
    let frequency = 0;
    if (points.length > 7) {
      const weeks = points.length / 7;
      frequency = Math.round((sessions / weeks) * 10) / 10;
    }

    return {
      hardTonnage,
      totalTonnage,
      bestE1rm,
      totalSets: sessions, // Rough estimate
      totalSessions: sessions,
      frequency,
    };
  }, [stats?.chartData, selectedStartDate, selectedEndDate]);

  const compressedTicks = useMemo(() => {
    if (!chartDataWithRolling.length) return undefined;
    // Selection all gaps and every ~20th regular point to ensure gaps are always visible
    const ticks: string[] = [];
    chartDataWithRolling.forEach((d, i) => {
      // Always include gaps, first point, and regular intervals
      if (d.isGap || i === 0 || i % 20 === 0) {
        ticks.push(d.date);
      }
    });
    return Array.from(new Set(ticks));
  }, [chartDataWithRolling]);

  // Compute detailed data for selected range
  const selectedRangeData = useMemo(() => {
    if (
      !stats?.workoutDetailsByDate || (!selectedStartDate && !selectedEndDate)
    ) return null;

    const startDate = selectedStartDate || selectedEndDate;
    const endDate = selectedEndDate || selectedStartDate;
    if (!startDate || !endDate) return null;

    // Ensure dates are in correct order
    const [fromDate, toDate] = startDate <= endDate
      ? [startDate, endDate]
      : [endDate, startDate];

    // Get all dates in range
    const datesInRange = Object.keys(stats.workoutDetailsByDate)
      .filter((date) => date >= fromDate && date <= toDate)
      .sort();

    // Aggregate exercises and sets
    const exerciseMap: Record<
      string,
      {
        name: string;
        role: string;
        sets: Array<
          {
            weight: number;
            reps: number;
            volume: number;
            e1rm: number;
            date: string;
            workoutId?: string;
            isHard: boolean;
          }
        >;
      }
    > = {};

    datesInRange.forEach((date) => {
      stats.workoutDetailsByDate[date]?.forEach((exercise) => {
        if (!exerciseMap[exercise.exerciseId]) {
          exerciseMap[exercise.exerciseId] = {
            name: exercise.exerciseName,
            role: exercise.role,
            sets: [],
          };
        }
        exercise.sets.forEach((set) => {
          exerciseMap[exercise.exerciseId].sets.push({
            ...set,
            date,
            workoutId: exercise.workoutId,
          });
        });
      });
    });

    const totalVolume = Object.values(exerciseMap).reduce(
      (acc, ex) => acc + ex.sets.reduce((s, set) => s + set.volume, 0),
      0,
    );
    const totalSets = Object.values(exerciseMap).reduce(
      (acc, ex) => acc + ex.sets.length,
      0,
    );

    return {
      fromDate,
      toDate,
      isSingleDay: fromDate === toDate,
      datesInRange,
      exercises: Object.values(exerciseMap),
      totalVolume,
      totalSets,
    };
  }, [stats?.workoutDetailsByDate, selectedStartDate, selectedEndDate]);

  const handleMuscleChange = (id: string) => {
    setSelectedMuscle(id);
    setSelectedExercise(null);
    navigate(`/training/load?muscle=${id}`);
  };

  const handleExerciseChange = (id: string) => {
    setSelectedExercise(id);
    navigate(
      `/training/load?exercise=${id}${
        selectedMuscle ? `&muscle=${selectedMuscle}` : ""
      }`,
    );
  };

  // Derived UI State
  const muscleName = allMuscles.find((m) => m.id === selectedMuscle)?.name ||
    selectedMuscle;
  const exerciseName =
    allExercises.find((e) => e.id === selectedExercise)?.name_sv ||
    selectedExercise;
  const pageTitle = selectedExercise
    ? `Analys: ${exerciseName}`
    : selectedMuscle
    ? `Belastningsanalys: ${muscleName}`
    : "Belastningsanalys";

  // Helper to get exercises for current muscle
  const relevantExercises = selectedMuscle
    ? allExercises.filter((e) =>
      e.primaryMuscles.includes(selectedMuscle) ||
      e.secondaryMuscles.includes(selectedMuscle)
    )
    : allExercises;

  relevantExercises.sort((a, b) => a.name_sv.localeCompare(b.name_sv));

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{pageTitle}</h1>
          <p className="text-slate-400">
            Analysera volym och intensitet.{" "}
            {selectedMuscle && !selectedExercise &&
              "(100% volym för primära, 50% för sekundära)"}
          </p>
        </div>
      </div>

      {/* Controls - Pretty Visual Selector */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 space-y-6">
        {/* Muscle Selector */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              🎯 Muskelgrupp
            </label>
            {selectedMuscle && (
              <button
                onClick={() => {
                  setSelectedMuscle(null);
                  setSelectedExercise(null);
                  navigate("/training/load");
                }}
                className="text-xs text-slate-500 hover:text-white"
              >
                ✕ Rensa
              </button>
            )}
          </div>

          {(() => {
            const groups = Array.from(new Set(allMuscles.map((m) => m.group)));
            return (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div key={group}>
                    <div className="text-[10px] uppercase text-slate-600 font-bold mb-1.5">
                      {group}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allMuscles.filter((m) => m.group === group).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleMuscleChange(m.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                            selectedMuscle === m.id
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-white/5"
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Exercise Selector */}
        {selectedMuscle && relevantExercises.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                💪 Övningar för {muscleName}
                <span className="text-slate-600 ml-2">
                  ({relevantExercises.length})
                </span>
              </label>
              {selectedExercise && (
                <button
                  onClick={() => {
                    setSelectedExercise(null);
                    navigate(`/training/load?muscle=${selectedMuscle}`);
                  }}
                  className="text-xs text-slate-500 hover:text-white"
                >
                  ✕ Visa alla
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {relevantExercises.map((e) => {
                const isPrimary = e.primaryMuscles.includes(selectedMuscle);
                return (
                  <button
                    key={e.id}
                    onClick={() => handleExerciseChange(e.id)}
                    className={`group relative px-3 py-2 text-xs font-medium rounded-xl transition-all ${
                      selectedExercise === e.id
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                        : isPrimary
                        ? "bg-slate-800 text-white hover:bg-slate-700 border border-emerald-500/30"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-white/5"
                    }`}
                  >
                    <span
                      className={`text-[9px] uppercase font-bold mr-1 ${
                        selectedExercise === e.id
                          ? "text-blue-200"
                          : isPrimary
                          ? "text-emerald-400"
                          : "text-slate-500"
                      }`}
                    >
                      {isPrimary ? "P" : "S"}
                    </span>
                    {e.name_sv}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading
        ? (
          <div className="h-96 flex items-center justify-center text-slate-500">
            Laddar analys...
          </div>
        )
        : !stats
        ? (
          <div className="h-96 flex items-center justify-center text-slate-500 italic">
            Välj en muskel eller övning för att se data.
          </div>
        )
        : (
          <div className="space-y-8">
            {/* Metric Explanations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-sm">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <span className="text-orange-400">💪</span>{" "}
                  Skillnad på 1RM & e1RM
                </h3>
                <p className="text-slate-400 leading-relaxed text-xs">
                  <span className="text-yellow-400 font-medium whitespace-nowrap">
                    1RM
                  </span>: Faktiskt vikt lyft för 1 repetition.<br />
                  <span className="text-orange-400 font-medium whitespace-nowrap">
                    e1RM
                  </span>: <i>Estimated 1RM</i>. Beräknas som{" "}
                  <code className="bg-slate-800 px-1 rounded">
                    Vikt * (1 + Reps/30)
                  </code>. Gör det möjligt att jämföra t.ex. 5 reps på 80kg med
                  3 reps på 85kg.
                </p>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-sm">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                  <span className="text-blue-400">📅</span> Vad är Frekvens?
                </h3>
                <p className="text-slate-400 leading-relaxed text-xs">
                  Genomsnittligt antal pass per vecka där denna muskel/övning
                  aktiverats. Beräknas som totalt antal pass genom antal veckor
                  mellan första och sista passet i intervallet.
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">🔥</div>
                <div className="text-xs text-slate-500 font-bold uppercase mb-1">
                  Hård Volym
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {((filteredSummary?.hardTonnage || 0) / 1000).toFixed(1)}{" "}
                  <span className="text-xs font-normal opacity-70">ton</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {((filteredSummary?.totalTonnage || 0) / 1000).toFixed(1)}
                  {" "}
                  ton totalt
                </div>
              </div>
              <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                <div className="text-xs text-slate-500 font-bold uppercase mb-1">
                  Antal Pass
                </div>
                <div className="text-2xl font-bold text-white">
                  {filteredSummary?.totalSessions || 0}
                </div>
              </div>
              <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                <div className="text-xs text-slate-500 font-bold uppercase mb-1">
                  Bästa e1RM
                </div>
                <div className="text-2xl font-bold text-orange-400">
                  {filteredSummary?.bestE1rm || 0}kg
                </div>
                <div className="text-[10px] text-slate-600">
                  I valt intervall
                </div>
              </div>
              <div
                className="p-4 bg-slate-900 rounded-2xl border border-white/5"
                title="Hur ofta du tränar denna muskel/övning per vecka i genomsnitt"
              >
                <div className="text-xs text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                  Frekvens
                  <span className="text-[10px] text-slate-600">ⓘ</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {filteredSummary?.frequency || 0}x
                </div>
                <div className="text-[10px] text-slate-600">
                  /vecka ({filteredSummary?.totalSessions || 0} pass)
                </div>
              </div>
            </div>

            {/* Matched Exercises Debug Section */}
            {stats.matchedExercises && stats.matchedExercises.length > 0 && (
              <div className="bg-slate-900 p-4 rounded-2xl border border-white/5">
                <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">
                  🔗 Matchade övningar
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.matchedExercises.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-lg text-sm"
                    >
                      <div className="flex-1">
                        <span className="text-slate-300">"{m.original}"</span>
                        <span className="text-slate-500 mx-2">→</span>
                        <span className="text-emerald-400 font-medium">
                          {m.matchedTo}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span
                          className="text-slate-500"
                          title="Matchningsregel"
                        >
                          {m.reason}
                        </span>
                        <span className="bg-slate-700 px-2 py-0.5 rounded text-white">
                          {m.sets} set
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Load Graph */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  Belastning & Styrka
                  {rollingPeriod !== "day" && (
                    <span className="text-emerald-400 text-sm ml-2">
                      ({rollingPeriod === "week" ? "7d" : "30d"} snitt)
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-800 rounded-lg p-0.5">
                    {(["day", "week", "month"] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setRollingPeriod(period)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                          rollingPeriod === period
                            ? "bg-emerald-500 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {period === "day"
                          ? "Dag"
                          : period === "week"
                          ? "Vecka"
                          : "Månad"}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowTrend(!showTrend)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all border ${
                      showTrend
                        ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                        : "bg-slate-800 text-slate-500 border-white/5"
                    }`}
                    title="Visa 'trappan' (din absoluta styrkenivå över tid)"
                  >
                    📈 Trend
                  </button>
                  <div className="flex flex-col items-end gap-1 px-2 border-l border-white/10 ml-1">
                    <div className="text-[9px] text-slate-400 font-bold uppercase whitespace-nowrap flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-800 rounded-sm border border-emerald-600">
                      </span>
                      Kvalitetsvolym ≥{Math.round(intensityThreshold * 100)}%
                      1RM
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="0.9"
                      step="0.05"
                      value={intensityThreshold}
                      onChange={(e) =>
                        setIntensityThreshold(parseFloat(e.target.value))}
                      className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Visual Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-800 rounded-sm"></span>
                  <span>
                    Tung volym (≥{Math.round(intensityThreshold * 100)}% 1RM)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-emerald-200 rounded-sm"></span>
                  <span>Lätt volym</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-orange-400 rounded"></span>
                  <span>e1RM (estimerad 1RM)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-0.5 bg-indigo-400 rounded"
                    style={{
                      borderStyle: "dashed",
                      borderWidth: 1,
                      backgroundColor: "transparent",
                      borderColor: "#818cf8",
                    }}
                  >
                  </span>
                  <span>Högsta lyftade vikt</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                💡 Klicka på en punkt eller dra i den gröna slidern nedan för
                tidsval.
              </p>

              {/* Date Range Selector (Relocated) */}
              <div className="mb-6 pb-6 border-b border-white/5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex bg-slate-800/50 rounded-xl p-1 border border-white/5 overflow-x-auto max-w-full">
                    {[
                      { label: "Alltid", start: null },
                      { label: "2 v", start: 14 },
                      { label: "4 v", start: 28 },
                      { label: "3 m", start: 90 },
                      { label: "9 m", start: 270 },
                      { label: "1 år", start: 365 },
                      { label: "I år", start: "year-start" },
                    ].map((p) => {
                      let isActive = false;
                      if (p.label === "Alltid") {
                        isActive = !selectedStartDate && !selectedEndDate;
                      } else if (p.label === "I år") {
                        const yearStart = `${new Date().getFullYear()}-01-01`;
                        isActive = selectedStartDate === yearStart &&
                          !selectedEndDate;
                      } else if (typeof p.start === "number") {
                        const d = new Date();
                        d.setDate(d.getDate() - p.start);
                        const startStr = d.toISOString().split("T")[0];
                        isActive = selectedStartDate === startStr;
                      }

                      return (
                        <button
                          key={p.label}
                          onClick={() => {
                            if (p.label === "Alltid") {
                              setSelectedStartDate(null);
                              setSelectedEndDate(null);
                            } else if (p.label === "I år") {
                              setSelectedStartDate(
                                `${new Date().getFullYear()}-01-01`,
                              );
                              setSelectedEndDate(null);
                            } else if (typeof p.start === "number") {
                              const d = new Date();
                              d.setDate(d.getDate() - p.start);
                              setSelectedStartDate(
                                d.toISOString().split("T")[0],
                              );
                              setSelectedEndDate(null);
                            }
                          }}
                          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${
                            isActive
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={selectedStartDate || ""}
                      onChange={(e) => setSelectedStartDate(e.target.value)}
                      className="bg-slate-800/80 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none transition-colors"
                    />
                    <span className="text-slate-600 text-xs">→</span>
                    <input
                      type="date"
                      value={selectedEndDate || ""}
                      onChange={(e) => setSelectedEndDate(e.target.value)}
                      className="bg-slate-800/80 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none transition-colors"
                    />
                  </div>
                  {(selectedStartDate || selectedEndDate) && (
                    <button
                      onClick={() => {
                        setSelectedStartDate(null);
                        setSelectedEndDate(null);
                      }}
                      className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                    >
                      ✕ Rensa filter
                    </button>
                  )}
                </div>
              </div>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartDataWithRolling}
                    margin={{ top: 10, right: 10, left: 0, bottom: 80 }}
                    onMouseDown={(e) => {
                      // Only trigger selection if we are over a valid data point area
                      if (
                        e && e.activeLabel && e.activePayload &&
                        e.activePayload.length > 0
                      ) {
                        const label = e.activeLabel.toString();
                        const date = label.includes("gap-")
                          ? label.replace("gap-", "")
                          : label;
                        setSelectedStartDate(date);
                        setSelectedEndDate(null);
                        setIsSelecting(true);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isSelecting && e?.activeLabel) {
                        setSelectedEndDate(e.activeLabel);
                      }
                    }}
                    onMouseUp={() => {
                      setIsSelecting(false);
                      if (!selectedEndDate && selectedStartDate) {
                        setSelectedEndDate(selectedStartDate);
                      }
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff10"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      type="category"
                      stroke="#94a3b8"
                      tick={<CustomXAxisTick allData={chartDataWithRolling} />}
                      ticks={compressedTicks}
                      minTickGap={0}
                      height={50}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#22c55e"
                      tick={{ fill: "#22c55e", fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      width={45}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#fb923c"
                      tick={{ fill: "#fb923c", fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(val) => `${val}kg`}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                      }}
                      itemStyle={{ color: "#fff" }}
                      formatter={(val: number, name: string, props: any) => {
                        const payload = props.payload;
                        if (payload?.isGap) {
                          if (name === "load") {
                            return [
                              `${payload.gapDays} dagar utan träning`,
                              "⏳ Uppehåll",
                            ];
                          }
                          return [null, null]; // Hide other metrics for gaps in tooltip
                        }

                        if (name === "hardVolume") {
                          return [
                            `${Math.round(val)} kg`,
                            "🔥 Tung Volym",
                          ];
                        }
                        if (name === "lightVolume") {
                          return [
                            `${Math.round(val)} kg`,
                            "🍃 Lätt Volym",
                          ];
                        }
                        if (name === "load") {
                          return [
                            `${Math.round(val)} kg`,
                            "📊 Total Volym",
                          ];
                        }
                        if (name === "e1rmTrend") {
                          return [
                            `${Math.round(val)} kg`,
                            "📈 Trend (e1RM)",
                          ];
                        }
                        if (name === "maxWeight") {
                          const maxWeightEx = payload?.maxWeightExercise;
                          const maxWeightOrig = payload?.maxWeightOriginal;
                          const isWeightPB = payload?.isWeightPB;

                          let valueStr = `${val} kg`;
                          if (isWeightPB) valueStr += " 🏆";

                          if (maxWeightEx && !selectedExercise && isWeightPB) {
                            return [
                              `${maxWeightEx}: ${maxWeightOrig}kg (vikt) → ${val}kg (vikt-PB) 🏆`,
                              "🏆 PB",
                            ];
                          }
                          return [valueStr, "🏋️ Högsta vikt"];
                        }
                        if (name === "e1rm") {
                          const isE1RMPB = payload?.isPB;
                          const isActual = payload?.isActual1RM;
                          const exName = payload?.pbExerciseName;
                          const repsCount = payload?.pbReps;
                          const wLifted = payload?.pbWeight;

                          let label = isActual ? "💪 1RM" : "💪 e1RM";
                          let valueStr = `${Math.round(val)} kg`;

                          if (isE1RMPB) {
                            valueStr += " 🏆";
                            if (exName && !selectedExercise) {
                              const pbType = isActual ? "1RM" : "e1RM";
                              valueStr =
                                `${exName}: ${repsCount}×${wLifted}kg → ${
                                  Math.round(val)
                                }kg (${pbType}) 🏆`;
                              label = "🏆 PB";
                            }
                          }

                          return [valueStr, label];
                        }
                        return [val, name];
                      }}
                      labelFormatter={(label, payload) => {
                        const data = payload?.[0]?.payload;
                        if (
                          data?.isGap
                        ) return `⏳ Uppehåll: ${data.gapLabel}`;
                        if (label.startsWith("gap-")) {return `⏳ Uppehåll (${
                            label.slice(4)
                          })`;}
                        return `📅 ${label}`;
                      }}
                    />
                    <Legend
                      onClick={(e, idx, event: any) => {
                        if (event) event.stopPropagation();
                        toggleMetric(e.dataKey as string);
                      }}
                      wrapperStyle={{ paddingTop: "20px", cursor: "pointer" }}
                    />
                    <Brush
                      dataKey="date"
                      height={30}
                      stroke="#10b981"
                      fill="#0f172a"
                      startIndex={brushIndices.start}
                      endIndex={brushIndices.end}
                      tickFormatter={(val) => val.slice(5)}
                      y={350}
                      onChange={(range) => {
                        if (
                          range && range.startIndex !== undefined &&
                          range.endIndex !== undefined
                        ) {
                          const startPoint =
                            chartDataWithRolling[range.startIndex];
                          const endPoint = chartDataWithRolling[range.endIndex];
                          if (startPoint && endPoint) {
                            const newStart = startPoint.isGap
                              ? startPoint.date.replace("gap-", "")
                              : startPoint.date;
                            const newEnd = endPoint.isGap
                              ? endPoint.date.replace("gap-", "")
                              : endPoint.date;
                            if (newStart !== selectedStartDate) {
                              setSelectedStartDate(newStart);
                            }
                            if (newEnd !== selectedEndDate) {setSelectedEndDate(
                                newEnd,
                              );}
                          }
                        }
                      }}
                    />
                    {selectedStartDate && selectedEndDate && (
                      <ReferenceArea
                        x1={selectedStartDate <= selectedEndDate
                          ? selectedStartDate
                          : selectedEndDate}
                        x2={selectedStartDate <= selectedEndDate
                          ? selectedEndDate
                          : selectedStartDate}
                        fill="#10b981"
                        fillOpacity={0.2}
                        stroke="#10b981"
                        strokeOpacity={0.5}
                      />
                    )}
                    <Bar
                      yAxisId="left"
                      dataKey="hardVolume"
                      stackId="volume"
                      fill="#064e3b"
                      name="hardVolume"
                      radius={[0, 0, 0, 0]}
                      hide={hiddenMetrics.has("hardVolume")}
                      onClick={(data) => data && scrollToDate(data.date)}
                      style={{ cursor: "pointer" }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="lightVolume"
                      stackId="volume"
                      fill="#d1fae5"
                      name="lightVolume"
                      radius={[2, 2, 0, 0]}
                      hide={hiddenMetrics.has("lightVolume")}
                      onClick={(data) => data && scrollToDate(data.date)}
                      style={{ cursor: "pointer" }}
                    />
                    {showTrend && (
                      <Line
                        yAxisId="right"
                        type="stepAfter"
                        dataKey="e1rmTrend"
                        stroke="#f59e0b"
                        strokeWidth={4}
                        strokeOpacity={0.5}
                        name="e1rmTrend"
                        hide={hiddenMetrics.has("e1rmTrend")}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          // Show a marker if this is a Trend Break (new e1RM PB)
                          if (payload?.isPB) {
                            return (
                              <g key={`trend-pb-${payload.date}`}>
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={6}
                                  fill="#f59e0b"
                                  stroke="#0f172a"
                                  strokeWidth={1.5}
                                />
                                <path
                                  d={`M ${cx - 3} ${cy} L ${
                                    cx + 3
                                  } ${cy} M ${cx} ${cy - 3} L ${cx} ${cy + 3}`}
                                  stroke="#0f172a"
                                  strokeWidth={1.5}
                                />
                              </g>
                            );
                          }
                          return <g key={`tnd-${payload?.date || "x"}`} />;
                        }}
                        activeDot={false}
                      />
                    )}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="maxWeight"
                      stroke="#6366f1"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      hide={hiddenMetrics.has("maxWeight")}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload?.isWeightPB && !payload?.isPB) {
                          return (
                            <circle
                              key={`wpt-${payload.date}`}
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill="#6366f1"
                              stroke="#fff"
                              strokeWidth={1}
                            />
                          );
                        }
                        return <g key={`nd-${payload?.date || "x"}`} />;
                      }}
                      name="maxWeight"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="e1rm"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      name="e1rm"
                      hide={hiddenMetrics.has("e1rm")}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload?.isPB) {
                          return (
                            <g key={`pb-${payload.date}`}>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={10}
                                fill="#f59e0b"
                                stroke="#0f172a"
                                strokeWidth={2}
                              />
                              <text
                                x={cx}
                                y={cy - 1}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#0f172a"
                                fontSize={8}
                                fontWeight="bold"
                              >
                                {payload.pbReps}r
                              </text>
                              <text
                                x={cx}
                                y={cy - 18}
                                textAnchor="middle"
                                fill="#f59e0b"
                                fontSize={8}
                                fontWeight="bold"
                              >
                                PB
                              </text>
                            </g>
                          );
                        }
                        if (!payload?.e1rm) {
                          return <g key={`empty-${payload?.date || "x"}`} />;
                        }
                        return (
                          <circle
                            key={`dot-${payload.date}`}
                            cx={cx}
                            cy={cy}
                            r={2}
                            fill="#f59e0b"
                          />
                        );
                      }}
                      activeDot={{
                        r: 6,
                        fill: "#f59e0b",
                        stroke: "#0f172a",
                        strokeWidth: 2,
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Max Weight Bar Chart */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2">
                🏋️ Max vikt per pass
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Visar den tyngsta vikten du kört varje träningsdag
              </p>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataWithRolling}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff10"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 9 }}
                      tickFormatter={(val) => val.slice(5)}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      tickFormatter={(val) => `${val}kg`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                      }}
                      formatter={(val: number) => [`${val} kg`, "Max vikt"]}
                      labelFormatter={(label) => `📅 ${label}`}
                    />
                    <Bar
                      dataKey="maxWeight"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      name="Max vikt"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Selected Range Drill-Down Panel */}
            {selectedRangeData && (
              <div className="bg-slate-900 p-6 rounded-3xl border border-emerald-500/30 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      📊 {selectedRangeData.isSingleDay ? "Dag" : "Period"}:
                      <span className="text-emerald-400 font-mono">
                        {selectedRangeData.isSingleDay
                          ? selectedRangeData.fromDate
                          : `${selectedRangeData.fromDate} → ${selectedRangeData.toDate}`}
                      </span>
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      {selectedRangeData.datesInRange.length} träningsdagar •
                      {selectedRangeData.totalSets} set •
                      {(selectedRangeData.totalVolume / 1000).toFixed(1)}{" "}
                      ton totalt •
                      <span className="text-emerald-400 ml-1">
                        {(selectedRangeData.exercises.reduce((acc, ex) =>
                          acc + ex.sets.reduce((sAcc, s) =>
                            s.isHard ? sAcc + s.volume : sAcc, 0), 0) / 1000)
                          .toFixed(1)} ton hård
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedRangeData.exercises.map((exercise, idx) => (
                    <div key={idx} className="bg-slate-800/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                              exercise.role === "primary"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : exercise.role === "target"
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-slate-600/50 text-slate-400"
                            }`}
                          >
                            {exercise.role === "primary"
                              ? "P"
                              : exercise.role === "target"
                              ? "T"
                              : "S"}
                          </span>
                          <h3 className="font-bold text-white text-sm">
                            {exercise.name}
                          </h3>
                        </div>
                        <div className="text-xs text-slate-400">
                          {exercise.sets.length} set •{" "}
                          {Math.round(exercise.sets.reduce((sum, s) =>
                            sum + s.volume, 0))} kg
                          <span className="text-emerald-500 ml-2 font-bold">
                            (🔥{" "}
                            {Math.round(exercise.sets.reduce((sum, s: any) =>
                              s.isHard ? sum + s.volume : sum, 0))} kg)
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {exercise.sets.map((set: any, sIdx: number) => (
                          <div
                            key={sIdx}
                            className={`px-2 py-1 rounded text-[10px] border transition-all ${
                              set.isHard
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                                : "bg-slate-900/50 border-white/5 text-slate-400"
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {set.isHard && <span>🔥</span>}
                              <span>{set.reps} × {set.weight}kg</span>
                              <span className="opacity-40 mx-1">→</span>
                              <span
                                className={set.isHard
                                  ? "text-emerald-400 font-bold"
                                  : "text-slate-500"}
                              >
                                {set.e1rm}kg
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {selectedRangeData.exercises.length === 0 && (
                    <div className="text-center text-slate-500 py-8">
                      Ingen matchande träning hittades för denna period.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Intensity Histogram */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-white/5 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2">
                Intensitetsfördelning
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Hur nära ditt "tillfälliga max" (6 mån rullande) du har tränat.
                <br />
                <span className="text-xs opacity-70">
                  *Baserat på sets där e1RM kan beräknas.
                </span>
              </p>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.intensityData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#ffffff10"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="range"
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <Tooltip
                      cursor={{ fill: "#ffffff05" }}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#334155",
                        borderRadius: "12px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="sets"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      name="Antal Set"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
