import React, { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../context/DataContext.tsx";
import { parseOmniboxInput } from "../../utils/nlpParser.ts";
import {
  type ExerciseIntensity,
  type ExerciseType,
  MEAL_TYPE_LABELS,
  type MealType,
} from "../../models/types.ts";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  CornerDownLeft,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  MapPin,
  Moon,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Utensils,
  Wine,
  X,
  Zap,
} from "lucide-react";
import "./CommandCenter.css";

const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
  { type: "running", icon: "🏃", label: "Löpning" },
  { type: "cycling", icon: "🚴", label: "Cykling" },
  { type: "strength", icon: "🏋️", label: "Styrka" },
  { type: "walking", icon: "🚶", label: "Promenad" },
  { type: "swimming", icon: "🏊", label: "Simning" },
  { type: "yoga", icon: "🧘", label: "Yoga" },
  { type: "other", icon: "✨", label: "Annat" },
];

const INTENSITIES: { value: ExerciseIntensity; label: string }[] = [
  { value: "low", label: "Låg" },
  { value: "moderate", label: "Medel" },
  { value: "high", label: "Hög" },
  { value: "ultra", label: "Max" },
];

const CATEGORY_LABELS: Record<
  string,
  {
    label: string;
    icon: any;
    color: string;
    classes: {
      bg: string;
      darkBg: string;
      text: string;
      darkText: string;
      border: string;
      icon: string;
    };
  }
> = {
  food: {
    label: "Mat",
    icon: Utensils,
    color: "emerald",
    classes: {
      bg: "bg-emerald-50",
      darkBg: "dark:bg-emerald-900/20",
      text: "text-emerald-600",
      darkText: "dark:text-emerald-400",
      border: "border-emerald-500",
      icon: "text-emerald-500",
    },
  },
  exercise: {
    label: "Träning",
    icon: Dumbbell,
    color: "orange",
    classes: {
      bg: "bg-orange-50",
      darkBg: "dark:bg-orange-900/20",
      text: "text-orange-600",
      darkText: "dark:text-orange-400",
      border: "border-orange-500",
      icon: "text-orange-500",
    },
  },
  vitals: {
    label: "Hälsa",
    icon: Moon,
    color: "blue",
    classes: {
      bg: "bg-blue-50",
      darkBg: "dark:bg-blue-900/20",
      text: "text-blue-600",
      darkText: "dark:text-blue-400",
      border: "border-blue-500",
      icon: "text-blue-500",
    },
  },
  sleep: {
    label: "Sömn",
    icon: Moon,
    color: "indigo",
    classes: {
      bg: "bg-indigo-50",
      darkBg: "dark:bg-indigo-900/20",
      text: "text-indigo-600",
      darkText: "dark:text-indigo-400",
      border: "border-indigo-500",
      icon: "text-indigo-500",
    },
  },
  water: {
    label: "Vatten",
    icon: Droplets,
    color: "cyan",
    classes: {
      bg: "bg-cyan-50",
      darkBg: "dark:bg-cyan-900/20",
      text: "text-cyan-600",
      darkText: "dark:text-cyan-400",
      border: "border-cyan-500",
      icon: "text-cyan-500",
    },
  },
  coffee: {
    label: "Kaffe",
    icon: Coffee,
    color: "amber",
    classes: {
      bg: "bg-amber-50",
      darkBg: "dark:bg-amber-900/20",
      text: "text-amber-600",
      darkText: "dark:text-amber-400",
      border: "border-amber-500",
      icon: "text-amber-500",
    },
  },
  nocco: {
    label: "Nocco",
    icon: Zap,
    color: "yellow",
    classes: {
      bg: "bg-yellow-50",
      darkBg: "dark:bg-yellow-900/20",
      text: "text-yellow-600",
      darkText: "dark:text-yellow-400",
      border: "border-yellow-500",
      icon: "text-yellow-500",
    },
  },
  energy: {
    label: "Energi",
    icon: Zap,
    color: "yellow",
    classes: {
      bg: "bg-yellow-50",
      darkBg: "dark:bg-yellow-900/20",
      text: "text-yellow-600",
      darkText: "dark:text-yellow-400",
      border: "border-yellow-500",
      icon: "text-yellow-500",
    },
  },
  alcohol: {
    label: "Alkohol",
    icon: Wine,
    color: "rose",
    classes: {
      bg: "bg-rose-50",
      darkBg: "dark:bg-rose-900/20",
      text: "text-rose-600",
      darkText: "dark:text-rose-400",
      border: "border-rose-500",
      icon: "text-rose-500",
    },
  },
  weight: {
    label: "Vikt",
    icon: Search,
    color: "slate",
    classes: {
      bg: "bg-slate-50",
      darkBg: "dark:bg-slate-900/20",
      text: "text-slate-600",
      darkText: "dark:text-slate-400",
      border: "border-slate-500",
      icon: "text-slate-500",
    },
  },
};

