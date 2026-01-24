import React, { useMemo, useState } from "react";
import { useData } from "../../context/DataContext.tsx";
import { StrengthSession, UniversalActivity } from "../../models/types.ts";
import {
  calculateEstimated1RM,
  calculateIPFPoints,
} from "../../utils/strengthCalculators.ts";
import {
  EXCLUDE_PATTERNS,
  MATCH_PATTERNS,
  MIN_WEIGHT_THRESHOLD,
  normalizeStrengthName,
} from "../../utils/strengthConstants.ts";
import {
  getBestSetForPatterns,
  SourceInfo,
} from "../../utils/strengthAnalysis.ts";
import {
  detectRunningPBs,
  formatTime,
  isCompetition,
} from "../../utils/activityUtils.ts";
import { slugify } from "../../utils/formatters.ts";
import { Link } from "react-router-dom";
import {
  Activity,
  Award,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
  ExternalLink,
  Heart,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

// --- Types & Interfaces ---

interface TrainingStats {
  firstDate: Date | null;
  lastDate: Date | null;
  totalSessions: number;
  activeWeeks: number;
  totalWeeks: number;
  consistencyScore: number; // 0-100
  activeYears: number; // Based on active weeks
  calendarYears: number;
  gapYears: number; // Time lost to gaps
  longestGapDays: number;
  cardioMinutes: number;
  strengthMinutes: number;
  hybridRatio: number; // 0 (Pure Strength) to 1 (Pure Cardio)
}

interface StrengthProfile {
  squat: {
    val: number;
    erm: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
  };
  bench: {
    val: number;
    erm: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
  };
  deadlift: {
    val: number;
    erm: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
  };
  ohp: {
    val: number;
    erm: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
  };
  swings: {
    val: number;
    erm: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
  };
  biceps: {
    val: number;
    erm: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
  };
  pullups: {
    val: number;
    erm: number;
    maxReps: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
    sourceMax?: SourceInfo;
  };
  row: {
    val: number;
    erm: number;
    sourceVal?: SourceInfo;
    sourceErm?: SourceInfo;
  };
  totalActual: number;
  totalEstimated: number;
  bwRatio: number;
  level: string;
  ipfPoints: number;
}

interface RunningProfile {
  best5k: { time: string; date: string; id?: string };
  best10k: { time: string; date: string; id?: string };
  bestHalf: { time: string; date: string; id?: string };
  bestFull: { time: string; date: string; id?: string };
  longestRun: { dist: number; time: string; date: string; id?: string };
  competitions: number;
}

// --- Helpers ---

const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
const GAP_THRESHOLD_DAYS = 28; // 4 weeks

function getISOWeek(date: Date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekKey(date: Date) {
  return `${date.getFullYear()}-W${getISOWeek(date)}`;
}

// --- Component ---

export function ToolsTrainingReportPage() {
  const {
    universalActivities,
    exerciseEntries,
    strengthSessions,
    getLatestWeight,
    userSettings,
    unifiedActivities,
  } = useData();
  const [promptCopied, setPromptCopied] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [totalMode, setTotalMode] = useState<"actual" | "estimated">("actual");

  // 1. Process Timeline & Consistency
  const stats: TrainingStats = useMemo(() => {
    const allActivities = [...unifiedActivities].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (allActivities.length === 0) {
      return {
        firstDate: null,
        lastDate: null,
        totalSessions: 0,
        activeWeeks: 0,
        totalWeeks: 0,
        consistencyScore: 0,
        activeYears: 0,
        calendarYears: 0,
        gapYears: 0,
        longestGapDays: 0,
        cardioMinutes: 0,
        strengthMinutes: 0,
        hybridRatio: 0.5,
      };
    }

    const first = new Date(allActivities[0].date);
    const last = new Date(allActivities[allActivities.length - 1].date);
    const totalWeeks = Math.max(
      1,
      Math.ceil((last.getTime() - first.getTime()) / ONE_WEEK_MS),
    );

    // Weekly Counts
    const weeks: Record<string, number> = {};
    let cardioMins = 0;
    let strengthMins = 0;

    allActivities.forEach((a) => {
      const d = new Date(a.date);
      const k = getWeekKey(d);
      weeks[k] = (weeks[k] || 0) + 1;

      const type = (((a as any).performance?.activityType || (a as any).type ||
        "other") as string).toLowerCase();
      const dur = (a as any).performance?.durationMinutes ||
        (a as any).durationMinutes || (a as any).duration || 0;

      if (
        [
          "running",
          "cycling",
          "swimming",
          "cardio",
          "löpning",
          "cykling",
          "simning",
        ].includes(type)
      ) {
        cardioMins += dur;
      } else if (
        ["strength", "weightlifting", "styrketräning"].includes(type)
      ) {
        strengthMins += dur;
      } else {
        // Default split if unknown
        strengthMins += dur / 2;
        cardioMins += dur / 2;
      }
    });

    // Active Weeks (>= 2 sessions)
    let activeWeeksCount = 0;
    Object.values(weeks).forEach((count) => {
      if (count >= 2) activeWeeksCount++;
    });

    // Gap Analysis
    let maxGap = 0;
    for (let i = 1; i < allActivities.length; i++) {
      const d1 = new Date(allActivities[i - 1].date);
      const d2 = new Date(allActivities[i].date);
      const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24);
      if (diffDays > maxGap) maxGap = diffDays;
    }

    const activeYears = (activeWeeksCount * 7) / 365.25;
    const calendarYears = (last.getTime() - first.getTime()) /
      (1000 * 3600 * 24 * 365.25);
    const totalMins = cardioMins + strengthMins;

    return {
      firstDate: first,
      lastDate: last,
      totalSessions: allActivities.length,
      activeWeeks: activeWeeksCount,
      totalWeeks,
      consistencyScore: Math.round((activeWeeksCount / totalWeeks) * 100),
      activeYears,
      calendarYears,
      gapYears: Math.max(0, calendarYears - activeYears),
      longestGapDays: Math.round(maxGap),
      cardioMinutes: cardioMins,
      strengthMinutes: strengthMins,
      hybridRatio: totalMins > 0 ? cardioMins / totalMins : 0.5,
    };
  }, [universalActivities]);

  // 2. Process Strength Profile
  const strengthProfile: StrengthProfile = useMemo(() => {
    const squat = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.squat,
      EXCLUDE_PATTERNS.squat,
    );
    const bench = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.bench,
      EXCLUDE_PATTERNS.bench,
    );
    const deadlift = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.deadlift,
      EXCLUDE_PATTERNS.deadlift,
    );
    const ohp = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.ohp,
      EXCLUDE_PATTERNS.ohp,
    );
    const swings = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.swings,
    );
    const biceps = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.biceps,
    );
    const pullups = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.pullups,
      EXCLUDE_PATTERNS.pullups,
    );
    const row = getBestSetForPatterns(
      strengthSessions,
      MATCH_PATTERNS.row,
      EXCLUDE_PATTERNS.row,
    );

    const bw = getLatestWeight() || 80;
    const totalActual = Math.round(
      squat.maxWeight + bench.maxWeight + deadlift.maxWeight,
    );
    const totalEstimated = Math.round(
      squat.maxEstimated1RM + bench.maxEstimated1RM + deadlift.maxEstimated1RM,
    );

    const displayTotal = totalMode === "actual" ? totalActual : totalEstimated;
    const ratio = displayTotal / bw;
    const ipfPoints = calculateIPFPoints(
      bw,
      displayTotal,
      (userSettings as any)?.gender || "male",
    );

    let level = "Nybörjare";
    if (ratio > 2.5) level = "Motionär";
    if (ratio > 3.5) level = "Atlet";
    if (ratio > 4.5) level = "Avancerad";
    if (ratio > 5.5) level = "Elit";

    const mapResult = (res: any) => ({
      val: res.maxWeight,
      erm: res.maxEstimated1RM,
      maxReps: res.maxReps || 0,
      sourceVal: res.heaviestSet || undefined,
      sourceErm: res.bestEstimatedSet || undefined,
      sourceMax: res.maxRepsSet || undefined,
    });

    return {
      squat: mapResult(squat),
      bench: mapResult(bench),
      deadlift: mapResult(deadlift),
      ohp: mapResult(ohp),
      swings: mapResult(swings),
      biceps: mapResult(biceps),
      pullups: mapResult(pullups),
      row: mapResult(row),
      totalActual,
      totalEstimated,
      bwRatio: ratio,
      level,
      ipfPoints,
    };
  }, [strengthSessions, getLatestWeight, userSettings, totalMode]);

  // 2.2 Process Running Profile
  const runningProfile: RunningProfile = useMemo(() => {
    return detectRunningPBs(unifiedActivities);
  }, [unifiedActivities]);

  // 3. Generate AI Prompt
  const generateAiPrompt = () => {
    const data = {
      meta: {
        reportDate: new Date().toISOString().split("T")[0],
        unit: "metric",
      },
      training_history: {
        start_date: stats.firstDate?.toISOString().split("T")[0],
        total_sessions: stats.totalSessions,
        active_years: stats.activeYears.toFixed(2),
        calendar_years: stats.calendarYears.toFixed(2),
        consistency_score: `${stats.consistencyScore}%`,
        active_weeks: stats.activeWeeks,
        longest_break_days: stats.longestGapDays,
        competitions: runningProfile.competitions,
      },
      athlete_type: {
        cardio_hours: Math.round(stats.cardioMinutes / 60),
        strength_hours: Math.round(stats.strengthMinutes / 60),
        classification: stats.hybridRatio > 0.7
          ? "Runner/Endurance"
          : stats.hybridRatio < 0.3
          ? "Lifter/Strength"
          : "Hybrid Athlete",
      },
      running_performance: {
        best_5k: runningProfile.best5k.time,
        best_10k: runningProfile.best10k.time,
        best_half_marathon: runningProfile.bestHalf.time,
        best_marathon: runningProfile.bestFull.time,
        longest_run_km: runningProfile.longestRun.dist.toFixed(1),
      },
      strength_performance: {
        squat: {
          heaviest_weight: Math.round(strengthProfile.squat.val),
          estimated_1rm: Math.round(strengthProfile.squat.erm),
          best_set: strengthProfile.squat.sourceErm
            ? `${strengthProfile.squat.sourceErm.reps}x${strengthProfile.squat.sourceErm.weight}kg`
            : "-",
        },
        bench: {
          heaviest_weight: Math.round(strengthProfile.bench.val),
          estimated_1rm: Math.round(strengthProfile.bench.erm),
          best_set: strengthProfile.bench.sourceErm
            ? `${strengthProfile.bench.sourceErm.reps}x${strengthProfile.bench.sourceErm.weight}kg`
            : "-",
        },
        deadlift: {
          heaviest_weight: Math.round(strengthProfile.deadlift.val),
          estimated_1rm: Math.round(strengthProfile.deadlift.erm),
          best_set: strengthProfile.deadlift.sourceErm
            ? `${strengthProfile.deadlift.sourceErm.reps}x${strengthProfile.deadlift.sourceErm.weight}kg`
            : "-",
        },
        ohp_erm: Math.round(strengthProfile.ohp.erm),
        pullups_max_reps: strengthProfile.pullups.maxReps,
        rows_erm: Math.round(strengthProfile.row.erm),
        kettlebell_swings_erm: Math.round(strengthProfile.swings.erm),
        bicep_curl_erm: Math.round(strengthProfile.biceps.erm),
        total_sbd_base: totalMode === "actual"
          ? "Actual 1RM"
          : "Estimated 1RM (e1RM)",
        total_sbd: strengthProfile.totalActual,
        total_sbd_erm: strengthProfile.totalEstimated,
        relative_strength: strengthProfile.bwRatio.toFixed(2),
        ipf_points: strengthProfile.ipfPoints.toFixed(1),
        level: strengthProfile.level,
      },
    };

    return `
Agera som en elittränare och fysiolog. Här är min träningsdata. Analysera min historik, identifiera svagheter och ge mig råd framåt.

DATA:
${JSON.stringify(data, null, 2)}

UPPGIFT:
1. Sammanfatta min "Träningsålder" vs verklig tid. Har jag varit konsekvent?
2. Analysera min styrkeprofil. Är jag balanserad? Vad laggar (Squat/Bench/Deadlift)?
3. Bedöm min "Hybrid-status". Tränar jag för mycket/lite av något?
4. Ge mig 3 konkreta fokusområden för nästa 12 veckor.
5. Ge mig en "Hård Sanning" om min träning baserat på datan.

Svara på Svenska. Håll det koncist, motiverande men ärligt.
`.trim();
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generateAiPrompt());
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  if (!stats.firstDate) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-700">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-500/20">
            <Brain className="w-3 h-3" />
            Deep Analysis
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Ditt Tränings-DNA
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Ingen träningsdata hittades. Logga dina första pass för att låsa upp
            din analys.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold uppercase tracking-wider border border-indigo-500/20">
          <Brain className="w-3 h-3" />
          Deep Analysis
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
          Ditt Tränings-DNA
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          En djupdykning i din träningshistorik. Vi analyserar inte bara vad du
          gjort, utan vad det betyder. Exportera datan till AI för personlig
          coaching.
        </p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
        <StatCard
          label="Träningsålder"
          value={`${stats.activeYears.toFixed(1)} År`}
          sub={`${stats.calendarYears.toFixed(1)} kalenderår`}
          icon={<Calendar className="w-5 h-5 text-indigo-400" />}
        />
        <StatCard
          label="Antal Pass"
          value={stats.totalSessions.toString()}
          sub="Totalt registrerade"
          icon={<Activity className="w-5 h-5 text-emerald-400" />}
        />
        <StatCard
          label="Konsistens"
          value={`${stats.consistencyScore}%`}
          sub={`${stats.activeWeeks} aktiva veckor`}
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
        />
        <StatCard
          label="Längsta Uppehåll"
          value={`${stats.longestGapDays} Dagar`}
          sub="Borträknat från ålder"
          icon={<Zap className="w-5 h-5 text-amber-400" />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Athlete Profile */}
        <div className="space-y-8">
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-pink-500/10 rounded-xl border border-pink-500/20">
                <Heart className="w-5 h-5 text-pink-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Atletprofil</h2>
            </div>

            {/* Hybrid Bar */}
            <div className="space-y-4">
              <div className="flex justify-between text-sm font-bold text-slate-400">
                <span>Styrka ({Math.round(stats.strengthMinutes / 60)}h)</span>
                <span>Cardio ({Math.round(stats.cardioMinutes / 60)}h)</span>
              </div>
              <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{ width: `${(1 - stats.hybridRatio) * 100}%` }}
                />
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                  style={{ width: `${stats.hybridRatio * 100}%` }}
                />
              </div>
              <div className="text-center pt-2">
                <span className="text-xl font-bold text-white">
                  {stats.hybridRatio > 0.7
                    ? "Uthållighetsatlet"
                    : stats.hybridRatio < 0.3
                    ? "Styrkelyftare"
                    : "Hybridatlet"}
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Baserat på tidsfördelning av all träning
                </p>
              </div>
            </div>
          </div>

          {/* AI Prompt Section */}
          <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-3xl p-8 relative overflow-hidden h-fit">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                  <Brain className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    AI Coach Analys
                  </h2>
                  <p className="text-xs text-indigo-300">
                    Generera rapport för ChatGPT/Claude
                  </p>
                </div>
              </div>
              <button
                onClick={copyPrompt}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
              >
                {promptCopied
                  ? <Check className="w-4 h-4" />
                  : <Copy className="w-4 h-4" />}
                {promptCopied ? "Kopierad!" : "Kopiera Prompt"}
              </button>
            </div>

            <div className="relative z-10">
              <button
                onClick={() => setIsPromptOpen(!isPromptOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-950/50 rounded-xl text-xs text-slate-400 font-mono border border-white/5 hover:bg-slate-950/80 transition-colors"
              >
                <span>Visa genererad data...</span>
                {isPromptOpen
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />}
              </button>

              {isPromptOpen && (
                <textarea
                  readOnly
                  value={generateAiPrompt()}
                  className="w-full h-64 mt-2 bg-slate-950/80 text-indigo-200/80 p-4 rounded-xl text-xs font-mono border border-white/5 focus:outline-none resize-none custom-scrollbar"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right: Strength Stats (Main Lifts) */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 h-fit">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Dumbbell className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Styrkeprofil</h2>
              <p className="text-xs text-slate-500">De tre stora & press</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StrengthCard label="Knäböj" data={strengthProfile.squat} />
            <StrengthCard label="Bänkpress" data={strengthProfile.bench} />
            <StrengthCard label="Marklyft" data={strengthProfile.deadlift} />
            <StrengthCard label="Militärpress" data={strengthProfile.ohp} />
          </div>
        </div>
      </div>

      {/* SBD Total Box - Standalone */}
      <div className="bg-slate-900 border border-indigo-500/20 rounded-3xl p-8 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] pointer-events-none" />

        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              Total (SBD)
            </div>
            <div className="text-6xl font-black text-white">
              {totalMode === "actual"
                ? strengthProfile.totalActual
                : strengthProfile.totalEstimated}{" "}
              <span className="text-xl text-slate-600">kg</span>
            </div>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setTotalMode("actual")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${
                totalMode === "actual"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-500 hover:text-slate-400"
              }`}
            >
              Faktisk
            </button>
            <button
              onClick={() => setTotalMode("estimated")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all ${
                totalMode === "estimated"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-500 hover:text-slate-400"
              }`}
            >
              e1RM
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
          <div className="space-y-4">
            {[
              { label: "Knäböj", data: strengthProfile.squat },
              { label: "Bänkpress", data: strengthProfile.bench },
              { label: "Marklyft", data: strengthProfile.deadlift },
            ].map((item, idx) => {
              const source = totalMode === "actual"
                ? item.data.sourceVal
                : item.data.sourceErm;
              return (
                <Link
                  key={idx}
                  to={source ? `/activity/${source.sessionId}` : "#"}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.08] border border-transparent hover:border-white/10 transition-all group"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-emerald-400/80 transition-colors">
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {source?.exerciseName || "-"}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-white">
                        {Math.round(
                          totalMode === "actual"
                            ? item.data.val
                            : item.data.erm,
                        )}
                      </span>
                      <span className="text-[10px] text-slate-600">kg</span>
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase opacity-80 group-hover:opacity-100">
                      {source?.date}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 items-center md:items-end justify-center">
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase border border-emerald-500/20 shadow-lg shadow-emerald-500/5 transition-transform hover:scale-105">
              <Award className="w-4 h-4" />
              Nivå: {strengthProfile.level}{" "}
              ({strengthProfile.bwRatio.toFixed(1)}x BW)
            </div>
            <div className="text-xs font-mono text-slate-500 uppercase tracking-wider bg-slate-950 px-3 py-1 rounded-lg border border-white/5">
              {strengthProfile.ipfPoints.toFixed(1)} IPF GL Points
            </div>
          </div>
        </div>
      </div>

      {/* Section: Running & Others (Wider Side by Side) */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Löparprofil (2/3 width) */}
        <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-3xl p-8 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Trophy className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Löparprofil</h2>
              <p className="text-xs text-slate-500">
                Dina snabbaste tider och uthållighet
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <RunningCard label="5 KM" data={runningProfile.best5k} />
            <RunningCard label="10 KM" data={runningProfile.best10k} />
            <RunningCard label="Halvmaraton" data={runningProfile.bestHalf} />
            <RunningCard label="Maraton" data={runningProfile.bestFull} />
            <RunningCard
              label="Längsta"
              value={`${runningProfile.longestRun.dist.toFixed(1)}km`}
              sub={runningProfile.longestRun.time}
              date={runningProfile.longestRun.date}
            />

            <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Tävlingar
              </div>
              <div className="text-3xl font-black text-white">
                {runningProfile.competitions}{" "}
                <span className="text-xs text-slate-600">st</span>
              </div>
            </div>
          </div>
        </div>

        {/* Andra Övningar (1/3 width) */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Andra Övningar</h2>
              <p className="text-xs text-slate-500">
                Kettlebell, Biceps, Chins & Rodd
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <StrengthCard label="Pullups" data={strengthProfile.pullups} />
            <StrengthCard label="Rodd" data={strengthProfile.row} />
            <StrengthCard label="KB Swings" data={strengthProfile.swings} />
            <StrengthCard label="Bicepscurl" data={strengthProfile.biceps} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard(
  { label, value, sub, icon }: {
    label: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
  },
) {
  return (
    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center hover:border-white/10 transition-colors shadow-sm">
      <div className="mb-4 p-3 bg-slate-950 rounded-xl border border-white/5">
        {icon}
      </div>
      <div className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight">
        {value}
      </div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-[10px] text-slate-600 font-medium leading-tight">
        {sub}
      </div>
    </div>
  );
}

function StrengthCard(
  { label, data }: {
    label: string;
    data: {
      val: number;
      erm: number;
      maxReps?: number;
      sourceVal?: SourceInfo;
      sourceErm?: SourceInfo;
    };
  },
) {
  const isPullups = label.toLowerCase().includes("pullup") ||
    label.toLowerCase().includes("chins");

  return (
    <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 flex flex-col gap-3 group hover:border-emerald-500/20 transition-all">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
          {label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-0.5">
          <div className="text-[9px] font-bold text-slate-600 uppercase">
            {isPullups ? "Max Reps" : "Faktisk"}
          </div>
          <div className="text-xl font-black text-white">
            {isPullups ? (data.maxReps || "-") : (data.val || "-")}
            <span className="text-[10px] text-slate-600 font-normal ml-1">
              {isPullups ? "st" : "kg"}
            </span>
          </div>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-[9px] font-bold text-indigo-500/70 uppercase">
            e1RM
          </div>
          <div className="text-xl font-black text-indigo-400">
            {data.erm || "-"}{" "}
            <span className="text-[10px] text-slate-600 font-normal ml-1">
              kg
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5 space-y-2">
        {data.sourceVal && (
          <Link
            to={`/activity/${data.sourceVal.sessionId}`}
            className="block text-[10px] text-slate-400 hover:text-white leading-tight bg-white/[0.03] p-2 rounded-lg border border-transparent hover:border-white/10 transition-all group/link"
          >
            <div className="font-black text-slate-300 group-hover/link:text-emerald-400 transition-colors">
              Tyngsta: {data.sourceVal.reps}x{data.sourceVal.weight}kg
            </div>
            <div className="truncate opacity-70 group-hover/link:opacity-100">
              {data.sourceVal.exerciseName} • {data.sourceVal.date}
            </div>
          </Link>
        )}
        {data.sourceErm &&
          data.sourceErm.sessionId !== data.sourceVal?.sessionId && (
          <Link
            to={`/activity/${data.sourceErm.sessionId}`}
            className="block text-[10px] text-indigo-300 hover:text-white leading-tight bg-indigo-500/[0.05] p-2 rounded-lg border border-transparent hover:border-indigo-500/20 transition-all group/link"
          >
            <div className="font-black text-indigo-400 group-hover/link:text-indigo-300 transition-colors">
              Bästa e1RM: {data.sourceErm.reps}x{data.sourceErm.weight}kg
            </div>
            <div className="truncate opacity-70 group-hover/link:opacity-100">
              {data.sourceErm.exerciseName} • {data.sourceErm.date}
            </div>
          </Link>
        )}
        {!data.sourceVal && !data.sourceErm && (
          <div className="text-[9px] text-slate-700 italic px-2">
            Ingen data
          </div>
        )}
      </div>
    </div>
  );
}

function RunningCard(
  { label, data, value, sub, date }: {
    label: string;
    data?: { time: string; date: string; id?: string };
    value?: string;
    sub?: string;
    date?: string;
  },
) {
  const displayValue = value || data?.time || "-";
  const displaySub = sub || (data?.time === "-" ? "" : "PB-Tid");
  const displayDate = date || data?.date || "";
  const sessionId = data?.id;

  const content = (
    <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex flex-col gap-2 group hover:border-blue-500/30 transition-all w-full h-full">
      <div className="flex justify-between items-start">
        <span className="text-xs text-slate-500 font-bold uppercase">
          {label}
        </span>
        <Trophy className="w-3 h-3 text-blue-500/30 group-hover:text-blue-500 transition-colors" />
      </div>
      <div>
        <div className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">
          {displayValue}
        </div>
        <div className="text-[10px] text-blue-400 font-bold uppercase">
          {displaySub}
        </div>
      </div>
      {displayDate && displayDate !== "-" && (
        <div className="text-[9px] text-slate-400 font-mono mt-1 pt-2 border-t border-white/5 opacity-60 group-hover:opacity-100">
          Förevigat {displayDate}
        </div>
      )}
    </div>
  );

  if (sessionId) {
    return (
      <Link to={`/activity/${sessionId}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
