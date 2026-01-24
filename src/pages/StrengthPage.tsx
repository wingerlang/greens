import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  normalizeExerciseName,
  PersonalBest,
  StrengthLogImportResult,
  StrengthStats,
  StrengthWorkout,
  StrengthWorkoutExercise,
  type WorkoutCategory,
} from "../models/strengthTypes.ts";
import { calculateEstimated1RM } from "../utils/strengthCalculators.ts";
import { useAuth } from "../context/AuthContext.tsx";
import { PRResearchCenter } from "../components/training/PRResearchCenter.tsx";
import { WeeklyVolumeChart } from "../components/training/WeeklyVolumeChart.tsx";
import { StrengthStreaks } from "../components/training/StrengthStreaks.tsx";
import { TrainingBreaks } from "../components/training/TrainingBreaks.tsx";
import { TopExercisesTable } from "../components/training/TopExercisesTable.tsx";
import { ExerciseDetailModal } from "../components/training/ExerciseDetailModal.tsx";
import { WorkoutDetailModal } from "../components/training/WorkoutDetailModal.tsx";
import { useScrollLock } from "../hooks/useScrollLock.ts";
import { Tabs } from "../components/common/Tabs.tsx";
import { CollapsibleSection } from "../components/common/CollapsibleSection.tsx";
import { TrainingTimeStats } from "../components/training/TrainingTimeStats.tsx";
import {
  PlateauWarningCard,
  VolumeRecommendationCard,
} from "../components/training/ProgressiveOverloadCard.tsx";
import {
  getPlateauWarnings,
  getUnderperformers,
  getWeeklyVolumeRecommendations,
  type PlateauWarning,
  type Underperformer,
} from "../utils/progressiveOverload.ts";
import { MuscleVolumeChart } from "../components/training/MuscleVolumeChart.tsx";
import { ACWRGauge } from "../components/training/ACWRGauge.tsx";
import {
  RecordTrendLine,
  StatCard,
  WorkoutCard,
} from "../components/training/StrengthCards.tsx";
import { StrengthPageSkeleton } from "../components/training/StrengthSkeletons.tsx";
import { formatDateFull, slugify } from "../utils/formatters.ts";
import { ImportWorkoutModal } from "../components/training/ImportWorkoutModal.tsx";
import {
  WorkoutCategoryBadge,
  WorkoutCategoryFilter,
} from "../components/training/WorkoutCategoryBadge.tsx";
import {
  classifyWorkout,
  getWorkoutCategoryStats,
} from "../utils/workoutClassifier.ts";

// ============================================
// Strength Page - Main Component
// ============================================

