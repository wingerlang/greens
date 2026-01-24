import { ExerciseEntry } from "../models/types.ts";
import { StrengthWorkout } from "../models/strengthTypes.ts";
import {
  ErgStandard,
  ROWING_STANDARDS,
  SKIERG_STANDARDS,
} from "../pages/tools/data/ergStandards.ts";

// ============================================
// Types
// ============================================

export type ErgInterval = "500m" | "1000m" | "2000m" | "5000m";

export interface ErgRecord {
  timeSeconds: number;
  timeString: string;
  distance: number;
  watts?: number;
  pace?: string; // /500m
  date: string;
  level: string;
  sourceType: "cardio" | "strength";
  sourceId: string;
  description: string;
}

// ============================================
// Physics & Math (Concept 2 Model)
// ============================================

export const ErgMath = {
  /**
   * Converts Pace (seconds per 500m) to Watts.
   * Formula: Watts = 2.80 * (Speed_m_s)^3
   * Speed = 500 / Pace_seconds
   */
  paceToWatts: (paceSeconds: number): number => {
    if (!paceSeconds) return 0;
    const speed = 500 / paceSeconds;
    return 2.80 * Math.pow(speed, 3);
  },

  /**
   * Converts Watts to Pace (seconds per 500m).
   * Formula: Pace_seconds = 500 / (Watts / 2.80)^(1/3)
   */
  wattsToPace: (watts: number): number => {
    if (!watts) return 0;
    const speed = Math.pow(watts / 2.80, 1 / 3);
    return 500 / speed;
  },

  /**
   * Formats seconds into MM:SS.s
   */
  formatTime: (seconds: number): string => {
    if (!seconds && seconds !== 0) return "-";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1);
    return `${m}:${s.toString().padStart(4, "0")}`;
  },

  /**
   * Parses MM:SS or MM:SS.s string to seconds
   */
  parseTime: (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    }
    if (parts.length === 3) { // HH:MM:SS
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 +
        parseFloat(parts[2]);
    }
    return parseFloat(timeStr) || 0;
  },

  /**
   * Estimates Cal/hr (Approximation for Concept 2 Monitor)
   * The Formula often cited for C2 is: Cal/hr = 4 * Watts + 300 (approx BMR included)
   * or Cal/hr = 175 + 4 * Watts (Very close to PM3/4/5 behavior for standard weights)
   * Example: 2:00/500m (202.5W) -> ~985 Cal/hr.
   */
  wattsToCalHr: (watts: number): number => {
    // Formula: 175 + 4 * Watts
    // This approximates the total metabolic burn shown on the C2 monitor.
    if (!watts) return 0;
    return Math.round(175 + 4 * watts);
  },
};

// ============================================
// Logic
// ============================================

/**
 * Determines Level based on Time for Distance
 */
export const getErgLevel = (
  seconds: number,
  distance: ErgInterval,
  type: "row" | "ski",
  gender: "male" | "female" = "male",
): string => {
  const standards = type === "row"
    ? ROWING_STANDARDS[gender]
    : SKIERG_STANDARDS[gender];

  // We want the HIGHEST level where user is FASTER (lower time) than standard.
  // Iterating Elite -> Beginner.
  for (const std of standards) {
    const stdTimeStr = std.distances[distance];
    if (stdTimeStr) {
      const stdSeconds = ErgMath.parseTime(stdTimeStr);
      if (seconds <= stdSeconds) {
        return std.level;
      }
    }
  }

  return "-";
};

/**
 * Scans history for best Erg performances
 */
