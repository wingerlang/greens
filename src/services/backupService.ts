/**
 * Backup Service
 * Handles snapshot creation, storage, and restoration via server API
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

function getToken(): string | null {
    return localStorage.getItem('auth_token');
}

async function apiRequest<T>(
    path: string,
    options: RequestInit = {}
): Promise<T | null> {
    const token = getToken();
    if (!token) {
        console.warn('[BackupService] No auth token');
        return null;
    }

    try {
        const res = await fetch(`http://localhost:8000${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers,
            },
        });

        if (!res.ok) {
            console.error(`[BackupService] API error: ${res.status}`);
            return null;
        }

        return await res.json() as T;
    } catch (e) {
        console.error('[BackupService] Request failed:', e);
        return null;
    }
}

// ============================================
// Backup Service Class
// ============================================

class BackupServiceImpl {
    private storageKey = 'greens-app-data';
    private snapshotsCache: BackupSnapshot[] | null = null;

    // ========== Settings ==========

    async getSettings(): Promise<BackupSettings> {
        const settings = await apiRequest<BackupSettings>('/api/backup/settings');
        return settings || DEFAULT_BACKUP_SETTINGS;
    }

    async saveSettings(settings: Partial<BackupSettings>): Promise<void> {
        const current = await this.getSettings();
        const updated = { ...current, ...settings };
        await apiRequest('/api/backup/settings', {
            method: 'PUT',
            body: JSON.stringify(updated),
        });
    }

    // ========== Tracks ==========

    async getTracks(): Promise<BackupTrack[]> {
        const tracks = await apiRequest<BackupTrack[]>('/api/backup/tracks');
        return tracks || [DEFAULT_TRACK];
    }

    getCurrentTrackId(): string {
        return localStorage.getItem('greens-backup-current-track') || 'main';
    }

    setCurrentTrack(trackId: string): void {
        localStorage.setItem('greens-backup-current-track', trackId);
    }

    async createTrack(name: string, description?: string): Promise<BackupTrack> {
        const newTrack: BackupTrack = {
            id: `track_${Date.now()}`,
            name,
            description,
            createdAt: new Date().toISOString(),
            isDefault: false,
            parentTrackId: this.getCurrentTrackId(),
        };

        await apiRequest('/api/backup/tracks', {
            method: 'POST',
            body: JSON.stringify(newTrack),
        });

        return newTrack;
    }

    // ========== Snapshots ==========

    async getSnapshots(trackId?: string): Promise<BackupSnapshot[]> {
        const snapshots = await apiRequest<BackupSnapshot[]>('/api/backup/snapshots');
        this.snapshotsCache = snapshots || [];

        if (trackId) {
            return this.snapshotsCache.filter(s => s.trackId === trackId);
        }
        return this.snapshotsCache;
    }

    async getSnapshot(id: string): Promise<BackupSnapshot | undefined> {
        if (!this.snapshotsCache) {
            await this.getSnapshots();
        }
        return this.snapshotsCache?.find(s => s.id === id);
    }

    /**
     * Create a new backup snapshot
     */
    async createSnapshot(
        trigger: BackupTrigger,
        label?: string,
        description?: string
    ): Promise<BackupSnapshot> {
        // Get current app data
        const rawData = localStorage.getItem(this.storageKey);
        if (!rawData) {
            throw new Error('No app data found to backup');
        }

        const appData = JSON.parse(rawData);
        const trackId = this.getCurrentTrackId();

        // Count entities
        const entityCounts: BackupEntityCounts = {
            // Core data
            meals: (appData.mealEntries || []).length,
            exercises: (appData.universalActivities || []).length,
            manualExercises: (appData.exerciseEntries || []).length,
            weights: (appData.weightEntries || []).length,
            recipes: (appData.recipes || []).length,
            foodItems: (appData.foodItems || []).length,
            weeklyPlans: (appData.weeklyPlans || []).length,

            // Goals & planning
            goals: (appData.performanceGoals || []).length,
            periods: 0, // trainingPeriods not in current AppData
            plannedActivities: (appData.plannedActivities || []).length,
            trainingCycles: (appData.trainingCycles || []).length,
            competitions: (appData.competitions || []).length,

            // Sessions & logs
            strengthSessions: (appData.strengthSessions || []).length,
            sleepSessions: (appData.sleepSessions || []).length,
            intakeLogs: (appData.intakeLogs || []).length,

            // Health & recovery
            bodyMeasurements: (appData.bodyMeasurements || []).length,
            vitals: Object.keys(appData.dailyVitals || {}).length,
            injuryLogs: (appData.injuryLogs || []).length,
            recoveryMetrics: (appData.recoveryMetrics || []).length,

            // Other
            pantryItems: (appData.pantryItems || []).length,
            users: (appData.users || []).length,
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

        // Send to server
        const result = await apiRequest<{ success: boolean; snapshot: BackupSnapshot }>(
            '/api/backup/snapshots',
            {
                method: 'POST',
                body: JSON.stringify({ snapshot, data: appData }),
            }
        );

        if (!result?.success) {
            throw new Error('Failed to save backup to server');
        }

        // Invalidate cache
        this.snapshotsCache = null;

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
     * Get snapshot data from server
     */
    async getSnapshotData(snapshotId: string): Promise<unknown | null> {
        return await apiRequest(`/api/backup/snapshots/${snapshotId}`);
    }

    /**
     * Delete snapshot
     */
    async deleteSnapshot(snapshotId: string): Promise<boolean> {
        const result = await apiRequest<{ success: boolean }>(
            `/api/backup/snapshots/${snapshotId}`,
            { method: 'DELETE' }
        );

        if (result?.success) {
            this.snapshotsCache = null;
            return true;
        }
        return false;
    }

    /**
     * Restore from a snapshot
     */
    async restore(options: RestoreOptions): Promise<RestoreResult> {
        const snapshot = await this.getSnapshot(options.snapshotId);
        if (!snapshot) {
            return {
                success: false,
                restoredCategories: [],
                entityCounts: {},
                errors: ['Snapshot hittades inte'],
            };
        }

        const snapshotData = await this.getSnapshotData(options.snapshotId);
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
                const preBackup = await this.createSnapshot('PRE_RESTORE', 'Före återställning');
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
                    // Core data
                    meals: 'mealEntries',
                    exercises: 'universalActivities',
                    manualExercises: 'exerciseEntries',
                    weights: 'weightEntries',
                    recipes: 'recipes',
                    foodItems: 'foodItems',
                    weeklyPlans: 'weeklyPlans',

                    // Goals & planning
                    goals: 'performanceGoals',
                    periods: 'trainingPeriods',
                    plannedActivities: 'plannedActivities',
                    trainingCycles: 'trainingCycles',
                    competitions: 'competitions',

                    // Sessions & logs
                    strengthSessions: 'strengthSessions',
                    sleepSessions: 'sleepSessions',
                    intakeLogs: 'intakeLogs',

                    // Health & recovery
                    bodyMeasurements: 'bodyMeasurements',
                    vitals: 'dailyVitals',
                    injuryLogs: 'injuryLogs',
                    recoveryMetrics: 'recoveryMetrics',

                    // Other
                    pantryItems: 'pantryItems',
                    users: 'users',
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

    async getStorageStats(): Promise<{
        totalSnapshots: number;
        totalSize: number;
        oldestSnapshot?: string;
        newestSnapshot?: string;
        byTrack: Record<string, { count: number; size: number }>;
    }> {
        const snapshots = await this.getSnapshots();
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

    /**
     * Check if snapshot has data (always true for server-based storage)
     */
    hasData(_snapshotId: string): boolean {
        return true; // Server validates this
    }

    /**
     * Cleanup orphan snapshots (no-op for server storage)
     */
    cleanupOrphanSnapshots(): number {
        return 0; // Server handles this
    }
}

// Export singleton instance
export const backupService = new BackupServiceImpl();
