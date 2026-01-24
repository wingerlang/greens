import { HYROX_DB_WORKOUTS } from "./hyrox.ts";
import { COACH_WORKOUTS } from "./coach.ts";
import { WorkoutDefinition } from "../../models/workout.ts";

export const ALL_WORKOUTS: WorkoutDefinition[] = [
  ...HYROX_DB_WORKOUTS,
  ...COACH_WORKOUTS,
];
