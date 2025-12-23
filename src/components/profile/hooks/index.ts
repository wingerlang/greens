// Re-export all hooks for easy importing

export { useWeightHistory } from './useWeightHistory.ts';
export type { WeightEntry, UseWeightHistoryResult } from './useWeightHistory.ts';

export { usePRs, PR_CATEGORIES } from './usePRs.ts';
export type { PersonalRecord, DetectedPR, UsePRsResult } from './usePRs.ts';

export { useHRZones } from './useHRZones.ts';
export type { HRZone, HRZoneData, UseHRZonesResult } from './useHRZones.ts';

export { useActivityStats } from './useActivityStats.ts';
export type { PeriodStats, ActivityTypeStats, RecentActivity, ActivityStatsData, UseActivityStatsResult } from './useActivityStats.ts';

export { useNotifications, DEFAULT_NOTIFICATIONS } from './useNotifications.ts';
export type { NotificationSettings, UseNotificationsResult } from './useNotifications.ts';

export { useSessions } from './useSessions.ts';
export type { Session, UseSessionsResult } from './useSessions.ts';
