export interface PartnerStats {
  name: string;
  gender: "MALE" | "FEMALE";

  // Abstract Levels (0-100) - Still used for simple mode / fallback
  runLevel: number;
  strengthLevel: number;
  engineLevel: number;

  // Real Metrics (Optional - if provided, levels are calculated from these)
  best5k?: string; // "MM:SS"
  sledPushWeight?: number; // kg for 50m comfortably
  wallBallsUnbroken?: number; // Reps
  burpeePace?: number; // Mins per 1000m (Ski) or just raw score 0-10
}

export type TeamArchetype =
  | "THE_TWIN_TURBOS" // Both fast runners
  | "THE_TOW_TRUCK" // One carries the other
  | "THUNDER_AND_LIGHTNING" // One strong, one fast
  | "THE_GRINDERS" // Both strong/slow
  | "BALANCED_ASSAULT" // Good synergy
  | "CHAOS_CREW"; // Mismatched / Weak

export interface SplitStrategy {
  stationId: string;
  assignedTo: "ME" | "PARTNER";
  rationale: string;
  advantage: number; // 0-100
  fatigueImpact: number; // 0-100
  // v2: Advanced Split
  splitRatio?: number; // 0.6 = 60% for assigned person (if splitting reps)
}

export interface SimulationStep {
  stationId: string;
  startTime: number;
  endTime: number;
  assignedTo: "ME" | "PARTNER" | "BOTH" | "SPLIT";
  energyLevel: number; // Team avg for simplicity
}
