// ============================================
// Training & Exercise
// ============================================

import { PerformanceGoalType, GoalPeriod, GoalCategory, GoalStatus } from './goals.ts';

/** Training goals for calorie adjustments */
export type TrainingGoal = 'neutral' | 'deff' | 'bulk';

export interface TrainingCycle {
    id: string;
    name: string;
    goal: TrainingGoal;
    startDate: string;
    endDate?: string;
    startWeight?: number;
    targetWeight?: number;
    notes?: string;
}

/** Available exercise categories */
export type ExerciseType =
    | 'running'
    | 'cycling'
    | 'strength'
    | 'walking'
    | 'swimming'
    | 'yoga'
    | 'other';

/** Intensity levels for exercise */
export type ExerciseIntensity = 'low' | 'moderate' | 'high' | 'ultra';

/** Available sub-types for deep exercise analysis */
export type ExerciseSubType = 'default' | 'interval' | 'long-run' | 'race' | 'tonnage' | 'ultra' | 'competition';

export type HyroxStation =
    | 'ski_erg'
    | 'sled_push'
    | 'sled_pull'
    | 'burpee_broad_jumps'
    | 'rowing'
    | 'farmers_carry'
    | 'sandbag_lunges'
    | 'wall_balls'
    | 'run_1km';

export interface HyroxActivityStats {
    totalTime?: number;
    stations?: Partial<Record<HyroxStation, number>>; // time in seconds
    runSplits?: number[]; // 8 x 1km splits
}

/** Exercise tracking entry */
export interface ExerciseEntry {
    id: string;
    date: string; // ISO date string (YYYY-MM-DD)
    type: ExerciseType;
    durationMinutes: number;
    intensity: ExerciseIntensity;
    caloriesBurned: number;
    notes?: string;
    excludeFromStats?: boolean;
    elapsedTimeSeconds?: number;
    subType?: ExerciseSubType;
    title?: string; // e.g. "Morning Run" or "Strava Activity Title"
    tonnage?: number;   // total kg lifted
    // Cycling / Performance
    averageWatts?: number;
    maxWatts?: number;
    averageSpeed?: number; // km/h
    distance?: number;  // km
    createdAt: string;
    source?: string;
    // Integration fields (Strava/Garmin)
    externalId?: string;          // e.g., "strava_123456"
    overridesActivityId?: string; // ID of activity this manual entry supersedes (e.g., to "tag" a Strava activity locally)
    platform?: 'strava' | 'garmin';
    heartRateAvg?: number;
    heartRateMax?: number;
    elevationGain?: number;       // meters
    prCount?: number;
    kudosCount?: number;
    achievementCount?: number;
    maxSpeed?: number;
    kilojoules?: number;

    // Hyrox Specifics (Phase 8)
    hyroxStats?: HyroxActivityStats;
}

/**
 * Raw Strava activity from API
 */
export interface StravaActivity {
    id: number;
    name: string;
    type: string;
    sport_type: string;
    start_date: string;
    start_date_local: string;
    elapsed_time: number;      // seconds
    moving_time: number;       // seconds
    distance: number;          // meters
    total_elevation_gain: number; // meters
    average_heartrate?: number;
    max_heartrate?: number;
    calories?: number;
    average_speed: number;     // m/s
    max_speed: number;         // m/s
    has_heartrate: boolean;
    pr_count: number;
    kudos_count: number;
    achievement_count: number;
    excludeFromStats?: boolean;
}

// ============================================
// Universal Activity Model (Database Overhaul)
// ============================================

export type ActivityStatus = 'PLANNED' | 'COMPLETED' | 'SKIPPED' | 'MISSED';
export type DataSource = 'strava' | 'garmin' | 'apple_health' | 'manual' | 'unknown' | 'strength';
export type ActivitySource = DataSource;

/**
 * The Data Source for a specific part of the activity.
 * e.g., Plan came from "Coach", Performance came from "Strava"
 */
