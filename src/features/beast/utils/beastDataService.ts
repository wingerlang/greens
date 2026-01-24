import type { ExerciseEntry } from "../../../models/types.ts";
import type { StrengthWorkout } from "../../../models/strengthTypes.ts";
import { calculateWilks } from "../../../utils/strengthCalculators.ts";

export interface BeastStats {
  cooper: {
    distance: number; // meters
    score: number;
    sourceActivityId?: string;
    date?: string;
  };
  strength: {
    squat: number;
    bench: number;
    deadlift: number;
    total: number;
    wilks: number;
    score: number;
    // Source IDs for linking
    squatWorkoutId?: string;
    benchWorkoutId?: string;
    deadliftWorkoutId?: string;
  };
  weightlifting: {
    snatch: number;
    cleanJerk: number;
    total: number;
    sinclair: number;
    score: number;
    // Source IDs for linking
    snatchWorkoutId?: string;
    cleanJerkWorkoutId?: string;
  };
  hyrox: {
    timeSeconds: number;
    score: number;
    date?: string;
    sourceActivityId?: string;
  };
  cycling: {
    ftp: number;
    relativeFtp: number;
    score: number;
    date?: string;
    sourceActivityId?: string;
  };
  totalScore: number;
}

// Name matchers
const MATCHERS = {
  squat: ["knäböj", "squat", "back squat", "back_squat"],
  bench: ["bänkpress", "bench press", "bench_press"],
  deadlift: ["marklyft", "deadlift"],
  snatch: ["ryck", "snatch"],
  cleanJerk: ["stöt", "clean & jerk", "clean and jerk", "clean_and_jerk"],
};

function matches(name: string, queries: string[]): boolean {
  if (!name) return false;
  const n = name.toLowerCase().trim();
  return queries.some((q) => n.includes(q));
}

function getMaxLiftData(
  sessions: StrengthWorkout[],
  matchers: string[],
): { weight: number; workoutId?: string } {
  let max = 0;
  let workoutId: string | undefined;

  sessions.forEach((session) => {
    if (session.excludeFromStats) return; // Skip excluded
    if (!session.exercises) return;

    session.exercises.forEach((ex) => {
      const name = ex.exerciseName || (ex as any).name || "";
      if (matches(name, matchers)) {
        if (ex.sets && Array.isArray(ex.sets)) {
          ex.sets.forEach((set) => {
            if (set.weight && set.weight > max) {
              max = set.weight;
              workoutId = session.id;
            }
          });
        }
      }
    });
  });
  return { weight: max, workoutId };
}

import {
  calculateCooperScore,
  calculateCyclingScore,
  calculateHyroxScore,
  calculateSinclair,
  calculateStrengthScore,
  calculateWeightliftingScore,
} from "./beastCalculators.ts";

