import {
  PartnerStats,
  SimulationStep,
  SplitStrategy,
  TeamArchetype,
} from "./DuoLabTypes.ts";

// ------------------------------------------------------------------
// CALIBRATION LOGIC
// ------------------------------------------------------------------
export function calculateLevelsFromRealStats(
  stats: PartnerStats,
): PartnerStats {
  const newStats = { ...stats };

  // 1. Run Level from 5k Time (Format "MM:SS")
  if (stats.best5k) {
    const parts = stats.best5k.split(":");
    if (parts.length === 2) {
      const min = parseInt(parts[0]);
      const sec = parseInt(parts[1]);
      const totalSec = min * 60 + sec;

      // Scale: 15:00 (900s) = 100, 35:00 (2100s) = 0
      // Linear interpolation
      const maxScoreSec = 900; // 15 mins
      const minScoreSec = 2100; // 35 mins

      let lvl = 100 -
        ((totalSec - maxScoreSec) / (minScoreSec - maxScoreSec)) * 100;
      newStats.runLevel = Math.min(100, Math.max(0, Math.round(lvl)));
    }
  }

  // 2. Strength Level from Wall Balls (Unbroken max reps)
  // Scale: 100 reps = 100, 20 reps = 20
  if (stats.wallBallsUnbroken) {
    newStats.strengthLevel = Math.min(
      100,
      Math.max(0, stats.wallBallsUnbroken),
    );
  }

  // 3. Engine Level from Burpee Pace (mins per 1000m Ski? No, let's use a 1-10 scale input for now or raw burpees)
  // For now, if user provides burpeePace (0-10 scale where 10 is fast)
  if (stats.burpeePace) {
    newStats.engineLevel = Math.min(100, Math.max(0, stats.burpeePace * 10));
  }

  return newStats;
}

// ------------------------------------------------------------------
// ARCHETYPE DETECTION
// ------------------------------------------------------------------
export function detectArchetype(
  p1: PartnerStats,
  p2: PartnerStats,
): TeamArchetype {
  const runDiff = Math.abs(p1.runLevel - p2.runLevel);
  const strDiff = Math.abs(p1.strengthLevel - p2.strengthLevel);
  const engDiff = Math.abs(p1.engineLevel - p2.engineLevel);

  const avgRun = (p1.runLevel + p2.runLevel) / 2;
  const avgStr = (p1.strengthLevel + p2.strengthLevel) / 2;

  if (p1.runLevel > 80 && p2.runLevel > 80) return "THE_TWIN_TURBOS";

  // One is significantly better at everything?
  const p1Score = p1.runLevel + p1.strengthLevel + p1.engineLevel;
  const p2Score = p2.runLevel + p2.strengthLevel + p2.engineLevel;
  if (Math.abs(p1Score - p2Score) > 60) return "THE_TOW_TRUCK";

  // Complementary?
  if (
    (p1.runLevel > p2.runLevel + 15 &&
      p2.strengthLevel > p1.strengthLevel + 15) ||
    (p2.runLevel > p1.runLevel + 15 && p1.strengthLevel > p2.strengthLevel + 15)
  ) {
    return "THUNDER_AND_LIGHTNING";
  }

  if (avgStr > 75 && avgRun < 60) return "THE_GRINDERS";

  if (runDiff < 15 && strDiff < 15 && engDiff < 15 && avgRun > 60) {
    return "BALANCED_ASSAULT";
  }

  return "CHAOS_CREW";
}

// ------------------------------------------------------------------
// ADVANCED SPLIT OPTIMIZER
// ------------------------------------------------------------------
export function optimizeSplits(
  p1: PartnerStats,
  p2: PartnerStats,
  config: { transitionPenalty: number },
): SplitStrategy[] {
  const stations = [
    { id: "ski", type: "engine" },
    { id: "sled_push", type: "strength" },
    { id: "sled_pull", type: "strength" },
    { id: "bbj", type: "engine" },
    { id: "row", type: "engine" },
    { id: "farmers", type: "strength" },
    { id: "lunges", type: "strength" },
    { id: "wb", type: "strength" },
  ];

  let p1Fatigue = 0;
  let p2Fatigue = 0;

  return stations.map((s) => {
    // Base Capability
    let s1 = s.type === "strength" ? p1.strengthLevel : p1.engineLevel;
    let s2 = s.type === "strength" ? p2.strengthLevel : p2.engineLevel;

    // Gender Normalization (if mixed)
    if (p1.gender === "MALE") s1 += 5;
    if (p2.gender === "MALE") s2 += 5;

    // Apply Fatigue (Cumulative)
    const s1Eff = s1 - p1Fatigue;
    const s2Eff = s2 - p2Fatigue;

    // Decision
    // Logic: Who is relatively stronger right now?
    const diff = s1Eff - s2Eff;
    const assignedTo = diff >= 0 ? "ME" : "PARTNER";

    // Update Fatigue for next station
    // The one working gets tired, the one resting recovers.
    if (assignedTo === "ME") {
      p1Fatigue += 10;
      p2Fatigue = Math.max(0, p2Fatigue - 5);
    } else {
      p2Fatigue += 10;
      p1Fatigue = Math.max(0, p1Fatigue - 5);
    }

    return {
      stationId: s.id,
      assignedTo,
      rationale: `Effective score: ${
        assignedTo === "ME" ? s1Eff.toFixed(0) : s2Eff.toFixed(0)
      } vs ${assignedTo === "ME" ? s2Eff.toFixed(0) : s1Eff.toFixed(0)}`,
      advantage: Math.abs(diff),
      fatigueImpact: assignedTo === "ME" ? p1Fatigue : p2Fatigue,
    };
  });
}

