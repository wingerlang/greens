import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext.tsx";
import { PartnerStats, TeamArchetype } from "./DuoLabTypes.ts";
import {
  calculateLevelsFromRealStats,
  detectArchetype,
  optimizeSplits,
  simulateRace,
} from "./DuoLabLogic.ts";
import { RaceFlowChart } from "./RaceFlowChart.tsx";

// ------------------------------------------------------------------
// CONFIG & CONSTANTS
// ------------------------------------------------------------------
const PRESETS: PartnerStats[] = [
  {
    name: "Lisa Lunges",
    gender: "FEMALE",
    runLevel: 75,
    strengthLevel: 85,
    engineLevel: 80,
    best5k: "22:00",
  },
  {
    name: "Kalle Cardio",
    gender: "MALE",
    runLevel: 90,
    strengthLevel: 55,
    engineLevel: 75,
    best5k: "18:30",
  },
  {
    name: "The Titan",
    gender: "MALE",
    runLevel: 95,
    strengthLevel: 98,
    engineLevel: 95,
    best5k: "17:00",
  },
  {
    name: "The Rookie",
    gender: "MALE",
    runLevel: 30,
    strengthLevel: 35,
    engineLevel: 40,
    best5k: "30:00",
  },
  {
    name: "Average Joe",
    gender: "MALE",
    runLevel: 50,
    strengthLevel: 50,
    engineLevel: 50,
    best5k: "25:00",
  },
  {
    name: "Hyrox Pro",
    gender: "MALE",
    runLevel: 90,
    strengthLevel: 90,
    engineLevel: 95,
    best5k: "16:45",
  },
];

const ARCHETYPE_DESCRIPTIONS: Record<
  TeamArchetype,
  { title: string; desc: string; icon: string; color: string }
