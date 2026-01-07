/**
 * Diff Engine for Backup Comparison
 * Deep object comparison with detailed change tracking
 * @module services/diffEngine
 */

import type { BackupSnapshot, BackupDiff, DiffSummary, DiffChange, FieldChange, BackupEntityCounts } from '../models/backup.ts';
import { backupService } from './backupService.ts';

// ============================================
// Category Mapping
// ============================================

const CATEGORY_DATA_KEYS: Record<keyof BackupEntityCounts, string> = {
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

const CATEGORY_LABELS: Record<keyof BackupEntityCounts, string> = {
    meals: 'Måltider',
    exercises: 'Aktiviteter',
    weights: 'Vägningar',
    recipes: 'Recept',
    foodItems: 'Råvaror',
    weeklyPlans: 'Veckoplaneringar',
    goals: 'Mål',
    periods: 'Träningsperioder',
    strengthSessions: 'Styrkepass',
    sleepSessions: 'Sömnsessioner',
    bodyMeasurements: 'Kroppsmått',
    vitals: 'Dagliga värden',
};

// ============================================
// Deep Comparison Utils
// ============================================

function isObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function getEntityLabel(entity: unknown, category: keyof BackupEntityCounts): string {
    if (!isObject(entity)) return 'Okänd';

    // Try common label fields
    if (typeof entity.name === 'string') return entity.name;
    if (typeof entity.title === 'string') return entity.title;
    if (typeof entity.date === 'string') return entity.date;
    if (typeof entity.mealType === 'string') return `${entity.mealType} (${entity.date || 'okänt datum'})`;
    if (typeof entity.type === 'string') return `${entity.type} (${entity.date || ''})`;

    return entity.id as string || 'Okänd';
}

function compareFields(oldObj: Record<string, unknown>, newObj: Record<string, unknown>): FieldChange[] {
    const changes: FieldChange[] = [];
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
        // Skip internal/meta fields
        if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;

        const oldVal = oldObj[key];
        const newVal = newObj[key];

        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes.push({
                field: key,
                oldValue: oldVal,
                newValue: newVal,
            });
        }
    }

    return changes;
}

// ============================================
// Main Diff Functions
// ============================================

export function compareSnapshots(fromId: string, toId: string): BackupDiff | null {
    const fromSnapshot = backupService.getSnapshot(fromId);
    const toSnapshot = backupService.getSnapshot(toId);

    if (!fromSnapshot || !toSnapshot) {
        console.error('One or both snapshots not found');
        return null;
    }

    const fromData = backupService.getSnapshotData(fromId) as Record<string, unknown>;
    const toData = backupService.getSnapshotData(toId) as Record<string, unknown>;

    if (!fromData || !toData) {
        console.error('Snapshot data not found');
        return null;
    }

    const changes: DiffChange[] = [];
    const summary: DiffSummary = {
        totalAdded: 0,
        totalRemoved: 0,
        totalModified: 0,
        byCategory: {},
    };

    // Compare each category
    for (const [category, dataKey] of Object.entries(CATEGORY_DATA_KEYS)) {
        const cat = category as keyof BackupEntityCounts;
        const fromItems = fromData[dataKey];
        const toItems = toData[dataKey];

        // Handle vitals specially (it's an object, not array)
        if (cat === 'vitals') {
            const fromVitals = (fromItems || {}) as Record<string, unknown>;
            const toVitals = (toItems || {}) as Record<string, unknown>;

            const catChanges = compareVitals(fromVitals, toVitals);
            if (catChanges.added > 0 || catChanges.removed > 0 || catChanges.modified > 0) {
                summary.byCategory[cat] = catChanges;
                summary.totalAdded += catChanges.added;
                summary.totalRemoved += catChanges.removed;
                summary.totalModified += catChanges.modified;
            }
            continue;
        }

        // Array comparison for other categories
        const fromArr = Array.isArray(fromItems) ? fromItems : [];
        const toArr = Array.isArray(toItems) ? toItems : [];

        const fromMap = new Map(fromArr.map((item: any) => [item.id, item]));
        const toMap = new Map(toArr.map((item: any) => [item.id, item]));

        let added = 0, removed = 0, modified = 0;

        // Find removed and modified
        for (const [id, fromItem] of fromMap) {
            const toItem = toMap.get(id);
            if (!toItem) {
                removed++;
                changes.push({
                    category: cat,
                    type: 'REMOVED',
                    entityId: id,
                    entityLabel: getEntityLabel(fromItem, cat),
                });
            } else if (JSON.stringify(fromItem) !== JSON.stringify(toItem)) {
                modified++;
                const fieldChanges = compareFields(
                    fromItem as Record<string, unknown>,
                    toItem as Record<string, unknown>
                );
                changes.push({
                    category: cat,
                    type: 'MODIFIED',
                    entityId: id,
                    entityLabel: getEntityLabel(toItem, cat),
                    fieldChanges,
                });
            }
        }

        // Find added
        for (const [id, toItem] of toMap) {
            if (!fromMap.has(id)) {
                added++;
                changes.push({
                    category: cat,
                    type: 'ADDED',
                    entityId: id,
                    entityLabel: getEntityLabel(toItem, cat),
                });
            }
        }

        if (added > 0 || removed > 0 || modified > 0) {
            summary.byCategory[cat] = { added, removed, modified };
            summary.totalAdded += added;
            summary.totalRemoved += removed;
            summary.totalModified += modified;
        }
    }

    return {
        fromSnapshotId: fromId,
        toSnapshotId: toId,
        timestamp: new Date().toISOString(),
        summary,
        changes,
    };
}

function compareVitals(
    from: Record<string, unknown>,
    to: Record<string, unknown>
): { added: number; removed: number; modified: number } {
    const fromDates = new Set(Object.keys(from));
    const toDates = new Set(Object.keys(to));

    let added = 0, removed = 0, modified = 0;

    for (const date of fromDates) {
        if (!toDates.has(date)) {
            removed++;
        } else if (JSON.stringify(from[date]) !== JSON.stringify(to[date])) {
            modified++;
        }
    }

    for (const date of toDates) {
        if (!fromDates.has(date)) {
            added++;
        }
    }

    return { added, removed, modified };
}

// ============================================
// Export Helpers
// ============================================

export function getCategoryLabel(category: keyof BackupEntityCounts): string {
    return CATEGORY_LABELS[category] || category;
}

export function formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) return '(tomt)';
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
        if (value.length > 50) return value.slice(0, 50) + '...';
        return value;
    }
    if (Array.isArray(value)) return `[${value.length} objekt]`;
    if (isObject(value)) return `{${Object.keys(value).length} fält}`;
    return String(value);
}

export function getDiffStats(diff: BackupDiff): {
    total: number;
    categories: { name: string; label: string; added: number; removed: number; modified: number }[];
} {
    const categories = Object.entries(diff.summary.byCategory).map(([cat, stats]) => ({
        name: cat,
        label: getCategoryLabel(cat as keyof BackupEntityCounts),
        ...stats,
    }));

    return {
        total: diff.summary.totalAdded + diff.summary.totalRemoved + diff.summary.totalModified,
        categories: categories.sort((a, b) =>
            (b.added + b.removed + b.modified) - (a.added + a.removed + a.modified)
        ),
    };
}
