/**
 * Running Calculator Utility
 * Implements deterministic formulas: VDOT (Jack Daniels) and Karvonen (HR)
 */

/**
 * Calculates VDOT score from a race result
 * Formula based on Jack Daniels' Running Formula
 * @param distanceKm - Race distance in km
 * @param timeSeconds - Race time in seconds
 */
export function calculateVDOT(distanceKm: number, timeSeconds: number): number {
  const distanceMeters = distanceKm * 1000;
  const timeMinutes = timeSeconds / 60;
  const velocity = distanceMeters / timeMinutes; // m/min

  // VO2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity^2
  const vo2 = -4.60 + (0.182258 * velocity) +
    (0.000104 * Math.pow(velocity, 2));

  // % Max = 0.8 + 0.1894393 * e^(-0.0115 * time) + 0.2989558 * e^(-0.1932605 * time)
  const pctMax = 0.8 +
    0.1894393 * Math.exp(-0.0115 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  return Math.round((vo2 / pctMax) * 10) / 10;
}

/**
 * Predicts VDOT after weight change
 * Simple linear model: VO2max is loosely related to body mass (O2 per kg)
 */
export function predictWeightAdjustedVDOT(
  currentVDOT: number,
  currentWeight: number,
  targetWeight: number,
): number {
  if (targetWeight <= 0 || currentWeight <= 0) return currentVDOT;
  // VO2max (absolute) = currentVDOT * currentWeight
  // New VDOT (relative) = absoluteVO2 / targetWeight
  const ratio = currentWeight / targetWeight;
  return Math.round(currentVDOT * ratio * 10) / 10;
}

/**
 * Assesses if a goal is reachable
 * Returns a probability score (0-1)
 */
export function assessGoalFeasibility(
  currentVDOT: number,
  targetVDOT: number,
  weeksLeft: number,
): {
  probability: number;
  gap: number;
  neededWeeklyImprovement: number;
} {
  const gap = targetVDOT - currentVDOT;
  if (gap <= 0) return { probability: 1, gap: 0, neededWeeklyImprovement: 0 };

  // Standard progression is roughly 0.5 to 1.5 VDOT per 4-week block
  const maxSafeProgressionPerWeek = 0.25;
  const neededWeeklyImprovement = gap / Math.max(1, weeksLeft);

  let probability = 1 -
    (neededWeeklyImprovement / (maxSafeProgressionPerWeek * 2));
  probability = Math.max(0, Math.min(1, probability));

  return { probability, gap, neededWeeklyImprovement };
}

/**
 * Calculates training paces from a VDOT score using the Jack Daniels formulas.
 * Translates VDOT to velocity and then to pace.
 */
export function getPaceZones(vdot: number) {
  // Helper to get velocity (m/min) from VO2 (ml/kg/min)
  // Quadratic: 0.000104 * v^2 + 0.182258 * v - (4.60 + VO2) = 0
  const getVelocity = (vo2: number) => {
    const a = 0.000104;
    const b = 0.182258;
    const c = -(4.60 + vo2);
    return (-b + Math.sqrt(Math.pow(b, 2) - 4 * a * c)) / (2 * a);
  };

  const vo2Max = vdot;

  // Intensities defined by Jack Daniels
  const paces = {
    easy: 1000 / getVelocity(vo2Max * 0.70), // 70% VO2Max
    marathon: 1000 / getVelocity(vo2Max * 0.80), // 80% VO2Max
    threshold: 1000 / getVelocity(vo2Max * 0.88), // 88% VO2Max
    interval: 1000 / getVelocity(vo2Max * 0.97), // 97% VO2Max
    repetition: 1000 / getVelocity(vo2Max * 1.05), // 105% VO2Max
  };

  return paces;
}

/**
 * Formats decimal pace (min/km) to "MM:SS" string
 */
export function formatPace(decimalPace: number): string {
  if (!decimalPace || !isFinite(decimalPace)) return "—";
  let mins = Math.floor(decimalPace);
  let secs = Math.round((decimalPace - mins) * 60);
  // Handle edge case where rounding gives 60 seconds
  if (secs >= 60) {
    mins += 1;
    secs = 0;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats seconds into "H:MM:SS" or "MM:SS"
 */
export function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${
      s.toString().padStart(2, "0")
    }`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Predicts race time for a given distance and VDOT
 * Uses iterative approach to find time where VO2(velocity) = VDOT * pctMax(time)
 */
export function predictRaceTime(vdot: number, distanceKm: number): number {
  // Initial guess: assume 5 min/km
  let timeMinutes = distanceKm * 5;

  for (let i = 0; i < 10; i++) {
    const velocity = (distanceKm * 1000) / timeMinutes;
    const vo2 = -4.60 + (0.182258 * velocity) +
      (0.000104 * Math.pow(velocity, 2));
    const pctMax = 0.8 +
      0.1894393 * Math.exp(-0.0115 * timeMinutes) +
      0.2989558 * Math.exp(-0.1932605 * timeMinutes);

    // Adjust time based on error
    const targetVO2 = vdot * pctMax;
    if (Math.abs(vo2 - targetVO2) < 0.01) break;

    // Simple proportional adjustment
    timeMinutes = timeMinutes * (vo2 / targetVO2);
  }

  return timeMinutes * 60;
}

/**
 * Karvonen Formula for HR Zones
 */
export function calculateHrZone(
  maxHr: number,
  restingHr: number,
  intensity: number,
): number {
  const reserve = maxHr - restingHr;
  return Math.round(reserve * intensity + restingHr);
}

export function getAllHrZones(maxHr: number, restingHr: number) {
  return {
    z1: {
      min: calculateHrZone(maxHr, restingHr, 0.50),
      max: calculateHrZone(maxHr, restingHr, 0.60),
    },
    z2: {
      min: calculateHrZone(maxHr, restingHr, 0.60),
      max: calculateHrZone(maxHr, restingHr, 0.70),
    },
    z3: {
      min: calculateHrZone(maxHr, restingHr, 0.70),
      max: calculateHrZone(maxHr, restingHr, 0.80),
    },
    z4: {
      min: calculateHrZone(maxHr, restingHr, 0.80),
      max: calculateHrZone(maxHr, restingHr, 0.90),
    },
    z5: {
      min: calculateHrZone(maxHr, restingHr, 0.90),
      max: calculateHrZone(maxHr, restingHr, 1.00),
    },
  };
}

// --- New Tool Functions ---

/**
 * Converts pace (seconds/km) to total time (seconds) for a given distance.
 */
export function convertPaceToTime(
  distanceKm: number,
  paceSecondsPerKm: number,
): number {
  return distanceKm * paceSecondsPerKm;
}

/**
 * Converts total time (seconds) to pace (seconds/km).
 */
export function convertTimeToPace(
  distanceKm: number,
  totalSeconds: number,
): number {
  if (distanceKm <= 0) return 0;
  return totalSeconds / distanceKm;
}

/**
 * Calculates distance (km) given time and pace.
 */
export function calculateDistance(
  totalSeconds: number,
  paceSecondsPerKm: number,
): number {
  if (paceSecondsPerKm <= 0) return 0;
  return totalSeconds / paceSecondsPerKm;
}

export interface CardioInput {
  weightKg?: number;
  speedKph?: number; // for running
  powerWatts?: number; // for cycling
}

/**
 * Estimates calories burned for running or cycling.
 * Running: Based on weight and distance.
 * Cycling: Based on power (Watts) and time.
 */
export function estimateCardioCalories(
  type: "running" | "cycling",
  durationSeconds: number,
  input: CardioInput,
): number {
  const durationHours = durationSeconds / 3600;

  if (type === "running") {
    // Rule of thumb: 1 kcal per kg per km
    // Distance = Speed * Time
    if (!input.weightKg || !input.speedKph) return 0;
    const distanceKm = input.speedKph * durationHours;
    return Math.round(input.weightKg * distanceKm);
  }

  if (type === "cycling") {
    // Power (Watts) -> Joules -> Kcal
    // 1 Watt = 1 Joule/second
    // Total Joules = Watts * seconds
    if (!input.powerWatts) return 0;
    const totalJoules = input.powerWatts * durationSeconds;
    const kCalOutput = totalJoules / 4184; // 1 kcal = 4184 J

    // Human efficiency on bike is approx 20-25%. We use 24%.
    // Gross Energy = Work / Efficiency
    const grossKcal = kCalOutput / 0.24;
    return Math.round(grossKcal);
  }

  return 0;
}

/**
 * Predicts race time using Riegel's formula: T2 = T1 * (D2 / D1)^1.06
 */
export function calculateRiegelTime(
  currentSeconds: number,
  currentDistKm: number,
  targetDistKm: number,
): number {
  if (currentDistKm <= 0 || targetDistKm <= 0) return 0;
  // T2 = T1 * (D2 / D1)^1.06
  return Math.round(
    currentSeconds * Math.pow(targetDistKm / currentDistKm, 1.06),
  );
}

/**
 * Estimates VO2Max from Cooper test distance (meters).
 */
export function calculateCooperVO2(distanceMeters: number): number {
  // (Distance - 504.9) / 44.73
  const vo2 = (distanceMeters - 504.9) / 44.73;
  return Math.max(0, Math.round(vo2 * 10) / 10);
}

/**
 * @deprecated Use `src/pages/tools/data/cooperStandards.ts` for detailed grading.
 */
export function getCooperGrade(
  distanceMeters: number,
  age: number,
  gender: "male" | "female",
): string {
  // Simplified grading logic
  // Using widely available standard tables roughly

  // Male
  if (gender === "male") {
    if (age < 30) {
      if (distanceMeters > 2800) return "Excellent";
      if (distanceMeters > 2400) return "Good";
      if (distanceMeters > 2200) return "Average";
      if (distanceMeters > 1600) return "Bad";
      return "Very Bad";
    } else if (age < 50) {
      if (distanceMeters > 2700) return "Excellent";
      if (distanceMeters > 2300) return "Good";
      if (distanceMeters > 2100) return "Average";
      if (distanceMeters > 1500) return "Bad";
      return "Very Bad";
    } else {
      if (distanceMeters > 2500) return "Excellent";
      if (distanceMeters > 2100) return "Good";
      if (distanceMeters > 1900) return "Average";
      if (distanceMeters > 1300) return "Bad";
      return "Very Bad";
    }
  } // Female
  else {
    if (age < 30) {
      if (distanceMeters > 2700) return "Excellent";
      if (distanceMeters > 2200) return "Good";
      if (distanceMeters > 1800) return "Average";
      if (distanceMeters > 1500) return "Bad";
      return "Very Bad";
    } else if (age < 50) {
      if (distanceMeters > 2500) return "Excellent";
      if (distanceMeters > 2000) return "Good";
      if (distanceMeters > 1700) return "Average";
      if (distanceMeters > 1400) return "Bad";
      return "Very Bad";
    } else {
      if (distanceMeters > 2300) return "Excellent";
      if (distanceMeters > 1900) return "Good";
      if (distanceMeters > 1500) return "Average";
      if (distanceMeters > 1100) return "Bad";
      return "Very Bad";
    }
  }
}