export const analyzeErgPerformance = (
  exerciseEntries: ExerciseEntry[],
  strengthSessions: StrengthWorkout[] = [],
  type: "row" | "ski",
  gender: "male" | "female" = "male",
): Record<ErgInterval, ErgRecord | null> => {
  const keywords = type === "row"
    ? ["row", "rodd", "concept2", "indoor rowing"]
    : ["ski", "skierg", "stakmaskin", "concept2 ski"];

  const targetDistances: { key: ErgInterval; meters: number }[] = [
    { key: "500m", meters: 500 },
    { key: "1000m", meters: 1000 },
    { key: "2000m", meters: 2000 },
    { key: "5000m", meters: 5000 },
  ];

  // Filter Targets based on type (Ski usually 1k, 2k, 5k; Row 500, 1k, 2k, 5k)
  // Actually user asked for 500, 1000, 2000, 5000 for Row.
  // And 1000, 2000, 5000 for Ski.
  const relevantTargets = type === "row"
    ? targetDistances
    : targetDistances.filter((t) => t.key !== "500m");

  const results: Record<string, ErgRecord | null> = {};
  relevantTargets.forEach((t) => results[t.key] = null);

  // 1. Scan Cardio Entries (Summaries)
  const cardioActivities = exerciseEntries.filter((e) => {
    const title = (e.title || "").toLowerCase();
    const notes = (e.notes || "").toLowerCase();
    const entryType = (e.type || "").toLowerCase();

    const isTypeMatch = type === "row"
      ? (entryType === "rowing" || entryType === "indoor_rowing")
      : (entryType === "cross_country_skiing" &&
        (title.includes("erg") || notes.includes("erg"))); // tough for ski erg, relies on title

    const isKeywordMatch = keywords.some((k) =>
      title.includes(k) || notes.includes(k)
    );

    return isTypeMatch || isKeywordMatch;
  });

  cardioActivities.forEach((activity) => {
    if (!activity.distance || !activity.durationMinutes) return;

    const distMeters = activity.distance *
      (activity.distanceUnit === "km" ? 1000 : 1);
    const totalSeconds = activity.durationMinutes * 60;

    // Check if this activity IS a specific distance effort (within tolerance)
    relevantTargets.forEach((target) => {
      // Tolerance: +/- 2% distance or just close enough?
      // Usually people log "2000m row" as exactly 2000m or 2.0km.
      if (Math.abs(distMeters - target.meters) < 50) { // 50m tolerance
        // This IS a target distance effort
        const currentBest = results[target.key];

        // Compare Time (Lower is better)
        if (!currentBest || totalSeconds < currentBest.timeSeconds) {
          results[target.key] = {
            timeSeconds: totalSeconds,
            timeString: ErgMath.formatTime(totalSeconds),
            distance: distMeters,
            watts: ErgMath.paceToWatts(totalSeconds / (distMeters / 500)),
            pace: ErgMath.formatTime(totalSeconds / (distMeters / 500)),
            date: activity.date,
            level: getErgLevel(totalSeconds, target.key, type, gender),
            sourceType: "cardio",
            sourceId: activity.id,
            description: activity.title || "Cardio Session",
          };
        }
      }
    });
  });

  // 2. Scan Strength Sessions (Detailed Sets)
  strengthSessions.forEach((session) => {
    // Filter relevant exercises
    const relevantExercises = session.exercises.filter((ex) => {
      const name = (ex.exerciseName || "").toLowerCase();
      return keywords.some((k) => name.includes(k));
    });

    relevantExercises.forEach((ex) => {
      ex.sets.forEach((set, setIndex) => {
        if (!set.distance) return;

        let setDist = set.distance;
        if (set.distanceUnit === "km") setDist *= 1000;

        const setSeconds = set.timeSeconds ||
          (set.time ? ErgMath.parseTime(set.time) : 0);
        if (setSeconds <= 0) return; // Need time to rank

        relevantTargets.forEach((target) => {
          // Exact match tolerance for sets
          if (Math.abs(setDist - target.meters) < 20) {
            const currentBest = results[target.key];

            if (!currentBest || setSeconds < currentBest.timeSeconds) {
              results[target.key] = {
                timeSeconds: setSeconds,
                timeString: ErgMath.formatTime(setSeconds),
                distance: setDist,
                watts: ErgMath.paceToWatts(setSeconds / (setDist / 500)),
                pace: ErgMath.formatTime(setSeconds / (setDist / 500)),
                date: session.date,
                level: getErgLevel(setSeconds, target.key, type, gender),
                sourceType: "strength",
                sourceId: session.id,
                description: `${session.name} (Set ${set.setNumber})`,
              };
            }
          }
        });
      });
    });
  });

  return results as Record<ErgInterval, ErgRecord | null>;
};
