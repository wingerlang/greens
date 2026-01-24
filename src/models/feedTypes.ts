// ============================================
// The Life Stream - Feed Types
// ============================================

/**
 * Event types for the universal activity feed
 * Everything tracked in the app becomes an event
 */
export type FeedEventType =
  | "WORKOUT_STRENGTH" // Completed strength session
  | "WORKOUT_CARDIO" // Running, cycling, swimming etc
  | "NUTRITION_MEAL" // Logged meal
  | "HYDRATION" // Water intake
  | "HEALTH_SLEEP" // Sleep session
  | "BODY_METRIC" // Weight, measurements
  | "MILESTONE" // PBs, streaks, achievements
  | "SOCIAL"; // Follows, comments

/**
 * Visibility levels for feed events
 * Controls who can see each event
 */
export type VisibilityLevel = "PUBLIC" | "FRIENDS" | "PRIVATE";

/**
 * Category groupings for the Matrix Follow system
 * Simplifies subscription UI into understandable groups
 */
export type FeedEventCategory =
  | "TRAINING" // WORKOUT_STRENGTH + WORKOUT_CARDIO + MILESTONE
  | "NUTRITION" // NUTRITION_MEAL + HYDRATION
  | "HEALTH" // HEALTH_SLEEP + BODY_METRIC
  | "SOCIAL"; // Everything else

/**
 * Maps event types to their category for filtering
 */
export const EVENT_TYPE_TO_CATEGORY: Record<FeedEventType, FeedEventCategory> =
  {
    "WORKOUT_STRENGTH": "TRAINING",
    "WORKOUT_CARDIO": "TRAINING",
    "NUTRITION_MEAL": "NUTRITION",
    "HYDRATION": "NUTRITION",
    "HEALTH_SLEEP": "HEALTH",
    "BODY_METRIC": "HEALTH",
    "MILESTONE": "TRAINING",
    "SOCIAL": "SOCIAL",
  };

/**
 * Category metadata for UI display
 */
export const CATEGORY_META: Record<
  FeedEventCategory,
  { icon: string; label: string; color: string }
> = {
  "TRAINING": { icon: "🏋️", label: "Träning", color: "emerald" },
  "NUTRITION": { icon: "🥗", label: "Kost", color: "amber" },
  "HEALTH": { icon: "😴", label: "Hälsa", color: "blue" },
  "SOCIAL": { icon: "👥", label: "Socialt", color: "purple" },
};

/**
 * Detail level for subscriptions
 * Controls how much detail is shown
 */
export type SubscriptionDetailLevel = "full" | "highlights";

/**
 * Base feed event - the core of the Life Stream
 */
export interface FeedEvent {
  id: string;
  userId: string;
  type: FeedEventType;
  timestamp: string; // ISO date string
  visibility: VisibilityLevel;
  title: string; // Human-readable title
  summary?: string; // Optional short description
  payload: FeedEventPayload; // Type-specific data
  aggregatedFrom?: string[]; // If bundled, original event IDs
  metrics?: FeedEventMetric[]; // Key stats to display
  createdAt: string;
}

/**
 * Type-specific payload union
 */
export type FeedEventPayload =
  | WorkoutStrengthPayload
  | WorkoutCardioPayload
  | NutritionMealPayload
  | HydrationPayload
  | HealthSleepPayload
  | BodyMetricPayload
  | MilestonePayload
  | SocialPayload;

/**
 * Strength workout payload
 */
export interface WorkoutStrengthPayload {
  type: "WORKOUT_STRENGTH";
  sessionId: string;
  exerciseCount: number;
  setCount: number;
  totalVolume: number; // kg
  duration?: number; // minutes
  exercises?: string[]; // List of exercise names
  newPBs?: number; // Count of new personal bests
}

/**
 * Cardio workout payload (running, cycling, etc)
 */
export interface WorkoutCardioPayload {
  type: "WORKOUT_CARDIO";
  activityType: string; // running, cycling, swimming
  distance?: number; // km
  duration: number; // minutes
  avgPace?: string; // e.g., "5:30 min/km"
  avgHeartRate?: number;
  calories?: number;
  elevationGain?: number;
  splits?: any[];
  externalId?: string; // Strava ID etc
}

/**
 * Nutrition meal payload
 */
export interface NutritionMealPayload {
  type: "NUTRITION_MEAL";
  mealType: string; // breakfast, lunch, dinner, snack
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items?: string[]; // Food names
  imageUrl?: string;
}

/**
 * Hydration payload
 */
export interface HydrationPayload {
  type: "HYDRATION";
  amountMl: number;
  totalDayMl?: number; // Cumulative for the day
  goalMl?: number;
}

/**
 * Sleep payload
 */
export interface HealthSleepPayload {
  type: "HEALTH_SLEEP";
  hours: number;
  quality?: "poor" | "fair" | "good" | "excellent";
  bedtime?: string;
  wakeTime?: string;
}

/**
 * Body metric payload (weight, measurements)
 */
export interface BodyMetricPayload {
  type: "BODY_METRIC";
  metricType: "weight" | "waist" | "chest" | "arms" | "other";
  value: number;
  unit: string;
  change?: number; // Difference from last
}

/**
 * Milestone payload (achievements, PBs)
 */
export interface MilestonePayload {
  type: "MILESTONE";
  milestoneType: "pb" | "streak" | "goal" | "achievement";
  title: string;
  description?: string;
  exercise?: string; // For PBs
  value?: number;
  previousValue?: number;
}

/**
 * Social payload (follows, etc)
 */
export interface SocialPayload {
  type: "SOCIAL";
  actionType: "follow" | "comment" | "like";
  targetUserId?: string;
  targetEventId?: string;
  message?: string;
}

/**
 * Metric for display on event cards
 */
export interface FeedEventMetric {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
}

/**
 * Follow preference - The Matrix Follow system
 * Controls what you see from each user you follow
 */
export interface FollowPreference {
  id: string;
  followerId: string; // Who is following
  targetUserId: string; // Who is being followed
  subscribedCategories: FeedEventCategory[];
  detailLevel: SubscriptionDetailLevel;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Default follow preferences when starting to follow someone
 */
export const DEFAULT_FOLLOW_PREFERENCES: Omit<
  FollowPreference,
  "id" | "followerId" | "targetUserId" | "createdAt" | "updatedAt"
> = {
  subscribedCategories: ["TRAINING"], // Default: only training
  detailLevel: "full",
  notificationsEnabled: false,
};

/**
 * Feed query options
 */
export interface FeedQueryOptions {
  since?: string; // ISO date, only events after this
  until?: string; // ISO date, only events before this
  limit?: number; // Max events to return
  offset?: number; // Pagination offset
  types?: FeedEventType[]; // Filter by event types
  categories?: FeedEventCategory[]; // Filter by categories
  userId?: string; // Filter by specific user
  includePrivate?: boolean; // Include private events (only for own feed)
}

/**
 * Aggregated feed response
 */
export interface FeedResponse {
  events: FeedEvent[];
  hasMore: boolean;
  nextOffset?: number;
  aggregationApplied: boolean;
}
