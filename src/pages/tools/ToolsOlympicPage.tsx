import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Dumbbell, Info, Target, TrendingUp } from "lucide-react";
import { useData } from "../../context/DataContext.tsx";
import { calculateEstimated1RM } from "../../utils/strengthCalculators.ts";
import { normalizeExerciseName } from "../../models/strengthTypes.ts";

// IWF Sinclair Constants (2021-2024 Cycle)
const SINCLAIR_CONSTANTS = {
  male: { A: 0.751945030, b: 175.508 },
  female: { A: 0.783497476, b: 153.655 },
};

// IWF Weight Categories (Simplified for levels)
const WEIGHT_CATS = {
  male: [55, 61, 67, 73, 81, 89, 96, 102, 109, 109.1],
  female: [45, 49, 55, 59, 64, 71, 76, 81, 87, 87.1],
};

// Benchmarks (Approximations based on BW multipliers for visualization)
const LEVELS = [
  { label: "Nybörjare", color: "bg-slate-500", totalMultiplier: 0.5 },
  { label: "Motionär", color: "bg-emerald-500", totalMultiplier: 1.0 },
  { label: "Atlet", color: "bg-blue-500", totalMultiplier: 1.5 },
  { label: "Elit", color: "bg-purple-500", totalMultiplier: 2.0 },
  { label: "Världsklass", color: "bg-amber-500", totalMultiplier: 2.5 },
];