export function StrengthPage() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
  const [stats, setStats] = useState<StrengthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<
    StrengthLogImportResult | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<
    StrengthWorkout | null
  >(null);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [isResearchCenterOpen, setIsResearchCenterOpen] = useState(false);

  // Main tab navigation
  const { tab: tabOrExercise } = useParams();
  const isSpecialTab = tabOrExercise === "research" ||
    tabOrExercise === "analys" || tabOrExercise === "analysis";

  const mainTab = isSpecialTab
    ? (tabOrExercise === "analys" ? "analysis" : tabOrExercise) as
      | "overview"
      | "analysis"
      | "research"
    : "overview";

  const setMainTab = (tab: string) => {
    if (tab === "overview") navigate("/styrka");
    else navigate(`/styrka/${tab}`);
  };
  const [hideJanuaryBests, setHideJanuaryBests] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<WorkoutCategory | "all">(
    "all",
  );

  // Workout table sorting
  const [workoutSortBy, setWorkoutSortBy] = useState<
    "date" | "name" | "exercises" | "sets" | "volume"
  >("date");
  const [workoutSortOrder, setWorkoutSortOrder] = useState<"asc" | "desc">(
    "desc",
  );

  const exerciseSlug = !isSpecialTab ? tabOrExercise : null;
  const [searchParams, setSearchParams] = useSearchParams();

  const exerciseName = exerciseSlug ? decodeURIComponent(exerciseSlug) : null;
  const sessionId = searchParams.get("sessionId");

  // Handle session deep-linking
  useEffect(() => {
    if (sessionId && workouts.length > 0) {
      const match = workouts.find((w) => w.id === sessionId);
      if (match) {
        setSelectedWorkout(match);
      }
    }
  }, [sessionId, workouts]);

  const selectedExercise = useMemo(() => {
    if (!exerciseName) return null;

    // Exact match?
    // We need to find the REAL name from the slug
    // Iterate all workouts and find a match
    for (const w of workouts) {
      for (const e of w.exercises) {
        if (slugify(e.exerciseName) === exerciseName) {
          return e.exerciseName;
        }
      }
    }

    // Final fallback: just deslugify with spaces
    return exerciseName.replace(/-/g, " ");
  }, [exerciseName, workouts]);

  // Handle modal close
  const handleCloseExercise = useCallback(() => {
    navigate("/styrka");
  }, [navigate]);

  // Handle workout selection with URL update
  const handleSelectWorkout = useCallback((workout: StrengthWorkout) => {
    setSelectedWorkout(workout);
    setSearchParams((prev) => {
      prev.set("sessionId", workout.id);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const handleCloseWorkout = useCallback(() => {
    setSelectedWorkout(null);
    setSearchParams((prev) => {
      prev.delete("sessionId");
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  // Calculate session number for selected workout
  const currentSessionInfo = useMemo(() => {
    if (!selectedWorkout || workouts.length === 0) return null;

    // Get workouts for the same year
    const year = new Date(selectedWorkout.date).getFullYear();
    // Sort ascending by date to find index
    const yearWorkouts = workouts
      .filter((w) => new Date(w.date).getFullYear() === year)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const index = yearWorkouts.findIndex((w) => w.id === selectedWorkout.id);
    return {
      number: index + 1,
      total: yearWorkouts.length,
      year,
    };
  }, [selectedWorkout, workouts]);

  const { token } = useAuth();

  // Fetch data on mount
  const fetchData = useCallback(async () => {
    console.log(
      "[StrengthPage] fetchData called, token:",
      token ? "exists" : "missing",
    );
    if (!token) {
      console.log("[StrengthPage] No token, skipping fetch");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      console.log("[StrengthPage] Starting fetch calls...");
      const [workoutsRes, pbsRes, statsRes] = await Promise.all([
        fetch("/api/strength/workouts", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/strength/pbs", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/strength/stats", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      console.log(
        "[StrengthPage] Responses:",
        workoutsRes.status,
        pbsRes.status,
        statsRes.status,
      );

      if (workoutsRes.ok) {
        const data = await workoutsRes.json();
        console.log("[StrengthPage] Workouts:", data.workouts?.length || 0);
        setWorkouts(data.workouts || []);
      }
      if (pbsRes.ok) {
        const data = await pbsRes.json();
        setPersonalBests(data.personalBests || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (e) {
      console.error("[StrengthPage] Failed to fetch strength data:", e);
    } finally {
      console.log("[StrengthPage] Setting loading to false");
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);

  // Handle file import
  const handleImport = async (file: File, source: "strengthlog" | "hevy") => {
    if (!file || !token) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const res = await fetch("/api/strength/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ csv: text, source }),
      });

      const result = await res.json();

      // Normalize generic API error response
      if (!res.ok && result.error) {
        setImportResult({
          success: false,
          errors: [result.error],
          workoutsImported: 0,
          workoutsUpdated: 0,
          workoutsSkipped: 0,
          exercisesDiscovered: 0,
          personalBestsFound: 0,
        });
        return;
      }

      setImportResult(result);

      if (result.success) {
        await fetchData();
        // setShowImportModal(false); // Keep open to show success result
      }
    } catch (e) {
      console.error("Import failed:", e);
      setImportResult({
        success: false,
        errors: [
          "Import failed: " + (e instanceof Error ? e.message : String(e)),
        ],
        workoutsImported: 0,
        workoutsUpdated: 0,
        workoutsSkipped: 0,
        exercisesDiscovered: 0,
        personalBestsFound: 0,
      });
    } finally {
      setImporting(false);
    }
  };

  // Get date range bounds from workouts
  const dateRange = React.useMemo(() => {
    if (workouts.length === 0) {
      return { min: "2020-01-01", max: new Date().toISOString().split("T")[0] };
    }
    const dates = workouts.map((w) => w.date).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [workouts]);

  const availableYears = React.useMemo(() => {
    const years = new Set<number>();
    workouts.forEach((w) => {
      const year = new Date(w.date).getFullYear();
      if (!isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [workouts]);

  // Date filter state (null = show all)
  const [startDate, setStartDate] = React.useState<string | null>(null);
  const [endDate, setEndDate] = React.useState<string | null>(null);

  // Filter workouts by date range and category
  const filteredWorkouts = React.useMemo(() => {
    return workouts.filter((w) => {
      if (startDate && w.date < startDate) return false;
      if (endDate && w.date > endDate) return false;
      // Category filter
      if (categoryFilter !== "all") {
        const cat = w.workoutCategory || classifyWorkout(w);
        if (cat !== categoryFilter) return false;
      }
      return true;
    });
  }, [workouts, startDate, endDate, categoryFilter]);

  // Category statistics for filter counts
  const categoryStats = useMemo(() => {
    // Calculate stats from date-filtered workouts (before category filter)
    const dateFiltered = workouts.filter((w) => {
      if (startDate && w.date < startDate) return false;
      if (endDate && w.date > endDate) return false;
      return true;
    });
    return getWorkoutCategoryStats(dateFiltered);
  }, [workouts, startDate, endDate]);

  // Prevent background scroll when Research Center is open
  useScrollLock(isResearchCenterOpen);

  // Derive Personal Bests from workout history (ensures bodyweight-aware logic is applied to existing data)
  const derivedPersonalBests = React.useMemo(() => {
    const allPRs: PersonalBest[] = [];
    const currentE1RMBests = new Map<string, number>();
    const currentWeightBests = new Map<string, number>();

    // Sort by date ascending to process records in order
    const sortedWorkouts = [...workouts].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    sortedWorkouts.forEach((w) => {
      w.exercises.forEach((ex, exIdx) => {
        const exName = normalizeExerciseName(ex.exerciseName);
        const exId = `ex-${exName.replace(/\s/g, "-")}`;

        ex.sets.forEach((set, setIdx) => {
          const isBW = !!set.isBodyweight || set.weight === 0;
          const calcWeight = isBW ? (set.extraWeight || 0) : set.weight;
          if (calcWeight <= 0 && !isBW) return;

          const est1RM = calculateEstimated1RM(calcWeight, set.reps);
          const existingE1RMBest = currentE1RMBests.get(exName) || 0;
          const existingWeightBest = currentWeightBests.get(exName) || 0;

          const isE1RMPR = est1RM > existingE1RMBest;
          const isWeightPR = calcWeight > existingWeightBest;

          if (isE1RMPR || isWeightPR) {
            const newPR: PersonalBest = {
              id: `pb-${exId}-${w.id}-${allPRs.length}`,
              exerciseId: exId,
              exerciseName: ex.exerciseName,
              userId: w.userId,
              type: "1rm",
              value: est1RM,
              weight: set.weight,
              reps: set.reps,
              isBodyweight: isBW,
              extraWeight: set.extraWeight,
              date: w.date,
              workoutId: w.id,
              workoutName: w.name,
              estimated1RM: est1RM,
              createdAt: w.date,
              previousBest: existingE1RMBest > 0 ? existingE1RMBest : undefined,
              orderIndex: (exIdx * 100) + setIdx,
              isActual1RM: set.reps === 1,
              isHighestWeight: isWeightPR,
            };
            allPRs.push(newPR);

            if (isE1RMPR) currentE1RMBests.set(exName, est1RM);
            if (isWeightPR) currentWeightBests.set(exName, calcWeight);
          }
        });
      });
    });

    // Return all PRs sorted by date descending, then by orderIndex ascending for intra-workout accuracy
    return allPRs.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return (a.orderIndex || 0) - (b.orderIndex || 0);
    });
  }, [workouts]);

  // Filter PBs by date range (using derived PBs to fix data issues)
  const filteredPBs = React.useMemo(() => {
    return derivedPersonalBests.filter((pb) => {
      if (startDate && pb.date < startDate) return false;
      if (endDate && pb.date > endDate) return false;
      return true;
    });
  }, [derivedPersonalBests, startDate, endDate]);

  // Top Workouts (Best of all time in specific categories)
  const bestWorkouts = React.useMemo(() => {
    if (filteredWorkouts.length === 0) return null;

    return {
      volume: [...filteredWorkouts].sort((a, b) =>
        b.totalVolume - a.totalVolume
      )[0],
      duration: [...filteredWorkouts].sort((a, b) =>
        (b.duration || 0) - (a.duration || 0)
      )[0],
      sets: [...filteredWorkouts].sort((a, b) => b.totalSets - a.totalSets)[0],
      reps: [...filteredWorkouts].sort((a, b) => b.totalReps - a.totalReps)[0],
      exercises: [...filteredWorkouts].sort((a, b) =>
        b.uniqueExercises - a.uniqueExercises
      )[0],
    };
  }, [filteredWorkouts]);

  // Identify workouts that contain an Annual Best (for that year)
  const annualBestWorkoutIds = useMemo(() => {
    const ids = new Set<string>();
    const bestsByYear: Record<string, Record<string, number>> = {};

    // 1. Find Max Values per Year per Exercise
    workouts.forEach((w) => {
      const date = new Date(w.date);
      const year = w.date.substring(0, 4);

      // If hiding January bests, skip if in January
      if (hideJanuaryBests && date.getMonth() === 0) return;

      if (!bestsByYear[year]) bestsByYear[year] = {};

      w.exercises.forEach((e) => {
        const exName = normalizeExerciseName(e.exerciseName);

        // Calculate session max (Standard 1RM based)
        const sessionMax = e.sets.reduce((max, s) => {
          const isBW = s.isBodyweight || s.weight === 0;
          const weight = isBW ? (s.extraWeight || 0) : s.weight;
          if (weight <= 0 && !isBW) return max;
          return Math.max(max, calculateEstimated1RM(weight, s.reps));
        }, 0);

        if (sessionMax > (bestsByYear[year][exName] || 0)) {
          bestsByYear[year][exName] = sessionMax;
        }
      });
    });

    // 2. Mark workouts that achieved the max
    workouts.forEach((w) => {
      const date = new Date(w.date);
      const year = w.date.substring(0, 4);

      // If hiding January bests, skip January workouts entirely for classification
      if (hideJanuaryBests && date.getMonth() === 0) return;

      const hasBest = w.exercises.some((e) => {
        const exName = normalizeExerciseName(e.exerciseName);
        const sessionMax = e.sets.reduce((max, s) => {
          const isBW = s.isBodyweight || s.weight === 0;
          const weight = isBW ? (s.extraWeight || 0) : s.weight;
          if (weight <= 0 && !isBW) return max;
          return Math.max(max, calculateEstimated1RM(weight, s.reps));
        }, 0);

        return sessionMax > 0 && sessionMax >= (bestsByYear[year][exName] || 0);
      });

      if (hasBest) ids.add(w.id);
    });

    return ids;
  }, [workouts, hideJanuaryBests]);

  // Identify workouts that contain an All-Time PR
  const allTimePBWorkoutIds = useMemo(() => {
    const ids = new Set<string>();
    derivedPersonalBests.forEach((pb) => {
      if (pb.workoutId) ids.add(pb.workoutId);
    });
    return ids;
  }, [derivedPersonalBests]);

  // Period-based stats
  const periodStats = React.useMemo(() => {
    const count = filteredWorkouts.length;
    const volume = filteredWorkouts.reduce(
      (sum, w) => sum + (w.totalVolume || 0),
      0,
    );
    const sets = filteredWorkouts.reduce(
      (sum, w) => sum + (w.totalSets || 0),
      0,
    );
    const uniqueExercises = new Set(filteredWorkouts.flatMap((w) =>
      w.exercises.map((e) =>
        e.exerciseName
      )
    )).size;
    return { count, volume, sets, uniqueExercises };
  }, [filteredWorkouts]);

  // Reset date filter
  const resetDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  // Workout Search & Pagination
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState("");
  const [workoutDisplayCount, setWorkoutDisplayCount] = useState(20);

  const searchedWorkouts = useMemo(() => {
    if (!workoutSearchTerm) return filteredWorkouts;
    const lower = workoutSearchTerm.toLowerCase();
    return filteredWorkouts.filter((w) =>
      w.name.toLowerCase().includes(lower) ||
      w.exercises.some((e) => e.exerciseName.toLowerCase().includes(lower))
    );
  }, [filteredWorkouts, workoutSearchTerm]);

  // Reset pagination when filter changes
  useEffect(() => {
    setWorkoutDisplayCount(20);
  }, [workoutSearchTerm, startDate, endDate]);

  const visibleWorkouts = searchedWorkouts.slice(0, workoutDisplayCount);

  const hasDateFilter = startDate !== null || endDate !== null;

  // Show skeleton during initial load
  if (loading && workouts.length === 0) {
    return (
      <div className="pt-2 md:pt-4 p-4 md:p-8 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-white mb-2">
            💪 Styrketräning
          </h1>
          <p className="text-slate-400">
            Dina pass, övningar och personliga rekord.
          </p>
        </header>
        <StrengthPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pt-2 md:pt-4 p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">
              💪 Styrketräning
            </h1>
            <p className="text-slate-400">
              Dina pass, övningar och personliga rekord.
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setShowImportModal(true)}
              className={`px-5 py-2.5 rounded-xl font-bold cursor-pointer transition-all active:scale-95 ${
                importing
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
              }`}
              disabled={importing}
            >
              {importing ? "⏳ Importerar..." : "📥 Importera Pass"}
            </button>
          </div>
        </div>

        <ImportWorkoutModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
          isImporting={importing}
          importResult={importResult}
        />

        {/* Main Tab Navigation */}
        <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 w-fit">
          <button
            onClick={() => setMainTab("overview")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mainTab === "overview"
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>📊</span> Översikt
          </button>
          <button
            onClick={() => setMainTab("analysis")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mainTab === "analysis"
                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>🔬</span> Analys
          </button>
          <button
            onClick={() => setMainTab("research")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              mainTab === "research"
                ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>⚛️</span> Research Center
          </button>
        </div>
      </header>

      {/* Date Filter - Only show on Overview and Analysis tabs */}
      {mainTab !== "research" && workouts.length > 0 && (
        <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">📅</span>
              <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Datumfilter
                </h3>
                <p className="text-[10px] text-slate-600 font-bold uppercase">
                  Begränsa analysen till en specifik tidsperiod
                </p>
              </div>
            </div>
            {hasDateFilter && (
              <button
                onClick={resetDateFilter}
                className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-4 py-1.5 rounded-full font-black uppercase transition-all"
              >
                ✕ Återställ
              </button>
            )}
          </div>

          {/* Year Presets */}
          <div className="flex flex-wrap gap-2">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => {
                  setStartDate(`${year}-01-01`);
                  setEndDate(`${year}-12-31`);
                }}
                className={`text-[11px] font-black uppercase px-6 py-2 rounded-xl border transition-all ${
                  startDate?.startsWith(year.toString()) &&
                    endDate?.startsWith(year.toString())
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-950 border-white/5 text-slate-500 hover:border-white/10"
                }`}
              >
                {year}
              </button>
            ))}
            <button
              onClick={() => {
                const now = new Date();
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(now.getMonth() - 6);
                setStartDate(sixMonthsAgo.toISOString().split("T")[0]);
                setEndDate(now.toISOString().split("T")[0]);
              }}
              className={`text-[11px] font-black uppercase px-6 py-2 rounded-xl border transition-all ${
                hasDateFilter && !availableYears.some((y) =>
                    startDate?.startsWith(y.toString()) &&
                    endDate?.startsWith(y.toString())
                  )
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-950 border-white/5 text-slate-500 hover:border-white/10"
              }`}
            >
              Senaste 6 mån
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
            <div className="w-full md:w-40 flex-shrink-0">
              <label className="text-[9px] text-slate-500 uppercase font-black mb-1.5 block">
                Från
              </label>
              <input
                type="date"
                value={startDate || dateRange.min}
                min={dateRange.min}
                max={endDate || dateRange.max}
                onChange={(e) => setStartDate(e.target.value || null)}
                className="w-full bg-slate-900 border border-white/5 text-white px-3 py-2 rounded-xl text-xs font-mono focus:border-blue-500/50 outline-none transition-colors"
              />
            </div>

            {/* Visual Range Slider */}
            <div className="flex-1 w-full px-2">
              <label className="text-[9px] text-slate-500 uppercase font-black mb-3 block text-center tracking-widest opacity-60">
                Tidsaxel
              </label>
              <div className="relative h-1.5 bg-slate-900 rounded-full border border-white/5">
                {(() => {
                  const min = Math.min(
                    new Date(dateRange.min).getTime(),
                    new Date(startDate || dateRange.min).getTime(),
                  );
                  const max = Math.max(
                    new Date(dateRange.max).getTime(),
                    new Date(endDate || dateRange.max).getTime(),
                  );
                  const start = new Date(startDate || dateRange.min).getTime();
                  const end = new Date(endDate || dateRange.max).getTime();
                  const left = ((start - min) / (max - min)) * 100;
                  const width = ((end - start) / (max - min)) * 100;

                  return (
                    <div
                      className="absolute h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  );
                })()}
                <input
                  type="range"
                  min={new Date(dateRange.min).getTime()}
                  max={new Date(dateRange.max).getTime()}
                  value={new Date(startDate || dateRange.min).getTime()}
                  onChange={(e) => {
                    const newStart = Math.min(
                      parseInt(e.target.value),
                      new Date(endDate || dateRange.max).getTime() - 86400000,
                    );
                    setStartDate(
                      new Date(newStart).toISOString().split("T")[0],
                    );
                  }}
                  className={`absolute inset-0 w-full appearance-none bg-transparent cursor-pointer slider-thumb-dual ${
                    new Date(startDate || dateRange.min).getTime() >
                        (new Date(dateRange.max).getTime() +
                            new Date(dateRange.min).getTime()) / 2
                      ? "z-30"
                      : "z-20"
                  }`}
                  style={{ pointerEvents: "none" }}
                />
                <input
                  type="range"
                  min={new Date(dateRange.min).getTime()}
                  max={new Date(dateRange.max).getTime()}
                  value={new Date(endDate || dateRange.max).getTime()}
                  onChange={(e) => {
                    const newEnd = Math.max(
                      parseInt(e.target.value),
                      new Date(startDate || dateRange.min).getTime() + 86400000,
                    );
                    setEndDate(new Date(newEnd).toISOString().split("T")[0]);
                  }}
                  className={`absolute inset-0 w-full appearance-none bg-transparent cursor-pointer slider-thumb-dual ${
                    new Date(endDate || dateRange.max).getTime() <=
                        (new Date(dateRange.max).getTime() +
                            new Date(dateRange.min).getTime()) / 2
                      ? "z-30"
                      : "z-20"
                  }`}
                  style={{ pointerEvents: "none" }}
                />
              </div>
            </div>

            <div className="w-full md:w-40 flex-shrink-0">
              <label className="text-[9px] text-slate-500 uppercase font-black mb-1.5 block text-right">
                Till
              </label>
              <input
                type="date"
                value={endDate || dateRange.max}
                min={startDate || dateRange.min}
                max={dateRange.max}
                onChange={(e) => setEndDate(e.target.value || null)}
                className="w-full bg-slate-900 border border-white/5 text-white px-3 py-2 rounded-xl text-xs font-mono text-right focus:border-blue-500/50 outline-none transition-colors"
              />
            </div>
          </div>

          {hasDateFilter && (
            <div className="pt-2 flex justify-between items-center text-[10px] font-black uppercase text-emerald-400">
              <span>
                Siktet inställt på:{" "}
                {new Date(startDate || dateRange.min).toLocaleDateString(
                  "sv-SE",
                )} →{" "}
                {new Date(endDate || dateRange.max).toLocaleDateString("sv-SE")}
              </span>
              <span className="bg-emerald-500/10 px-3 py-1 rounded-full">
                {filteredWorkouts.length} pass fångade
              </span>
            </div>
          )}
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div
          className={`p-4 rounded-xl border ${
            importResult.success
              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
              : "bg-red-950/30 border-red-500/30 text-red-200"
          }`}
        >
          {importResult.success
            ? (
              <p>
                ✅ Import klar! {importResult.workoutsImported} nya pass,{" "}
                {importResult.workoutsUpdated} uppdaterade,{" "}
                {importResult.exercisesDiscovered} nya övningar,{" "}
                {importResult.personalBestsFound} PBs.
              </p>
            )
            : <p>❌ Import misslyckades: {importResult.errors?.join(", ")}</p>}
        </div>
      )}

      {/* Stats Cards */}
      {mainTab === "overview" && stats && (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 md:px-8 flex flex-wrap justify-between items-center gap-4 text-sm font-medium text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-xl md:text-2xl">
              {periodStats.count}
            </span>
            <span className="uppercase text-[10px] md:text-xs font-bold tracking-widest opacity-60">
              Pass
            </span>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-xl md:text-2xl">
              {periodStats.uniqueExercises}
            </span>
            <span className="uppercase text-[10px] md:text-xs font-bold tracking-widest opacity-60">
              Övningar
            </span>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-xl md:text-2xl">
              {periodStats.sets}
            </span>
            <span className="uppercase text-[10px] md:text-xs font-bold tracking-widest opacity-60">
              Set
            </span>
          </div>
          <div className="w-px h-8 bg-white/10 hidden sm:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-xl md:text-2xl">
              {(periodStats.volume / 1000).toFixed(1)}
            </span>
            <span className="uppercase text-[10px] md:text-xs font-bold tracking-widest opacity-60">
              Ton
            </span>
          </div>
        </div>
      )}

      {/* Progressive Overload - Plateau Warnings & Volume - ANALYSIS TAB */}
      {mainTab === "analysis" && workouts.length > 0 && (() => {
        const plateauWarnings = getPlateauWarnings(workouts, 3);
        const volumeRecs = getWeeklyVolumeRecommendations(workouts).filter(
          (r) => r.recommendation !== "maintain",
        );

        return (
          <section className="space-y-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">📈</span>
              <div>
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Progressive Overload Assistant
                </h2>
                <p className="text-[10px] text-slate-600 font-bold">
                  Platåer, volym och rekommendationer
                </p>
              </div>
            </div>

            {(plateauWarnings.length > 0 || volumeRecs.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Plateau Warnings */}
                {plateauWarnings.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <span>⚠️</span> Övningar som stagnerat
                    </h3>
                    {plateauWarnings.slice(0, 4).map((warning, idx) => (
                      <PlateauWarningCard key={idx} warning={warning} />
                    ))}
                  </div>
                )}

                {/* Volume Recommendations */}
                {volumeRecs.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-2">
                      <span>📊</span> Volymanalys
                    </h3>
                    {volumeRecs.slice(0, 4).map((rec, idx) => (
                      <VolumeRecommendationCard
                        key={idx}
                        recommendation={rec}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })()}

      {/* Training Time Analytics - ANALYSIS TAB */}
      {mainTab === "analysis" && (
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <TrainingTimeStats
            workouts={filteredWorkouts}
            days={hasDateFilter ? 365 : 9999}
            personalBests={personalBests}
            dateRangeLabel={hasDateFilter && startDate && endDate
              ? `${
                new Date(startDate).toLocaleDateString("sv-SE", {
                  day: "numeric",
                  month: "short",
                })
              } - ${
                new Date(endDate).toLocaleDateString("sv-SE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              }`
              : "Alla tider"}
          />
          {/* Placeholder for another module */}
          <div className="hidden md:block" />
        </section>
      )}

      {/* Physiological Analytics - ANALYSIS TAB */}
      {mainTab === "analysis" && workouts.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xl">🔬</span>
            <div>
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Fysiologisk Analys
              </h2>
              <p className="text-[10px] text-slate-600 font-bold">
                Muskelvolym, belastning och skaderisk
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Muscle Volume Chart */}
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Muskelvolym
                  </h3>
                  <p className="text-[9px] text-slate-600 font-bold">
                    Volym per muskelgrupp (vecka vs snitt)
                  </p>
                </div>
                <span className="text-lg">💪</span>
              </div>
              <MuscleVolumeChart workouts={filteredWorkouts} />
            </div>

            {/* ACWR Gauge */}
            <ACWRGauge workouts={filteredWorkouts} />
          </div>
        </section>
      )}

      {/* Personal Bests - OVERVIEW TAB */}
      {mainTab === "overview" && (
        <section className="mt-8">
          <Tabs
            items={[
              {
                id: "latest-records",
                label: "Senaste Rekord",
                icon: "🏆",
                content: (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      // Group PBs by exerciseName
                      const grouped = filteredPBs.reduce((acc, pb) => {
                        const key = pb.exerciseName;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(pb);
                        return acc;
                      }, {} as Record<string, PersonalBest[]>);

                      // Sort groups by the date of their most recent PR
                      return Object.values(grouped)
                        .sort((a, b) => b[0].date.localeCompare(a[0].date))
                        .slice(0, 12)
                        .map((pbs) => {
                          const latestPb = pbs[0];
                          const exName = latestPb.exerciseName;

                          return (
                            <div
                              key={exName}
                              className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 transition-all hover:border-blue-500/30 hover:bg-slate-900/60 group relative overflow-hidden cursor-pointer"
                              onClick={() =>
                                navigate(`/styrka/${slugify(exName)}`)}
                            >
                              <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/5 blur-2xl group-hover:bg-blue-500/10 transition-all rounded-full" />
                              <div className="flex justify-between items-start mb-3 relative">
                                <div className="flex-1 min-w-0">
                                  <h3
                                    className="text-sm font-black text-blue-400 uppercase truncate pr-4"
                                    title={exName}
                                  >
                                    {exName}
                                  </h3>
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    Senaste: {latestPb.date}
                                  </p>
                                </div>
                                <span className="bg-slate-800 text-slate-500 text-[9px] font-black px-2 py-1 rounded-full border border-white/5">
                                  {pbs.length} REKORD
                                </span>
                              </div>
                              <div className="space-y-2 relative">
                                {pbs.slice(0, 3).map((singlePb, idx) => (
                                  <div
                                    key={singlePb.id}
                                    className="flex justify-between items-center text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-black ${
                                          idx === 0
                                            ? "text-white text-lg"
                                            : "text-slate-400"
                                        }`}
                                      >
                                        {singlePb.weight} kg
                                      </span>
                                      {singlePb.isHighestWeight && (
                                        <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1 rounded font-bold uppercase">
                                          TOPP
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-slate-500">
                                        {singlePb.reps} reps
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                ),
              },
              {
                id: "trend-line",
                label: "Trend",
                icon: "📈",
                content: (
                  <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                          Övergripande rekord-trend
                        </h3>
                        <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold italic">
                          Din totala styrka (Summan av alla personbästa 1eRM)
                        </p>
                      </div>
                    </div>
                    <div className="h-48 w-full relative">
                      <RecordTrendLine pbs={filteredPBs} />
                    </div>
                  </div>
                ),
              },
              {
                id: "volume-overview",
                label: "Volym-Översikt",
                icon: "📊",
                content: (
                  <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4">
                      📈 Volym per vecka
                    </h2>
                    <WeeklyVolumeChart
                      workouts={workouts}
                      setStartDate={setStartDate}
                      setEndDate={setEndDate}
                    />
                  </div>
                ),
              },
              {
                id: "underperformers",
                label: "Underpresterare",
                icon: "📉",
                content: (
                  <div className="space-y-4">
                    <div className="bg-slate-900/30 border border-white/5 rounded-xl p-4">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Övningar du tränar ofta men har flat utveckling — många
                        set utan nya rekord
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getUnderperformers(workouts, personalBests, 15).slice(
                        0,
                        9,
                      ).map((u) => (
                        <div
                          key={u.exerciseName}
                          className="bg-slate-900/40 border border-white/5 rounded-xl p-4 hover:border-amber-500/30 transition-all group"
                        >
                          <div
                            className="cursor-pointer"
                            onClick={() =>
                              navigate(`/styrka/${slugify(u.exerciseName)}`)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-sm font-black text-white uppercase truncate pr-2 group-hover:text-amber-400 transition-colors">
                                {u.exerciseName}
                                {u.isBodyweight && (
                                  <span className="ml-1 text-[8px] text-slate-500 border border-white/10 px-1 py-0.5 rounded bg-slate-800">
                                    KV
                                  </span>
                                )}
                                {u.isTimeBased && (
                                  <span className="ml-1 text-[8px] text-cyan-500 border border-cyan-500/20 px-1 py-0.5 rounded bg-cyan-500/10">
                                    TID
                                  </span>
                                )}
                                {u.isHyrox && (
                                  <span className="ml-1 text-[8px] text-amber-500 border border-amber-500/20 px-1 py-0.5 rounded bg-amber-500/10 tracking-wider">
                                    HYROX
                                  </span>
                                )}
                              </h3>
                              <span className="text-[8px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-black uppercase shrink-0">
                                {u.setsSinceLastPB} set
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <div>
                                <p className="text-xl font-black text-amber-400">
                                  {u.daysSinceLastPB || "—"}d
                                </p>
                                <p className="text-[8px] text-slate-600 uppercase">
                                  sedan rekord
                                </p>
                              </div>
                              {u.isTimeBased && u.maxTimeFormatted
                                ? (
                                  <div className="border-l border-white/5 pl-3">
                                    <p className="text-lg font-black text-cyan-400">
                                      {u.maxTimeFormatted}
                                    </p>
                                    <p className="text-[8px] text-slate-600 uppercase">
                                      rekord
                                    </p>
                                  </div>
                                )
                                : u.isWeightedDistance &&
                                    (u.e1RM || u.maxDistance)
                                ? (
                                  <div className="border-l border-white/5 pl-3">
                                    <p className="text-lg font-black text-emerald-400">
                                      {u.e1RM}kg{" "}
                                      <span className="text-slate-500 text-xs font-normal">
                                        ({u.maxDistance}
                                        {u.maxDistanceUnit})
                                      </span>
                                    </p>
                                    <p className="text-[8px] text-slate-600 uppercase">
                                      PB
                                    </p>
                                  </div>
                                )
                                : u.e1RM && (
                                  <div className="border-l border-white/5 pl-3">
                                    <p className="text-lg font-black text-slate-400">
                                      {u.e1RM}kg
                                    </p>
                                    <p className="text-[8px] text-slate-600 uppercase">
                                      {u.isBodyweight ? "1RM" : "e1RM"}
                                    </p>
                                  </div>
                                )}
                            </div>
                            <p className="text-[9px] text-slate-500 italic mb-2">
                              {u.message}
                            </p>
                          </div>
                          {u.lastPBWorkoutId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const workout = workouts.find((w) =>
                                  w.id === u.lastPBWorkoutId
                                );
                                if (workout) setSelectedWorkout(workout);
                              }}
                              className="w-full mt-2 text-[9px] bg-slate-800/50 hover:bg-blue-600/20 text-slate-500 hover:text-blue-400 py-1.5 rounded-lg transition-all border border-white/5 font-bold uppercase"
                            >
                              📋 Visa senaste rekord-passet
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {getUnderperformers(workouts, personalBests, 15).length ===
                        0 && (
                      <div className="text-center text-slate-500 py-8">
                        <p className="text-2xl mb-2">🎉</p>
                        <p className="text-sm">
                          Inga underpresterande övningar!
                        </p>
                        <p className="text-[10px] text-slate-600">
                          Du gör framsteg i alla övningar du tränar regelbundet.
                        </p>
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </section>
      )}

      {/* Training Quality & Continuity - OVERVIEW TAB */}
      {mainTab === "overview" && (
        <div className="space-y-12">
          <TrainingBreaks
            workouts={workouts}
            filterRange={{ start: startDate, end: endDate }}
          />
          <StrengthStreaks workouts={filteredWorkouts} />
        </div>
      )}

      {/* Best Workouts / Records Section - OVERVIEW TAB */}
      {mainTab === "overview" && bestWorkouts && (
        <section>
          <h2 className="text-lg font-bold text-white mb-3">
            🏅 Rekordpass {hasDateFilter ? "(Perioden)" : "(Alla tider)"}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <button
              onClick={() => setSelectedWorkout(bestWorkouts.volume)}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center hover:bg-emerald-500/20 transition-all group active:scale-95"
            >
              <p className="text-[9px] text-emerald-500 font-black uppercase">
                Mest volym
              </p>
              <p className="text-xl font-black text-white my-1">
                {Math.round(bestWorkouts.volume.totalVolume / 1000)}t
              </p>
              <p className="text-[9px] text-slate-500">
                {bestWorkouts.volume.totalSets} set |{" "}
                {bestWorkouts.volume.uniqueExercises} övn
              </p>
              <p className="text-[8px] text-emerald-500/60 mt-1">
                {formatDateFull(bestWorkouts.volume.date)}
              </p>
            </button>
            {bestWorkouts.duration?.duration &&
              bestWorkouts.duration.duration > 0 && (
              <button
                onClick={() => setSelectedWorkout(bestWorkouts.duration)}
                className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center hover:bg-blue-500/20 transition-all group active:scale-95"
              >
                <p className="text-[9px] text-blue-500 font-black uppercase">
                  Längst pass
                </p>
                <p className="text-xl font-black text-white my-1">
                  {bestWorkouts.duration.duration}m
                </p>
                <p className="text-[9px] text-slate-500">
                  {bestWorkouts.duration.totalSets} set |{" "}
                  {bestWorkouts.duration.uniqueExercises} övn
                </p>
                <p className="text-[8px] text-blue-500/60 mt-1">
                  {formatDateFull(bestWorkouts.duration.date)}
                </p>
              </button>
            )}
            <button
              onClick={() => setSelectedWorkout(bestWorkouts.sets)}
              className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center hover:bg-purple-500/20 transition-all group active:scale-95"
            >
              <p className="text-[9px] text-purple-500 font-black uppercase">
                Flest set
              </p>
              <p className="text-xl font-black text-white my-1">
                {bestWorkouts.sets.totalSets} st
              </p>
              <p className="text-[9px] text-slate-500">
                {bestWorkouts.sets.uniqueExercises} övningar
              </p>
              <p className="text-[8px] text-purple-500/60 mt-1">
                {formatDateFull(bestWorkouts.sets.date)}
              </p>
            </button>
            <button
              onClick={() => setSelectedWorkout(bestWorkouts.reps)}
              className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center hover:bg-amber-500/20 transition-all group active:scale-95"
            >
              <p className="text-[9px] text-amber-500 font-black uppercase">
                Flest reps
              </p>
              <p className="text-xl font-black text-white my-1">
                {bestWorkouts.reps.totalReps}
              </p>
              <p className="text-[9px] text-slate-500">
                {bestWorkouts.reps.totalSets} set |{" "}
                {bestWorkouts.reps.uniqueExercises} övn
              </p>
              <p className="text-[8px] text-amber-500/60 mt-1">
                {formatDateFull(bestWorkouts.reps.date)}
              </p>
            </button>
            <button
              onClick={() => setSelectedWorkout(bestWorkouts.exercises)}
              className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3 text-center hover:bg-pink-500/20 transition-all group active:scale-95"
            >
              <p className="text-[9px] text-pink-500 font-black uppercase">
                Variation
              </p>
              <p className="text-xl font-black text-white my-1">
                {bestWorkouts.exercises.uniqueExercises} övn
              </p>
              <p className="text-[9px] text-slate-500">
                {bestWorkouts.exercises.totalSets} set totalt
              </p>
              <p className="text-[8px] text-pink-500/60 mt-1">
                {formatDateFull(bestWorkouts.exercises.date)}
              </p>
            </button>
          </div>
        </section>
      )}

      {/* Top Exercises by Volume - OVERVIEW TAB */}
      {mainTab === "overview" && filteredWorkouts.length > 0 && (
        <CollapsibleSection
          id="top-exercises"
          title="Mest tränade övningar"
          icon="🔥"
          className="mb-8"
          rightElement={
            <div onClick={(e) => e.stopPropagation()}>
              <WorkoutCategoryFilter
                selectedCategory={categoryFilter}
                onChange={setCategoryFilter}
                stats={categoryStats}
              />
            </div>
          }
        >
          <TopExercisesTable
            workouts={filteredWorkouts}
            personalBests={personalBests}
            onSelectExercise={(name) => navigate(`/styrka/${slugify(name)}`)}
            onSelectWorkout={handleSelectWorkout}
          />
        </CollapsibleSection>
      )}

      {/* Workouts List - OVERVIEW TAB */}
      {mainTab === "overview" && (
        <CollapsibleSection
          id="recent-workouts"
          title="Träningspass"
          icon="📋"
          defaultOpen={true}
          className="mb-8"
          rightElement={
            <label
              className="flex items-center gap-2 cursor-pointer bg-slate-800/50 hover:bg-slate-800 px-3 py-1 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={hideJanuaryBests}
                onChange={(e) => setHideJanuaryBests(e.target.checked)}
                className="form-checkbox h-3.5 w-3.5 text-emerald-500 rounded border-slate-600 bg-slate-900 focus:ring-offset-slate-900"
              />
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Dölj årsbästa i januari
              </span>
            </label>
          }
        >
          {loading
            ? <div className="text-center text-slate-500 py-12">Laddar...</div>
            : filteredWorkouts.length === 0
            ? (
              <div className="text-center text-slate-500 py-12 bg-slate-900/50 rounded-2xl border border-white/5">
                <p className="text-4xl mb-4">🏋️</p>
                <p>
                  {hasDateFilter
                    ? "Inga pass i valt datumintervall"
                    : "Inga pass ännu. Importera din StrengthLog CSV!"}
                </p>
              </div>
            )
            : (
              <div className="space-y-4">
                {/* Category Filter */}
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-2">
                      Filtrera efter kategori
                    </label>
                    <WorkoutCategoryFilter
                      selectedCategory={categoryFilter}
                      onChange={setCategoryFilter}
                      stats={categoryStats}
                    />
                  </div>
                </div>

                {/* Category Summary Stats */}
                <div className="flex gap-3 flex-wrap">
                  {(["push", "pull", "legs", "mixed"] as const).map((cat) => {
                    const count = categoryStats[cat] || 0;
                    if (count === 0) return null;
                    const colors: Record<string, string> = {
                      push:
                        "text-orange-400 border-orange-500/30 bg-orange-500/10",
                      pull: "text-blue-400 border-blue-500/30 bg-blue-500/10",
                      legs: "text-rose-400 border-rose-500/30 bg-rose-500/10",
                      mixed:
                        "text-violet-400 border-violet-500/30 bg-violet-500/10",
                    };
                    const labels: Record<string, string> = {
                      push: "PUSH",
                      pull: "PULL",
                      legs: "BEN",
                      mixed: "MIX",
                    };
                    return (
                      <div
                        key={cat}
                        className={`px-3 py-2 rounded-lg border font-bold ${
                          colors[cat]
                        } ${
                          categoryFilter === cat ? "ring-1 ring-white/20" : ""
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-wider">
                          {labels[cat]}
                        </span>
                        <span className="ml-2 text-lg">{count}</span>
                      </div>
                    );
                  })}
                  <div className="px-3 py-2 rounded-lg border border-white/10 bg-slate-800/50 text-slate-400 font-bold">
                    <span className="text-[10px] uppercase tracking-wider">
                      Totalt
                    </span>
                    <span className="ml-2 text-lg text-white">
                      {Object.values(categoryStats).reduce((a, b) => a + b, 0)}
                    </span>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Sök pass, övningar..."
                    value={workoutSearchTerm}
                    onChange={(e) => setWorkoutSearchTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-white/5 text-white pl-10 pr-4 py-3 rounded-xl focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                  />
                  {workoutSearchTerm && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                      {searchedWorkouts.length} träffar
                    </div>
                  )}
                </div>

                {visibleWorkouts.length === 0
                  ? (
                    <div className="text-center text-slate-500 py-12">
                      <p>Inga pass matchar din sökning.</p>
                    </div>
                  )
                  : (
                    <div className="border border-white/5 rounded-xl overflow-hidden bg-slate-950/50">
                      <table className="w-full text-xs">
                        <thead className="text-slate-500 font-bold bg-slate-900/90 sticky top-0 z-10">
                          <tr>
                            <th
                              className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors"
                              onClick={() => {
                                if (workoutSortBy === "date") {
                                  setWorkoutSortOrder((o) =>
                                    o === "asc" ? "desc" : "asc"
                                  );
                                } else {
                                  setWorkoutSortBy("date");
                                  setWorkoutSortOrder("desc");
                                }
                              }}
                            >
                              Datum {workoutSortBy === "date" &&
                                (workoutSortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                              className="px-4 py-3 text-left cursor-pointer hover:text-white transition-colors"
                              onClick={() => {
                                if (workoutSortBy === "name") {
                                  setWorkoutSortOrder((o) =>
                                    o === "asc" ? "desc" : "asc"
                                  );
                                } else {
                                  setWorkoutSortBy("name");
                                  setWorkoutSortOrder("asc");
                                }
                              }}
                            >
                              Pass {workoutSortBy === "name" &&
                                (workoutSortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                              className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors"
                              onClick={() => {
                                if (workoutSortBy === "exercises") {
                                  setWorkoutSortOrder((o) =>
                                    o === "asc" ? "desc" : "asc"
                                  );
                                } else {
                                  setWorkoutSortBy("exercises");
                                  setWorkoutSortOrder("desc");
                                }
                              }}
                            >
                              Övningar {workoutSortBy === "exercises" &&
                                (workoutSortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                              className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors"
                              onClick={() => {
                                if (workoutSortBy === "sets") {
                                  setWorkoutSortOrder((o) =>
                                    o === "asc" ? "desc" : "asc"
                                  );
                                } else {
                                  setWorkoutSortBy("sets");
                                  setWorkoutSortOrder("desc");
                                }
                              }}
                            >
                              Set {workoutSortBy === "sets" &&
                                (workoutSortOrder === "asc" ? "↑" : "↓")}
                            </th>
                            <th
                              className="px-4 py-3 text-right cursor-pointer hover:text-white transition-colors"
                              onClick={() => {
                                if (workoutSortBy === "volume") {
                                  setWorkoutSortOrder((o) =>
                                    o === "asc" ? "desc" : "asc"
                                  );
                                } else {
                                  setWorkoutSortBy("volume");
                                  setWorkoutSortOrder("desc");
                                }
                              }}
                            >
                              Volym {workoutSortBy === "volume" &&
                                (workoutSortOrder === "asc" ? "↑" : "↓")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {[...visibleWorkouts].sort((a, b) => {
                            const mult = workoutSortOrder === "asc" ? 1 : -1;
                            if (workoutSortBy === "date") {
                              return mult * a.date.localeCompare(b.date);
                            }
                            if (workoutSortBy === "name") {
                              return mult * a.name.localeCompare(b.name);
                            }
                            if (workoutSortBy === "exercises") {
                              return mult *
                                (a.uniqueExercises - b.uniqueExercises);
                            }
                            if (workoutSortBy === "sets") {
                              return mult * (a.totalSets - b.totalSets);
                            }
                            if (workoutSortBy === "volume") {
                              return mult * (a.totalVolume - b.totalVolume);
                            }
                            return 0;
                          }).map((workout) => {
                            const category = workout.workoutCategory ||
                              classifyWorkout(workout);
                            const isPR = allTimePBWorkoutIds.has(workout.id);
                            const isAnnualBest = annualBestWorkoutIds.has(
                              workout.id,
                            );

                            return (
                              <tr
                                key={workout.id}
                                className={`hover:bg-slate-800/30 cursor-pointer transition-colors ${
                                  isPR
                                    ? "bg-amber-500/5"
                                    : isAnnualBest
                                    ? "bg-yellow-500/5"
                                    : ""
                                }`}
                                onClick={() => handleSelectWorkout(workout)}
                              >
                                <td className="px-4 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                                  {workout.date}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <WorkoutCategoryBadge
                                      category={category}
                                      size="sm"
                                    />
                                    <span className="text-white font-bold">
                                      {workout.name}
                                    </span>
                                    {isPR && (
                                      <span className="text-[7px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 rounded font-black">
                                        PR
                                      </span>
                                    )}
                                    {isAnnualBest && !isPR && (
                                      <span className="text-[7px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-1 py-0.5 rounded font-black">
                                        ÅB
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-300 font-mono">
                                  {workout.uniqueExercises}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-300 font-mono">
                                  {workout.totalSets}
                                </td>
                                <td className="px-4 py-2.5 text-right text-emerald-400 font-bold whitespace-nowrap">
                                  {Math.round(workout.totalVolume / 1000)}t
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                {visibleWorkouts.length < searchedWorkouts.length && (
                  <button
                    onClick={() => setWorkoutDisplayCount((prev) => prev + 20)}
                    className="w-full py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-white/5 transition-all font-bold uppercase text-xs tracking-wider"
                  >
                    Visa fler pass ({searchedWorkouts.length -
                      visibleWorkouts.length} kvar)
                  </button>
                )}
              </div>
            )}
        </CollapsibleSection>
      )}

      {/* Research Center - RESEARCH TAB */}
      {mainTab === "research" && (
        <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-amber-500/20 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/30 shadow-lg shadow-amber-500/10">
              ⚛️
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                Research Center
              </h2>
              <p className="text-slate-400 text-sm italic">
                "The path to strength is paved with data."
              </p>
            </div>
          </div>

          <PRResearchCenter
            workouts={workouts}
            personalBests={derivedPersonalBests}
            onClose={() => {}} // No closing when inline
            onSelectWorkout={(w) => setSelectedWorkout(w)}
            inline={true} // Special flag for inline rendering if supported
          />
        </div>
      )}

      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <ExerciseDetailModal
          exerciseName={selectedExercise}
          workouts={workouts}
          onClose={handleCloseExercise}
          onSelectWorkout={(w) => setSelectedWorkout(w)}
          isWorkoutModalOpen={!!selectedWorkout}
        />
      )}

      {/* Workout Detail Modal - last to be on top */}
      {selectedWorkout && (
        <WorkoutDetailModal
          workout={selectedWorkout}
          onClose={handleCloseWorkout}
          onSelectExercise={(name) => {
            handleCloseWorkout();
            navigate(`/styrka/${slugify(name)}`);
          }}
          pbs={filteredPBs}
          allWorkouts={workouts}
          sessionNumber={currentSessionInfo?.number}
          sessionTotal={currentSessionInfo?.total}
          sessionYear={currentSessionInfo?.year}
          onDeleted={() => {
            handleCloseWorkout();
            fetchData(); // Refresh the list
          }}
          isMerged={selectedWorkout.mergeInfo?.isMerged}
          onSeparate={selectedWorkout.mergeInfo?.isMerged
            ? async () => {
              if (!token) return;
              try {
                const res = await fetch(
                  `/api/strength/workout/${selectedWorkout.id}/merge`,
                  {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${token}` },
                  },
                );
                if (res.ok) {
                  handleCloseWorkout();
                  fetchData(); // Refresh the list
                }
              } catch (e) {
                console.error("Failed to separate workout:", e);
              }
            }
            : undefined}
        />
      )}

      {isResearchCenterOpen && (
        <PRResearchCenter
          workouts={workouts}
          personalBests={derivedPersonalBests}
          onClose={() => setIsResearchCenterOpen(false)}
          onSelectWorkout={(w) => setSelectedWorkout(w)}
        />
      )}
    </div>
  );
}

// Sub-components moved to ../components/training/StrengthCards.tsx
// (StatCard, WorkoutCard, RecordTrendLine)
