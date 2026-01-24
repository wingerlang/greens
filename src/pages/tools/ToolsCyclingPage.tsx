import React, { useEffect, useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import {
  analyzeAssaultBikePerformance,
  ASSAULT_BIKE_INTERVALS,
  AssaultBikeMath,
  type AssaultInterval,
  calculateWattsPerKg,
  estimateFtp,
  extractFtpFromHistory,
  getCyclingLevel,
} from "../../utils/cyclingCalculations";
import {
  analyzeErgPerformance,
  type ErgInterval,
  ErgMath,
} from "../../utils/ergCalculations";
import { CYCLING_POWER_PROFILE } from "./data/cyclingStandards";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUpDown,
  Ban,
  Bike,
  Calculator,
  CheckCircle,
  ExternalLink,
  Flame,
  Gauge,
  Snowflake,
  Timer,
  Trophy,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";

type TabType = "cycling" | "assault" | "row" | "ski";

export const ToolsCyclingPage: React.FC = () => {
  const { getLatestWeight, unifiedActivities, userSettings, strengthSessions } =
    useData();
  const [activeTab, setActiveTab] = useState<TabType>("cycling");

  // Cycling State
  const [inputWatts, setInputWatts] = useState<string>("");
  const [isFtpInput, setIsFtpInput] = useState(true); // true = FTP input, false = 20min max input
  const [weight, setWeight] = useState<string>("80");
  const [gender, setGender] = useState<"male" | "female">("male");

  // Assault Bike Calculator State
  const [calcWatts, setCalcWatts] = useState<string>("300");
  const [calcRpm, setCalcRpm] = useState<string>("60");
  const [calcSpeed, setCalcSpeed] = useState<string>("26"); // km/h
  const [calcCals, setCalcCals] = useState<string>("15"); // cals/min

  // Erg Calculator State (Row/Ski)
  const [ergWatts, setErgWatts] = useState<string>("200");
  const [ergPace, setErgPace] = useState<string>("2:00"); // /500m

  const [sourceFtp, setSourceFtp] = useState<
    | {
      id: string;
      watts: number;
      date: string;
      source: string;
      method: string;
    }
    | null
  >(null);
  const [sortConfig, setSortConfig] = useState<
    { key: string; direction: "asc" | "desc" }
  >({ key: "date", direction: "desc" });

  const { updateExercise } = useData();

  // Load initial data
  useEffect(() => {
    const latestWeight = getLatestWeight();
    if (latestWeight) setWeight(latestWeight.toString());

    if (userSettings?.gender) {
      setGender(userSettings.gender === "female" ? "female" : "male");
    }

    // Pre-fill cycling best if available
    const bestFtp = extractFtpFromHistory(unifiedActivities);
    if (bestFtp) {
      setInputWatts(bestFtp.watts.toString());
      setIsFtpInput(true);
      setSourceFtp(bestFtp);
    }
  }, [getLatestWeight, unifiedActivities, userSettings]);

  // Cycling Calculations
  const cyclingStats = useMemo(() => {
    const w = parseFloat(weight) || 0;
    const p = parseFloat(inputWatts) || 0;

    if (!w || !p) return null;

    const ftp = isFtpInput ? p : estimateFtp(p);
    const wKg = calculateWattsPerKg(ftp, w);
    const level = getCyclingLevel(wKg, "ftp", gender);

    return { ftp, wKg, level };
  }, [weight, inputWatts, isFtpInput, gender]);

  const cyclingChartData = useMemo(() => {
    const standards = CYCLING_POWER_PROFILE[gender];
    const data = standards.map((s) => ({
      name: s.level,
      wKg: s.wKgFtp,
      userWKg: cyclingStats?.wKg || 0,
      isUser: false,
    })).reverse();

    return data;
  }, [gender, cyclingStats]);

  // History Analysis
  const historicalAssault = useMemo(() => {
    return analyzeAssaultBikePerformance(
      unifiedActivities,
      strengthSessions,
      gender,
    );
  }, [unifiedActivities, strengthSessions, gender]);

  const historicalRow = useMemo(() => {
    return analyzeErgPerformance(
      unifiedActivities,
      strengthSessions,
      "row",
      gender,
    );
  }, [unifiedActivities, strengthSessions, gender]);

  const historicalSki = useMemo(() => {
    return analyzeErgPerformance(
      unifiedActivities,
      strengthSessions,
      "ski",
      gender,
    );
  }, [unifiedActivities, strengthSessions, gender]);

  // Assault Calculator Handlers
  const handleWattChange = (val: string) => {
    setCalcWatts(val);
    const w = parseFloat(val);
    if (!w) return;
    setCalcRpm(AssaultBikeMath.wattsToRpm(w).toFixed(1));
    setCalcCals(AssaultBikeMath.wattsToCalsPerMin(w).toFixed(1));
    const rpm = AssaultBikeMath.wattsToRpm(w);
    setCalcSpeed(AssaultBikeMath.rpmToSpeedKmh(rpm).toFixed(1));
  };

  const handleRpmChange = (val: string) => {
    setCalcRpm(val);
    const rpm = parseFloat(val);
    if (!rpm) return;
    setCalcWatts(AssaultBikeMath.rpmToWatts(rpm).toFixed(0));
    setCalcSpeed(AssaultBikeMath.rpmToSpeedKmh(rpm).toFixed(1));
    const w = AssaultBikeMath.rpmToWatts(rpm);
    setCalcCals(AssaultBikeMath.wattsToCalsPerMin(w).toFixed(1));
  };

  const handleSpeedChange = (val: string) => {
    setCalcSpeed(val);
    const s = parseFloat(val);
    if (!s) return;
    const rpm = s / 0.43;
    setCalcRpm(rpm.toFixed(1));
    const w = AssaultBikeMath.rpmToWatts(rpm);
    setCalcWatts(w.toFixed(0));
    setCalcCals(AssaultBikeMath.wattsToCalsPerMin(w).toFixed(1));
  };

  const handleCalsChange = (val: string) => {
    setCalcCals(val);
    const c = parseFloat(val);
    if (!c) return;
    const w = AssaultBikeMath.calsPerMinToWatts(c);
    setCalcWatts(w.toFixed(0));
    setCalcRpm(AssaultBikeMath.wattsToRpm(w).toFixed(1));
    const rpm = AssaultBikeMath.wattsToRpm(w);
    setCalcSpeed(AssaultBikeMath.rpmToSpeedKmh(rpm).toFixed(1));
  };

  // Erg Calculator Handlers
  const handleErgWattsChange = (val: string) => {
    setErgWatts(val);
    const w = parseFloat(val);
    if (!w) return;
    const paceSec = ErgMath.wattsToPace(w);
    setErgPace(ErgMath.formatTime(paceSec));
  };

  const handleErgPaceChange = (val: string) => {
    setErgPace(val);
    // Try parsing MM:SS or MM:SS.s
    const sec = ErgMath.parseTime(val);
    if (sec > 0) {
      const w = ErgMath.paceToWatts(sec);
      setErgWatts(w.toFixed(0));
    }
  };

  // Relevant Activities List
  const relevantActivities = useMemo(() => {
    const list: {
      id: string;
      date: string;
      title: string;
      type: string;
      details: string;
      averageWatts?: number;
      excludeFromStats?: boolean;
      durationMinutes?: number;
      notes?: string;
    }[] = [];

    if (activeTab === "cycling") {
      const baseList = unifiedActivities
        .filter((e) => {
          const isCycling = e.type === "cycling";
          const hasWatts = e.averageWatts && e.averageWatts > 0;
          const isFtpSession = (e.notes || "").toLowerCase().includes("ftp") ||
            (e.title || "").toLowerCase().includes("ftp");
          return isCycling || hasWatts || isFtpSession;
        });
      list.push(...baseList.map((e) => ({
        id: e.id,
        date: e.date,
        title: e.title || "Cycling",
        type: e.type,
        details: "",
        averageWatts: e.averageWatts,
        excludeFromStats: e.excludeFromStats,
        durationMinutes: e.durationMinutes,
        notes: e.notes,
      })));
    } else {
      // Cardio & Strength Logic for Assault/Row/Ski
      const keywords = activeTab === "assault"
        ? ["assault", "air bike", "echo"]
        : activeTab === "row"
        ? ["row", "rodd", "concept2"]
        : ["ski", "skierg", "stakmaskin"];

      // 1. Summaries from unifiedActivities
      unifiedActivities.forEach((e) => {
        const title = (e.title || "").toLowerCase();
        const notes = (e.notes || "").toLowerCase();
        const type = (e.type || "").toLowerCase();

        let isMatch = false;
        if (
          activeTab === "row" && (type === "rowing" || type === "indoor_rowing")
        ) isMatch = true;
        if (
          activeTab === "ski" && type === "cross_country_skiing" &&
          (title.includes("erg") || notes.includes("erg"))
        ) isMatch = true;

        if (keywords.some((k) => title.includes(k) || notes.includes(k))) {
          isMatch = true;
        }

        if (isMatch) {
          list.push({
            id: e.id,
            date: e.date,
            title: e.title || "Cardio",
            type: "Cardio",
            details: `${
              e.distance ? e.distance + (e.distanceUnit || "km") : ""
            } ${
              e.caloriesBurned ? e.caloriesBurned + "kcal" : ""
            } ${e.durationMinutes}m`,
            excludeFromStats: e.excludeFromStats,
          });
        }
      });

      // 2. Strength Sessions
      strengthSessions.forEach((s) => {
        const hasMatch = s.exercises.some((ex) => {
          const name = (ex.exerciseName || "").toLowerCase();
          return keywords.some((k) => name.includes(k));
        });

        if (hasMatch) {
          const sets: string[] = [];
          s.exercises.forEach((ex) => {
            if (
              keywords.some((k) =>
                (ex.exerciseName || "").toLowerCase().includes(k)
              )
            ) {
              ex.sets.forEach((set) => {
                if (set.time) sets.push(`${set.time}`);
                else if (set.distance) {
                  sets.push(`${set.distance}${set.distanceUnit || "m"}`);
                } else if (set.calories) sets.push(`${set.calories} kcal`);
              });
            }
          });

          list.push({
            id: s.id,
            date: s.date,
            title: s.name || "Styrkepass",
            type: "Strength",
            details: sets.slice(0, 3).join(", ") +
              (sets.length > 3 ? "..." : ""),
            excludeFromStats: s.excludeFromStats,
          });
        }
      });
    }

    // Apply Sorting
    return list.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];

      if (sortConfig.key === "date") {
        const timeA = new Date(aVal || 0).getTime();
        const timeB = new Date(bVal || 0).getTime();
        return sortConfig.direction === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (sortConfig.key === "efTP") {
        const getFtp = (item: any) =>
          (item.title?.toLowerCase().includes("ftp") ||
              item.notes?.toLowerCase().includes("ftp"))
            ? item.averageWatts
            : (item.durationMinutes >= 20 ? item.averageWatts * 0.95 : 0);
        const ftpA = getFtp(a);
        const ftpB = getFtp(b);
        return sortConfig.direction === "asc" ? ftpA - ftpB : ftpB - ftpA;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [activeTab, unifiedActivities, strengthSessions, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleToggleExclude = (id: string, current: boolean) => {
    updateExercise(id, { excludeFromStats: !current });
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            {activeTab === "cycling" && (
              <Bike className="text-emerald-400" size={32} />
            )}
            {activeTab === "assault" && (
              <Wind className="text-emerald-400" size={32} />
            )}
            {activeTab === "row" && (
              <Waves className="text-emerald-400" size={32} />
            )}
            {activeTab === "ski" && (
              <Snowflake className="text-emerald-400" size={32} />
            )}
            Erg & Cardio Tools
          </h1>
          <p className="text-slate-400 mt-2">
            Prestationsanalys och kalkylatorer för din konditionsträning.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10 no-scrollbar">
        {[
          { id: "cycling", label: "Cykling", icon: Activity },
          { id: "assault", label: "Assault", icon: Wind },
          { id: "row", label: "Rodd", icon: Waves },
          { id: "ski", label: "Skierg", icon: Snowflake },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`pb-4 px-4 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === tab.id
                ? "text-emerald-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-2">
              <tab.icon size={18} /> {tab.label}
            </span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-400 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "cycling"
        ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Cycling Content (Existing) */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Kalkylator
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Vikt (kg)
                    </label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Kön (för standarder)
                    </label>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10">
                      <button
                        onClick={() => setGender("male")}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                          gender === "male"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Man
                      </button>
                      <button
                        onClick={() => setGender("female")}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                          gender === "female"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Kvinna
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Effekt (Watt)
                      </label>
                      <button
                        onClick={() => setIsFtpInput(!isFtpInput)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/30"
                      >
                        {isFtpInput ? "Har bara 20min max?" : "Har exakt FTP?"}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={inputWatts}
                        onChange={(e) => setInputWatts(e.target.value)}
                        placeholder={isFtpInput
                          ? "Din FTP (ex. 250)"
                          : "Ditt 20min Max (ex. 265)"}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">
                        W
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      {isFtpInput
                        ? "Ange din Functional Threshold Power."
                        : "Vi drar av 5% från ditt 20-minutersvärde för att estimera FTP."}
                    </p>
                    {sourceFtp && (
                      <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                          Baserat på senast hittade data:
                        </p>
                        <div className="flex items-center justify-between gap-2 text-xs font-medium">
                          <Link
                            to={`?activityId=${sourceFtp.id}`}
                            className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/30 flex items-center gap-1"
                          >
                            {sourceFtp.watts}W från {sourceFtp.source}
                            <ExternalLink size={10} />
                          </Link>
                          <span className="text-slate-500">
                            ({sourceFtp.date})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Results Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <h3 className="text-xl font-bold text-white mb-6">Analys</h3>

                {cyclingStats
                  ? (
                    <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                          <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                            Estim. FTP
                          </div>
                          <div className="text-3xl font-bold text-white">
                            {cyclingStats.ftp}{" "}
                            <span className="text-sm font-medium text-slate-500">
                              W
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
                          <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                            Watt / kg
                          </div>
                          <div className="text-3xl font-bold text-emerald-400">
                            {cyclingStats.wKg}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-500 uppercase font-bold mb-2">
                          Nivå (Coggan Power Profile)
                        </div>
                        <div className="text-2xl font-bold text-white flex items-center gap-3">
                          <Trophy className="text-amber-400" size={24} />
                          {cyclingStats.level}
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full mt-4 overflow-hidden relative">
                          <div
                            className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000"
                            style={{
                              width: `${
                                Math.min(100, (cyclingStats.wKg / 6.0) * 100)
                              }%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-medium uppercase">
                          <span>Otränad</span>
                          <span>Elit (6.0+)</span>
                        </div>
                      </div>
                    </div>
                  )
                  : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 min-h-[200px]">
                      <Activity size={48} className="opacity-20" />
                      <p>Ange värden för att se analys</p>
                    </div>
                  )}
              </div>
            </div>

            {/* Chart Section */}
            {cyclingStats && (
              <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-6">
                  Power Profile (W/kg)
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={cyclingChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#ffffff10"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="#94a3b8"
                        fontSize={12}
                        domain={[0, "auto"]}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#94a3b8"
                        fontSize={11}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#1e293b",
                          borderRadius: "12px",
                        }}
                        cursor={{ fill: "#ffffff05" }}
                      />
                      <Bar
                        dataKey="wKg"
                        fill="#334155"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        name="Standard"
                      />
                      <ReferenceLine
                        x={cyclingStats.wKg}
                        stroke="#10b981"
                        strokeWidth={2}
                        label={{
                          position: "top",
                          value: "DU",
                          fill: "#10b981",
                          fontSize: 10,
                          fontWeight: "bold",
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-8 p-4 bg-slate-950/50 rounded-xl border border-white/5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
                    Om beräkningarna
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Denna kalkylator använder{" "}
                    <span className="text-slate-300">Coggan Power Profile</span>
                    {" "}
                    för att kategorisera din atletiska profil. FTP-estimeringen
                    baseras på{" "}
                    <span className="text-slate-300">95%-regeln</span>, där man
                    drar av 5% från din maximala snitteffekt över 20 minuter.
                  </p>
                </div>
              </div>
            )}
          </div>
        )
        : activeTab === "assault"
        ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Assault Bike Layout */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy size={20} className="text-amber-400" />
                Mina Rekord
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {ASSAULT_BIKE_INTERVALS.map((interval) => {
                  const record = historicalAssault[interval.key];
                  return (
                    <div
                      key={interval.key}
                      className="bg-slate-950/50 border border-white/5 rounded-xl p-3 flex flex-col justify-between h-28 relative group hover:border-emerald-500/30 transition-all"
                    >
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        {interval.label}
                      </div>
                      {record
                        ? (
                          <div>
                            <div className="text-lg font-bold text-white">
                              {interval.type === "time"
                                ? Math.round(record.totalCals)
                                : formatTime(record.durationMinutes * 60)}
                              <span className="text-[10px] font-medium text-slate-500 ml-1">
                                {interval.type === "time" ? "kcal" : "min"}
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-400 mt-0.5 truncate">
                              {record.description}
                            </div>
                            <div className="text-[9px] text-slate-600 mt-1">
                              {record.date.split("T")[0]}
                            </div>
                          </div>
                        )
                        : (
                          <div className="text-xs text-slate-600 italic">
                            Inget data
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Calculator className="text-emerald-400" size={24} />
                <h3 className="text-xl font-bold text-white">Konverterare</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Zap size={14} /> Watt
                  </label>
                  <input
                    type="number"
                    value={calcWatts}
                    onChange={(e) => handleWattChange(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Gauge size={14} /> RPM
                  </label>
                  <input
                    type="number"
                    value={calcRpm}
                    onChange={(e) => handleRpmChange(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Wind size={14} /> Km/h (Est)
                  </label>
                  <input
                    type="number"
                    value={calcSpeed}
                    onChange={(e) => handleSpeedChange(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Flame size={14} /> Kcal/min
                  </label>
                  <input
                    type="number"
                    value={calcCals}
                    onChange={(e) => handleCalsChange(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-4 text-center">
                Baserat på standardformler för Assault/Echo bike (Watts = 0.99 *
                RPM³ / 1260).
              </p>
            </div>
          </div>
        )
        : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Erg (Row/Ski) Layout */}

            {/* Records Grid */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy size={20} className="text-amber-400" />
                  Mina Rekord ({activeTab === "row" ? "Rodd" : "Skierg"})
                </h3>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setGender("male")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      gender === "male"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Man
                  </button>
                  <button
                    onClick={() => setGender("female")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      gender === "female"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Kvinna
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(["500m", "1000m", "2000m", "5000m"] as ErgInterval[]).map(
                  (dist) => {
                    if (activeTab === "ski" && dist === "500m") return null; // Ski usually doesn't track 500m benchmark as heavily? Or user didn't ask for it. User asked for 1k, 2k, 5k for Ski.

                    const records = activeTab === "row"
                      ? historicalRow
                      : historicalSki;
                    const record = records[dist];

                    return (
                      <div
                        key={dist}
                        className="bg-slate-950/50 border border-white/5 rounded-xl p-4 flex flex-col justify-between min-h-[140px] relative group hover:border-emerald-500/30 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div className="text-xs font-bold text-slate-500 uppercase">
                            {dist}
                          </div>
                          {record && record.level !== "-" && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300`}
                            >
                              {record.level}
                            </span>
                          )}
                        </div>

                        {record
                          ? (
                            <div className="mt-2">
                              <div className="text-2xl font-bold text-white font-mono">
                                {record.timeString}
                              </div>
                              <div className="text-xs text-emerald-400 font-mono mt-1">
                                {record.pace}/500m
                              </div>
                              <div className="text-[10px] text-slate-500 mt-3 truncate border-t border-white/5 pt-2">
                                {record.date.split("T")[0]} •{" "}
                                {record.watts?.toFixed(0)}W
                              </div>
                            </div>
                          )
                          : (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-600 italic">
                              Inget data
                            </div>
                          )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            {/* Calculator */}
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Calculator className="text-emerald-400" size={24} />
                <h3 className="text-xl font-bold text-white">
                  Pace Konverterare
                </h3>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Timer size={14} /> Pace / 500m
                  </label>
                  <input
                    type="text"
                    value={ergPace}
                    onChange={(e) => handleErgPaceChange(e.target.value)}
                    placeholder="2:00"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Format: MM:SS (t.ex. 1:45)
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Zap size={14} /> Watt
                  </label>
                  <input
                    type="number"
                    value={ergWatts}
                    onChange={(e) => handleErgWattsChange(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-lg"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                    <Flame size={14} /> Cal/hr (Est)
                  </label>
                  <div className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-slate-400 font-mono text-lg">
                    ~{ErgMath.wattsToCalHr(parseFloat(ergWatts) || 0)}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Ungefärlig mekanisk förbränning.
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-4 text-center">
                Baserat på Concept2 fysikmodell (Watts = 2.80 / (Pace/500m)³).
              </p>
            </div>
          </div>
        )}

      {/* Common: Relevant Activity List */}
      <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h3 className="text-xl font-bold text-white mb-6">
          Relevanta Aktiviteter
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-white/10 uppercase font-bold">
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    Datum <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("title")}
                >
                  <div className="flex items-center gap-1">
                    Titel <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("type")}
                >
                  <div className="flex items-center gap-1">
                    Typ <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("averageWatts")}
                >
                  <div className="flex items-center justify-end gap-1">
                    {activeTab === "cycling" ? "Snittwatt" : "Detaljer"}{" "}
                    <ArrowUpDown size={10} />
                  </div>
                </th>
                {activeTab === "cycling" && (
                  <th
                    className="py-3 px-4 text-right cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("efTP")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      (e)FTP <ArrowUpDown size={10} />
                    </div>
                  </th>
                )}
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {relevantActivities.length > 0
                ? (
                  relevantActivities.map((activity: any) => (
                    <tr
                      key={activity.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                        activity.excludeFromStats
                          ? "opacity-40 grayscale-[0.5]"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {activity.date.split("T")[0]}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`?activityId=${activity.id}`}
                          className="text-white font-medium hover:text-emerald-400 transition-colors"
                        >
                          {activity.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {activeTab === "cycling"
                          ? (activity.type === "cycling" ? "Cykling" : "Annat")
                          : activity.type}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {activeTab === "cycling"
                          ? (
                            <div className="flex flex-col items-end">
                              {activity.averageWatts
                                ? (
                                  <span className="text-slate-300 font-bold">
                                    {Math.round(activity.averageWatts)}W
                                  </span>
                                )
                                : "-"}
                            </div>
                          )
                          : (
                            <span className="text-slate-300">
                              {activity.details}
                            </span>
                          )}
                      </td>
                      {activeTab === "cycling" && (
                        <td className="py-3 px-4 text-right">
                          {activity.averageWatts
                            ? (
                              <div className="flex flex-col items-end">
                                {(activity.title?.toLowerCase().includes(
                                    "ftp",
                                  ) ||
                                    activity.notes?.toLowerCase().includes(
                                      "ftp",
                                    ))
                                  ? (
                                    <span className="text-emerald-400 font-bold">
                                      {Math.round(activity.averageWatts)}W
                                    </span>
                                  )
                                  : (activity.durationMinutes >= 20)
                                  ? (
                                    <span className="text-amber-400/80 font-bold">
                                      {Math.round(
                                        activity.averageWatts * 0.95,
                                      )}W{" "}
                                      <span className="text-[10px] opacity-50">
                                        est
                                      </span>
                                    </span>
                                  )
                                  : "-"}
                              </div>
                            )
                            : "-"}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() =>
                            handleToggleExclude(
                              activity.id,
                              !!activity.excludeFromStats,
                            )}
                          className={`p-1.5 rounded-lg transition-all ${
                            activity.excludeFromStats
                              ? "text-slate-500 hover:text-emerald-400"
                              : "text-slate-600 hover:text-rose-400"
                          }`}
                          title={activity.excludeFromStats
                            ? "Inkludera i beräkningar"
                            : "Exkludera från beräkningar (t.ex. felaktig data)"}
                        >
                          {activity.excludeFromStats
                            ? <CheckCircle size={16} />
                            : <Ban size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )
                : (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-slate-500 italic"
                    >
                      Inga relevanta aktiviteter hittades.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
