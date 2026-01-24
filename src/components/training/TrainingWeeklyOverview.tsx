import React, { useMemo } from "react";
import { PlannedActivity } from "../../models/types.ts";
import { formatSecondsToTime } from "../../utils/timeParser.ts";

interface TrainingWeeklyOverviewProps {
  activities: PlannedActivity[];
}

export function TrainingWeeklyOverview(
  { activities }: TrainingWeeklyOverviewProps,
) {
  // Group activities by week (ISO week or just 7-day windows)
  const weeks = useMemo(() => {
    const sorted = [...activities].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const grouped: Record<string, PlannedActivity[]> = {};

    sorted.forEach((a) => {
      const date = new Date(a.date);
      // Get the Monday of that week
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      const weekKey = monday.toISOString().split("T")[0];

      if (!grouped[weekKey]) grouped[weekKey] = [];
      grouped[weekKey].push(a);
    });

    return Object.entries(grouped).map(([weekStart, weekActivities]) => {
      const totalDist = weekActivities.reduce(
        (sum, a) => sum + (a.actualDistance || a.estimatedDistance || 0),
        0,
      );
      const totalTime = weekActivities.reduce(
        (sum, a) => sum + (a.actualTimeSeconds || 0),
        0,
      );
      const qualitySessions = weekActivities.filter((a) =>
        ["INTERVALS", "TEMPO", "REPETITION"].includes(a.category)
      ).length;
      const status = weekActivities.every((a) =>
          a.status === "COMPLETED"
        )
        ? "Completed"
        : weekActivities.some((a) => a.status === "COMPLETED")
        ? "In Progress"
        : "Planned";

      return {
        weekStart,
        activities: weekActivities,
        totalDist,
        totalTime,
        qualitySessions,
        status,
      };
    });
  }, [activities]);

  if (activities.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest italic">
          Periodiserings-överblick
        </h4>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">
              Klar
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">
              Planerad
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {weeks.map((week, idx) => (
          <div
            key={week.weekStart}
            className="glass-card overflow-hidden group hover:border-indigo-500/30 transition-all relative"
          >
            {/* Background stylized index */}
            <div className="absolute top-0 right-0 text-7xl font-black text-white/[0.02] -mr-4 -mt-4 italic pointer-events-none">
              W{idx + 1}
            </div>

            <div className="flex flex-col md:flex-row md:items-center p-6 gap-8 relative z-10">
              {/* Week Info */}
              <div className="w-32">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter block mb-1">
                  Micro-Cycle
                </span>
                <span className="text-sm font-black text-white whitespace-nowrap">
                  {week.weekStart}
                </span>
                <div
                  className={`mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                    week.status === "Completed"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : week.status === "In Progress"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-slate-800/50 text-slate-500 border border-white/5"
                  }`}
                >
                  <div
                    className={`w-1 h-1 rounded-full ${
                      week.status === "Completed"
                        ? "bg-emerald-400"
                        : "bg-current"
                    }`}
                  />
                  {week.status}
                </div>
              </div>

              {/* Summary Stats with Progress Gauges */}
              <div className="flex-1 grid grid-cols-3 gap-6 border-l border-white/10 pl-8">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">
                    Volume (KM)
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white italic tracking-tighter">
                      {Math.round(week.totalDist)}
                    </span>
                    {week.totalDist > 0 && (
                      <span className="text-[10px] text-emerald-500 font-bold">
                        ▲
                      </span>
                    )}
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden w-16">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.min(100, (week.totalDist / 50) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">
                    Quality Sessions
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-indigo-400 italic tracking-tighter">
                      {week.qualitySessions}
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden w-16">
                    <div
                      className="h-full bg-indigo-500"
                      style={{
                        width: `${
                          Math.min(100, (week.qualitySessions / 3) * 100)
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">
                    Time Spent
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white italic tracking-tighter whitespace-nowrap">
                      {week.totalTime > 0
                        ? formatSecondsToTime(week.totalTime)
                        : "--:--"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Visual Timeline - The "Wild" Part */}
              <div className="flex-1 flex items-end gap-2 h-16 relative">
                {week.activities.map((a, i) => {
                  const intensityColor = a.category === "LONG_RUN"
                    ? "from-amber-500 to-orange-500"
                    : ["INTERVALS", "TEMPO"].includes(a.category)
                    ? "from-rose-600 to-pink-500"
                    : "from-indigo-600 to-blue-500";

                  return (
                    <div
                      key={a.id}
                      className={`flex-1 rounded-t-xl transition-all relative group/bar cursor-help overflow-hidden ${
                        a.status === "COMPLETED"
                          ? `bg-gradient-to-t ${intensityColor}`
                          : "bg-slate-800/50 border border-white/5"
                      }`}
                      style={{
                        height: `${
                          Math.max(
                            15,
                            Math.min(100, (a.estimatedDistance / 35) * 100),
                          )
                        }%`,
                      }}
                    >
                      {/* Hover Detail */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-xl text-[8px] font-black whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-all translate-y-2 group-hover/bar:translate-y-0 z-30 shadow-2xl">
                        <div className="text-indigo-400 mb-0.5">{a.date}</div>
                        <div className="text-white">
                          {a.category}: {a.estimatedDistance}km
                        </div>
                        {a.targetPace && (
                          <div className="text-slate-500">
                            Pace: {a.targetPace}
                          </div>
                        )}
                      </div>

                      {/* Gloss effect */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10" />

                      {/* Pulsing glow for hard sessions */}
                      {["INTERVALS", "TEMPO"].includes(a.category) && (
                        <div className="absolute inset-0 bg-white/20 animate-pulse mix-blend-overlay" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly Breakdown Expansion Label */}
            <div className="bg-white/[0.02] border-t border-white/5 px-5 py-2 flex justify-between items-center group-hover:bg-white/[0.04] transition-colors">
              <div className="flex gap-4">
                {week.activities.map((a) => (
                  <span
                    key={a.id}
                    className={`text-[8px] font-black ${
                      a.category === "LONG_RUN"
                        ? "text-amber-400"
                        : ["INTERVALS", "TEMPO"].includes(a.category)
                        ? "text-rose-400"
                        : "text-slate-500"
                    }`}
                  >
                    {a.category.charAt(0)}
                  </span>
                ))}
              </div>
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                Detailj-vy via Dashboard
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 mt-8">
        <div className="flex items-center gap-4">
          <div className="text-3xl">🎯</div>
          <div>
            <h5 className="font-black text-white uppercase italic tracking-tighter text-lg">
              Goal Trajectory
            </h5>
            <p className="text-xs text-slate-400 max-w-md">
              Din plan är optimerad med en progressiv överbelastning på 5% per
              vecka. Följ planen till 85% för att säkerställa att du når din
              mål-VDOT.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
