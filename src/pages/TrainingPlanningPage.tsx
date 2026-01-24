import React, { useMemo, useState } from "react";
import { useData } from "../context/DataContext.tsx";
import { analyzeInterference } from "../utils/interferenceEngine.ts";
import {
  getTrainingSuggestions,
  TrainingSuggestion,
} from "../utils/trainingSuggestions.ts";
import {
  generateId,
  getISODate,
  getWeekStartDate,
  PlannedActivity,
  Weekday,
  WEEKDAYS,
} from "../models/types.ts";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Dumbbell,
  MinusCircle,
  Plus,
  RefreshCcw,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatDuration } from "../utils/dateUtils.ts";
import { TrainingPeriodBanner } from "../components/planning/TrainingPeriodBanner.tsx";
import { notificationService } from "../services/notificationService.ts";
import { ActivityModal } from "../components/planning/ActivityModal.tsx";
import { WeeklyStatsAnalysis } from "../components/planning/WeeklyStatsAnalysis.tsx";

const SHORT_WEEKDAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export function TrainingPlanningPage() {
  const navigate = useNavigate();
  const {
    strengthSessions,
    performanceGoals,
    plannedActivities,
    savePlannedActivities,
    deletePlannedActivity,
    updatePlannedActivity,
    universalActivities = [],
    unifiedActivities = [],
    currentUser,
  } = useData();

  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<
    PlannedActivity | null
  >(null);
  const [draggedOverDate, setDraggedOverDate] = useState<string | null>(null);

  // Keyboard Navigation & ESC handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Modal closing
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
        setEditingActivity(null);
        return;
      }

      // Week Navigation with Ctrl + Arrow
      if (e.ctrlKey && !isModalOpen) {
        if (e.key === "ArrowLeft") {
          handleWeekChange(-1);
        } else if (e.key === "ArrowRight") {
          handleWeekChange(1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, currentWeekStart]);

  // Navigation
  const handleWeekChange = (offset: number) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + (offset * 7));
    setCurrentWeekStart(getISODate(d));
  };

  // Get dates for current week
  const weekDates = useMemo(() => {
    const dates: { date: string; weekday: Weekday; label: string }[] = [];
    const start = new Date(currentWeekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = getISODate(d);
      dates.push({
        date: iso,
        weekday: WEEKDAYS[i],
        label: SHORT_WEEKDAYS[i],
      });
    }
    return dates;
  }, [currentWeekStart]);

  // Helper for calculating weekly stats
  const calculateWeeklyStats = (start: string) => {
    const weekStart = new Date(start);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startStr = getISODate(weekStart);
    const endStr = getISODate(weekEnd);

    // All completed sessions from unifiedActivities
    const weekCompleted = unifiedActivities.filter((a: any) =>
      a.date >= startStr && a.date <= endStr
    );

    // Running stats (Running + any other cardio that isn't strength)
    const runningActivities = weekCompleted.filter((a: any) =>
      a.type === "running" ||
      ["cycling", "walking", "swimming"].includes(a.type)
    );
    const runningSessions = runningActivities.length;
    const runningKm = runningActivities.reduce(
      (sum: number, a: any) => sum + (a.distance || 0),
      0,
    );
    const runningTime = runningActivities.reduce(
      (sum: number, a: any) => sum + (a.durationMinutes || 0),
      0,
    );

    // Strength stats
    const strengthActivities = weekCompleted.filter((a: any) =>
      a.type === "strength"
    );
    const strengthSessionCount = strengthActivities.length;
    const strengthTime = strengthActivities.reduce(
      (sum: number, a: any) => sum + (a.durationMinutes || 0),
      0,
    );
    const strengthTonnage = strengthActivities.reduce(
      (sum: number, a: any) => sum + (a.tonnage || 0),
      0,
    );

    // Forecast from planned activities
    const plannedThisWeek = plannedActivities.filter((p: any) =>
      p.date >= startStr && p.date <= endStr && p.status === "PLANNED"
    );
    const plannedRunning = plannedThisWeek.filter((p: any) =>
      p.title?.toLowerCase().includes("löpning") ||
      p.category === "EASY" || p.category === "INTERVALS" ||
      p.category === "TEMPO" ||
      p.category === "LONG_RUN" || p.category === "RECOVERY"
    );
    const plannedStrength = plannedThisWeek.filter((p: any) =>
      p.title?.toLowerCase().includes("styrka") || p.category === "STRENGTH"
    );

    const forecastRunningSessions = runningSessions + plannedRunning.length;
    const forecastRunningKm = runningKm +
      plannedRunning.reduce(
        (sum: number, p: any) => sum + (p.estimatedDistance || 0),
        0,
      );
    const forecastStrengthSessions = strengthSessionCount +
      plannedStrength.length;

    return {
      running: {
        sessions: runningSessions,
        km: runningKm,
        time: runningTime,
      },
      strength: {
        sessions: strengthSessionCount,
        time: strengthTime,
        tonnage: strengthTonnage,
      },
      forecast: {
        runningSessions: forecastRunningSessions,
        runningKm: forecastRunningKm,
        strengthSessions: forecastStrengthSessions,
      },
    };
  };

  const weeklyStats = useMemo(() => calculateWeeklyStats(currentWeekStart), [
    currentWeekStart,
    unifiedActivities,
    plannedActivities,
  ]);

  const lastWeeklyStats = useMemo(() => {
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    return calculateWeeklyStats(getISODate(lastWeekStart));
  }, [currentWeekStart, unifiedActivities, plannedActivities]);

  // Interference Analysis
  const weeklyWarnings = useMemo(() => {
    const startStr = getISODate(new Date(currentWeekStart));
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);
    const endStr = getISODate(end);

    // Filter and map to compatible format
    const relevantHistory = unifiedActivities
      .filter((a: any) => a.date >= startStr && a.date <= endStr)
      .map((a: any) => ({ ...a, _source: "HISTORY", _id: a.id }));

    const relevantPlan = plannedActivities
      .filter((a) =>
        a.date >= startStr && a.date <= endStr && a.status === "PLANNED"
      )
      .map((a) => ({ ...a, _source: "PLAN", _id: a.id }));

    const all = [...relevantHistory, ...relevantPlan];

    // DEBUG: Log warning computation
    console.log(
      "[Interference] Analyzing",
      all.length,
      "activities:",
      all.map((a) => ({
        date: a.date,
        type: a.type,
        title: a.title,
        category: a.category,
        hyroxFocus: a.hyroxFocus,
        source: a._source,
      })),
    );

    const warnings = analyzeInterference(all);
    console.log("[Interference] Generated warnings:", warnings);

    return warnings;
  }, [currentWeekStart, unifiedActivities, plannedActivities]);

  // Unified Goal Progress Logic
  const goalProgress = useMemo(() => {
    return performanceGoals
      .filter((g) => g.status === "active")
      .map((goal) => {
        let current = 0;
        let planned = 0;
        let target = 0;
        let unitLabel = "";

        // Extract Target
        // Priority: KM > Sessions > Tonnage
        const kmTarget = goal.targets?.find((t) => t.unit === "km")?.value;
        const sessionTarget = goal.targets?.find((t) =>
          ["sessions", "pass", "x/v"].some((u) =>
            t.unit?.toLowerCase().includes(u)
          )
        )?.value ||
          goal.targets?.find((t) =>
            ["sessions", "pass", "x/v"].some((u) =>
              t.unit?.toLowerCase().includes(u)
            )
          )?.count;
        const tonTarget = goal.targets?.find((t) =>
          t.unit === "ton"
        )?.value;

        if (kmTarget) {
          target = kmTarget;
          current = weeklyStats.running.km;
          planned = Math.max(0, weeklyStats.forecast.runningKm - current);
          unitLabel = "km";
        } else if (tonTarget) {
          target = tonTarget;
          current = weeklyStats.strength.tonnage / 1000; // Assuming tons
          planned = 0; // No forecast for tonnage yet
          unitLabel = "ton";
        } else if (sessionTarget) {
          target = sessionTarget;
          const isStrength = goal.name.toLowerCase().includes("styrka") ||
            goal.name.toLowerCase().includes("strength");
          const isRunning = goal.name.toLowerCase().includes("löpning") ||
            goal.name.toLowerCase().includes("run");

          if (isStrength) {
            current = weeklyStats.strength.sessions;
            planned = Math.max(
              0,
              weeklyStats.forecast.strengthSessions - current,
            );
          } else if (isRunning) {
            current = weeklyStats.running.sessions;
            planned = Math.max(
              0,
              weeklyStats.forecast.runningSessions - current,
            );
          } else {
            // Total
            current = weeklyStats.running.sessions +
              weeklyStats.strength.sessions;
            // For forecast total, we sum them
            const forecastTotal = weeklyStats.forecast.runningSessions +
              weeklyStats.forecast.strengthSessions;
            planned = Math.max(0, forecastTotal - current);
          }
          unitLabel = "pass";
        }

        // Color coding
        const isStrength = goal.name.toLowerCase().includes("styrka");
        const isRunning = goal.name.toLowerCase().includes("löpning") ||
          kmTarget;
        const colorClass = isStrength
          ? "bg-purple-500"
          : (isRunning ? "bg-emerald-500" : "bg-indigo-500");
        const plannedClass = isStrength
          ? "bg-purple-500/30"
          : (isRunning ? "bg-emerald-500/30" : "bg-indigo-500/30");

        return {
          id: goal.id,
          name: goal.name,
          target,
          current,
          planned,
          unit: unitLabel,
          isMet: current >= target,
          isProjectedMet: (current + planned) >= target,
          colorClass,
          plannedClass,
        };
      })
      // Filter out goals with 0 target to avoid division by zero or weird UI
      .filter((g) => g.target > 0);
  }, [performanceGoals, weeklyStats]);

  // Handlers
  const handleOpenModal = (date: string, activity?: PlannedActivity) => {
    setSelectedDate(date);
    setEditingActivity(activity || null);
    setIsModalOpen(true);
  };

  const handleSaveActivity = (activity: PlannedActivity) => {
    if (editingActivity) {
      updatePlannedActivity(editingActivity.id, activity);
      notificationService.notify(
        "success",
        "Aktiviteten uppdateraf och sparad till databasen!",
      );
    } else {
      savePlannedActivities([activity]);
      notificationService.notify(
        "success",
        "Ny aktivitet sparad till databasen!",
      );
    }
    setIsModalOpen(false);
    setEditingActivity(null);
  };

  // UI Helper: Format duration as hh:mm
  const formatDurationHHMM = (minutes: number) => {
    if (!minutes) return "00:00";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  // Helper: Update URL params
  const updateUrlParams = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams(window.location.search);
    Object.entries(params).forEach(([key, value]) => {
      searchParams.set(key, value);
    });
    const newUrl = window.location.pathname + "?" + searchParams.toString() +
      window.location.hash;
    window.history.replaceState({}, "", newUrl);
    // Force re-render/logic run via popstate or just rely on Layout.tsx listening to URL
    // To be safe, we can navigate(current + search) but we want to avoid refresh.
    // Since we are using react-router in Layout.tsx, using navigate() with search params is best.
    navigate("?" + searchParams.toString(), { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-900 dark:text-white">
      <div className="max-w-6xl mx-auto mb-6">
        <TrainingPeriodBanner />
      </div>

      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ChevronLeft />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">
              Planera Träning
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Vecka {getWeekNumber(currentWeekStart)}
            </p>
          </div>
        </div>

        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => handleWeekChange(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 text-sm font-bold flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            {currentWeekStart}
          </div>
          <button
            onClick={() => handleWeekChange(1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Weekly Summary & Goals Widget */}
      <div className="max-w-6xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 0. Föregående Vecka (Historical) */}
        <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm opacity-80">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-slate-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Föregående Vecka
            </span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex flex-col flex-1">
              <div className="text-[10px] font-black uppercase text-slate-400 mb-0.5">
                🏃 Löpning
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                  {lastWeeklyStats.running.km.toFixed(1)}
                  <span className="text-sm font-bold text-slate-400 ml-1">
                    km
                  </span>
                </span>
              </div>
              <div className="text-xs font-medium text-slate-500">
                {lastWeeklyStats.running.sessions} pass •{" "}
                {formatDuration(lastWeeklyStats.running.time * 60)}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-slate-200 dark:bg-slate-700 self-stretch">
            </div>

            <div className="flex flex-col flex-1">
              <div className="text-[10px] font-black uppercase text-slate-400 mb-0.5">
                💪 Styrka
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-700 dark:text-slate-300">
                  {lastWeeklyStats.strength.sessions}
                  <span className="text-sm font-bold text-slate-400 ml-1">
                    pass
                  </span>
                </span>
              </div>
              <div className="text-xs font-medium text-slate-500">
                {(lastWeeklyStats.strength.tonnage / 1000).toFixed(1)} ton •
                {" "}
                {formatDuration(lastWeeklyStats.strength.time * 60)}
              </div>
            </div>
          </div>
        </div>

        {/* 1. Denna Vecka (Actuals vs Planned) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Denna Vecka
            </span>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex flex-col flex-1">
              <div className="text-[10px] font-black uppercase text-slate-400 mb-0.5">
                🏃 Löpning
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {weeklyStats.running.km.toFixed(1)}
                  <span className="text-xs font-bold text-slate-400 ml-1">
                    / {weeklyStats.forecast.runningKm.toFixed(1)} km
                  </span>
                </span>
              </div>
              <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <span>
                  {weeklyStats.running.sessions}{" "}
                  ({weeklyStats.forecast.runningSessions}) pass
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-slate-100 dark:bg-slate-800 self-stretch">
            </div>

            <div className="flex flex-col flex-1">
              <div className="text-[10px] font-black uppercase text-slate-400 mb-0.5">
                💪 Styrka
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {weeklyStats.strength.sessions}
                  <span className="text-xs font-bold text-slate-400 ml-1">
                    / {weeklyStats.forecast.strengthSessions} pass
                  </span>
                </span>
              </div>
              <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
                <span>
                  {(weeklyStats.strength.tonnage / 1000).toFixed(1)} ton
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Veckomål & Prognos (Compact Combined) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-indigo-500" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Mål & Prognos
              </span>
            </div>
            {/* Forecast Mini-Summary */}
            <div className="flex gap-2 text-[10px] uppercase font-black text-slate-400">
              <span className="flex items-center gap-1">
                <Zap size={10} className="text-amber-500 fill-amber-500" />{" "}
                {weeklyStats.forecast.runningKm.toFixed(1)} km
              </span>
            </div>
          </div>

          {goalProgress.length === 0
            ? (
              <p className="text-xs text-slate-400 italic">
                Inga aktiva veckomål.
              </p>
            )
            : (
              <div className="space-y-3">
                {goalProgress.map((goal) => {
                  const currentPct = Math.min(
                    100,
                    (goal.current / goal.target) * 100,
                  );
                  const plannedPct = Math.min(
                    100 - currentPct,
                    (goal.planned / goal.target) * 100,
                  );

                  const isActuallyMet = goal.current >= goal.target;
                  const isProjectedMet =
                    (goal.current + goal.planned) >= goal.target;

                  // Over-performance calculation
                  const overPerformance = Math.max(
                    0,
                    goal.current - goal.target,
                  );
                  const isOverPerforming = overPerformance > 0;

                  return (
                    <div key={goal.id}>
                      <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                        <span className="text-slate-500 dark:text-slate-400 truncate pr-2 flex items-center gap-1.5">
                          {goal.name}
                          {isActuallyMet
                            ? (
                              <Check
                                size={12}
                                className="text-emerald-500 stroke-[3]"
                              />
                            )
                            : isProjectedMet
                            ? (
                              <Check
                                size={12}
                                className="text-emerald-500/50 stroke-[3]"
                              />
                            )
                            : null}
                        </span>
                        <span
                          className={isActuallyMet
                            ? "text-emerald-500"
                            : isProjectedMet
                            ? "text-slate-700 dark:text-slate-300"
                            : "text-slate-500"}
                        >
                          {/* Logic for Over-Performance Display */}
                          {isOverPerforming
                            ? (
                              <span className="flex items-center gap-1">
                                <span>{goal.target} {goal.unit}</span>
                                <span className="text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 px-1 rounded text-[9px]">
                                  +{(goal.current - goal.target).toFixed(1)}
                                </span>
                              </span>
                            )
                            : (
                              <>
                                {typeof goal.current === "number" &&
                                    !Number.isInteger(goal.current)
                                  ? goal.current.toFixed(1)
                                  : goal.current}
                                <span className="text-slate-300 mx-1">/</span>
                                {goal.target} {goal.unit}
                              </>
                            )}

                          {goal.planned > 0 && !isActuallyMet && (
                            <span className="text-slate-400 ml-1 italic font-medium">
                              (+{typeof goal.planned === "number" &&
                                  !Number.isInteger(goal.planned)
                                ? goal.planned.toFixed(1)
                                : goal.planned})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative">
                        {/* Completed Segment (Solid) */}
                        <div
                          className={`h-full transition-all ${
                            isActuallyMet ? "bg-emerald-500" : goal.colorClass
                          }`}
                          style={{ width: `${currentPct}%` }}
                        />
                        {/* Planned Segment (Striped/Dashed) */}
                        {plannedPct > 0 && (
                          <div
                            className={`h-full transition-all ${goal.plannedClass}`}
                            style={{
                              width: `${plannedPct}%`,
                              backgroundImage:
                                "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)",
                            }}
                          />
                        )}

                        {/* Over-performance Indicator (Bonus Bar) */}
                        {isOverPerforming && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                            title="Målet överträffat!"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDates.map((day) => {
          // 1. Get all planned activities for this day
          const dayPlanned = plannedActivities.filter((a) =>
            a.date.split("T")[0] === day.date
          );

          // 2. Get all actual activities for this day
          const dayActualRaw = unifiedActivities.filter((a) =>
            a.date.split("T")[0] === day.date
          );

          // 3. Deduplicate: Find which actual IDs are already represented by a matched plan
          const matchedActualIds = new Set(
            dayPlanned
              .filter((p) => p.status === "COMPLETED" && p.externalId)
              .map((p) => p.externalId!),
          );

          // 4. Create unified list of events
          const allEvents = [
            ...dayPlanned.map((p) => ({
              type: "planned" as const,
              id: p.id,
              time: p.startTime ||
                (p.status === "COMPLETED" && p.completedDate?.includes("T")
                  ? p.completedDate.split("T")[1].substring(0, 5)
                  : undefined),
              data: p,
            })),
            ...dayActualRaw
              .filter((a) => !matchedActualIds.has(a.id))
              .map((a) => ({
                type: "actual" as const,
                id: a.id,
                time: a.date.includes("T")
                  ? a.date.split("T")[1].substring(0, 5)
                  : undefined,
                data: a,
              })),
          ].sort((a, b) => {
            const timeA = a.time || "23:59";
            const timeB = b.time || "23:59";
            return timeA.localeCompare(timeB);
          });

          // Summary calculations (can still use raw lists for stats)
          const dayKm = dayActualRaw.reduce(
            (sum, a) => sum + (a.distance || 0),
            0,
          );
          const dayTime = dayActualRaw.reduce(
            (sum, a) => sum + (a.durationMinutes || 0),
            0,
          );

          const isToday = day.date === getISODate();
          const isPast = day.date < getISODate();
          const warning = weeklyWarnings.find((w) =>
            w.date.split("T")[0] === day.date
          );

          return (
            <div
              key={day.date}
              className={`flex flex-col h-[400px] bg-white dark:bg-slate-900 rounded-2xl border ${
                warning
                  ? "border-amber-400 ring-1 ring-amber-400/50"
                  : (isToday
                    ? "border-emerald-500 ring-1 ring-emerald-500/50"
                    : (isPast
                      ? "border-slate-100 dark:border-slate-800/50 opacity-90"
                      : "border-slate-200 dark:border-slate-800"))
              } relative group shadow-sm transition-all`}
            >
              {/* Background Date */}
              <div className="absolute bottom-4 right-4 text-7xl font-black text-slate-100 dark:text-slate-800/20 select-none z-0 pointer-events-none">
                {day.date.split("-")[2]}
              </div>

              {/* Header */}
              <div
                className={`p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1 ${
                  warning
                    ? "bg-amber-500/10 dark:bg-amber-900/20"
                    : (isToday
                      ? "bg-emerald-500/10 dark:bg-emerald-500/5"
                      : (isPast
                        ? "bg-slate-50/20 dark:bg-slate-900/50"
                        : "bg-slate-50/50 dark:bg-slate-800/50"))
                } rounded-t-2xl z-10 relative`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {day.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {warning && (
                      <Link
                        to="/tools/interference"
                        className="pointer-events-auto"
                        title={`${warning.message}: ${warning.suggestion}`}
                      >
                        <AlertTriangle
                          size={14}
                          className="text-amber-500 animate-pulse hover:scale-110 transition-transform"
                        />
                      </Link>
                    )}
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? "text-emerald-500"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {day.date.split("-")[2]}
                    </span>
                  </div>
                </div>
                <div className="text-[9px] font-black text-slate-400 flex items-center gap-1.5">
                  {dayKm > 0 && <span>🏃 {dayKm.toFixed(1)} km</span>}
                  {dayTime > 0 && <span>⏱️ {formatDurationHHMM(dayTime)}</span>}
                </div>
              </div>

              {/* Activities */}
              <div
                className={`flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar transition-colors ${
                  draggedOverDate === day.date
                    ? "bg-blue-500/5 ring-2 ring-blue-500/20 rounded-b-2xl"
                    : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDraggedOverDate(day.date);
                }}
                onDragLeave={() => setDraggedOverDate(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggedOverDate(null);
                  const activityId = e.dataTransfer.getData("activityId");
                  if (activityId) {
                    updatePlannedActivity(activityId, { date: day.date });
                    notificationService.notify(
                      "success",
                      `Passet flyttat till ${day.date}`,
                    );
                  }
                }}
              >
                {allEvents.map((event) => {
                  if (event.type === "planned") {
                    const act = event.data;
                    const isRace = act.isRace ||
                      act.title?.toLowerCase().includes("tävling");
                    const isCompleted = act.status === "COMPLETED";
                    const isPlanned = act.status === "PLANNED";
                    const isSkipped = act.status === "SKIPPED";
                    const isChanged = act.status === "CHANGED";

                    return (
                      <div
                        key={act.id}
                        draggable={!isCompleted}
                        onDragStart={(e) => {
                          if (isCompleted) return;
                          e.dataTransfer.setData("activityId", act.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => handleOpenModal(day.date, act)}
                        className={`p-3 border rounded-xl group/card relative hover:shadow-md transition-all cursor-pointer z-10
                                                    ${
                          isPlanned ? "border-dashed" : "border-solid"
                        }
                                                    ${
                          isCompleted
                            ? "border-slate-300 dark:border-slate-700"
                            : ""
                        }
                                                    ${
                          isSkipped
                            ? "opacity-40 grayscale border-slate-200 dark:border-slate-800"
                            : ""
                        }
                                                    ${
                          isChanged
                            ? "border-amber-400 dark:border-amber-600 shadow-[0_0_10px_rgba(251,191,36,0.1)]"
                            : ""
                        }
                                                    ${
                          isRace
                            ? "bg-amber-500/10 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50 hover:border-amber-500 dark:hover:border-amber-500"
                            : act.type === "REST" || act.category === "REST"
                            ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                            : act.type === "STRENGTH" ||
                                act.category === "STRENGTH"
                            ? "bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700"
                            : act.type === "HYROX" ||
                                act.title?.toLowerCase().includes("hyrox")
                            ? "bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700"
                            : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                              isRace
                                ? "text-amber-600 dark:text-amber-400"
                                : act.type === "REST" || act.category === "REST"
                                ? "text-slate-500"
                                : act.type === "STRENGTH" ||
                                    act.category === "STRENGTH"
                                ? "text-purple-600 dark:text-purple-400"
                                : act.type === "HYROX" ||
                                    act.title?.toLowerCase().includes("hyrox")
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {isCompleted
                              ? <Check size={10} className="text-emerald-500" />
                              : isRace
                              ? <Trophy size={10} />
                              : isSkipped
                              ? <MinusCircle size={10} />
                              : isChanged
                              ? <RefreshCcw size={10} />
                              : null}
                            {isCompleted
                              ? "GENOMFÖRT"
                              : isRace
                              ? "TÄVLING"
                              : isSkipped
                              ? "ÖVERHOPPAT"
                              : isChanged
                              ? "BYTT PASS"
                              : act.type === "REST" || act.category === "REST"
                              ? "💤 Vila"
                              : (act.type === "STRENGTH" ||
                                  act.category === "STRENGTH"
                                ? "💪"
                                : "📅") + " " + act.title}
                          </span>
                          <div className="flex items-center gap-2">
                            {!isCompleted && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const d = new Date(day.date + "T00:00:00");
                                    d.setDate(d.getDate() - 1);
                                    const prevDateStr = `${d.getFullYear()}-${
                                      String(d.getMonth() + 1).padStart(2, "0")
                                    }-${String(d.getDate()).padStart(2, "0")}`;
                                    updatePlannedActivity(act.id, {
                                      date: prevDateStr,
                                    });
                                    notificationService.notify(
                                      "success",
                                      `Passet flyttat till igår (${prevDateStr})`,
                                    );
                                  }}
                                  className="text-slate-400 hover:text-blue-500 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                  title="Flytta till igår"
                                >
                                  <ChevronLeft size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const d = new Date(day.date + "T00:00:00");
                                    d.setDate(d.getDate() + 1);
                                    const nextDateStr = `${d.getFullYear()}-${
                                      String(d.getMonth() + 1).padStart(2, "0")
                                    }-${String(d.getDate()).padStart(2, "0")}`;
                                    updatePlannedActivity(act.id, {
                                      date: nextDateStr,
                                    });
                                    notificationService.notify(
                                      "success",
                                      `Passet flyttat till imorgon (${nextDateStr})`,
                                    );
                                  }}
                                  className="text-slate-400 hover:text-blue-500 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                  title="Flytta till imorgon"
                                >
                                  <ChevronRight size={12} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePlannedActivity(act.id);
                              }}
                              className="text-slate-400 hover:text-rose-500 opacity-0 group-hover/card:opacity-100 transition-opacity"
                              title="Ta bort"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                        <p
                          className={`text-xs font-medium leading-tight ${
                            isSkipped ? "line-through" : ""
                          } ${
                            isCompleted
                              ? "text-slate-700 dark:text-slate-200"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {isRace && act.title && (
                            <span className="font-bold block mb-0.5">
                              {act.title}
                            </span>
                          )}
                          {act.description || (isCompleted
                            ? (act.reconciliation?.matchReason?.includes(
                                "Liknande",
                              )
                              ? "Loggat pass"
                              : "Pass genomfört")
                            : isSkipped
                            ? "Passet blev aldrig av"
                            : "")}
                        </p>

                        {/* Developer Insights */}
                        {(currentUser?.role === "developer" ||
                          currentUser?.role === "admin") &&
                          act.reconciliation && (
                          <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 text-[9px] font-mono text-slate-400">
                            <div className="flex justify-between items-center mb-0.5">
                              <span
                                className={act.reconciliation.score! >= 60
                                  ? "text-emerald-500"
                                  : "text-amber-500"}
                              >
                                Match: {act.reconciliation.score}%
                              </span>
                              {act.reconciliation.reconciledAt && (
                                <span>
                                  {act.reconciliation.reconciledAt?.split(
                                    "T",
                                  )[1].substring(0, 5)}
                                </span>
                              )}
                            </div>
                            <p className="italic leading-[1.1] text-[8px] opacity-70">
                              {act.reconciliation.matchReason}
                            </p>
                            {act.externalId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateUrlParams({
                                    activityId: act.externalId!,
                                  });
                                }}
                                className="mt-1 flex items-center gap-1 text-blue-500 hover:underline"
                              >
                                <Activity size={8} /> Visa källa:{" "}
                                {act.externalId.substring(0, 8)}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Time Indicator - only if explicit time exists  */}
                        {event.time && (
                          <div
                            className={`flex items-center gap-1 text-[9px] font-bold mt-1 opacity-60`}
                          >
                            <Clock size={9} />
                            {event.time}
                          </div>
                        )}
                        <div className="flex flex-col gap-1 mt-1">
                          {/* Stats */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {(act.estimatedDistance || 0) > 0 && (
                              <div
                                className={`text-[10px] font-bold flex items-center gap-1 ${
                                  isRace
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-500"
                                }`}
                              >
                                <Activity size={10} />
                                {Number(act.estimatedDistance).toFixed(1)} km
                              </div>
                            )}
                            {act.tonnage && act.tonnage > 0 && (
                              <div
                                className={`text-[10px] font-bold flex items-center gap-1 text-slate-500`}
                              >
                                <Dumbbell size={10} />
                                {(act.tonnage / 1000).toFixed(1)}t
                              </div>
                            )}
                          </div>
                          {act.muscleGroups && act.muscleGroups.length > 0 && (
                            <div
                              className={`text-[10px] font-medium flex flex-wrap gap-1 text-slate-400`}
                            >
                              {act.muscleGroups.slice(0, 3).map((m: any) => (
                                <span
                                  key={m}
                                  className={`px-1 rounded bg-slate-100 dark:bg-slate-800`}
                                >
                                  {({
                                    legs: "Ben",
                                    chest: "Bröst",
                                    back: "Rygg",
                                    arms: "Armar",
                                    shoulders: "Axlar",
                                    core: "Core",
                                  } as Record<string, string>)[m] || m}
                                </span>
                              ))}
                              {act.muscleGroups.length > 3 && <span>+</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    // Actual Activity (Unmatched)
                    const actual = event.data;
                    return (
                      <div
                        key={actual.id}
                        onClick={() =>
                          updateUrlParams({ activityId: actual.id })}
                        className={`p-3 border rounded-xl hover:shadow-md transition-all cursor-pointer group
                                                    ${
                          actual.type === "strength"
                            ? "bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30"
                            : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1
                                                        ${
                              actual.type === "strength"
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {actual.source === "strava" ? "STRAVA" : "LOGGAT"}
                            {(actual.source === "strava" ||
                              actual.source === "merged") && (
                              <span className="text-[#FC4C02]" title="Strava">
                                🔥
                              </span>
                            )}
                          </span>
                          {event.time && (
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 opacity-60">
                              <Clock size={9} />
                              {event.time}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                            {actual.title || (actual.type === "strength"
                              ? "Styrkepass"
                              : "Träningspass")}
                          </h4>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {(actual.distance ?? 0) > 0 && (
                            <span className="text-xs text-slate-500 font-medium">
                              🏃 {actual.distance?.toFixed(1)} km
                            </span>
                          )}
                          {actual.durationMinutes > 0 && (
                            <span className="text-xs text-slate-500 font-medium">
                              ⏱️ {formatDurationHHMM(actual.durationMinutes)}
                            </span>
                          )}
                          {(actual.tonnage ?? 0) > 0 && (
                            <span className="text-xs text-slate-500 font-medium">
                              💪 {((actual.tonnage || 0) / 1000).toFixed(1)}t
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                })}

                {allEvents.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-2">
                      <Activity size={20} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Vila
                    </span>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (isPast) {
                      updateUrlParams({
                        registerDate: day.date,
                        registerInput: "löpning",
                      });
                    } else {
                      handleOpenModal(day.date);
                    }
                  }}
                  className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex flex-col items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Plus size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    {isPast ? "Registrera" : "Planera"}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        editingActivity={editingActivity}
        onSave={handleSaveActivity}
        onDelete={(id) => {
          deletePlannedActivity(id);
          notificationService.notify(
            "info",
            "Aktiviteten raderad från databasen.",
          );
          setIsModalOpen(false);
        }}
        weeklyStats={weeklyStats}
        goalProgress={goalProgress}
      />

      {/* Deep Stats Analysis */}
      <WeeklyStatsAnalysis
        weekStart={currentWeekStart}
        weeklyStats={weeklyStats}
      />
    </div>
  );
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