> = {
  "THE_TWIN_TURBOS": {
    title: "The Twin Turbos",
    desc: "Ni vinner på löpningen. Strategin är enkel: Spring ifrån dem.",
    icon: "🏎️",
    color: "cyan",
  },
  "THE_TOW_TRUCK": {
    title: "The Tow Truck",
    desc:
      "En drar lasset. Det handlar om att maximera 'The Machine' utan att bränna ut hen.",
    icon: "🚛",
    color: "amber",
  },
  "THUNDER_AND_LIGHTNING": {
    title: "Thunder & Lightning",
    desc: "Den perfekta stormen. En springer, en lyfter. Oslagbar kombo.",
    icon: "⚡",
    color: "purple",
  },
  "THE_GRINDERS": {
    title: "The Grinders",
    desc:
      "Starka men långsamma. Ni kommer äta upp stationerna men blöda tid på löpet.",
    icon: "⚙️",
    color: "slate",
  },
  "BALANCED_ASSAULT": {
    title: "Balanced Assault",
    desc: "Inga svagheter. Ni kan växla flexibelt och anpassa er efter banan.",
    icon: "⚖️",
    color: "emerald",
  },
  "CHAOS_CREW": {
    title: "Chaos Crew",
    desc:
      "Obalanserade och oförutsägbara. Ni behöver en strikt plan för att överleva.",
    icon: "🔥",
    color: "rose",
  },
};

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
export function HyroxDuoLab() {
  const { exerciseEntries } = useData();

  // STATE
  const [userStats, setUserStats] = useState<PartnerStats>({
    name: "YOU",
    gender: "MALE",
    runLevel: 65,
    strengthLevel: 60,
    engineLevel: 70,
    best5k: "24:00",
  });
  const [partnerStats, setPartnerStats] = useState<PartnerStats>(PRESETS[0]);
  const [presetName, setPresetName] = useState("Lisa Lunges");
  const [transitionPenalty, setTransitionPenalty] = useState(5); // seconds
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [tab, setTab] = useState<"SPLITS" | "SIMULATION">("SPLITS");

  // EFFECT: Auto-update levels from real stats in calibration mode
  useEffect(() => {
    if (calibrationMode) {
      setUserStats((prev) => calculateLevelsFromRealStats(prev));
      setPartnerStats((prev) => calculateLevelsFromRealStats(prev));
    }
  }, [
    calibrationMode,
    userStats.best5k,
    userStats.wallBallsUnbroken,
    userStats.burpeePace,
    partnerStats.best5k,
    partnerStats.wallBallsUnbroken,
    partnerStats.burpeePace,
  ]);

  // DERIVED STATE
  const archetype = useMemo(() => detectArchetype(userStats, partnerStats), [
    userStats,
    partnerStats,
  ]);
  const splits = useMemo(
    () => optimizeSplits(userStats, partnerStats, { transitionPenalty }),
    [userStats, partnerStats, transitionPenalty],
  );

  // Run Simulation
  const simulation = useMemo(
    () => simulateRace(userStats, partnerStats, archetype),
    [userStats, partnerStats, archetype],
  );
  const predictedTime = simulation.totalTime;

  // HELPERS
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8">
      {/* HERO: ARCHETYPE REVEAL */}
      <div className="text-center relative py-12 bg-slate-900/50 rounded-3xl border border-white/5 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-transparent to-slate-950 pointer-events-none" />

        {/* Background Icon Faded */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15rem] opacity-5 pointer-events-none grayscale">
          {ARCHETYPE_DESCRIPTIONS[archetype].icon}
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`text-6xl mb-4 p-6 rounded-full bg-${
              ARCHETYPE_DESCRIPTIONS[archetype].color
            }-500/20 border-2 border-${
              ARCHETYPE_DESCRIPTIONS[archetype].color
            }-500 shadow-2xl shadow-${
              ARCHETYPE_DESCRIPTIONS[archetype].color
            }-500/20`}
          >
            {ARCHETYPE_DESCRIPTIONS[archetype].icon}
          </div>
          <h2
            className={`text-5xl font-black text-white italic uppercase tracking-tighter mb-2`}
          >
            {ARCHETYPE_DESCRIPTIONS[archetype].title}
          </h2>
          <p className="text-slate-400 max-w-md mx-auto text-lg font-light leading-relaxed">
            {ARCHETYPE_DESCRIPTIONS[archetype].desc}
          </p>

          <div className="mt-8 flex gap-4">
            <div className="bg-slate-800 px-4 py-2 rounded-xl border border-white/5">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Predicted Time
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {fmtTime(predictedTime)}
              </div>
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-xl border border-white/5">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Synergy Bonus
              </div>
              <div
                className={`text-2xl font-black ${
                  predictedTime < 3600 ? "text-emerald-400" : "text-slate-200"
                } font-mono`}
              >
                {predictedTime < 4000 ? "HIGH" : "AVG"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROL CENTER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* PLAYER CONFIG */}
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white italic uppercase">
              Roster Config
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Input Mode:
              </span>
              <button
                onClick={() => setCalibrationMode(!calibrationMode)}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  calibrationMode
                    ? "bg-indigo-500 text-white border-indigo-400"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {calibrationMode ? "Real Data" : "Simple Sliders"}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-900 border border-white/5 p-4 rounded-xl">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Preset:
            </span>
            <select
              value={presetName}
              onChange={(e) => {
                setPresetName(e.target.value);
                const p = PRESETS.find((x) => x.name === e.target.value);
                if (p) setPartnerStats({ ...p });
              }}
              className="bg-slate-800 text-xs text-white px-3 py-1.5 rounded-lg border-none outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black rounded-full border-2 border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
              VS
            </div>
            <div className="grid grid-cols-2 gap-4">
              <PlayerEditor
                stats={userStats}
                onChange={setUserStats}
                color="cyan"
                label="YOU"
                calibrationMode={calibrationMode}
              />
              <PlayerEditor
                stats={partnerStats}
                onChange={setPartnerStats}
                color="rose"
                label="PARTNER"
                calibrationMode={calibrationMode}
              />
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase">
                Transition Efficiency
              </h4>
              <span className="text-xs font-mono text-white">
                {transitionPenalty}s loss / swap
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={transitionPenalty}
              onChange={(e) => setTransitionPenalty(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <p className="text-[10px] text-slate-500 mt-2">
              Higher penalty favors fewer swaps ("Tow Truck" strategy). Lower
              penalty favors rapid swapping ("Twin Turbos").
            </p>
          </div>
        </div>

        {/* TACTICAL BOARD (SPLITS & SIMULATION) */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white italic uppercase">
              Strategy & Sim
            </h3>
            <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setTab("SPLITS")}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${
                  tab === "SPLITS"
                    ? "bg-slate-700 text-white shadow"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Splits
              </button>
              <button
                onClick={() => setTab("SIMULATION")}
                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${
                  tab === "SIMULATION"
                    ? "bg-slate-700 text-white shadow"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Visual Flow
              </button>
            </div>
          </div>

          {tab === "SPLITS"
            ? (
              <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
                {splits.map((s, i) => (
                  <div
                    key={i}
                    className={`relative overflow-hidden p-4 rounded-xl border flex items-center justify-between transition-all group ${
                      s.assignedTo === "ME"
                        ? "bg-cyan-500/5 border-cyan-500/20 hover:bg-cyan-500/10"
                        : "bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10"
                    }`}
                  >
                    {/* Connecting Line (Visual Flair) */}
                    {i < splits.length - 1 && (
                      <div className="absolute bottom-0 left-8 w-0.5 h-4 bg-white/5 -mb-4 z-0">
                      </div>
                    )}

                    <div className="flex items-center gap-4 relative z-10">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-slate-900 border ${
                          s.assignedTo === "ME"
                            ? "border-cyan-500/30 text-cyan-500"
                            : "border-rose-500/30 text-rose-500"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-white uppercase tracking-tight">
                          {s.stationId.replace("_", " ")}
                        </h4>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {s.rationale}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-2xl font-black italic ${
                          s.assignedTo === "ME"
                            ? "text-cyan-400"
                            : "text-rose-400"
                        }`}
                      >
                        {s.assignedTo === "ME" ? "YOU" : "PARTNER"}
                      </div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        Advantage: +{Math.round(s.advantage)}pts
                      </div>
                    </div>

                    {/* Fatigue Indicator */}
                    <div className="absolute bottom-0 right-0 left-0 h-0.5 bg-slate-800">
                      <div
                        className={`h-full ${
                          s.assignedTo === "ME" ? "bg-cyan-500" : "bg-rose-500"
                        }`}
                        style={{
                          width: `${Math.min(100, s.fatigueImpact)}%`,
                          opacity: 0.3,
                        }}
                      >
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
            : (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <RaceFlowChart simulation={simulation} />

                <div className="mt-6 bg-slate-900 p-4 rounded-xl border border-white/5 text-[10px] text-slate-400 leading-relaxed">
                  <h5 className="font-bold text-white mb-2 uppercase">
                    Analysis
                  </h5>
                  Based on your inputs, the simulation predicts your energy
                  levels will deplete significantly around the later runs.
                  {archetype === "THE_TOW_TRUCK" &&
                    " Since you're using a Tow Truck strategy, ensure the 'Machine' recovers during runs."}
                  {archetype === "THE_TWIN_TURBOS" &&
                    " You will gain a lot of time on the runs, but watch out for the Sleds causing fatigue spikes."}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* ATTRIBUTE COMPARISON */}
      <div className="bg-slate-900 border border-white/5 rounded-3xl p-8">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 text-center">
          Attribute Head-to-Head
        </h4>
        <div className="space-y-6 max-w-2xl mx-auto">
          <ComparisonBar
            label="Running (5k Capacity)"
            val1={userStats.runLevel}
            val2={partnerStats.runLevel}
            c1="cyan"
            c2="rose"
          />
          <ComparisonBar
            label="Strength (Sleds/Lunges)"
            val1={userStats.strengthLevel}
            val2={partnerStats.strengthLevel}
            c1="cyan"
            c2="rose"
          />
          <ComparisonBar
            label="Engine (Burpees/Row)"
            val1={userStats.engineLevel}
            val2={partnerStats.engineLevel}
            c1="cyan"
            c2="rose"
          />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// SUBCOMPONENTS
// ------------------------------------------------------------------

const PlayerEditor = (
  { stats, onChange, color, label, calibrationMode }: any,
) => {
  const update = (k: string, v: any) => onChange({ ...stats, [k]: v });

  return (
    <div
      className={`bg-slate-900 border border-${color}-500/20 rounded-2xl p-5 hover:border-${color}-500/40 transition-colors`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h4
          className={`text-sm font-black text-${color}-400 uppercase tracking-widest`}
        >
          {label}
        </h4>
        {/* Gender toggle */}
        <div className="flex gap-1">
          {["MALE", "FEMALE"].map((g) => (
            <button
              key={g}
              onClick={() => update("gender", g)}
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                stats.gender === g
                  ? `bg-${color}-500 text-black`
                  : "bg-slate-800 text-slate-500"
              }`}
            >
              {g[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {calibrationMode
          ? (
            <>
              {/* REAL STATS INPUTS */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                  <span>Best 5k Run</span>
                  <span className={`text-${color}-500`}>
                    {stats.best5k || "--:--"}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="MM:SS"
                  value={stats.best5k || ""}
                  onChange={(e) => update("best5k", e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:border-white/30 outline-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                  <span>Wall Balls (Max Reps)</span>
                  <span className={`text-${color}-500`}>
                    {stats.wallBallsUnbroken || 0}
                  </span>
                </div>
                <input
                  type="number"
                  value={stats.wallBallsUnbroken || ""}
                  onChange={(e) =>
                    update("wallBallsUnbroken", parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:border-white/30 outline-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                  <span>Engine (1-10)</span>
                  <span className={`text-${color}-500`}>
                    {stats.burpeePace || 0}
                  </span>
                </div>
                <input
                  type="number"
                  max="10"
                  value={stats.burpeePace || ""}
                  onChange={(e) =>
                    update("burpeePace", parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:border-white/30 outline-none font-mono"
                />
              </div>
            </>
          )
          : (
            <>
              {/* SLIDERS */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                  <span>Run Lvl</span>
                  <span>{stats.runLevel}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stats.runLevel}
                  onChange={(e) => update("runLevel", parseInt(e.target.value))}
                  className={`w-full h-1.5 rounded-full bg-slate-800 appearance-none accent-${color}-500`}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                  <span>Strength Lvl</span>
                  <span>{stats.strengthLevel}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stats.strengthLevel}
                  onChange={(e) =>
                    update("strengthLevel", parseInt(e.target.value))}
                  className={`w-full h-1.5 rounded-full bg-slate-800 appearance-none accent-${color}-500`}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                  <span>Engine Lvl</span>
                  <span>{stats.engineLevel}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={stats.engineLevel}
                  onChange={(e) =>
                    update("engineLevel", parseInt(e.target.value))}
                  className={`w-full h-1.5 rounded-full bg-slate-800 appearance-none accent-${color}-500`}
                />
              </div>
            </>
          )}
      </div>
    </div>
  );
};

const ComparisonBar = ({ label, val1, val2, c1, c2 }: any) => (
  <div className="relative pt-6">
    <div className="absolute top-0 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-500 uppercase">
      <span>{label}</span>
    </div>

    {/* CENTER LINE */}
    <div className="absolute top-6 bottom-0 left-1/2 w-px bg-white/10 z-0">
    </div>

    <div className="flex items-center h-8 relative z-10">
      {/* LEFT BAR (USER) */}
      <div className="flex-1 flex justify-end pr-2">
        <div
          className={`h-full rounded-l bg-${c1}-500 transition-all duration-500 flex items-center justify-end px-2 text-[10px] font-bold text-black`}
          style={{ width: `${val1}%` }}
        >
          {val1}
        </div>
      </div>

      {/* RIGHT BAR (PARTNER) */}
      <div className="flex-1 flex justify-start pl-2">
        <div
          className={`h-full rounded-r bg-${c2}-500 transition-all duration-500 flex items-center justify-start px-2 text-[10px] font-bold text-black`}
          style={{ width: `${val2}%` }}
        >
          {val2}
        </div>
      </div>
    </div>
  </div>
);
