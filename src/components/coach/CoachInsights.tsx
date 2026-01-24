import React, { useMemo } from "react";
import { useData } from "../../context/DataContext.tsx";
import {
  calculateVDOT,
  formatSeconds,
  predictRaceTime,
} from "../../utils/runningCalculator.ts";
import { useUniversalActivities } from "../../hooks/useUniversalActivities.ts";
import { ExerciseEntry, UniversalActivity } from "../../models/types.ts";

// Helper to map UniversalActivity -> ExerciseEntry (Legacy Support)
function mapToLegacyEntry(a: UniversalActivity): ExerciseEntry | null {
  if (!a.performance) return null;
  return {
    id: a.id,
    date: a.date,
    type:
      (a.plan?.activityType || a.performance.source?.source === "strava"
        ? "running"
        : "other") as any, // Only defaulting running for now based on Strava context
    durationMinutes: a.performance.durationMinutes,
    intensity: "moderate", // default
    caloriesBurned: a.performance.calories,
    distance: a.performance.distanceKm,
    createdAt: a.createdAt,
    externalId: a.performance.source?.externalId,
    platform: a.performance.source?.source === "strava" ? "strava" : undefined,
    heartRateAvg: a.performance.avgHeartRate,
    heartRateMax: a.performance.maxHeartRate,
    elevationGain: a.performance.elevationGain,
    subType: a.plan?.activityCategory === "INTERVALS" ? "interval" : undefined,
  };
}

