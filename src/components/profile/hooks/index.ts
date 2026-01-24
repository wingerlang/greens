// Re-export all hooks for easy importing

export { useWeightHistory } from "./useWeightHistory.ts";
export type {
  UseWeightHistoryResult,
  WeightEntry,
} from "./useWeightHistory.ts";

export { PR_CATEGORIES, usePRs } from "./usePRs.ts";
export type { DetectedPR, PersonalRecord, UsePRsResult } from "./usePRs.ts";

export { useHRZones } from "./useHRZones.ts";
export type { HRZone, HRZoneData, UseHRZonesResult } from "./useHRZones.ts";

export { useActivityStats } from "./useActivityStats.ts";
export type {
  ActivityStatsData,
  ActivityTypeStats,
  PeriodStats,
  RecentActivity,
  UseActivityStatsResult,
} from "./useActivityStats.ts";

export { DEFAULT_NOTIFICATIONS, useNotifications } from "./useNotifications.ts";
export type {
  NotificationSettings,
  UseNotificationsResult,
} from "./useNotifications.ts";

export { useSessions } from "./useSessions.ts";
export type { Session, UseSessionsResult } from "./useSessions.ts";
