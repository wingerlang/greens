export type SegmentType =
  | "WARMUP"
  | "INTERVAL"
  | "COOLDOWN"
  | "REST"
  | "RAMP_UP"
  | "RAMP_DOWN";

export interface PaceTarget {
  type: "steady" | "progressive" | "range";
  // Normalized values in seconds per km (for running) or watts/bpm (generic)
  // We store strings for display: "4:00", "4:15-3:59"
  display: string;
  minSeconds?: number;
  maxSeconds?: number;
  value?: number; // for steady
}

export interface RecoveryDefinition {
  type: "distance" | "time" | "variable_list" | "unknown";
  value?: number; // meters or seconds
  unit: "m" | "s" | "min" | "km";
  variableValues?: number[]; // For lists like "500, 400, 300"
}

export interface WorkoutSegment {
  type: SegmentType;
  reps: number;
  work: {
    dist?: number; // meters
    time?: number; // seconds
    pace?: PaceTarget;
  };
  recovery?: RecoveryDefinition;
  originalString: string;
}

export interface ParsedWorkout {
  segments: WorkoutSegment[];
  totalDistance: number;
  classification: "INTERVALS" | "DISTANCE";
  suggestedSubType?: "interval" | "long-run" | "default" | "tempo";
}
