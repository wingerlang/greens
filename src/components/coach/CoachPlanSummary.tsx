import React, { useMemo, useState } from "react";
import { PlannedActivity } from "../../models/types.ts";

interface CoachPlanSummaryProps {
  activities: PlannedActivity[];
  onWeekClick?: (weekNumber: number) => void;
}

type Phase = "base" | "build" | "peak" | "taper";

const PHASE_COLORS: Record<
  Phase,
  { bg: string; text: string; border: string }
> = {
  base: {
    bg: "bg-blue-500",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  build: {
    bg: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  peak: {
    bg: "bg-rose-500",
    text: "text-rose-400",
    border: "border-rose-500/30",
  },
  taper: {
    bg: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
};

const CATEGORY_ICONS: Record<PlannedActivity["category"], string> = {
  "LONG_RUN": "🏃",
  "INTERVALS": "⚡",
  "TEMPO": "🔥",
  "EASY": "🌿",
  "RECOVERY": "💤",
  "REPETITION": "🔁",
};

export function CoachPlanSummary(
  { activities, onWeekClick }: CoachPlanSummaryProps,
) {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Group activities by week
  const weeklyData = useMemo(() => {
    if (activities.length === 0) return [];

    const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sorted[0].date);
    const weeks: {
      weekNumber: number;
      startDate: string;
      endDate: string;
      activities: PlannedActivity[];
      totalVolumeKm: number;
      completedVolumeKm: number;
      phase: Phase;
      sessionsPlanned: number;
      sessionsCompleted: number;
      longestRun: number;
      categories: Record<string, number>;
    }[] = [];

    sorted.forEach((act) => {
      const actDate = new Date(act.date);
      const weekNum = Math.floor(
        (actDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
      ) + 1;

      let week = weeks.find((w) => w.weekNumber === weekNum);
      if (!week) {
        const weekStart = new Date(
          firstDate.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000,
        );
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        week = {
          weekNumber: weekNum,
          startDate: weekStart.toISOString().split("T")[0],
          endDate: weekEnd.toISOString().split("T")[0],
          activities: [],
          totalVolumeKm: 0,
          completedVolumeKm: 0,
          phase: weekNum <= 4
            ? "base"
            : weekNum <= 8
            ? "build"
            : weekNum <= 10
            ? "peak"
            : "taper",
          sessionsPlanned: 0,
          sessionsCompleted: 0,
          longestRun: 0,
          categories: {},
        };
        weeks.push(week);
      }

      week.activities.push(act);
      week.totalVolumeKm += act.estimatedDistance || 0;
      week.sessionsPlanned++;
      if (act.status === "COMPLETED") {
        week.sessionsCompleted++;
        week.completedVolumeKm += act.actualDistance || act.estimatedDistance ||
          0;
      }
      if ((act.estimatedDistance || 0) > week.longestRun) {
        week.longestRun = act.estimatedDistance || 0;
      }
      week.categories[act.category] = (week.categories[act.category] || 0) + 1;
    });

    return weeks.sort((a, b) => a.weekNumber - b.weekNumber);
  }, [activities]);

  // Global stats
  const stats = useMemo(() => {
    const totalPlanned = activities.length;
    const completed = activities.filter((a) => a.status === "COMPLETED").length;
    const remaining = totalPlanned - completed;
    const totalVolumePlanned = activities.reduce(
      (sum, a) => sum + (a.estimatedDistance || 0),
      0,
    );
    const totalVolumeCompleted = activities.filter((a) =>
      a.status === "COMPLETED"
    ).reduce(
      (sum, a) => sum + (a.actualDistance || a.estimatedDistance || 0),
      0,
    );
    const longestRun = Math.max(
      ...activities.map((a) => a.estimatedDistance || 0),
    );
    const longestRunActivity = activities.find((a) =>
      a.estimatedDistance === longestRun
    );
    const avgSessionsPerWeek = weeklyData.length > 0
      ? (totalPlanned / weeklyData.length).toFixed(1)
      : "0";
    const currentWeek = weeklyData.find((w) => {
      const now = new Date().toISOString().split("T")[0];
      return now >= w.startDate && now <= w.endDate;
    });
    const completionRate = totalPlanned > 0
      ? Math.round((completed / totalPlanned) * 100)
      : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    activities.forEach((a) => {
      categoryBreakdown[a.category] = (categoryBreakdown[a.category] || 0) + 1;
    });

    // Weekly volume trend
    const avgWeeklyVolume = weeklyData.length > 0
      ? totalVolumePlanned / weeklyData.length
      : 0;
    const peakVolume = weeklyData.length > 0
      ? Math.max(...weeklyData.map((w) => w.totalVolumeKm))
      : 0;

    return {
      totalPlanned,
      completed,
      remaining,
      totalVolumePlanned: Math.round(totalVolumePlanned),
      totalVolumeCompleted: Math.round(totalVolumeCompleted),
      longestRun: Math.round(longestRun * 10) / 10,
      longestRunActivity,
      avgSessionsPerWeek,
      currentWeek,
      completionRate,
      categoryBreakdown,
      avgWeeklyVolume: Math.round(avgWeeklyVolume),
      peakVolume: Math.round(peakVolume),
      totalWeeks: weeklyData.length,
    };
  }, [activities, weeklyData]);

  const maxWeekVolume = Math.max(...weeklyData.map((w) => w.totalVolumeKm), 30);

  if (activities.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-sm font-bold">Ingen plan att visa</p>
        <p className="text-[10px]">Generera en plan först</p>
      </div>
    );
  }

  return (
    <div className="coach-plan-summary text-white space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-2xl border border-emerald-500/20">
          <div className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest mb-1">
            Genomförda
          </div>
          <div className="text-3xl font-black text-emerald-400">
            {stats.completed}
            <span className="text-lg text-emerald-400/50">
              /{stats.totalPlanned}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {stats.completionRate}% klart
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-2xl border border-amber-500/20">
          <div className="text-[9px] font-black text-amber-400/70 uppercase tracking-widest mb-1">
            Kvar att köra
          </div>
          <div className="text-3xl font-black text-amber-400">
            {stats.remaining}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            pass återstående
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 rounded-2xl border border-indigo-500/20">
          <div className="text-[9px] font-black text-indigo-400/70 uppercase tracking-widest mb-1">
            Total Volym
          </div>
          <div className="text-3xl font-black text-indigo-400">
            {stats.totalVolumePlanned}
            <span className="text-lg text-indigo-400/50">km</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {stats.totalVolumeCompleted}km avklarade
          </div>
        </div>
        <div className="p-4 bg-gradient-to-br from-rose-500/20 to-rose-500/5 rounded-2xl border border-rose-500/20">
          <div className="text-[9px] font-black text-rose-400/70 uppercase tracking-widest mb-1">
            Längsta Pass
          </div>
          <div className="text-3xl font-black text-rose-400">
            {stats.longestRun}
            <span className="text-lg text-rose-400/50">km</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 truncate">
            {stats.longestRunActivity?.title}
          </div>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <div className="p-3 bg-slate-900/60 rounded-xl text-center">
          <div className="text-xl font-black text-white">
            {stats.totalWeeks}
          </div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">
            Veckor
          </div>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl text-center">
          <div className="text-xl font-black text-white">
            {stats.avgSessionsPerWeek}
          </div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">
            Pass/vecka
          </div>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl text-center">
          <div className="text-xl font-black text-white">
            {stats.avgWeeklyVolume}
          </div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">
            Snitt km/v
          </div>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl text-center">
          <div className="text-xl font-black text-white">
            {stats.peakVolume}
          </div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">
            Peak km
          </div>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl text-center">
          <div className="text-xl font-black text-white">
            {stats.categoryBreakdown["LONG_RUN"] || 0}
          </div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">
            Långpass
          </div>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl text-center">
          <div className="text-xl font-black text-white">
            {stats.categoryBreakdown["INTERVALS"] || 0}
          </div>
          <div className="text-[8px] text-slate-500 uppercase font-bold">
            Intervaller
          </div>
        </div>
      </div>

      {/* Weekly Volume Bar Chart */}
      <div className="p-5 bg-slate-900/40 rounded-2xl border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-tight">
            📊 Veckovolym
          </h3>
          <div className="flex gap-2">
            {Object.entries(PHASE_COLORS).map(([phase, colors]) => (
              <span
                key={phase}
                className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${colors.text} bg-white/5`}
              >
                {phase}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-1 h-40 mb-2">
          {weeklyData.map((week) => {
            const heightPct = (week.totalVolumeKm / maxWeekVolume) * 100;
            const completedHeightPct =
              (week.completedVolumeKm / maxWeekVolume) * 100;
            const phaseColor = PHASE_COLORS[week.phase];
            const isCurrentWeek =
              stats.currentWeek?.weekNumber === week.weekNumber;
            const isSelected = selectedWeek === week.weekNumber;

            return (
              <div
                key={week.weekNumber}
                className={`flex-1 flex flex-col justify-end cursor-pointer group relative ${
                  isSelected ? "z-10" : ""
                }`}
                onClick={() => {
                  setSelectedWeek(isSelected ? null : week.weekNumber);
                  onWeekClick?.(week.weekNumber);
                }}
              >
                {/* Bar */}
                <div className="relative w-full">
                  {/* Completed portion */}
                  <div
                    className={`absolute bottom-0 w-full ${phaseColor.bg} opacity-40 rounded-t transition-all`}
                    style={{ height: `${completedHeightPct}%` }}
                  />
                  {/* Total bar */}
                  <div
                    className={`w-full ${phaseColor.bg} rounded-t transition-all group-hover:opacity-90 ${
                      isCurrentWeek ? "ring-2 ring-white/50" : ""
                    } ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
                    style={{ height: `${heightPct}%`, minHeight: "4px" }}
                  >
                    <div className="absolute inset-x-0 top-0 h-1/3 bg-white/20 rounded-t" />
                  </div>
                </div>

                {/* Week label */}
                <div
                  className={`text-center mt-2 text-[8px] font-bold ${
                    isCurrentWeek ? "text-white" : "text-slate-600"
                  }`}
                >
                  V{week.weekNumber}
                </div>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-[9px] font-bold whitespace-nowrap z-20 pointer-events-none shadow-xl">
                  <div className="text-white">
                    {Math.round(week.totalVolumeKm)} km
                  </div>
                  <div className="text-slate-500">
                    {week.sessionsCompleted}/{week.sessionsPlanned} pass
                  </div>
                  <div className="text-slate-600">
                    Längsta: {week.longestRun}km
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Volume scale */}
        <div className="flex justify-between text-[9px] text-slate-600">
          <span>0 km</span>
          <span>{Math.round(maxWeekVolume)} km</span>
        </div>
      </div>

      {/* Selected Week Detail */}
      {selectedWeek && (
        <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl animate-in slide-in-from-top duration-200">
          {(() => {
            const week = weeklyData.find((w) => w.weekNumber === selectedWeek);
            if (!week) return null;
            return (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-black text-white">
                      Vecka {week.weekNumber}
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      {week.startDate} → {week.endDate}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                      PHASE_COLORS[week.phase].text
                    } ${PHASE_COLORS[week.phase].border} border bg-white/5`}
                  >
                    {week.phase}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-black text-indigo-400">
                      {Math.round(week.totalVolumeKm)}
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase">
                      km totalt
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-emerald-400">
                      {week.sessionsCompleted}/{week.sessionsPlanned}
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase">
                      pass
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-amber-400">
                      {week.longestRun}
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase">
                      längsta km
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-white">
                      {Object.keys(week.categories).length}
                    </div>
                    <div className="text-[8px] text-slate-500 uppercase">
                      passtyper
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {week.activities.map((act) => (
                    <div
                      key={act.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        act.status === "COMPLETED"
                          ? "bg-emerald-500/10"
                          : "bg-white/5"
                      }`}
                    >
                      <span className="text-lg">
                        {CATEGORY_ICONS[act.category]}
                      </span>
                      <div className="flex-1">
                        <div className="text-xs font-bold text-white">
                          {act.title}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {act.date}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-white">
                          {act.estimatedDistance} km
                        </div>
                        {act.status === "COMPLETED" && (
                          <span className="text-[8px] text-emerald-400">✓</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Category Breakdown */}
      <div className="p-5 bg-slate-900/40 rounded-2xl border border-white/5">
        <h3 className="text-sm font-black uppercase tracking-tight mb-4">
          🏃 Passfördelning
        </h3>
        <div className="space-y-2">
          {Object.entries(stats.categoryBreakdown).sort((a, b) => b[1] - a[1])
            .map(([category, count]) => {
              const pct = (count / stats.totalPlanned) * 100;
              return (
                <div key={category} className="flex items-center gap-3">
                  <span className="text-lg w-8">
                    {CATEGORY_ICONS[category as PlannedActivity["category"]]}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] font-bold text-white uppercase">
                        {category.replace("_", " ")}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {count} pass ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Current Week Spotlight */}
      {stats.currentWeek && (
        <div className="p-5 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 rounded-2xl border border-indigo-500/20">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">📍</span>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">
                Denna Vecka (V{stats.currentWeek.weekNumber})
              </h3>
              <p className="text-[10px] text-slate-500">
                {stats.currentWeek.startDate} → {stats.currentWeek.endDate}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-xl font-black text-indigo-400">
                {Math.round(stats.currentWeek.totalVolumeKm)}
              </div>
              <div className="text-[8px] text-slate-500 uppercase">km mål</div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-xl font-black text-emerald-400">
                {stats.currentWeek.sessionsCompleted}
              </div>
              <div className="text-[8px] text-slate-500 uppercase">klara</div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-xl font-black text-amber-400">
                {stats.currentWeek.sessionsPlanned -
                  stats.currentWeek.sessionsCompleted}
              </div>
              <div className="text-[8px] text-slate-500 uppercase">kvar</div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-center">
              <div className="text-xl font-black text-rose-400">
                {stats.currentWeek.longestRun}
              </div>
              <div className="text-[8px] text-slate-500 uppercase">längsta</div>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Highlights */}
      <div className="p-5 bg-slate-900/40 rounded-2xl border border-white/5">
        <h3 className="text-sm font-black uppercase tracking-tight mb-4">
          🔮 Kommande Höjdpunkter
        </h3>
        <div className="space-y-3">
          {activities
            .filter((a) =>
              a.status !== "COMPLETED" &&
              (a.isLongestInPlan || a.isVolumePR || a.category === "LONG_RUN")
            )
            .slice(0, 5)
            .map((act) => (
              <div
                key={act.id}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5"
              >
                <span className="text-xl">{CATEGORY_ICONS[act.category]}</span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    {act.title}
                    {act.isLongestInPlan && (
                      <span className="text-[8px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full font-black">
                        👑 LÄNGST
                      </span>
                    )}
                    {act.isVolumePR && (
                      <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-black">
                        🔥 PR
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-500">{act.date}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-indigo-400">
                    {act.estimatedDistance} km
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
