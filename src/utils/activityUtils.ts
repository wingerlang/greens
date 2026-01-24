import { UniversalActivity } from "../models/types.ts";

/**
 * Shared Activity Utilities
 */

/**
 * Checks if an activity is a competition.
 */
export function isCompetition(activity: UniversalActivity | any): boolean {
  const title = (activity.plan?.title || activity.name || "").toLowerCase();
  const notes = (activity.performance?.notes || activity.notes || "")
    .toLowerCase();
  const isRacePlanned = !!activity.plan?.isRace ||
    activity.plan?.category === "RACE";
  const isRaceActual = activity.subType === "race" || activity.isRace === true;

  const raceKeywords = [
    "tävling",
    " race",
    "lopp",
    "competition",
    "marathon",
    "maraton",
    "halvmarathon",
    "halvmaraton",
  ];
  const matchesKeyword = raceKeywords.some((kw) =>
    title.includes(kw) || notes.includes(kw)
  );

  return isRacePlanned || isRaceActual || matchesKeyword;
}

/**
 * Formats seconds into human-readable time (H:MM:SS or M:SS).
 */
export function formatTime(seconds: number): string {
  if (seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parses time string (MM:SS or H:MM:SS) into seconds.
 */
export function parseTimeInSeconds(timeStr?: string): number {
  if (!timeStr || timeStr === "-") return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

/**
 * Detects running PBs for common distances.
 */
export function detectRunningPBs(activities: (UniversalActivity | any)[]) {
  const pbs = {
    best5k: { time: "-", date: "-", id: "" },
    best10k: { time: "-", date: "-", id: "" },
    bestHalf: { time: "-", date: "-", id: "" },
    bestFull: { time: "-", date: "-", id: "" },
    longestRun: { dist: 0, time: "-", date: "-" },
    competitions: 0,
  };

  activities.forEach((a) => {
    // Extract type, distance and time regardless of object structure
    const type = (a.performance?.activityType || a.type || "").toLowerCase();
    if (type !== "running" && type !== "löpning") return;

    const dist = a.performance?.distanceKm || a.distance || 0;
    let time = a.performance?.elapsedTimeSeconds ||
      (a.performance?.durationMinutes ? a.performance.durationMinutes * 60 : 0);

    if (!time && (a.duration || a.durationMinutes)) {
      time = (a.duration || a.durationMinutes) * (a.durationMinutes ? 60 : 1);
    }

    if (isCompetition(a)) {
      pbs.competitions++;
    }

    // Longest
    if (dist > pbs.longestRun.dist) {
      pbs.longestRun = { dist, time: formatTime(time), date: a.date };
    }

    // Simple distance-based PB detection
    const ranges = [
      { key: "best5k", min: 4.85, max: 5.35 },
      { key: "best10k", min: 9.7, max: 10.7 },
      { key: "bestHalf", min: 20.7, max: 21.7 },
      { key: "bestFull", min: 41.5, max: 43.5 },
    ];

    ranges.forEach((r) => {
      if (dist >= r.min && dist <= r.max) {
        const currentBestSec = parseTimeInSeconds((pbs as any)[r.key].time) ||
          9999999;
        if (time < currentBestSec && time > 0) {
          (pbs as any)[r.key] = {
            time: formatTime(time),
            date: a.date,
            id: a.id,
          };
        }
      }
    });
  });

  return pbs;
}
