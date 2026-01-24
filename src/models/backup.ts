/**
 * Backup System Types
 * @module models/backup
 */

// ============================================
// Backup Snapshot
// ============================================

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  trackId: string;
  label?: string; // Optional user-defined label
  description?: string; // Auto-generated or manual
  size: number; // bytes
  entityCounts: BackupEntityCounts;
  trigger: BackupTrigger;
  checksum?: string; // For integrity verification
}

export interface BackupEntityCounts {
  // Core data
  meals: number;
  exercises: number; // universalActivities (Strava etc)
  manualExercises: number; // exerciseEntries (legacy manual)
  weights: number;
  recipes: number;
  foodItems: number;
  weeklyPlans: number;

  // Goals & planning
  goals: number; // performanceGoals
  periods: number; // trainingPeriods - not in AppData, remove or keep for future
  plannedActivities: number;
  trainingCycles: number;
  competitions: number;

  // Sessions & logs
  strengthSessions: number;
  sleepSessions: number;
  intakeLogs: number;

  // Health & recovery
  bodyMeasurements: number;
  vitals: number; // dailyVitals
  injuryLogs: number;
  recoveryMetrics: number;

  // Other
  pantryItems: number;
  users: number;
}

export type BackupTrigger =
  | "MANUAL" // User clicked "Create Backup"
  | "AUTO_SCHEDULED" // Scheduled auto-backup
  | "AUTO_THRESHOLD" // Triggered by change threshold
  | "PRE_RESTORE" // Created before a restore operation
  | "IMPORT"; // Created before data import

// ============================================
// ============================================

export interface BackupTrack {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  isDefault: boolean;
  parentTrackId?: string; // For branching
  branchPoint?: string; // Snapshot ID where branch was created
}

// ============================================
// Backup Settings
// ============================================

export interface BackupSettings {
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoBackupOnThreshold: boolean;
  changeThreshold: number; // Number of changes before auto-backup
  maxSnapshots: number; // Limit to prevent storage bloat
  retentionDays: number; // Auto-delete old backups
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: true,
  autoBackupIntervalHours: 24,
  autoBackupOnThreshold: true,
  changeThreshold: 50,
  maxSnapshots: 100,
  retentionDays: 90,
};

// ============================================
// ============================================

export interface BackupDiff {
  fromSnapshotId: string;
  toSnapshotId: string;
  timestamp: string;
  summary: DiffSummary;
  changes: DiffChange[];
}

export interface DiffSummary {
  totalAdded: number;
  totalRemoved: number;
  totalModified: number;
  byCategory: Record<
    string,
    { added: number; removed: number; modified: number }
  >;
}

export interface DiffChange {
  category: keyof BackupEntityCounts;
  type: "ADDED" | "REMOVED" | "MODIFIED";
  entityId: string;
  entityLabel?: string; // Human-readable label
  fieldChanges?: FieldChange[]; // For MODIFIED
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

// ============================================
// Restore Types
// ============================================

export interface RestoreOptions {
  snapshotId: string;
  mode: "FULL" | "SELECTIVE";
  categories?: (keyof BackupEntityCounts)[]; // For selective restore
  createBackupFirst?: boolean; // Default: true
}

export interface RestoreResult {
  success: boolean;
  preRestoreSnapshotId?: string;
  restoredCategories: (keyof BackupEntityCounts)[];
  entityCounts: Partial<BackupEntityCounts>;
  errors?: string[];
}

// ============================================
// Storage Keys
// ============================================

export const BACKUP_STORAGE_KEYS = {
  SNAPSHOTS: "greens-backup-snapshots",
  TRACKS: "greens-backup-tracks",
  SETTINGS: "greens-backup-settings",
  CURRENT_TRACK: "greens-backup-current-track",
} as const;

// ============================================
// Default Track
// ============================================

export const DEFAULT_TRACK: BackupTrack = {
  id: "main",
  name: "Huvudspår",
  description: "Primärt dataspår",
  createdAt: new Date().toISOString(),
  isDefault: true,
};