export interface DataSourceInfo {
    source: DataSource;
    externalId?: string;
    importedAt?: string;
}

/**
 * Phase 1: The Plan
 * Defines what was intended to be done.
 */
export interface ActivityPlanSection {
    // Core Identity
    title: string;
    description?: string;
    activityType: ExerciseType; // 'running', 'cycling', etc.
    activityCategory?: PlannedActivity['category']; // 'LONG_RUN', 'INTERVALS' etc.

    // Usage in Coach Logic
    templateId?: string; // If this came from a reusable plan template
    trainingPlanId?: string; // ID of the specific active plan instance

    // Planned Metrics
    distanceKm: number;
    durationMinutes?: number;
    targetPace?: string;   // e.g. "5:30/km"
    targetHrZone?: number; // 1-5

    // Structured Workout Data
    structure?: {
        warmupKm: number;
        mainSet: { reps: number; distKm: number; pace: string; restMin: number }[];
        cooldownKm: number;
    };
}

/**
 * Phase 2: The Performance (Execution)
 * Defines what was actually done.
 */
export interface ActivityPerformanceSection {
    // Provenance
    source?: DataSourceInfo;

    // Core Metrics
    activityType?: ExerciseType; // Captures actual performed type (e.g. walked instead of ran)
    durationMinutes: number;
    elapsedTimeSeconds?: number;
    distanceKm?: number;
    calories: number;
    excludeFromStats?: boolean;

    // Physiological
    avgHeartRate?: number;
    maxHeartRate?: number;
    elevationGain?: number;

    // Cycling / Advanced
    averageWatts?: number;
    maxWatts?: number;
    averageSpeed?: number; // km/h
    maxSpeed?: number;     // km/h
    kilojoules?: number;
    kudosCount?: number;
    achievementCount?: number;

    // Qualitative (RPE/Feel) - Moved to Analysis or here?
    // Usually RPE is subjective 'performance' data.
    rpe?: number; // 1-10
    feel?: 'good' | 'average' | 'bad';
    notes?: string;
    subType?: ExerciseSubType;
    splits?: Array<{
        split: number;
        distance: number;
        elapsedTime: number;
        movingTime: number;
        elevationDiff: number;
        averageSpeed: number;
        averageHeartrate?: number;
    }>;
    prCount?: number;
}

/**
 * Phase 3: Analysis & Insights
 * Computed derived values.
 */
export interface ActivityAnalysisSection {
    complianceScore?: number; // 0-100% match with Plan
    effortScore?: number; // e.g. Relative Effort
    trainingLoad?: {
        score: number; // TSS
        type: 'hr' | 'pace' | 'power';
    };
    benefits?: string[]; // "Improved Aerobic Base"
    badges?: string[]; // "Fastest 5k this year"
}

/**
 * Universal Activity Entity
 * Merges PlannedActivity and ExerciseEntry into one Source of Truth.
 */
export interface UniversalActivity {
    id: string;
    userId: string;
    date: string; // ISO YYYY-MM-DD

    // High-level status
    status: ActivityStatus;

    // The Three Pillars
    plan?: ActivityPlanSection;
    performance?: ActivityPerformanceSection;
    analysis?: ActivityAnalysisSection;

    // Merge tracking (for combined activities)
    mergeInfo?: {
        isMerged: boolean;
        originalActivityIds: string[];  // IDs of activities that were merged
        mergedAt: string;               // ISO timestamp when merge occurred
    };

    // If this activity was merged INTO another, hide it from views
    // This ID points to the merged activity that replaced this one
    mergedIntoId?: string;

    createdAt: string;
    updatedAt: string;
}

export interface TrainingLoadData {
    date: string;
    // Training Impulse (TRIMP)
    trimp: number;
    // Training Stress Score (TSS-like)
    tss: number;
    // Chronic Training Load (fitness)
    ctl: number;
    // Acute Training Load (fatigue)
    atl: number;
    // Training Stress Balance (form)
    tsb: number;
    // Activity details
    distanceKm: number;
    durationMinutes: number;
    avgHeartRate?: number;
    category?: PlannedActivity['category'];
}