// ------------------------------------------------------------------
// MAGIC MILE PREDICTOR (DOUBLES)
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// SIMULATION & PREDICTION
// ------------------------------------------------------------------

export interface SimulationResult {
  totalTime: number;
  trace: SimulationStep[];
}

export function simulateRace(
  p1: PartnerStats,
  p2: PartnerStats,
  archetype: TeamArchetype,
): SimulationResult {
  const trace: SimulationStep[] = [];
  let currentTime = 0;

  // Stations array representing a full Hyrox race
  const stations = [
    "Run 1 (1km)",
    "Ski Erg",
    "Run 2 (1km)",
    "Sled Push",
    "Run 3 (1km)",
    "Sled Pull",
    "Run 4 (1km)",
    "Burpees",
    "Run 5 (1km)",
    "Row",
    "Run 6 (1km)",
    "Farmers",
    "Run 7 (1km)",
    "Lunges",
    "Run 8 (1km)",
    "Wall Balls",
  ];

  let p1Energy = p1.engineLevel;
  let p2Energy = p2.engineLevel;

  stations.forEach((station) => {
    const isRun = station.includes("Run");
    let sectorDuration = 0;
    let p1Active = false;
    let p2Active = false;

    if (isRun) {
      // Running: Both active
      p1Active = true;
      p2Active = true;

      // Pace Calc (sec/km) - 100 level = 3:30 (210s), 0 level = 7:00 (420s)
      const p1Pace = 420 - (p1.runLevel * 2.1);
      const p2Pace = 420 - (p2.runLevel * 2.1);

      // Group pace is dictated by the slower runner (plus a small drag factor)
      sectorDuration = Math.max(p1Pace, p2Pace) + 5;

      // Fatigue
      p1Energy = Math.max(10, p1Energy - 3);
      p2Energy = Math.max(10, p2Energy - 3);
    } else {
      // Station: Split logic based on strengths
      // Identify station type
      const isStrength = station.includes("Sled") ||
        station.includes("Lunges") || station.includes("Farmers") ||
        station.includes("Wall");

      const p1Ability = isStrength ? p1.strengthLevel : p1.engineLevel;
      const p2Ability = isStrength ? p2.strengthLevel : p2.engineLevel;

      // Work Ratio (Simple heuristic for simulation)
      // If P1 is much stronger, they do more.
      const totalAbility = p1Ability + p2Ability;
      const p1Share = p1Ability / totalAbility; // e.g. 0.6

      p1Active = p1Share > 0.55;
      p2Active = p1Share <= 0.55;
      if (Math.abs(p1Share - 0.5) < 0.05) { // Close match? Both work (split sets)
        p1Active = true;
        p2Active = true;
      }

      // Base time for station (avg 4 mins / 240s for weak, 3 mins / 180s for strong)
      // 200 totalAbility => 3 mins. 100 total => 5 mins.
      sectorDuration = 300 - (totalAbility * 0.6);

      // Archetype Bonuses
      if (
        archetype === "THUNDER_AND_LIGHTNING" &&
        Math.abs(p1Ability - p2Ability) > 30
      ) sectorDuration *= 0.9; // Efficient specialist usage
      if (archetype === "THE_TOW_TRUCK" && (p1Ability > 80 || p2Ability > 80)) {
        sectorDuration *= 0.95;
      }

      // Fatigue
      if (p1Active) p1Energy = Math.max(5, p1Energy - (isStrength ? 8 : 12));
      if (p2Active) p2Energy = Math.max(5, p2Energy - (isStrength ? 8 : 12));
      if (!p1Active) p1Energy = Math.min(100, p1Energy + 5); // Recovery
      if (!p2Active) p2Energy = Math.min(100, p2Energy + 5);
    }

    trace.push({
      stationId: station,
      startTime: currentTime,
      endTime: currentTime + sectorDuration,
      assignedTo: p1Active && p2Active ? "BOTH" : (p1Active ? "ME" : "PARTNER"),
      energyLevel: (p1Energy + p2Energy) / 2, // Average team energy for simplified chart
    });

    currentTime += sectorDuration;
  });

  return { totalTime: currentTime, trace };
}

export function predictDoublesTime(
  p1: PartnerStats,
  p2: PartnerStats,
  archetype: TeamArchetype,
): number {
  return simulateRace(p1, p2, archetype).totalTime;
}
