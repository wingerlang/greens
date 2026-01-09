// ============================================
// Daily Vitality Tracking
// ============================================

import { ActivitySource } from './activity.ts';

/** Daily health and vitality metrics */
export interface DailyVitals {
    water: number;       // Glasses (approx 250ml)
    sleep: number;       // Hours
    caffeine?: number;   // Grams or counts (Coffee/Te/Nocco)
    alcohol?: number;    // Units
    incomplete?: boolean; // If true, this day is marked as unfinished (e.g. forgot to log food)
    completed?: boolean; // If true, this day is explicitly marked as complete/closed
    updatedAt: string;
}

/** Weight and body measurements tracking entry */
export interface WeightEntry {
    id: string;
    date: string; // ISO date string (YYYY-MM-DD)
    weight: number; // kg
    waist?: number; // cm
    chest?: number; // cm
    hips?: number; // cm
    thigh?: number; // cm
    createdAt: string;
}

// ============================================
// Body Measurements (Phase Legacy+)
// ============================================

export type BodyMeasurementType =
    | 'waist'       // Midja
    | 'hips'        // Höft
    | 'chest'       // Bröst
    | 'arm_left'    // Vänster arm
    | 'arm_right'   // Höger arm
    | 'thigh_left'  // Vänster lår
    | 'thigh_right' // Höger lår
    | 'calf_left'   // Vänster vad
    | 'calf_right'  // Höger vad
    | 'neck'        // Nacke
    | 'shoulders'   // Axlar
    | 'forearm_left' // Vänster underarm
    | 'forearm_right'; // Höger underarm

export interface BodyMeasurementEntry {
    id: string;
    date: string; // ISO Date YYYY-MM-DD
    type: BodyMeasurementType;
    value: number; // cm
    notes?: string;
    createdAt: string;
}

// ============================================
// Phase 8: Data Persistence & Deep Integration (Garmin/Strava)
// ============================================

export type SleepStage = 'deep' | 'light' | 'rem' | 'awake';

export interface SleepSession {
    id: string;
    date: string; // YYYY-MM-DD
    startTime: string; // ISO
    endTime: string; // ISO
    durationSeconds: number;
    score?: number; // 0-100
    source: ActivitySource;
    stages?: {
        deepSeconds: number;
        lightSeconds: number;
        remSeconds: number;
        awakeSeconds: number;
    };
    efficiency?: number; // 0-100%
}

export interface IntakeLog {
    id: string;
    userId: string;
    type: 'caffeine' | 'water' | 'alcohol' | 'medication';
    amount: number;
    unit: string;
    timestamp: string; // ISO
    source: ActivitySource;
}


// ============================================
// Phase 9: Physio-AI / Rehab Content
// ============================================

export type BodyPart =
    | 'neck' | 'shoulders' | 'upper_back' | 'lower_back' | 'chest' | 'abs'
    | 'glutes' | 'hips' | 'quads' | 'hamstrings' | 'calves' | 'shins' | 'adductors' | 'abductors'
    | 'knees' | 'ankles' | 'feet'
    | 'biceps' | 'triceps' | 'forearms' | 'wrist' | 'hands';

export type InjuryType = 'pain' | 'soreness' | 'tightness' | 'injury' | 'fatigue';
export type InjuryStatus = 'active' | 'recovering' | 'healed' | 'chronic';
export type PainLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface InjuryLog {
    id: string;
    userId: string;
    date: string; // ISO date
    bodyPart: BodyPart;
    side: 'left' | 'right' | 'both' | 'center';
    type: InjuryType;
    severity: PainLevel;
    status: InjuryStatus;
    notes?: string;

    // Correlated Activity (e.g., "Hände ont efter Marklyft")
    relatedActivityId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RecoveryMetric {
    id: string;
    userId: string;
    date: string;

    // Subjective Scores (1-10)
    sorenessScore: number; // 1 = Fresh, 10 = Broken
    fatigueScore: number;  // 1 = Energetic, 10 = Exhausted
    sleepQuality: number;  // 1 = Terrible, 10 = Perfect
    stressLevel: number;   // 1 = Zen, 10 = Panic
    mood: number;          // 1 = Depressed, 10 = Euphoric

    // Calculated
    readinessScore?: number; // 0-100 (Computed from above + Training Load)

    notes?: string;
}

export interface RehabExercise {
    id: string;
    name: string;
    description: string;
    reps: string; // "3x10" or "2 min"
    videoUrl?: string; // YouTube ID or similar
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface RehabRoutine {
    id: string;
    title: string;
    description: string;
    tags: BodyPart[]; // Which parts this helps
    condition?: InjuryType; // e.g., 'tightness', 'pain'
    exercises: RehabExercise[];
    estimatedDurationMin: number;
}