export function CoachInsights() {
  const { coachConfig, plannedActivities } = useData();
  const { activities: universalActivities } = useUniversalActivities(365); // Fetch last year

  // Convert to legacy format for compatibility with existing charts
  const exerciseEntries = useMemo(() => {
    return universalActivities
      .map(mapToLegacyEntry)
      .filter((e): e is ExerciseEntry => e !== null);
  }, [universalActivities]);

  const stats = useMemo(() => {
    if (!coachConfig || !coachConfig.goals) return null;

    const activeGoal = coachConfig.goals.find((g) => g.isActive) ||
      coachConfig.goals[0];
    if (!activeGoal) return null;

    // 1. VDOT Progress
    let startVdot = 35;
    if (coachConfig.userProfile.currentForm) {
      startVdot = calculateVDOT(
        coachConfig.userProfile.currentForm.distanceKm,
        coachConfig.userProfile.currentForm.timeSeconds,
      );
    }

    // Recent performance (latest completed activities in last 30 days)
    const runningEntries = exerciseEntries
      .filter((e) => e.type === "running" && e.distance)
      .sort((a, b) => b.date.localeCompare(a.date));

    const recentRuns = runningEntries.slice(0, 5);

    const recentVdots = recentRuns.map((r) =>
      calculateVDOT(r.distance!, r.durationMinutes * 60)
    );
    const currentVdot = recentVdots.length > 0
      ? recentVdots.reduce((a, b) => a + b, 0) / recentVdots.length
      : startVdot;

    const improvement = currentVdot - startVdot;

    // 2. Completion Stats
    const relevantActivities = plannedActivities.filter((a) =>
      a.goalId === activeGoal.id
    );
    const completed = relevantActivities.filter((a) =>
      a.status === "COMPLETED"
    ).length;
    const total = relevantActivities.length;
    const completionRate = total > 0 ? completed / total : 0;

    // 3. Goal Proximity
    const dist = activeGoal.type === "MARATHON"
      ? 42.195
      : activeGoal.type === "HALF_MARATHON"
      ? 21.097
      : activeGoal.type === "10K"
      ? 10
      : 5;
    const targetVdot = calculateVDOT(
      dist,
      activeGoal.targetTimeSeconds || 3000,
    );
    const vdotGoalProgress = Math.min(
      100,
      Math.max(0, ((currentVdot - startVdot) / (targetVdot - startVdot)) * 100),
    );

    const weeksLeft = Math.ceil(
      (new Date(activeGoal.targetDate).getTime() - new Date().getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );

    // 4. Projections
    const projections = [
      { name: "5K", dist: 5, time: predictRaceTime(currentVdot, 5) },
      { name: "10K", dist: 10, time: predictRaceTime(currentVdot, 10) },
      {
        name: "Halvmarathon",
        dist: 21.097,
        time: predictRaceTime(currentVdot, 21.097),
      },
      {
        name: "Marathon",
        dist: 42.195,
        time: predictRaceTime(currentVdot, 42.195),
      },
    ];

    // 5. Volume Trend (Last 4 weeks)
    const now = new Date();
    const volumeTrend = [3, 2, 1, 0].map((weeksAgo) => {
      const start = new Date(
        now.getTime() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000,
      );
      const end = new Date(now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
      const weekVol = runningEntries
        .filter((e) => {
          const d = new Date(e.date);
          return d >= start && d < end;
        })
        .reduce((acc, e) => acc + (e.distance || 0), 0);
      return {
        week: weeksAgo === 0 ? "Nu" : `v-${weeksAgo}`,
        volume: Math.round(weekVol),
      };
    });

    // 6. Zone Distribution (Last 30 days)
    const last30Days = runningEntries.filter((e) => {
      const d = new Date(e.date);
      return d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    });

    const qualityRuns = last30Days.filter((e) =>
      e.intensity === "high" || e.intensity === "ultra" ||
      e.subType === "interval" || e.subType === "race"
    );
    const easyRuns = last30Days.filter((e) => !qualityRuns.includes(e));

    const zoneDist = {
      quality: qualityRuns.length,
      easy: easyRuns.length,
      total: last30Days.length,
      ratio: last30Days.length > 0
        ? (easyRuns.length / last30Days.length) * 100
        : 100,
    };

    // 7. Future Volume Projection
    const futureVolume = [0, 1, 2, 3].map((weeksAhead) => {
      const start = new Date(
        now.getTime() + weeksAhead * 7 * 24 * 60 * 60 * 1000,
      );
      const end = new Date(
        now.getTime() + (weeksAhead + 1) * 7 * 24 * 60 * 60 * 1000,
      );
      const weekVol = plannedActivities
        .filter((a) => {
          const d = new Date(a.date);
          return d >= start && d < end;
        })
        .reduce((acc, a) => acc + (a.estimatedDistance || 0), 0);
      return { week: `v+${weeksAhead}`, volume: Math.round(weekVol) };
    });

    // 8. Coach Wisdom Selector
    const currentPhase = weeksLeft <= 2
      ? "TAPER"
      : weeksLeft <= 6
      ? "PEAK"
      : weeksLeft <= 12
      ? "BUILD"
      : "BASE";
    const phaseWisdom = {
      "BASE": {
        title: "Basens Betydelse",
        text:
          "Dina lugna mil bygger mitokondriell densitet. Detta gör din kropp till en fettförbränningsmaskin och lägger grunden för att tåla hårda intervaller senare.",
        focus: "Aerob motor & Tålighet",
      },
      "BUILD": {
        title: "Kapacitetsökning",
        text:
          "Vi höjer nu volymen och intensiteten. Fokus ligger på att höja din tröskelfart så att du kan springa snabbare utan att dra på dig mjölksyra.",
        focus: "Laktattröskel & Styrka",
      },
      "PEAK": {
        title: "Toppningsfasen",
        text:
          "Nu finslipar vi tävlingsfarten. Passen blir mer specifika. Det handlar om att lära kroppen exakt hur måltempot känns när du är trött.",
        focus: "Race Pace & VO2 Max",
      },
      "TAPER": {
        title: "Superkompensation",
        text:
          "Det svåraste nu är att vila. Vi minskar volymen men behåller intensiteten. Din kropp reparerar sig nu för att leverera på tävlingsdagen.",
        focus: "Återhämtning & Explosivitet",
      },
    }[currentPhase];

    // 9. Session Count by Type
    const sessionCount = {
      easy: relevantActivities.filter((a) => a.category === "EASY").length,
      long: relevantActivities.filter((a) => a.category === "LONG_RUN").length,
      quality: relevantActivities.filter((a) =>
        a.category === "INTERVALS" || a.category === "TEMPO"
      ).length,
    };

    return {
      startVdot,
      currentVdot,
      targetVdot,
      improvement,
      completionRate,
      vdotGoalProgress,
      weeksLeft,
      activeGoal,
      projections,
      volumeTrend,
      futureVolume,
      zoneDist,
      sessionCount,
      totalWorkouts: total,
      completedWorkouts: completed,
      phaseWisdom,
      currentPhase,
      averageHistoricalVol: volumeTrend.reduce((a, b) => a + b.volume, 0) / 4,
    };
  }, [coachConfig, plannedActivities, exerciseEntries]);

  if (!stats) return null;

  return (
    <div className="coach-insights max-w-6xl mx-auto space-y-10 pb-24 text-white animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-8 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 group hover:border-emerald-500/40 transition-all">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
            VDOT Förbättring
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              +{stats.improvement.toFixed(1)}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              enheter
            </span>
          </div>
          <p className="text-[9px] text-slate-400 mt-2 font-bold italic tracking-wide">
            Senaste 30 dagarna
          </p>
        </div>

        <div className="glass-card p-8 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-500/20 group hover:border-indigo-500/40 transition-all">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
            Genomförandegrad
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.3)]">
              {Math.round(stats.completionRate * 100)}%
            </span>
          </div>
          <p className="text-[9px] text-slate-400 mt-2 font-bold italic tracking-wide">
            {stats.completedWorkouts} av {stats.totalWorkouts} pass klara
          </p>
        </div>

        <div className="glass-card p-8 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 group hover:border-amber-500/40 transition-all">
          <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
            Tid till Mål
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              {stats.weeksLeft}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              veckor
            </span>
          </div>
          <p className="text-[9px] text-slate-400 mt-2 font-bold italic tracking-wide">
            Loppdag: {stats.activeGoal.targetDate}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Projections Table */}
        <div className="glass-card p-8 bg-slate-900/40">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <span className="text-emerald-500">⏱️</span> Prognostiserade Tider
            </h3>
            <div className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black uppercase text-slate-500">
              VDOT {stats.currentVdot.toFixed(1)}
            </div>
          </div>
          <div className="space-y-4">
            {stats.projections.map((proj) => (
              <div
                key={proj.name}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
              >
                <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors">
                  {proj.name}
                </span>
                <span className="text-xl font-black text-emerald-400 tabular-nums drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                  {formatSeconds(proj.time)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Training Mix */}
        <div className="glass-card p-8 bg-slate-900/40">
          <h3 className="text-xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
            <span className="text-violet-500">🎨</span> Träningsmix
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="text-2xl font-black text-emerald-400 mb-1">
                {stats.sessionCount.easy}
              </div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Easy
              </div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
              <div className="text-2xl font-black text-blue-400 mb-1">
                {stats.sessionCount.long}
              </div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Long
              </div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
              <div className="text-2xl font-black text-rose-400 mb-1">
                {stats.sessionCount.quality}
              </div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Quality
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-6 italic text-center font-medium leading-relaxed">
            Fördelning av pass senaste 30 dagarna. Baseras på intensitet och
            distans.
          </p>
        </div>

        {/* Combined volume chart (Past & Future) */}
        <div className="glass-card p-8 bg-slate-900/40 lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <span className="text-indigo-500">📈</span>{" "}
              Volymprognos (Full Plan)
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase">
                  Historik
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase">
                  Planerat
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3 h-48 px-4 border-b border-white/5">
            {[...stats.volumeTrend].reverse().map((v) => (
              <div
                key={v.week}
                className="flex-1 flex flex-col items-center group relative"
              >
                <div className="absolute -top-6 text-[8px] font-black text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                  {v.volume}km
                </div>
                <div
                  className="w-full bg-slate-700/30 rounded-t-md group-hover:bg-slate-700/50 transition-all"
                  style={{ height: `${Math.max(10, (v.volume / 80) * 100)}%` }}
                />
                <div className="text-[8px] font-black text-slate-600 mt-2 uppercase">
                  {v.week}
                </div>
              </div>
            ))}
            <div className="w-px h-full bg-white/10 mx-2" />
            {stats.futureVolume.map((v) => (
              <div
                key={v.week}
                className="flex-1 flex flex-col items-center group relative"
              >
                <div className="absolute -top-6 text-[8px] font-black text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                  {v.volume}km
                </div>
                <div
                  className="w-full bg-indigo-500/40 rounded-t-md group-hover:bg-indigo-500/60 transition-all relative overflow-hidden"
                  style={{ height: `${Math.max(10, (v.volume / 80) * 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent" />
                  {v.volume > stats.averageHistoricalVol && (
                    <div className="absolute top-0 inset-x-0 h-1 bg-amber-400/50" />
                  )}
                </div>
                <div className="text-[8px] font-black text-indigo-400 mt-2 uppercase">
                  {v.week}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coach Wisdom Snippet */}
        <div className="glass-card p-10 border-l-[6px] border-indigo-500 bg-gradient-to-r from-indigo-500/10 to-transparent lg:col-span-2">
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-indigo-500 text-slate-950 text-[9px] font-black rounded-full uppercase tracking-widest">
                  Fas: {stats.currentPhase}
                </span>
                <h4 className="text-2xl font-black uppercase italic tracking-tighter">
                  Coachens Visdom: {stats.phaseWisdom.title}
                </h4>
              </div>
              <p className="text-lg text-slate-300 italic leading-relaxed font-medium mb-6">
                "{stats.phaseWisdom.text}"
              </p>
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Nuvarande Fokus
                  </span>
                  <span className="text-base font-black text-white uppercase">
                    {stats.phaseWisdom.focus}
                  </span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Analys
                  </span>
                  <span className="text-base font-black text-emerald-400 uppercase">
                    {stats.completionRate > 0.8
                      ? "Hög Kontinuitet"
                      : "Behöver Disciplin"}
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex w-32 h-32 items-center justify-center bg-slate-900/50 rounded-full border border-white/10 text-5xl">
              🧠
            </div>
          </div>
        </div>

        {/* Goal Proximity Gauge */}
        <div className="glass-card p-10 bg-gradient-to-br from-slate-900/40 to-transparent lg:col-span-2">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-3 text-white">
                  Vägen mot Målet 🎯
                </h3>
                <p className="text-slate-400 text-base leading-relaxed max-w-xl opacity-80 font-medium">
                  Dina genomförda pass och nuvarande VDOT-trend placerar dig
                  <span className="text-emerald-400 font-black px-2 text-xl">
                    {Math.round(stats.vdotGoalProgress)}%
                  </span>
                  längs vägen till optimal form för din {stats.activeGoal.type}.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                  <span className="text-slate-500">
                    Bas (VDOT {stats.startVdot.toFixed(1)})
                  </span>
                  <span className="text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                    Mål (VDOT {stats.targetVdot.toFixed(1)})
                  </span>
                </div>
                <div className="h-4 w-full bg-slate-950/50 rounded-full overflow-hidden p-1 border border-white/5 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-1000 ease-out shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                    style={{ width: `${stats.vdotGoalProgress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="w-full md:w-64 aspect-square glass-card bg-slate-900/50 flex flex-col items-center justify-center border-white/10 p-6 relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors" />
              <span className="text-5xl mb-4 z-10">🏅</span>
              <div className="text-4xl font-black text-white tabular-nums z-10">
                {stats.currentVdot.toFixed(1)}
              </div>
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mt-2 z-10 tracking-[0.2em]">
                Live VDOT
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
