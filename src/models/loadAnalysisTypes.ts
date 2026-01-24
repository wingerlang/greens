import { type MuscleGroup } from "./strengthTypes.ts";

export interface WeeklyLoadData {
  week: string; // "v.34" or "2023-W34"
  weekNumber: number;
  year: number;

  // Y-Axis 1: Volume
  effectiveSets: number;
  totalSets: number; // For comparison (optional)

  // Y-Axis 2: Strength
  maxE1RM: number; // The highest e1RM achieved that week
  averageE1RM: number; // The average e1RM of effective sets

  // Metadata
  exerciseCount: number;
}

export type InsightScenario =
  | "PROGRESS" // Scenario A
  | "UNDER_TRAINING" // Scenario B
  | "JUNK_VOLUME" // Scenario C
  | "DETRAINING" // Scenario D
  | "INSUFFICIENT_DATA";

export interface LoadInsight {
  scenario: InsightScenario;
  title: string;
  message: string;
  color: string; // Tailwind class e.g. "text-green-400"
}

export interface SetAnalysis {
  date: string;
  weight: number;
  reps: number;
  e1RM: number;
  referenceMax: number;
  intensityRatio: number;
  isEffective: boolean;
  isWarmup: boolean;
  exerciseName: string;
}
