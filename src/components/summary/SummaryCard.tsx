import React from "react";
import { Link } from "react-router-dom";
import { SummaryStats } from "../../hooks/useTrainingSummary.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import {
  formatDuration,
  formatPace,
  formatSwedishDate,
} from "../../utils/dateUtils.ts";
import {
  Activity,
  Award,
  Calendar,
  Clock,
  Dumbbell,
  Flame,
  MapPin,
  Timer,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

interface SummaryCardProps {
  stats: SummaryStats;
  startDate: string;
  endDate: string;
  id?: string;
  showPrs?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = (
  { stats, startDate, endDate, id, showPrs = true },
) => {
  const { user } = useAuth();
  const runningStats = stats.types.find((t) => t.name === "running");
  const runningDist = runningStats?.dist || 0;
  const runningTime = runningStats?.time || 0;
  const strengthStats = stats.types.find((t) => t.name === "strength");
  const runningCount = runningStats?.count || 0;
  const strengthCount = strengthStats?.count || 0;

  // Calculate average pace (min/km)
  const avgPace = runningDist > 0 ? runningTime / runningDist : 0;

  const formattedStartDate = formatSwedishDate(startDate);
  const formattedEndDate = formatSwedishDate(endDate);

  return (
    <div
      id={id}
      className="relative bg-slate-950 text-white overflow-hidden flex flex-col p-8 border border-white/5 shadow-2xl w-[850px] min-h-[800px] font-sans rounded-3xl"
    >
      {/* Ambient Background Effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header Section */}
      <div className="relative z-10 flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-lg">
              <Activity className="w-6 h-6 text-slate-900" />
            </div>
            <h2 className="text-4xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
              SAMMANFATTNING
            </h2>
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-xs ml-1">
            <Calendar className="w-3 h-3" />
            <span>{formattedStartDate} — {formattedEndDate}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white tracking-tight">
            {user?.name || "User"}
          </p>
          <div className="flex flex-col items-end gap-1 mt-2">
            <div className="flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
              <Zap className="w-4 h-4 text-indigo-400" />
              <p className="text-lg font-black text-indigo-400">
                {stats.totalSessions}{" "}
                <span className="text-xs font-bold text-indigo-300 uppercase">
                  pass
                </span>
              </p>
            </div>
            <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-[0.15em] bg-emerald-500/10 px-2 py-0.5 rounded-full">
              GREENS
            </p>
          </div>
        </div>
      </div>

      {/* Top Stats Grid - Now 2 Columns */}
      <div className="relative z-10 grid grid-cols-2 gap-4 mb-8">
        {/* Active Days */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-lg group hover:border-emerald-500/20 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Aktiva Dagar
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-white">{stats.activeDays}</p>
            <span className="text-sm font-bold text-slate-500">
              / {stats.totalDays}
            </span>
          </div>
          {/* Visual Progress Bar */}
          <div className="w-full h-1 bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full"
              style={{
                width: `${
                  Math.min(100, (stats.activeDays / stats.totalDays) * 100)
                }%`,
              }}
            />
          </div>
        </div>

        {/* Total Time */}
        <div className="bg-slate-900/60 backdrop-blur-md p-4 rounded-2xl border border-white/5 shadow-lg group hover:border-emerald-500/20 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              Träningstid
            </p>
          </div>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-black text-white">
              {Math.floor(stats.totalTime / 60)}
            </p>
            <span className="text-sm font-bold text-emerald-500/80">h</span>
            <p className="text-xl font-black text-white ml-1">
              {Math.round(stats.totalTime % 60)}
            </p>
            <span className="text-xs font-bold text-emerald-500/60">min</span>
          </div>
          <p className="text-[10px] text-slate-500 font-bold mt-2">
            ~{stats.totalSessions > 0
              ? Math.round(stats.totalTime / stats.totalSessions)
              : 0} min/pass
          </p>
        </div>
      </div>

      {/* Split Layout: Running vs Strength */}
      <div className="relative z-10 grid grid-cols-2 gap-6 flex-1">
        {/* RUNNING CARD */}
        <div className="bg-gradient-to-b from-emerald-950/40 to-slate-950/40 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full" />

          {/* Header */}
          <div className="flex flex-col items-center gap-2 pb-4">
            <div className="flex items-center gap-3 w-full">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/10 to-emerald-500/30" />
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.25em] flex items-center gap-2 px-2 whitespace-nowrap">
                🏃 LÖPNING
              </div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-500/10 to-emerald-500/30" />
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
              {runningCount} pass loggade
            </p>
          </div>

          {/* Big Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">
                Distans
              </p>
              <p className="text-2xl font-black text-white tracking-tight">
                {Math.round(runningDist).toLocaleString()}{" "}
                <span className="text-sm text-emerald-500/60 font-bold">
                  km
                </span>
              </p>
              <p className="text-[9px] text-slate-500 font-bold mt-1">
                ~{runningCount > 0
                  ? (runningDist / runningCount).toFixed(1)
                  : 0} km/pass
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">
                Tid
              </p>
              <p className="text-2xl font-black text-white tracking-tight">
                {Math.floor(runningTime / 60)}
                <span className="text-sm text-emerald-500/60 font-bold">h</span>
                {" "}
                {Math.round(runningTime % 60)}
                <span className="text-xs text-emerald-500/40 font-bold">m</span>
              </p>
              <p className="text-[9px] text-slate-500 font-bold mt-1">
                ~{runningCount > 0 ? Math.round(runningTime / runningCount) : 0}
                {" "}
                min/pass
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">
                Snitt-tempo
              </p>
              <p className="text-2xl font-black text-white tracking-tight">
                {avgPace > 0 ? formatPace(avgPace * 60) : "-"}
              </p>
              <p className="text-[9px] text-slate-500 font-bold mt-1">per km</p>
            </div>
          </div>

          {/* Highlights */}
          <div className="mt-auto space-y-3">
            {stats.fastestRuns[0] && (
              <Link
                to={`/activity/${stats.fastestRuns[0].id}`}
                className="block w-full"
              >
                <div className="bg-slate-900/50 hover:bg-emerald-900/20 border border-white/5 hover:border-emerald-500/30 p-3 rounded-xl transition-all group/item cursor-pointer flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                        Snabbast
                      </p>
                      <p className="text-lg font-black text-white">
                        {formatPace(
                          (stats.fastestRuns[0].performance?.durationMinutes ||
                            0) *
                            60 /
                            (stats.fastestRuns[0].performance?.distanceKm || 1),
                        ).replace("/km", "")}{" "}
                        <span className="text-xs font-bold text-slate-500">
                          min/km
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold">
                      {stats.fastestRuns[0].performance?.distanceKm?.toFixed(1)}
                      {" "}
                      km
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {stats.longestRuns[0] && (
              <Link
                to={`/activity/${stats.longestRuns[0].id}`}
                className="block w-full"
              >
                <div className="bg-slate-900/50 hover:bg-emerald-900/20 border border-white/5 hover:border-emerald-500/30 p-3 rounded-xl transition-all group/item cursor-pointer flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                        Längst
                      </p>
                      <p className="text-lg font-black text-white">
                        {stats.longestRuns[0].performance?.distanceKm?.toFixed(
                          1,
                        )}{" "}
                        <span className="text-base text-slate-500 font-bold">
                          km
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold">
                      {formatDuration(
                        (stats.longestRuns[0].performance?.durationMinutes ||
                          0) * 60,
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* STRENGTH CARD */}
        <div className="bg-gradient-to-b from-purple-950/40 to-slate-950/40 backdrop-blur-md border border-purple-500/20 rounded-3xl p-6 flex flex-col gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full" />

          {/* Header */}
          <div className="flex flex-col items-center gap-2 pb-4">
            <div className="flex items-center gap-3 w-full">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-500/10 to-purple-500/30" />
              <div className="text-[10px] font-black text-purple-400 uppercase tracking-[0.25em] flex items-center gap-2 px-2 whitespace-nowrap">
                💪 STYRKA
              </div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-purple-500/10 to-purple-500/30" />
            </div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
              {strengthCount} pass loggade
            </p>
          </div>

          {/* Big Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">
                Volym
              </p>
              <p className="text-3xl font-black text-white tracking-tight">
                {(stats.totalTonnage / 1000).toFixed(1)}{" "}
                <span className="text-base text-purple-500/60 font-bold">
                  ton
                </span>
              </p>
              <p className="text-[9px] text-slate-500 font-bold mt-1">
                ~{strengthCount > 0
                  ? Math.round(stats.totalTonnage / strengthCount)
                  : 0} kg/pass
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">
                Tid
              </p>
              <p className="text-3xl font-black text-white tracking-tight">
                {strengthStats?.time ? Math.floor(strengthStats.time / 60) : 0}
                <span className="text-base text-purple-500/60 font-bold">
                  h
                </span>{" "}
                {strengthStats?.time ? Math.round(strengthStats.time % 60) : 0}
                <span className="text-sm text-purple-500/40 font-bold">m</span>
              </p>
              <p className="text-[9px] text-slate-500 font-bold mt-1">
                ~{strengthCount > 0 && strengthStats?.time
                  ? Math.round(strengthStats.time / strengthCount)
                  : 0} min/pass
              </p>
            </div>
          </div>

          {/* Highlights */}
          <div className="mt-auto space-y-3">
            {stats.mostTrainedExercise && (
              <div className="bg-slate-900/50 border border-white/5 p-3 rounded-xl flex items-center justify-between w-full">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Award className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="truncate">
                    <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">
                      Mest
                    </p>
                    <p
                      className="text-sm font-bold text-white truncate leading-tight"
                      title={stats.mostTrainedExercise}
                    >
                      {stats.mostTrainedExercise}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-[10px] text-purple-300 font-bold">
                    {stats.mostTrainedExerciseStats?.sets || 0} set
                  </p>
                  <p className="text-[9px] text-slate-500 font-bold">
                    {stats.mostTrainedExerciseStats?.reps || 0} reps
                  </p>
                </div>
              </div>
            )}

            {stats.topLifts[0] && (
              <Link
                to={`/activity/${stats.topLifts[0].id}`}
                className="block w-full"
              >
                <div className="bg-slate-900/50 hover:bg-purple-900/20 border border-white/5 hover:border-purple-500/30 p-3 rounded-xl transition-all group/item cursor-pointer flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Trophy className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="truncate">
                      <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">
                        Tyngst
                      </p>
                      <p
                        className="text-sm font-bold text-white truncate leading-tight"
                        title={stats.topLifts[0].exercise}
                      >
                        {stats.topLifts[0].exercise}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-lg font-black text-white">
                      {stats.topLifts[0].weight}{" "}
                      <span className="text-xs text-slate-500">kg</span>
                    </p>
                    <p className="text-[9px] text-purple-400 font-bold">
                      {stats.topLifts[0].sets} set
                      {stats.topLifts[0].distance
                        ? ` • ${stats.topLifts[0].distance}m`
                        : stats.topLifts[0].reps > 0
                        ? ` • ${stats.topLifts[0].reps} reps`
                        : ""}
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Optional PR Section */}
      {showPrs && (
        <div className="relative z-10 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <p className="text-amber-400 text-sm font-black uppercase tracking-wide">
                Prestationer & Lopp
              </p>
            </div>
            {stats.raceCount > 0 && (
              <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                {stats.raceCount} Lopp
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-900/40 p-2 rounded-lg border border-amber-500/10">
              <p className="text-2xl font-black text-white">
                {stats.runningPRs + stats.strengthPRs}
              </p>
              <p className="text-[8px] font-bold text-slate-500 uppercase">
                Totalt
              </p>
            </div>
            <div className="bg-slate-900/40 p-2 rounded-lg border border-amber-500/10 col-span-3 flex flex-col justify-center">
              <div className="flex justify-around">
                <div>
                  <span className="block font-black text-emerald-400">
                    {stats.runningPRs}
                  </span>
                  <span className="text-[8px] text-slate-500">Löpning</span>
                </div>
                <div className="w-[1px] bg-white/10"></div>
                <div>
                  <span className="block font-black text-purple-400">
                    {stats.strengthPRs}
                  </span>
                  <span className="text-[8px] text-slate-500">Styrka</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-900/40 p-2 rounded-lg border border-amber-500/10">
              <p className="text-2xl font-black text-cyan-400">
                {stats.activeDays}
              </p>
              <p className="text-[8px] font-bold text-slate-500 uppercase">
                Dagar
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="relative z-10 pt-4 mt-4 border-t border-white/10 flex justify-between items-center">
        <div className="flex gap-2 text-[10px] text-slate-500">
          <span>Generated by Greens</span>
          <span>•</span>
          <span>{new Date().toLocaleDateString("sv-SE")}</span>
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
        </div>
      </div>
    </div>
  );
};
