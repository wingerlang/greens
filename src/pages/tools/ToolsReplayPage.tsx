import React, { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../context/DataContext.tsx";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Calendar,
  Dumbbell,
  FastForward,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Scale,
  Trophy,
} from "lucide-react";
import { ExerciseEntry, WeightEntry } from "../../models/types.ts";
import { formatActivityDuration } from "../../utils/formatters.ts";
import { EXERCISE_TYPES } from "../../components/training/ExerciseModal.tsx";

// --- Types ---

interface ReplayEvent {
  id: string;
  date: string;
  type: "weight" | "exercise" | "pb" | "race";
  data: any; // ExerciseEntry | WeightEntry
  isGold?: boolean; // For PBs and Races
  title: string;
  subtitle?: string;
  value?: string; // "85 kg" or "10 km"
  color?: string; // Custom color for the card
  icon?: any;
}

interface DailySnapshot {
  date: string; // YYYY-MM-DD
  weight: number | null;
  events: ReplayEvent[];
}

// --- Helpers ---

const getEarliestDate = (d1: string, d2: string) => d1 < d2 ? d1 : d2;
const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};
const getDaysDiff = (start: string, end: string) => {
  const d1 = new Date(start);
  const d2 = new Date(end);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
};

export function ToolsReplayPage() {
  const { exerciseEntries = [], weightEntries = [] } = useData();

  // --- State ---
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(startDate);
  const [playbackSpeed, setPlaybackSpeed] = useState(100); // ms per day
  const [showConfetti, setShowConfetti] = useState(false);

  // --- Refs for Animation Loop ---
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  // --- Data Preprocessing ---

  // 1. Calculate PBs over time (Global History for accurate PB detection)
  // We need to know if a specific lift on a specific day was a PB *at that time*.
  const eventsWithPB = useMemo(() => {
    const sortedExercises = [...exerciseEntries].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // Track maxes
    let currentMaxTonnage = 0;
    const currentMaxDistance: Record<string, number> = {};

    // Create a map of "Date -> Event[]" where events have isPB flag
    const pbMap = new Map<string, string[]>(); // activityId -> pbDescription[]

    sortedExercises.forEach((ex) => {
      const pbs: string[] = [];

      // Tonnage PB
      if (ex.tonnage && ex.tonnage > currentMaxTonnage) {
        currentMaxTonnage = ex.tonnage;
        pbs.push(`Nytt Volymrekord: ${ex.tonnage} kg`);
      }

      // Distance PB (per type)
      if (ex.distance) {
        const cur = currentMaxDistance[ex.type] || 0;
        if (ex.distance > cur) {
          currentMaxDistance[ex.type] = ex.distance;
          pbs.push(`Distansrekord (${ex.type}): ${ex.distance} km`);
        }
      }

      if (pbs.length > 0) {
        pbMap.set(ex.id, pbs);
      }
    });

    return pbMap;
  }, [exerciseEntries]);

  // 2. Build the Replay Timeline
  // We want a complete array of dates from Start to End.
  const timelineData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const days = getDaysDiff(startDate, endDate);
    const data: DailySnapshot[] = [];

    let lastKnownWeight: number | null = null;

    // Sort data
    const sortedWeights = [...weightEntries].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const sortedExercises = [...exerciseEntries].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    for (let i = 0; i <= days; i++) {
      const date = addDays(startDate, i);

      // Find Weight
      const wEntry = sortedWeights.find((w) => w.date === date);
      if (wEntry) lastKnownWeight = wEntry.weight;

      // Find Exercises
      const exEntries = sortedExercises.filter((e) => e.date === date);

      const events: ReplayEvent[] = [];

      // Add Weight Event
      if (wEntry) {
        events.push({
          id: wEntry.id,
          date: date,
          type: "weight",
          data: wEntry,
          title: "Invägning",
          value: `${wEntry.weight} kg`,
          color: "bg-yellow-500",
          icon: <Scale size={16} />,
        });
      }

      // Add Exercise Events
      exEntries.forEach((ex) => {
        const pbs = eventsWithPB.get(ex.id);
        const isRace = ex.subType === "race" || ex.subType === "competition";
        const isPB = !!pbs?.length;

        const typeConfig = EXERCISE_TYPES.find((t) => t.type === ex.type);

        events.push({
          id: ex.id,
          date: date,
          type: isRace ? "race" : isPB ? "pb" : "exercise",
          data: ex,
          isGold: isRace || isPB,
          title: isRace
            ? "TÄVLING!"
            : (pbs ? "NYTT PERSONBÄSTA!" : (typeConfig?.label || "Träning")),
          subtitle: pbs
            ? pbs[0]
            : (ex.title || ex.notes || "Inga anteckningar"),
          value: ex.distance
            ? `${ex.distance} km`
            : formatActivityDuration(ex.durationMinutes),
          color: isRace
            ? "bg-amber-400"
            : (isPB
              ? "bg-amber-300"
              : (ex.type === "strength" ? "bg-emerald-500" : "bg-blue-500")),
          icon: isRace
            ? <Trophy size={16} />
            : (isPB
              ? <Trophy size={16} />
              : (ex.type === "strength"
                ? <Dumbbell size={16} />
                : <Activity size={16} />)),
        });
      });

      data.push({
        date,
        weight: lastKnownWeight,
        events,
      });
    }
    return data;
  }, [startDate, endDate, weightEntries, exerciseEntries, eventsWithPB]);

  // --- Playback Logic ---

  const animate = (time: number) => {
    if (!isPlaying) return;
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;

      if (deltaTime >= playbackSpeed) {
        setCurrentDate((prev) => {
          if (prev >= endDate) {
            setIsPlaying(false);
            return prev;
          }
          return addDays(prev, 1);
        });
        lastTimeRef.current = time;
      }
    } else {
      lastTimeRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = undefined;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, endDate, playbackSpeed]);

  // --- Derived Data for Views ---

  const currentSnapshot = useMemo(() => {
    return timelineData.find((d) => d.date === currentDate);
  }, [timelineData, currentDate]);

  const historicalData = useMemo(() => {
    return timelineData.filter((d) => d.date <= currentDate);
  }, [timelineData, currentDate]);

  // Stats
  const stats = useMemo(() => {
    const events = historicalData.flatMap((d) => d.events).filter((e) =>
      e.type !== "weight"
    );
    const totalDist = events.reduce(
      (sum, e) => sum + (e.data.distance || 0),
      0,
    );
    const totalTon = events.reduce((sum, e) => sum + (e.data.tonnage || 0), 0);
    const startWeight = timelineData[0]?.weight || 0;
    const currentWeight = currentSnapshot?.weight || startWeight;
    const weightDiff = currentWeight && startWeight
      ? currentWeight - startWeight
      : 0;
    const totalWorkouts = events.length;

    return { totalDist, totalTon, weightDiff, totalWorkouts, currentWeight };
  }, [historicalData, timelineData, currentSnapshot]);

  // --- Controls ---
  const handlePreset = (days: number | "ytd") => {
    const end = new Date().toISOString().split("T")[0];
    let start = "";
    if (days === "ytd") {
      start = `${new Date().getFullYear()}-01-01`;
    } else {
      const d = new Date();
      d.setDate(d.getDate() - days);
      start = d.toISOString().split("T")[0];
    }
    setStartDate(start);
    setEndDate(end);
    setCurrentDate(start);
    setIsPlaying(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 flex items-center gap-3">
            <RotateCcw className="text-amber-500" /> Replay Mode
          </h1>
          <p className="text-slate-400 text-sm max-w-md">
            Återupplev året som gått. Välj period, luta dig tillbaka och se dina
            framsteg spelas upp.
          </p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl w-full lg:w-auto flex flex-col gap-4">
          {/* Period Selectors */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { l: "30D", v: 30 },
              { l: "3M", v: 90 },
              { l: "6M", v: 180 },
              { l: "I ÅR", v: "ytd" },
              { l: "1 ÅR", v: 365 },
            ].map((p) => (
              <button
                key={p.l}
                onClick={() => handlePreset(p.v as any)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold text-slate-400 hover:text-white transition-all whitespace-nowrap"
              >
                {p.l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (currentDate >= endDate) setCurrentDate(startDate);
                setIsPlaying(!isPlaying);
              }}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
                isPlaying
                  ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30"
                  : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 hover:scale-105"
              }`}
            >
              {isPlaying
                ? <Pause fill="currentColor" />
                : <Play fill="currentColor" className="ml-1" />}
            </button>

            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span>{startDate}</span>
                <span className="text-white">{currentDate}</span>
                <span>{endDate}</span>
              </div>
              <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-75"
                  style={{
                    width: `${
                      Math.min(
                        100,
                        (getDaysDiff(startDate, currentDate) /
                          getDaysDiff(startDate, endDate)) * 100,
                      )
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">
                Hastighet
              </span>
              <div className="flex bg-slate-800 rounded-lg p-0.5">
                {[200, 100, 20].map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                      playbackSpeed === s
                        ? "bg-white text-black"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {i === 0 ? "1x" : i === 1 ? "2x" : "🚀"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats & Feed */}
        <div className="space-y-6 lg:col-span-1 h-[600px] flex flex-col">
          {/* Live Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">
                Nuvarande Vikt
              </div>
              <div className="text-2xl font-black text-white">
                {stats.currentWeight ? stats.currentWeight.toFixed(1) : "-"}
                {" "}
                <span className="text-sm font-bold text-slate-500">kg</span>
              </div>
              <div
                className={`text-xs font-bold ${
                  stats.weightDiff <= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {stats.weightDiff > 0 ? "+" : ""}
                {stats.weightDiff.toFixed(1)} kg
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">
                Total Volym
              </div>
              <div className="text-2xl font-black text-white">
                {Math.round(stats.totalTon / 1000)}{" "}
                <span className="text-sm font-bold text-slate-500">ton</span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">
                Total Distans
              </div>
              <div className="text-2xl font-black text-white">
                {Math.round(stats.totalDist)}{" "}
                <span className="text-sm font-bold text-slate-500">km</span>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">
                Antal Pass
              </div>
              <div className="text-2xl font-black text-white">
                {stats.totalWorkouts}
              </div>
            </div>
          </div>

          {/* Feed */}
          <div className="flex-1 bg-slate-900/50 rounded-3xl border border-white/5 p-4 overflow-hidden flex flex-col relative">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 px-2">
              Händelseflöde
            </h3>

            <div className="overflow-y-auto no-scrollbar space-y-3 flex-1 flex flex-col-reverse">
              {
                /* We reverse to show newest at bottom/top depending on preference.
                                Let's show newest at TOP. so flex-col. */
              }

              {/* Actually, let's show timeline style: Newest on top. */}
              {[...historicalData].reverse().slice(0, 20).map((day) => (
                day.events.map((event) => (
                  <div
                    key={event.id}
                    className={`relative p-3 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-left-4 fade-in duration-300 ${
                      event.isGold
                        ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        : "bg-slate-800/50 border-white/5"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-slate-950 shadow-lg ${event.color}`}
                    >
                      {event.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h4
                          className={`text-xs font-black uppercase truncate ${
                            event.isGold ? "text-amber-400" : "text-white"
                          }`}
                        >
                          {event.title}
                        </h4>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {event.date}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">
                        {event.subtitle}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xs font-black ${
                          event.isGold ? "text-amber-400" : "text-white"
                        }`}
                      >
                        {event.value}
                      </div>
                    </div>
                  </div>
                ))
              ))}
            </div>
            {/* Fade effect at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none">
            </div>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-3xl p-6 relative overflow-hidden h-[600px] flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none">
          </div>

          <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
              <h2 className="text-xl font-bold text-white">
                Viktkurva & Milstolpar
              </h2>
              <p className="text-xs text-slate-400">
                Visualisering av kroppsvikt i relation till träning
              </p>
            </div>
          </div>

          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff10"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => val.slice(5)} // MM-DD
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "12px",
                  }}
                  itemStyle={{ color: "#fff", fontSize: "12px" }}
                  labelStyle={{
                    color: "#94a3b8",
                    fontSize: "10px",
                    marginBottom: "4px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorWeight)"
                  animationDuration={0} // Disable internal animation for smoother manual control
                  isAnimationActive={false}
                />

                {/* Custom Dots for Events */}
                {
                  /* Since we can't easily map multiple events to X-Axis via Recharts built-ins efficiently for many points,
                                    we only show dots for the last 5 events or so to avoid clutter, OR just rely on the feed.
                                    Alternatively, ReferenceDots for PBs/Races.
                                */
                }
                {historicalData.flatMap((d) => d.events.filter((e) => e.isGold))
                  .map((e, i) => {
                    // Find weight for this date to position dot on the line
                    const snap = timelineData.find((td) => td.date === e.date);
                    const yValue = snap?.weight || 0;

                    return (
                      <ReferenceDot
                        key={e.id}
                        x={e.date}
                        y={yValue}
                        r={6}
                        fill="#fbbf24"
                        stroke="#fff"
                        strokeWidth={2}
                        ifOverflow="extendDomain"
                      />
                    );
                  })}

                {/* The Playhead */}
                <ReferenceLine
                  x={currentDate}
                  stroke="#fbbf24"
                  strokeDasharray="3 3"
                  label={{
                    position: "top",
                    value: "PLAYHEAD",
                    fill: "#fbbf24",
                    fontSize: 10,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
