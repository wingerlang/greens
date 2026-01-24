import { TrainingLoadData, UniversalActivity } from "../models/types.ts";

// Constants
const CTL_DECAY = 42;
const ATL_DECAY = 7;

/**
 * Calculate Training Stress Score (TSS)
 * Simplified estimation based on time and intensity or HR.
 */
export function calculateTSS(activity: UniversalActivity): number {
  const perf = activity.performance;
  if (!perf) return 0;

  // 1. Use existing HR data if available
  // (This is a simplified model, real TSS requires Threshold Power/HR)
  if (perf.avgHeartRate) {
    // Assume Threshold HR ~ 170 (very rough default)
    // IF = AvgHR / Threshold
    // TSS = (DurationSec * NP * IF) / (Threshold * 3600) * 100
    // Simplified: (DurationMin / 60) * (IntensityFactor^2) * 100

    // Rough Intensity Factor estimation
    // Zone 1: 0.6, Zone 2: 0.7, Zone 3: 0.8, Zone 4: 0.9, Zone 5: 1.0+
    let intensityFactor = 0.6;
    if (perf.avgHeartRate > 150) intensityFactor = 0.8;
    if (perf.avgHeartRate > 170) intensityFactor = 1.0;

    return (perf.durationMinutes / 60) * (intensityFactor * intensityFactor) *
      100;
  }

  // 2. Fallback to "Trimp" or RPE based estimation
  // 1 hour at moderate intensity = 50-60 TSS
  // 1 hour at hard intensity = 80-100 TSS
  // 1 hour easy = 30-40 TSS

  // We can use Strava's 'suffer score' relative if we had it, but we can look at pace/type
  if (perf.source?.source === "strava") {
    const pace = perf.durationMinutes / perf.distanceKm; // min/km
    if (pace < 4.5) return (perf.durationMinutes / 60) * 85; // Fast run
    if (pace < 5.5) return (perf.durationMinutes / 60) * 65; // Moderate
    return (perf.durationMinutes / 60) * 45; // Easy/Long
  }

  return (perf.durationMinutes / 60) * 50; // Default fallback
}

/**
 * Generate Training Load Data from Activities
 */
export function calculateTrainingLoad(
  activities: UniversalActivity[],
  days = 90,
): TrainingLoadData[] {
  // 1. Sort activities chronologically
  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));

  // 2. Map to daily load
  const dailyMap = new Map<
    string,
    { tss: number; distance: number; duration: number }
  >();

  sorted.forEach((a) => {
    if (!a.performance) return;
    const current = dailyMap.get(a.date) ||
      { tss: 0, distance: 0, duration: 0 };
    current.tss += calculateTSS(a);
    current.distance += a.performance.distanceKm;
    current.duration += a.performance.durationMinutes;
    dailyMap.set(a.date, current);
  });

  // 3. Generate Timeline & Metrics
  const result: TrainingLoadData[] = [];
  const now = new Date();
  // Start from [days] ago
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  let prevCtl = 0; // Should ideally load historical starting point
  let prevAtl = 0;

  for (let i = 0; i <= days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];

    const dayData = dailyMap.get(dateStr) ||
      { tss: 0, distance: 0, duration: 0 };
    const tss = dayData.tss;

    // Calculate Exponential Weighted Moving Averages
    // CTL_today = CTL_yesterday + (TSS_today - CTL_yesterday) / 42
    const ctl = prevCtl + (tss - prevCtl) / CTL_DECAY;
    const atl = prevAtl + (tss - prevAtl) / ATL_DECAY;
    const tsb = prevCtl - prevAtl; // TSB is usually based on yesterday's CTL/ATL

    result.push({
      date: dateStr,
      tss: Math.round(tss),
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(tsb),
      distanceKm: Math.round(dayData.distance * 10) / 10,
      durationMinutes: dayData.duration,
      trimp: Math.round(tss * 0.9), // Simple proxy
    });

    prevCtl = ctl;
    prevAtl = atl;
  }

  return result;
}