const getNutrients = (match: { type: string; item: any }) => {
  if (match.type === "foodItem") {
    return {
      cal: match.item.calories || 0,
      prot: match.item.protein || 0,
    };
  } else {
    // Recipe estimation (rough average or need helper)
    return {
      cal: 150,
      prot: 8,
    };
  }
};

interface CommandCenterProps {
  autoFocus?: boolean;
  onAfterAction?: () => void;
  className?: string;
  overlayMode?: boolean;
}

export function CommandCenter(
  { autoFocus = false, onAfterAction, className = "", overlayMode = false }:
    CommandCenterProps,
) {
  const {
    foodItems,
    recipes,
    addExercise,
    addMealEntry,
    addWeightEntry,
    calculateExerciseCalories,
    updateVitals,
    getVitalsForDate,
  } = useData();

  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null); // Ref for the first manual input field

  // History State
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("omni_history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const addToHistory = (cmd: string) => {
    if (!cmd.trim()) return;
    setHistory((prev) => {
      const next = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 10);
      localStorage.setItem("omni_history", JSON.stringify(next));
      return next;
    });
  };

  // Draft states...
  const [draftType, setDraftType] = useState<ExerciseType | null>(null);
  const [draftDuration, setDraftDuration] = useState<number | null>(null);
  const [draftIntensity, setDraftIntensity] = useState<
    ExerciseIntensity | null
  >(null);
  const [draftQuantity, setDraftQuantity] = useState<number | null>(null);
  const [draftUnit, setDraftUnit] = useState<string | null>(null);
  const [draftMealType, setDraftMealType] = useState<MealType | null>(null);
  const [draftVitalType, setDraftVitalType] = useState<
    "sleep" | "water" | "coffee" | "nocco" | "energy" | "steps" | null
  >(null);

  // Explicit Manual Mode Flag
  const [isManual, setIsManual] = useState(false);

  const intent = useMemo(() => parseOmniboxInput(query), [query]);

  // Update draft values from intent -> BUT ONLY IF NOT ALREADY MANUALLY EDITED
  useEffect(() => {
    // If query changes, we reset manual mode ONLY if the NEW intent type is different
    // This is tricky. simpler: Reset manual mode only on empty query or completely different intent type logic?
    // Actually, users want "smart defaults" which they then tweak.
    // So we should only update from intent if the user hasn't touched the control for THAT specific field.
    // For simplicity in this fix: Reset manual flag only when query is cleared.
    // When typing, we respect intent. When clicking UI, we set isManual = true.

    if (!isManual) {
      if (intent.type === "exercise") {
        setDraftType(intent.data.exerciseType);
        setDraftDuration(intent.data.duration);
        setDraftIntensity(intent.data.intensity);
      } else if (intent.type === "food") {
        setDraftQuantity(intent.data.quantity || 1);
        setDraftUnit(intent.data.unit || "g");
        setDraftMealType(intent.data.mealType || "snack");
      } else if (intent.type === "weight") {
        setDraftQuantity(intent.data.weight);
      } else if (intent.type === "vitals") {
        setDraftVitalType(intent.data.vitalType);
        setDraftQuantity(intent.data.amount);
      }

      // Sync date from intent if present
      if (intent.date) {
        setSelectedDate(intent.date);
      }
    }
  }, [intent]);

  // Reset everything when query is cleared
  useEffect(() => {
    if (!query) {
      setIsManual(false);
      setDraftType(null);
      setDraftDuration(null);
      setDraftIntensity(null);
      setDraftQuantity(null);
      setDraftUnit(null);
      setDraftMealType(null);
      setDraftVitalType(null);
    }
  }, [query]);

  const foodMatch = useMemo(() => {
    if (intent.type !== "food") return null;
    const q = intent.data.query.toLowerCase();
    // Exact match prioritized
    const exactRecipe = recipes.find((r) => r.name.toLowerCase() === q);
    if (exactRecipe) return { type: "recipe", item: exactRecipe };

    const exactFood = foodItems.find((f) => f.name.toLowerCase() === q);
    if (exactFood) return { type: "foodItem", item: exactFood };

    // Starts with match
    const prefixRecipe = recipes.find((r) =>
      r.name.toLowerCase().startsWith(q)
    );
    if (prefixRecipe) return { type: "recipe", item: prefixRecipe };

    const prefixFood = foodItems.find((f) =>
      f.name.toLowerCase().startsWith(q)
    );
    if (prefixFood) return { type: "foodItem", item: prefixFood };

    return null; // No "direct" match, fallback to search suggestions or manual entry
  }, [intent, foodItems, recipes]);

  // Filter partial matches for suggestions if no exact match
  const suggestions = useMemo(() => {
    if (intent.type !== "food" || foodMatch) return [];
    const q = intent.data.query.toLowerCase();
    if (q.length < 2) return [];

    const foodSuggestions = foodItems
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({ type: "foodItem" as const, item }));

    const recipeSuggestions = recipes
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 2)
      .map((item) => ({ type: "recipe" as const, item }));

    return [...foodSuggestions, ...recipeSuggestions];
  }, [intent, foodItems, recipes, foodMatch]);

  const handleAction = () => {
    const targetDate = selectedDate;

    // Use DRAFT values if they exist (manual override), otherwise fall back to intent data (parsed)
    // logic: const finalVal = draftVal !== null ? draftVal : intentVal

    if (intent.type === "exercise") {
      const type = draftType || intent.data.exerciseType || "other";
      const duration = draftDuration || intent.data.duration || 30;
      const intensity = draftIntensity || intent.data.intensity || "moderate";

      const calories = calculateExerciseCalories(type, duration, intensity);
      addExercise({
        date: targetDate,
        type,
        durationMinutes: duration,
        intensity,
        caloriesBurned: calories,
        subType: intent.data.subType,
        tonnage: intent.data.tonnage,
        notes: intent.data.notes,
        distance: intent.data.distance,
        heartRateAvg: intent.data.heartRateAvg,
        heartRateMax: intent.data.heartRateMax,
      });
      setQuery("");
      if (onAfterAction) setTimeout(onAfterAction, 100);
    } else if (intent.type === "weight") {
      addWeightEntry(draftQuantity || intent.data.weight || 0, targetDate);
      setQuery("");
      if (onAfterAction) setTimeout(onAfterAction, 100);
    } else if (intent.type === "food" && foodMatch) {
      addMealEntry({
        date: targetDate,
        mealType: draftMealType || intent.data.mealType || "snack",
        items: [{
          type: foodMatch.type as any,
          referenceId: foodMatch.item.id,
          servings: draftQuantity || intent.data.quantity || 1,
        }],
      });
      setQuery("");
      if (onAfterAction) setTimeout(onAfterAction, 100);
    } else if (intent.type === "vitals") {
      const vType = draftVitalType || intent.data.vitalType;
      if (!vType) return;

      const amount = draftQuantity || intent.data.amount || 0;
      const currentVitals = getVitalsForDate(targetDate);
      const updates: any = {};

      if (vType === "sleep") {
        updates.sleep = amount;
      } else if (vType === "water") {
        updates.water = (currentVitals.water || 0) + amount;
      } else {
        updates.caffeine = (currentVitals.caffeine || 0) + amount;
        if (vType !== "nocco" && vType !== "energy") {
          // Should coffee count as water? Maybe separately. Kept logic simple for now.
        }
      }

      updateVitals(targetDate, updates);
      setQuery("");
      addToHistory(query);
      updateVitals(targetDate, updates);
      setQuery("");
      if (onAfterAction) setTimeout(onAfterAction, 100);
    }
  };

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAction();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!query && history.length > 0) {
        setQuery(history[0]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      // Move focus to manual input if it exists
      if (manualInputRef.current) {
        manualInputRef.current.focus();
      }
    }
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];
  const isYesterday = selectedDate ===
    new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const getDateLabel = () => {
    if (isToday) return "Idag";
    if (isYesterday) return "Igår";
    return selectedDate;
  };

  // Determine detected category for visual header
  const detectedCategory = useMemo(() => {
    if (intent.type === "food") return "food";
    if (intent.type === "exercise") return "exercise";
    if (intent.type === "vitals") return intent.data.vitalType || "vitals"; // Specific vital type
    return intent.type;
  }, [intent]);

  const catInfo = CATEGORY_LABELS[detectedCategory] || {
    label: "Sök",
    icon: Search,
    color: "slate",
    classes: {
      bg: "bg-slate-50",
      darkBg: "dark:bg-slate-900/20",
      text: "text-slate-600",
      darkText: "dark:text-slate-400",
      border: "border-slate-500",
      icon: "text-slate-500",
    },
  };
  const CategoryIcon = catInfo.icon;

  return (
    <div
      className={`command-center ${isFocused ? "is-active" : ""} ${className}`}
    >
      <div className="omnibox-wrapper relative z-50">
        <button
          className={`date-picker-trigger ${
            !isToday ? "active" : ""
          } flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            isToday
              ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
          }`}
          onClick={() => {
            const newDate = isToday
              ? new Date(Date.now() - 86400000).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0];
            setSelectedDate(newDate);
          }}
        >
          <Calendar size={12} />
          {getDateLabel()}
        </button>

        <div className="omnibox-icon w-8 h-8 flex items-center justify-center text-slate-400">
          <Sparkles size={16} />
        </div>

        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder="Vad vill du logga?"
          className="w-full bg-transparent border-none text-base font-medium placeholder-slate-400 focus:outline-none focus:ring-0 h-12"
          onKeyDown={handleKeyDown}
        />

        <div className="omnibox-shortcut flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
          <CornerDownLeft size={10} />
          RETUR
        </div>
      </div>

      {(query || (isFocused && history.length > 0)) && (
        <div
          className={`suggestion-panel border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-2 duration-200 z-40 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 ${
            overlayMode
              ? "relative border-t mt-0 bg-transparent"
              : "absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border"
          }`}
        >
          {/* Explicit Category Header */}
          <div
            className={`px-4 py-2 ${catInfo.classes.bg} ${catInfo.classes.darkBg} border-l-4 ${catInfo.classes.border} flex items-center justify-between`}
          >
            <div className="flex items-center gap-2">
              <CategoryIcon size={16} className={`${catInfo.classes.icon}`} />
              <span
                className={`text-xs font-bold uppercase tracking-wider ${catInfo.classes.text} ${catInfo.classes.darkText}`}
              >
                {catInfo.label}
              </span>
            </div>
            {isManual && (
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full">
                Manuellt ändrad
              </span>
            )}
          </div>

          {/* HISTORY LIST (If query is empty) */}
          {!query && history.length > 0 && (
            <div className="p-2">
              <div className="text-[10px] font-bold uppercase text-slate-400 px-2 py-1">
                Tidigare
              </div>
              {history.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(cmd)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between group"
                >
                  <span>{cmd}</span>
                  <CornerDownLeft
                    size={12}
                    className="opacity-0 group-hover:opacity-50"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Content Body */}
          {query && (
            <div className="p-4">
              {/* SEARCH / GENERIC */}
              {!["vitals", "exercise", "weight", "food"].includes(
                intent.type,
              ) && (
                <div className="text-center py-4 text-slate-500">
                  <Search size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Söker efter "{query}"...</p>
                  <button
                    className="mt-4 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors"
                    onClick={handleAction}
                  >
                    Sök
                  </button>
                </div>
              )}

              {/* VITALS (Sleep, Water, etc) */}
              {intent.type === "vitals" && (
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center ${catInfo.classes.bg} ${catInfo.classes.darkBg} ${catInfo.classes.text} ${catInfo.classes.darkText} text-3xl`}
                  >
                    <CategoryIcon size={32} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        ref={manualInputRef}
                        type="number"
                        value={draftQuantity || ""}
                        // Removed autoFocus to prevent stealing focus. ArrowDown moves focus here.
                        onChange={(e) => {
                          setDraftQuantity(parseFloat(e.target.value));
                          setIsManual(true);
                        }}
                        className="w-24 text-3xl font-black bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 outline-none text-center"
                        placeholder="0"
                      />
                      <span className="text-sm font-bold text-slate-400 uppercase">
                        {intent.data.vitalType === "sleep" ? "Timmar" : "St"}
                      </span>
                    </div>
                    <button
                      className="text-white bg-slate-900 hover:bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold"
                      onClick={handleAction}
                    >
                      Spara
                    </button>
                  </div>
                </div>
              )}

              {/* EXERCISE */}
              {intent.type === "exercise" && (
                <div className="space-y-4">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {EXERCISE_TYPES.map((t) => (
                      <button
                        key={t.type}
                        onClick={() => {
                          setDraftType(t.type);
                          setIsManual(true);
                        }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all min-w-[70px] ${
                          (draftType || intent.data.exerciseType) === t.type
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="text-2xl">{t.icon}</span>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Flame size={64} />
                    </div>

                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
                        Tid (min)
                      </label>
                      <input
                        ref={manualInputRef}
                        type="number"
                        value={draftDuration || ""}
                        onChange={(e) => {
                          setDraftDuration(parseFloat(e.target.value));
                          setIsManual(true);
                        }}
                        className="w-full text-3xl font-black bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 outline-none"
                        placeholder="30"
                      />

                      {/* Extra Details Row (Km, Ton, HR) */}
                      <div className="flex flex-wrap gap-3 mt-3">
                        {/* Distance (km) */}
                        {(intent.data.distance || draftType === "running") && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300">
                            <MapPin size={12} />
                            <span className="text-xs font-bold">
                              {intent.data.distance
                                ? `${intent.data.distance} km`
                                : "- km"}
                            </span>
                          </div>
                        )}

                        {/* Tonnage (ton) */}
                        {(intent.data.tonnage || draftType === "strength") && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-700 dark:text-purple-300">
                            <Dumbbell size={12} />
                            <span className="text-xs font-bold">
                              {intent.data.tonnage
                                ? `${intent.data.tonnage / 1000} ton`
                                : "- ton"}
                            </span>
                          </div>
                        )}

                        {/* Heart Rate */}
                        {(intent.data.heartRateAvg) && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-700 dark:text-rose-300">
                            <Heart size={12} />
                            <span className="text-xs font-bold">
                              {intent.data.heartRateAvg} bpm
                            </span>
                          </div>
                        )}

                        {/* Pace Calculation Hint */}
                        {intent.data.distance && !draftDuration && (
                          <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400">
                            <span>
                              ~ {Math.round(
                                (intent.data.duration || 30) /
                                  intent.data.distance,
                              )} min/km
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 border-l border-slate-200 dark:border-slate-700 pl-6">
                      <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">
                        Intensitet
                      </label>
                      <div className="flex flex-col gap-1">
                        {INTENSITIES.map((i) => (
                          <button
                            key={i.value}
                            onClick={() => {
                              setDraftIntensity(i.value);
                              setIsManual(true);
                            }}
                            className={`text-xs font-bold text-left px-2 py-1 rounded ${
                              (draftIntensity || intent.data.intensity) ===
                                  i.value
                                ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                                : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            {i.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                    onClick={handleAction}
                  >
                    <span>Logga Träning</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* FOOD */}
              {intent.type === "food" && (
                <div className="space-y-4">
                  {foodMatch
                    ? (
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-4xl shadow-sm">
                          {foodMatch.type === "recipe" ? "🍳" : "🥬"}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                            {foodMatch.item.name}
                          </h3>
                          <div className="flex gap-2 mt-2">
                            <div className="relative group">
                              <input
                                type="number"
                                value={draftQuantity || ""}
                                onChange={(e) => {
                                  setDraftQuantity(parseFloat(e.target.value));
                                  setIsManual(true);
                                }}
                                className="w-16 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-sm font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            </div>
                            <select
                              value={draftUnit || "g"}
                              onChange={(e) => {
                                setDraftUnit(e.target.value);
                                setIsManual(true);
                              }}
                              className="bg-transparent text-sm font-medium text-slate-500 focus:text-slate-800 dark:focus:text-white outline-none cursor-pointer"
                            >
                              <option value="g">g</option>
                              <option value="st">st</option>
                              <option value="ml">ml</option>
                            </select>
                          </div>

                          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 font-medium">
                            <span>
                              🔥 ~{getNutrients(foodMatch).cal *
                                (draftQuantity || 100) / 100} kcal
                            </span>
                            <span>
                              🌱 ~{getNutrients(foodMatch).prot *
                                (draftQuantity || 100) / 100}g prot
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={handleAction}
                          className="h-12 w-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"
                        >
                          <ArrowRight size={20} />
                        </button>
                      </div>
                    )
                    : (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500 mb-2">
                          Ingen exakt träff. Förslag:
                        </p>
                        {suggestions.length > 0
                          ? (
                            suggestions.map((s) => (
                              <button
                                key={s.item.id}
                                onClick={() => {
                                  const newQ = s.item.name + (draftQuantity
                                    ? ` ${draftQuantity}${draftUnit}`
                                    : "");
                                  setQuery(newQ);
                                }}
                                className="w-full p-2 flex items-center gap-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg group-hover:bg-white group-hover:shadow-sm transition-all">
                                  {s.type === "recipe" ? "🍳" : "🥬"}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {s.item.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {s.type === "recipe"
                                      ? "Recept"
                                      : "Livsmedel"}
                                  </div>
                                </div>
                                <ArrowRight
                                  size={14}
                                  className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                              </button>
                            ))
                          )
                          : (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center text-slate-400">
                              <Search
                                size={24}
                                className="mx-auto mb-2 opacity-30"
                              />
                              <p className="text-sm">
                                Inga matchningar hittades i databasen.
                              </p>
                            </div>
                          )}
                      </div>
                    )}
                </div>
              )}
            </div>
          )} {/* End Content Body */}
        </div>
      )}
    </div>
  );
}