export function ToolsOlympicPage() {
  const { strengthSessions, exerciseEntries } = useData();

  // Form State
  const [bodyWeight, setBodyWeight] = useState<number>(80);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [snatch, setSnatch] = useState<number>(0);
  const [cleanJerk, setCleanJerk] = useState<number>(0);
  const [squat, setSquat] = useState<number>(0); // Required for Efficiency Analysis

  // Derived State
  const total = snatch + cleanJerk;

  // Auto-fetch Logic
  useEffect(() => {
    // Try to find recent bodyweight
    // (Assuming we might have it in settings or recent weight entry - but here we only have strengthSessions/exerciseEntries in scope from destructuring.
    //  Real implementation might want to pull weightEntries from useData too, but let's stick to what we requested)

    // Find best lifts
    const findMax = (terms: string[]) => {
      let max = 0;

      // Scan Strength Workouts (Session based)
      strengthSessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          const normName = normalizeExerciseName(ex.exerciseName);
          if (terms.some((t) => normName.includes(t))) {
            // Check sets
            ex.sets.forEach((set) => {
              if (set.weight > 0) {
                // Simple 1RM estimate if reps > 1, else weight
                const e1rm = calculateEstimated1RM(set.weight, set.reps);
                if (e1rm > max) max = e1rm;
              }
            });
          }
        });
      });

      // Scan Exercise Entries (Legacy/Simple)
      exerciseEntries.forEach((entry) => {
        // Check if entry has tonnage or weight in notes?
        // ExerciseEntry structure is limited for specific weights unless in notes or structured differently.
        // We'll rely primarily on strengthSessions for high fidelity data.
      });

      return Math.round(max);
    };

    const bestSnatch = findMax(["snatch", "ryck"]);
    const bestCJ = findMax(["clean and jerk", "clean & jerk", "stöt"]);
    const bestSquat = findMax(["squat", "knäböj", "böj"]);

    if (bestSnatch > 0) setSnatch(bestSnatch);
    if (bestCJ > 0) setCleanJerk(bestCJ);
    if (bestSquat > 0) setSquat(bestSquat);
  }, [strengthSessions]);

  // Sinclair Calculation
  const sinclairScore = useMemo(() => {
    if (bodyWeight <= 0 || total <= 0) return 0;

    const c = SINCLAIR_CONSTANTS[gender];
    if (bodyWeight >= c.b) return total; // Heavyweight cap

    const exponent = c.A * Math.pow(Math.log10(bodyWeight / c.b), 2);
    const multiplier = Math.pow(10, exponent);

    return Math.round(total * multiplier);
  }, [bodyWeight, total, gender]);

  // Efficiency Analysis
  const efficiency = useMemo(() => {
    if (squat <= 0) return null;

    const snatchRatio = (snatch / squat) * 100;
    const cjRatio = (cleanJerk / squat) * 100;

    return {
      snatchRatio: Math.round(snatchRatio),
      cjRatio: Math.round(cjRatio),
      snatchStatus: snatchRatio < 60
        ? "Teknikbegränsad"
        : snatchRatio > 66
        ? "Styrkebegränsad"
        : "Balanserad",
      cjStatus: cjRatio < 80
        ? "Teknikbegränsad"
        : cjRatio > 85
        ? "Styrkebegränsad"
        : "Balanserad",
    };
  }, [snatch, cleanJerk, squat]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in pb-24">
      <div className="mb-8">
        <Link
          to="/tools"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka till verktyg
        </Link>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
          Olympisk Tyngdlyftning
        </h1>
        <p className="text-slate-400 mt-2">
          Beräkna din Sinclair-poäng och analysera din tekniska effektivitet mot
          IWF-standarder.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* INPUTS */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <Dumbbell className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Dina Resultat</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Kön
              </label>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setGender("male")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    gender === "male"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  MAN
                </button>
                <button
                  onClick={() => setGender("female")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                    gender === "female"
                      ? "bg-pink-600 text-white shadow-lg"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  KVINNA
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Kroppsvikt (kg)
              </label>
              <input
                type="number"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono font-bold focus:border-blue-500 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1">
                <span>Ryck (Snatch)</span>
                {efficiency && (
                  <span
                    className={efficiency.snatchRatio < 60
                      ? "text-rose-400"
                      : "text-emerald-400"}
                  >
                    {efficiency.snatchRatio}% av Böj
                  </span>
                )}
              </label>
              <input
                type="number"
                value={snatch}
                onChange={(e) => setSnatch(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold text-lg focus:border-emerald-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1">
                <span>Stöt (Clean & Jerk)</span>
                {efficiency && (
                  <span
                    className={efficiency.cjRatio < 80
                      ? "text-rose-400"
                      : "text-emerald-400"}
                  >
                    {efficiency.cjRatio}% av Böj
                  </span>
                )}
              </label>
              <input
                type="number"
                value={cleanJerk}
                onChange={(e) => setCleanJerk(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono font-bold text-lg focus:border-emerald-500 outline-none transition-colors"
              />
            </div>

            <div className="pt-4 border-t border-white/5">
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Knäböj (För analys)
              </label>
              <input
                type="number"
                value={squat}
                onChange={(e) => setSquat(Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-slate-300 font-mono focus:border-purple-500 outline-none transition-colors"
                placeholder="Valfritt (för effektivitetsanalys)"
              />
            </div>
          </div>
        </div>

        {/* RESULTS */}
        <div className="space-y-6">
          {/* SCORE CARD */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border border-white/10 rounded-3xl p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-9xl font-black">
              IWF
            </div>

            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">
              Sinclair Total
            </h3>
            <div className="text-7xl font-black text-white tracking-tighter mb-4 drop-shadow-2xl">
              {sinclairScore}
            </div>
            <div className="inline-flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
              <span className="text-xs font-bold text-slate-300">
                Totalvikt: <span className="text-white">{total} kg</span>
              </span>
            </div>
          </div>

          {/* LEVELS / PROGRESS */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-6">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">
              Nivåbedömning
            </h3>

            <div className="space-y-6">
              {/* Total Level */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-white">Din Nivå</span>
                  <span className="text-slate-400">
                    {Math.round((total / bodyWeight) * 100) / 100}x BW
                  </span>
                </div>
                <div className="h-3 bg-slate-950 rounded-full overflow-hidden flex relative">
                  {/* Markers for levels */}
                  {LEVELS.map((level, i) => (
                    <div
                      key={level.label}
                      className={`h-full ${level.color} opacity-20`}
                      style={{ width: "20%" }} // Simplified equal distribution for visual stacking
                    />
                  ))}

                  {/* User Position */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-white shadow-[0_0_10px_white]"
                    style={{
                      width: `${
                        Math.min(100, (total / (bodyWeight * 2.5)) * 100)
                      }%`, // Scale: 0 to 2.5x BW
                      transition: "width 1s ease-out",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-600 font-bold uppercase">
                  <span>Nybörjare</span>
                  <span>Elit (2.5x)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ANALYSIS SECTION */}
      {efficiency && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
          {/* SNATCH ANALYSIS */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16">
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-black text-white italic">
                  Ryck-analys
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                    efficiency.snatchStatus === "Balanserad"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {efficiency.snatchStatus}
                </span>
              </div>

              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black text-white">
                  {efficiency.snatchRatio}%
                </span>
                <span className="text-xs text-slate-400 font-bold mb-1">
                  av Knäböj
                </span>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed">
                {efficiency.snatchStatus === "Teknikbegränsad" &&
                  "Du har en stor styrkereserv i benen. Fokusera på teknik, rörlighet och explosivitet för att få ut mer av din styrka i rycket."}
                {efficiency.snatchStatus === "Styrkebegränsad" &&
                  "Din teknik är utmärkt! Du utnyttjar din benstyrka till max. För att öka i ryck måste du nu bli starkare i knäböj."}
                {efficiency.snatchStatus === "Balanserad" &&
                  "Du ligger inom det optimala intervallet (60-66%). Fortsätt träna både styrka och teknik parallellt."}
              </p>
            </div>
          </div>

          {/* CJ ANALYSIS */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16">
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-black text-white italic">
                  Stöt-analys
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                    efficiency.cjStatus === "Balanserad"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {efficiency.cjStatus}
                </span>
              </div>

              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black text-white">
                  {efficiency.cjRatio}%
                </span>
                <span className="text-xs text-slate-400 font-bold mb-1">
                  av Knäböj
                </span>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed">
                {efficiency.cjStatus === "Teknikbegränsad" &&
                  "Din stöt släpar efter din benstyrka. Fokusera på vändningen (clean) och överstöten (jerk) tekniskt."}
                {efficiency.cjStatus === "Styrkebegränsad" &&
                  "Imponerande effektivitet! Du får ut nästan allt av din styrka. Prioritera tyngre knäböj för att driva upp totalen."}
                {efficiency.cjStatus === "Balanserad" &&
                  "Du ligger perfekt (80-85%). Din styrka och teknik utvecklas i takt."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
