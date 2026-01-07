/**
 * Backup Service
 * Handles snapshot creation, storage, and restoration
 * @module services/backup
 */

import {
    BackupSnapshot,
    BackupEntityCounts,
    BackupTrigger,
    BackupTrack,
    BackupSettings,
    DEFAULT_BACKUP_SETTINGS,
    DEFAULT_TRACK,
    BACKUP_STORAGE_KEYS,
    RestoreOptions,
    RestoreResult,
} from '../models/backup.ts';

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateSize(obj: unknown): number {
    return new Blob([JSON.stringify(obj)]).size;
}

function generateChecksum(data: string): string {
    // Simple hash for integrity check
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// ============================================
// Backup Service Class
// ============================================

class BackupServiceImpl {
    private storageKey = 'greens-app-data';

    // ========== Settings ==========

    getSettings(): BackupSettings {
        const stored = localStorage.getItem(BACKUP_STORAGE_KEYS.SETTINGS);
        if (stored) {
            try {
                return { ...DEFAULT_BACKUP_SETTINGS, ...JSON.parse(stored) };
            } catch {
                return DEFAULT_BACKUP_SETTINGS;
            }
        }
        return DEFAULT_BACKUP_SETTINGS;
    }

    saveSettings(settings: Partial<BackupSettings>): void {
        const current = this.getSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(BACKUP_STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    }

    // ========== Tracks ==========

    getTracks(): BackupTrack[] {
        const stored = localStorage.getItem(BACKUP_STORAGE_KEYS.TRACKS);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return [DEFAULT_TRACK];
            }
        }
        // Initialize with default track
        this.saveTracks([DEFAULT_TRACK]);
        return [DEFAULT_TRACK];
    }

    private saveTracks(tracks: BackupTrack[]): void {
        localStorage.setItem(BACKUP_STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
    }

    getCurrentTrackId(): string {
        return localStorage.getItem(BACKUP_STORAGE_KEYS.CURRENT_TRACK) || 'main';
    }

    setCurrentTrack(trackId: string): void {
        localStorage.setItem(BACKUP_STORAGE_KEYS.CURRENT_TRACK, trackId);
    }

    createTrack(name: string, description?: string): BackupTrack {
        const tracks = this.getTracks();
        const newTrack: BackupTrack = {
            id: `track_${Date.now()}`,
            name,
            description,
            createdAt: new Date().toISOString(),
            isDefault: false,
            parentTrackId: this.getCurrentTrackId(),
        };
        tracks.push(newTrack);
        this.saveTracks(tracks);
        return newTrack;
    }

    // ========== Snapshots ==========

    getSnapshots(trackId?: string): BackupSnapshot[] {
        const stored = localStorage.getItem(BACKUP_STORAGE_KEYS.SNAPSHOTS);
        if (!stored) return [];

        try {
            const allSnapshots: BackupSnapshot[] = JSON.parse(stored);
            if (trackId) {
                return allSnapshots.filter(s => s.trackId === trackId);
            }
            return allSnapshots;
        } catch {
            return [];
        }
    }

    getSnapshot(id: string): BackupSnapshot | undefined {
        const snapshots = this.getSnapshots();
        return snapshots.find(s => s.id === id);
    }

    private saveSnapshots(snapshots: BackupSnapshot[]): void {
        localStorage.setItem(BACKUP_STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
    }

    /**
     * Create a new backup snapshot
     */
    createSnapshot(
        trigger: BackupTrigger,
        label?: string,
        description?: string
    ): BackupSnapshot {
        // Get current app data
        const rawData = localStorage.getItem(this.storageKey);
        if (!rawData) {
            throw new Error('No app data found to backup');
        }

        const appData = JSON.parse(rawData);
        const trackId = this.getCurrentTrackId();

        // Count entities
        const entityCounts: BackupEntityCounts = {
            meals: (appData.mealEntries || []).length,
            exercises: (appData.exerciseEntries || []).length,
            weights: (appData.weightEntries || []).length,
            recipes: (appData.recipes || []).length,
            foodItems: (appData.foodItems || []).length,
            weeklyPlans: (appData.weeklyPlans || []).length,
            goals: (appData.performanceGoals || []).length,
            periods: (appData.trainingPeriods || []).length,
            strengthSessions: (appData.strengthSessions || []).length,
            sleepSessions: (appData.sleepSessions || []).length,
            bodyMeasurements: (appData.bodyMeasurements || []).length,
            vitals: Object.keys(appData.dailyVitals || {}).length,
        };

        // Calculate size
        const size = calculateSize(appData);

        // Generate auto-description if not provided
        const autoDescription = description || this.generateAutoDescription(entityCounts, trigger);

        const snapshot: BackupSnapshot = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            trackId,
            label,
            description: autoDescription,
            size,
            entityCounts,
            trigger,
            checksum: generateChecksum(rawData),
        };

        // Store snapshot metadata
        const snapshots = this.getSnapshots();
        snapshots.unshift(snapshot); // Add at beginning (newest first)

        // Enforce max snapshots limit
        const settings = this.getSettings();
        const trackSnapshots = snapshots.filter(s => s.trackId === trackId);
        if (trackSnapshots.length > settings.maxSnapshots) {
            // Remove oldest snapshots beyond limit
            const toRemove = trackSnapshots.slice(settings.maxSnapshots);
            toRemove.forEach(s => this.deleteSnapshotData(s.id));
            const filteredSnapshots = snapshots.filter(
                s => !toRemove.some(r => r.id === s.id)
            );
            this.saveSnapshots(filteredSnapshots);
        } else {
            this.saveSnapshots(snapshots);
        }

        // Store actual data separately
        this.saveSnapshotData(snapshot.id, appData);

        return snapshot;
    }

    private generateAutoDescription(counts: BackupEntityCounts, trigger: BackupTrigger): string {
        const parts: string[] = [];

        if (counts.meals > 0) parts.push(`${counts.meals} måltider`);
        if (counts.exercises > 0) parts.push(`${counts.exercises} aktiviteter`);
        if (counts.weights > 0) parts.push(`${counts.weights} vägningar`);
        if (counts.strengthSessions > 0) parts.push(`${counts.strengthSessions} styrkepass`);

        const triggerLabel = {
            MANUAL: 'Manuell backup',
            AUTO_SCHEDULED: 'Schemalagd backup',
            AUTO_THRESHOLD: 'Auto-backup (ändringar)',
            PRE_RESTORE: 'Säkerhetskopia före återställning',
            IMPORT: 'Säkerhetskopia före import',
        }[trigger];

        return `${triggerLabel}: ${parts.join(', ') || 'Tom data'}`;
    }

    /**
     * Store snapshot data in separate localStorage key
     */
    private saveSnapshotData(snapshotId: string, data: unknown): void {
        localStorage.setItem(`greens-backup-data-${snapshotId}`, JSON.stringify(data));
    }

    /**
     * Get snapshot data
     */
    getSnapshotData(snapshotId: string): unknown | null {
        const stored = localStorage.getItem(`greens-backup-data-${snapshotId}`);
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }

    /**
     * Delete snapshot and its data
     */
    deleteSnapshot(snapshotId: string): boolean {
        const snapshots = this.getSnapshots();
        const filtered = snapshots.filter(s => s.id !== snapshotId);

        if (filtered.length === snapshots.length) {
            return false; // Not found
        }

        this.saveSnapshots(filtered);
        this.deleteSnapshotData(snapshotId);
        return true;
    }

    private deleteSnapshotData(snapshotId: string): void {
        localStorage.removeItem(`greens-backup-data-${snapshotId}`);
    }

    /**
     * Restore from a snapshot
     */
    restore(options: RestoreOptions): RestoreResult {
        const snapshot = this.getSnapshot(options.snapshotId);
        if (!snapshot) {
            return {
                success: false,
                restoredCategories: [],
                entityCounts: {},
                errors: ['Snapshot hittades inte'],
            };
        }

        const snapshotData = this.getSnapshotData(options.snapshotId);
        if (!snapshotData) {
            return {
                success: false,
                restoredCategories: [],
                entityCounts: {},
                errors: ['Snapshot-data saknas'],
            };
        }

        // Create pre-restore backup
        let preRestoreSnapshotId: string | undefined;
        if (options.createBackupFirst !== false) {
            try {
                const preBackup = this.createSnapshot('PRE_RESTORE', 'Före återställning');
                preRestoreSnapshotId = preBackup.id;
            } catch (e) {
                console.error('Failed to create pre-restore backup:', e);
            }
        }

        try {
            if (options.mode === 'FULL') {
                // Full restore - replace everything
                localStorage.setItem(this.storageKey, JSON.stringify(snapshotData));
                return {
                    success: true,
                    preRestoreSnapshotId,
                    restoredCategories: Object.keys(snapshot.entityCounts) as (keyof BackupEntityCounts)[],
                    entityCounts: snapshot.entityCounts,
                };
            } else {
                // Selective restore
                const currentData = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
                const categories = options.categories || [];
                const restoredCounts: Partial<BackupEntityCounts> = {};

                const categoryMapping: Record<keyof BackupEntityCounts, string> = {
                    meals: 'mealEntries',
                    exercises: 'exerciseEntries',
                    weights: 'weightEntries',
                    recipes: 'recipes',
                    foodItems: 'foodItems',
                    weeklyPlans: 'weeklyPlans',
                    goals: 'performanceGoals',
                    periods: 'trainingPeriods',
                    strengthSessions: 'strengthSessions',
                    sleepSessions: 'sleepSessions',
                    bodyMeasurements: 'bodyMeasurements',
                    vitals: 'dailyVitals',
                };

                for (const category of categories) {
                    const dataKey = categoryMapping[category];
                    if (dataKey && (snapshotData as Record<string, unknown>)[dataKey] !== undefined) {
                        (currentData as Record<string, unknown>)[dataKey] =
                            (snapshotData as Record<string, unknown>)[dataKey];
                        restoredCounts[category] = snapshot.entityCounts[category];
                    }
                }

                localStorage.setItem(this.storageKey, JSON.stringify(currentData));

                return {
                    success: true,
                    preRestoreSnapshotId,
                    restoredCategories: categories,
                    entityCounts: restoredCounts,
                };
            }
        } catch (e) {
            return {
                success: false,
                preRestoreSnapshotId,
                restoredCategories: [],
                entityCounts: {},
                errors: [`Återställningsfel: ${e}`],
            };
        }
    }

    // ========== Statistics ==========

    getStorageStats(): {
        totalSnapshots: number;
        totalSize: number;
        oldestSnapshot?: string;
        newestSnapshot?: string;
        byTrack: Record<string, { count: number; size: number }>;
    } {
        const snapshots = this.getSnapshots();
        const byTrack: Record<string, { count: number; size: number }> = {};

        for (const s of snapshots) {
            if (!byTrack[s.trackId]) {
                byTrack[s.trackId] = { count: 0, size: 0 };
            }
            byTrack[s.trackId].count++;
            byTrack[s.trackId].size += s.size;
        }

        const sorted = [...snapshots].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        return {
            totalSnapshots: snapshots.length,
            totalSize: snapshots.reduce((sum, s) => sum + s.size, 0),
            oldestSnapshot: sorted[0]?.timestamp,
            newestSnapshot: sorted[sorted.length - 1]?.timestamp,
            byTrack,
        };
    }

    /**
     * Format bytes to human-readable
     */
    formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export singleton instance
export const backupService = new BackupServiceImpl();