export function calculateBeastStats(
  activities: ExerciseEntry[],
  strengthSessions: StrengthWorkout[],
  userWeight: number,
  userGender: "male" | "female" = "male",
): BeastStats {
  // 1. COOPER TEST (Running)
  let bestCooperDist = 0;
  let bestCooperRunId: string | undefined;
  let bestCooperDate: string | undefined;

  activities.forEach((a) => {
    if (a.excludeFromStats) return;
    if (
      a.type === "running" && a.durationMinutes >= 12 && a.distance &&
      a.distance > 0
    ) {
      const distMeters = a.distance * 1000;
      const cooperMeters = (distMeters / a.durationMinutes) * 12;

      if (cooperMeters > bestCooperDist) {
        bestCooperDist = Math.round(cooperMeters);
        bestCooperRunId = a.id;
        bestCooperDate = a.date;
      }
    }
  });

  const cooperScore = calculateCooperScore(bestCooperDist);

  // 2. STRENGTH (Powerlifting)
  const squatData = getMaxLiftData(strengthSessions, MATCHERS.squat);
  const benchData = getMaxLiftData(strengthSessions, MATCHERS.bench);
  const deadliftData = getMaxLiftData(strengthSessions, MATCHERS.deadlift);

  const totalPL = squatData.weight + benchData.weight + deadliftData.weight;
  const strengthScore = calculateStrengthScore(userWeight, totalPL, userGender);

  // 3. WEIGHTLIFTING (Olympic)
  const snatchData = getMaxLiftData(strengthSessions, MATCHERS.snatch);
  const cleanJerkData = getMaxLiftData(strengthSessions, MATCHERS.cleanJerk);

  const totalWL = snatchData.weight + cleanJerkData.weight;
  const wlScore = calculateWeightliftingScore(userWeight, totalWL, userGender);
  const sinclair = calculateSinclair(userWeight, totalWL, userGender);

  // 4. HYROX
  let bestHyroxTime = 0;
  let bestHyroxDate: string | undefined;
  let bestHyroxId: string | undefined;

  activities.forEach((a) => {
    if (a.excludeFromStats) return;

    // Priority 1: Structured Hyrox Stats
    if (a.hyroxStats?.totalTime) {
      if (bestHyroxTime === 0 || a.hyroxStats.totalTime < bestHyroxTime) {
        bestHyroxTime = a.hyroxStats.totalTime;
        bestHyroxDate = a.date;
        bestHyroxId = a.id;
      }
    } // Priority 2: Manual "Hyrox" typed activity
    else if (
      a.type === "hyrox" as any || a.title?.toLowerCase().includes("hyrox")
    ) {
      const timeSec = (a.durationMinutes || 0) * 60;
      if (timeSec > 0 && (bestHyroxTime === 0 || timeSec < bestHyroxTime)) {
        bestHyroxTime = timeSec;
        bestHyroxDate = a.date;
        bestHyroxId = a.id;
      }
    }
  });

  const hyroxScore = calculateHyroxScore(bestHyroxTime);

  // 5. CYCLING (FTP)
  let bestFtp = 0;
  let bestFtpDate: string | undefined;
  let bestFtpId: string | undefined;

  activities.forEach((a) => {
    if (a.excludeFromStats) return;

    const ftpValue = a.averageWatts || 0; // Fallback to average watts if no explicit FTP
    // But better: Look for Max Watts or systematic FTP entries if they exist
    // For now, let's use the best 20-min average or explicit FTP if we had it.
    // If it's a cycling activity and has power:
    if (a.type === "cycling" && a.averageWatts && a.averageWatts > bestFtp) {
      bestFtp = a.averageWatts;
      bestFtpDate = a.date;
      bestFtpId = a.id;
    }
  });

  const relFtp = userWeight > 0 ? bestFtp / userWeight : 0;
  const cyclingScore = calculateCyclingScore(relFtp);

  return {
    cooper: {
      distance: bestCooperDist,
      score: cooperScore,
      sourceActivityId: bestCooperRunId,
      date: bestCooperDate,
    },
    strength: {
      squat: squatData.weight,
      bench: benchData.weight,
      deadlift: deadliftData.weight,
      total: totalPL,
      wilks: calculateWilks(userWeight, totalPL, userGender),
      score: strengthScore,
      squatWorkoutId: squatData.workoutId,
      benchWorkoutId: benchData.workoutId,
      deadliftWorkoutId: deadliftData.workoutId,
    },
    weightlifting: {
      snatch: snatchData.weight,
      cleanJerk: cleanJerkData.weight,
      total: totalWL,
      sinclair: sinclair,
      score: wlScore,
      snatchWorkoutId: snatchData.workoutId,
      cleanJerkWorkoutId: cleanJerkData.workoutId,
    },
    hyrox: {
      timeSeconds: bestHyroxTime,
      score: hyroxScore,
      date: bestHyroxDate,
      sourceActivityId: bestHyroxId,
    },
    cycling: {
      ftp: bestFtp,
      relativeFtp: relFtp,
      score: cyclingScore,
      date: bestFtpDate,
      sourceActivityId: bestFtpId,
    },
    totalScore: Math.round(
      (cooperScore + strengthScore + wlScore + hyroxScore + cyclingScore) / 5,
    ),
  };
}
