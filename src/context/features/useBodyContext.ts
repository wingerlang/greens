import { useState, useCallback, type MutableRefObject } from 'react';
import {
    type WeightEntry,
    type SleepSession,
    type IntakeLog,
    type InjuryLog,
    type RecoveryMetric,
    type BodyMeasurementEntry,
    type User,
    type DatabaseActionType,
    type DatabaseEntityType,
    generateId,
    getISODate
} from '../../models/types.ts';
import { storageService } from '../../services/storage.ts';
import type { FeedEventType } from '../../models/feedTypes.ts';

interface UseBodyContextProps {
    currentUser: User | null;
    logAction: (
        actionType: DatabaseActionType,
        entityType: DatabaseEntityType,
        entityId: string,
        entityName?: string,
        metadata?: Record<string, any>
    ) => void;
    emitFeedEvent: (type: FeedEventType, title: string, payload: any, metrics?: any[], summary?: string) => void;
    skipAutoSave: MutableRefObject<boolean>;
}

export function useBodyContext({ currentUser, logAction, emitFeedEvent, skipAutoSave }: UseBodyContextProps) {
    const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
    const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);
    const [intakeLogs, setIntakeLogs] = useState<IntakeLog[]>([]);
    const [injuryLogs, setInjuryLogs] = useState<InjuryLog[]>([]);
    const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetric[]>([]);
    const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurementEntry[]>([]);

    // ============================================
    // Weight Management
    // ============================================

    const addWeightEntry = useCallback((weight: number, date: string = getISODate(), waist?: number, chest?: number, hips?: number, thigh?: number): WeightEntry => {
        // Check if an entry for this date already exists
        const existingEntry = weightEntries.find(w => w.date === date);

        if (existingEntry) {
            // Update existing entry
            const updatedEntry = {
                ...existingEntry,
                weight,
                waist: waist !== undefined ? waist : existingEntry.waist,
                chest: chest !== undefined ? chest : existingEntry.chest,
                hips: hips !== undefined ? hips : existingEntry.hips,
                thigh: thigh !== undefined ? thigh : existingEntry.thigh,
                updatedAt: new Date().toISOString()
            };

            setWeightEntries(prev => {
                const next = prev.map(w => w.id === existingEntry.id ? updatedEntry : w);
                return next.sort((a, b) => b.date.localeCompare(a.date));
            });

            // Sync via API
            storageService.updateWeightEntry(updatedEntry).catch(err => {
                console.error("Failed to sync weight update:", err);
            });

            return updatedEntry;
        }

        // Otherwise create new entry
        const newEntry: WeightEntry = {
            id: generateId(),
            weight,
            date,
            waist,
            chest,
            hips,
            thigh,
            createdAt: new Date().toISOString(),
        };

        // Optimistic UI Update
        setWeightEntries(prev => {
            const next = [...prev, newEntry];
            return next.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                const timeA = a.createdAt || "";
                const timeB = b.createdAt || "";
                return timeB.localeCompare(timeA);
            });
        });

        storageService.addWeightEntry(newEntry).catch(err => {
            console.error("Failed to sync weight:", err);
        });

        // Life Stream: Add event
        emitFeedEvent(
            'BODY_METRIC',
            'Ny invägning',
            { type: 'BODY_METRIC', metricType: 'weight', value: weight, unit: 'kg' },
            [{ label: 'Vikt', value: weight, unit: 'kg', icon: '⚖️' }]
        );

        logAction('CREATE', 'weight_entry', newEntry.id, undefined, { weight, date });

        return newEntry;
    }, [weightEntries, emitFeedEvent, logAction]);

    const bulkAddWeightEntries = useCallback((entries: Partial<WeightEntry>[]) => {
        const newEntries = entries.map(e => ({
            id: generateId(),
            date: e.date || getISODate(),
            weight: e.weight || 0,
            waist: e.waist,
            chest: e.chest,
            hips: e.hips,
            thigh: e.thigh,
            createdAt: new Date().toISOString()
        } as WeightEntry));

        setWeightEntries(prev => {
            const next = [...prev, ...newEntries];
            return next.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
        });
    }, []);

    const updateWeightEntry = useCallback((id: string, weight?: number, date?: string, updates?: Partial<WeightEntry>) => {
        setWeightEntries(prev => {
            const next = prev.map(w => w.id === id ? { ...w, ...(weight !== undefined ? { weight } : {}), ...(date ? { date } : {}), ...updates } : w);

            // Sync via Granular API
            const updated = next.find(w => w.id === id);
            if (updated) {
                // We don't skip auto-save here because we want the biometric fields to be captured in the monolithic blob
                storageService.updateWeightEntry(updated).catch(e => console.error("Failed to update weight", e));
            }

            // Re-sort in case date changed
            return next.sort((a, b) => b.date.localeCompare(a.date));
        });
    }, []);

    const deleteWeightEntry = useCallback((id: string) => {
        setWeightEntries(prev => {
            const entry = prev.find(w => w.id === id);
            if (entry) {
                skipAutoSave.current = true;
                storageService.deleteWeightEntry(id, entry.date).catch(e => console.error("Failed to delete weight", e));
            }
            return prev.filter(w => w.id !== id);
        });
    }, [skipAutoSave]);

    const getLatestWeight = useCallback((): number => {
        return weightEntries[0]?.weight || 0;
    }, [weightEntries]);

    const getLatestWaist = useCallback((): number | undefined => {
        return weightEntries.find(w => w.waist !== undefined)?.waist;
    }, [weightEntries]);

    // ============================================
    // Sleep & Intake
    // ============================================

    const addSleepSession = useCallback((session: SleepSession) => {
        setSleepSessions(prev => {
            const filtered = prev.filter(s => s.date !== session.date); // Replace existing/overlap
            return [...filtered, session].sort((a, b) => b.date.localeCompare(a.date));
        });

        // Life Stream: Add event
        const hours = session.durationSeconds ? session.durationSeconds / 3600 : 0;
        emitFeedEvent(
            'HEALTH_SLEEP',
            'Sömn loggad',
            { type: 'HEALTH_SLEEP', hours, score: session.score },
            [{ label: 'Tid', value: hours.toFixed(1), unit: 'h', icon: '😴' }]
        );
    }, [emitFeedEvent]);

    // ============================================
    // Injury & Recovery (Phase 7)
    // ============================================

    const addInjuryLog = useCallback((data: Omit<InjuryLog, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newLog: InjuryLog = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setInjuryLogs(prev => [...prev, newLog]);
        return newLog;
    }, []);

    const updateInjuryLog = useCallback((id: string, updates: Partial<InjuryLog>) => {
        setInjuryLogs(prev => prev.map(log =>
            log.id === id ? { ...log, ...updates, updatedAt: new Date().toISOString() } : log
        ));
    }, []);

    const deleteInjuryLog = useCallback((id: string) => {
        setInjuryLogs(prev => prev.filter(log => log.id !== id));
    }, []);

    const addRecoveryMetric = useCallback((metric: Omit<RecoveryMetric, 'id'>) => {
        const newMetric: RecoveryMetric = {
            ...metric,
            id: generateId()
        };
        setRecoveryMetrics(prev => {
            // Ensure only one metric per day per user? Or just append?
            // Let's replace if exists for same date to keep it clean
            const filtered = prev.filter(m => m.date !== metric.date);
            return [...filtered, newMetric];
        });
        return newMetric;
    }, []);

    // ============================================
    // Body Measurements
    // ============================================

    const addBodyMeasurement = useCallback((entry: Omit<BodyMeasurementEntry, 'id' | 'createdAt'>) => {
        const newEntry: BodyMeasurementEntry = {
            ...entry,
            id: generateId(),
            createdAt: new Date().toISOString()
        };
        setBodyMeasurements(prev => [...prev, newEntry]);

        // Sync with WeightEntry if it exists for this date
        setWeightEntries(prev => {
            const existing = prev.find(w => w.date === entry.date);
            if (existing) {
                const updates: Partial<WeightEntry> = {};
                if (entry.type === 'waist') updates.waist = entry.value;
                if (entry.type === 'chest') updates.chest = entry.value;
                if (entry.type === 'hips') updates.hips = entry.value;
                if (entry.type === 'thigh_left' || entry.type === 'thigh_right') updates.thigh = entry.value;

                if (Object.keys(updates).length > 0) {
                    const updatedWeight = { ...existing, ...updates, updatedAt: new Date().toISOString() };
                    storageService.updateWeightEntry(updatedWeight).catch(e => console.error("Failed to sync weight measurement:", e));
                    return prev.map(w => w.id === existing.id ? updatedWeight : w);
                }
            }
            return prev;
        });

        // Persist
        storageService.saveBodyMeasurement?.(newEntry).catch(e => console.error("Failed to sync measurement:", e));
    }, []);

    const updateBodyMeasurement = useCallback((id: string, updates: Partial<BodyMeasurementEntry>) => {
        setBodyMeasurements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }, []);

    const deleteBodyMeasurement = useCallback((id: string) => {
        setBodyMeasurements(prev => prev.filter(e => e.id !== id));
        storageService.deleteBodyMeasurement?.(id).catch(e => console.error("Failed to delete measurement:", e));
    }, []);

    return {
        // State
        weightEntries,
        sleepSessions,
        intakeLogs,
        injuryLogs,
        recoveryMetrics,
        bodyMeasurements,

        // Setters
        setWeightEntries,
        setSleepSessions,
        setIntakeLogs,
        setInjuryLogs,
        setRecoveryMetrics,
        setBodyMeasurements,

        // Actions
        addWeightEntry,
        bulkAddWeightEntries,
        updateWeightEntry,
        deleteWeightEntry,
        getLatestWeight,
        getLatestWaist,
        addSleepSession,
        addInjuryLog,
        updateInjuryLog,
        deleteInjuryLog,
        addRecoveryMetric,
        addBodyMeasurement,
        updateBodyMeasurement,
        deleteBodyMeasurement
    };
}