export interface PerformanceTrend {
    date: string;
    pacePerKm: number;
    avgHeartRate: number;
    efficiency: number; // pace / HR ratio
    vdot?: number;
}

export interface AICoachTip {
    id: string;
    type: 'insight' | 'warning' | 'celebration' | 'suggestion';
    category: 'volume' | 'intensity' | 'recovery' | 'nutrition' | 'form' | 'motivation';
    title: string;
    message: string;
    actionable?: { label: string; action: string };
    priority: number;
    createdAt: string;
    expiresAt?: string;
    dismissed?: boolean;
}

export interface PlannedActivity {
    id: string;
    goalId?: string; // Link to a specific CoachGoal
    date: string; // ISO Date (YYYY-MM-DD)
    type: 'RUN';
    category: 'LONG_RUN' | 'INTERVALS' | 'TEMPO' | 'EASY' | 'RECOVERY' | 'REPETITION' | 'STRENGTH';
    title: string;
    description: string;
    structure: {
        warmupKm: number;
        mainSet: { reps: number; distKm: number; pace: string; restMin: number }[];
        cooldownKm: number;
    };
    targetPace: string;
    targetHrZone: number;
    estimatedDistance: number;
    // Progress Tracking
    status: 'PLANNED' | 'COMPLETED' | 'SKIPPED' | 'DRAFT';
    feedback?: 'EASY' | 'PERFECT' | 'HARD' | 'TOO_HARD' | 'INJURY';
    completedDate?: string;
    actualDistance?: number;
    actualTimeSeconds?: number;
    // Phase 2 enhancements
    scientificBenefit?: string;
    isVolumePR?: boolean;
    isLongestInPlan?: boolean;
    customScalingFactor?: number; // Scale target distances/paces (e.g. 0.85 for "piano")
}

// Phase 2: Strength & Cross-Training
// ============================================

export type StrengthMuscleGroup = 'legs' | 'core' | 'upper' | 'full_body' | 'mobility';

export interface StrengthExercise {
    id: string;
    name: string;
    muscleGroups: StrengthMuscleGroup[];
    sets: number;
    reps: number;
    weight?: number;
    notes?: string;
}

export interface StrengthSession {
    id: string;
    date: string;
    title: string;
    muscleGroups: StrengthMuscleGroup[];
    exercises: StrengthExercise[];
    durationMinutes: number;
    estimatedCalories: number;
    source?: 'manual' | 'strengthlog' | 'imported';
    externalId?: string; // For Strengthlog API integration
}

// Phase 3: Feedback & Adaptation
// ============================================

export type RPE = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FeedbackEntry {
    id: string;
    activityId: string;
    date: string;
    // Core metrics
    rpe: RPE;
    perceivedDifficulty: 'EASY' | 'PERFECT' | 'HARD' | 'TOO_HARD';
    // Body state
    sleepQuality?: 1 | 2 | 3 | 4 | 5;
    stressLevel?: 1 | 2 | 3 | 4 | 5;
    musclesSoreness?: 'none' | 'mild' | 'moderate' | 'severe';
    injuryFlag?: boolean;
    injuryLocation?: string;
    // Qualitative
    notes?: string;
    mood?: 'great' | 'good' | 'neutral' | 'low' | 'terrible';
    createdAt: string;
}

export interface FatigueTrend {
    date: string;
    fatigueScore: number;    // 0-100, computed from RPE, sleep, stress
    acuteLoad: number;       // Rolling 7-day load
    chronicLoad: number;     // Rolling 28-day load
    trainingStressBalance: number; // TSB = CTL - ATL
}

export interface AdaptationSuggestion {
    id: string;
    type: 'reduce_volume' | 'add_recovery' | 'reduce_intensity' | 'injury_risk' | 'overtraining_risk';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    suggestedAction?: string;
    affectedDates?: string[];
    createdAt: string;
    dismissed?: boolean;
}
