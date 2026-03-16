import { useState, useCallback, useMemo, useEffect, type MutableRefObject } from 'react';
import {
    type ExerciseEntry,
    type StrengthWorkout,
    type Competition,
    type TrainingCycle,
    type PerformanceGoal,
    type TrainingPeriod,
    type CoachConfig,
    type PlannedActivity,
    type UniversalActivity,
    type User,
    type DatabaseActionType,
    type DatabaseEntityType,
    type ExerciseType,
    type ExerciseIntensity,
    type CoachGoal,
    type StravaActivity,
    generateId,
    getISODate,
    type RaceDefinition,
    type RaceIgnoreRule
} from '../../models/types.ts';
import { storageService } from '../../services/storage.ts';
import type { FeedEventType } from '../../models/feedTypes.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { generateTrainingPlan } from '../../services/coach/planGenerator.ts';
import { isDistanceBasedExercise } from '../../models/strengthTypes.ts';

interface UseActivityContextProps {
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
    getLatestWeight: () => number;
    isLoaded: boolean;
}

export function useActivityContext({ currentUser, logAction, emitFeedEvent, skipAutoSave, getLatestWeight, isLoaded }: UseActivityContextProps) {
    const [exerciseEntries, setExerciseEntries] = useState<ExerciseEntry[]>([]);
    const [strengthSessions, setStrengthSessions] = useState<StrengthWorkout[]>([]);
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [trainingCycles, setTrainingCycles] = useState<TrainingCycle[]>([]);
    const [performanceGoals, setPerformanceGoals] = useState<PerformanceGoal[]>([]);
    const [trainingPeriods, setTrainingPeriods] = useState<TrainingPeriod[]>([]);
    const [coachConfig, setCoachConfig] = useState<CoachConfig | undefined>(undefined);
    const [plannedActivities, setPlannedActivities] = useState<PlannedActivity[]>([]);
    const [universalActivities, setUniversalActivities] = useState<UniversalActivity[]>([]);

    // Race Definitions
    const [raceDefinitions, setRaceDefinitions] = useState<RaceDefinition[]>([]);
    const [raceIgnoreRules, setRaceIgnoreRules] = useState<RaceIgnoreRule[]>([]);

    // Pre-seed Race Data (One-off or load from storage later)
    useEffect(() => {
        if (!isLoaded) return;

        // This would ideally come from storageService.load() but we'll init if empty for now
        // or just let the user manage it. 
        // For the specific user request, we can verify if they exist, if not create them.
        setRaceDefinitions(prev => {
            const defaults: RaceDefinition[] = [
                { id: 'wings-for-life', name: 'Wings For Life', aliases: ['Wings For Life Part 1', 'Wings For Life Part', 'Wings For Life App Run'] },
                { id: 'vmx', name: 'VMX (Vånga Mountain Xtreme)', aliases: ['Vånga Mountain Xtreme', 'Vånga Mountain Extreme', 'Vmx 600-'] },
                { id: 'snapphaneracet', name: 'Snapphaneracet', aliases: ['Snapphaneracet +'] },
            ];

            const newDefs = [...prev];
            defaults.forEach(d => {
                if (!newDefs.find(existing => existing.id === d.id)) {
                    newDefs.push(d);
                }
            });
            return newDefs;
        });

        setRaceIgnoreRules(prev => {
            const defaults: RaceIgnoreRule[] = [
                { id: 'ignore-10th', pattern: '1/10th Marathon', matchType: 'contains' }
            ];
            const newRules = [...prev];
            defaults.forEach(d => {
                if (!newRules.find(existing => existing.id === d.id)) {
                    newRules.push(d);
                }
            });
            return newRules;
        });

    }, [isLoaded]);



    // ============================================
    // Strength Session CRUD
    // ============================================

    const addStrengthSession = useCallback((session: Omit<StrengthWorkout, 'id'>): StrengthWorkout => {
        const newSession: StrengthWorkout = {
            ...session as any, // Cast for simplicity during migration
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setStrengthSessions(prev => [...prev, newSession]);

        // Life Stream: Add event
        const totalVol = newSession.totalVolume || 0;

        emitFeedEvent(
            'WORKOUT_STRENGTH',
            newSession.name || 'Styrkepass slutfört',
            {
                type: 'WORKOUT_STRENGTH',
                sessionId: newSession.id,
                exerciseCount: (newSession.exercises || []).length,
                setCount: (newSession.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).length, 0),
                totalVolume: totalVol,
            },
            [
                { label: 'Volym', value: Math.round(totalVol / 1000), unit: 't', icon: '🏋️' },
                { label: 'Övningar', value: (newSession.exercises || []).length, icon: '📋' }
            ],
            `${(newSession.exercises || []).length} övningar • ${Math.round(totalVol / 1000)}t total volym`
        );

        return newSession;
    }, [emitFeedEvent]);

    const updateStrengthSession = useCallback((id: string, updates: Partial<StrengthWorkout>): void => {
        setStrengthSessions(prev => {
            const next = prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s);
            const updated = next.find(s => s.id === id);
            if (updated) {
                // Persist via Universal Activities logic fallback or via a dedicated Strength endpoint if we had one.
                // Our backend PATCH /api/activities/:id handles Strength fallbacks!
                const dateParam = updated.date.split('T')[0];
                fetch(`/api/activities/${id}?date=${dateParam}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        title: updated.name,
                        notes: updated.notes,
                        durationMinutes: updated.duration,
                        excludeFromStats: updated.excludeFromStats
                    })
                }).catch(e => console.error("Failed to persist strength session update:", e));
            }
            return next;
        });
    }, []);

    const deleteStrengthSession = useCallback((id: string): void => {
        let sessionToDelete: StrengthWorkout | undefined;

        setStrengthSessions(prev => {
            const session = prev.find(s => s.id === id);
            if (session) {
                sessionToDelete = session;
            }
            return prev.filter(s => s.id !== id);
        });

        if (sessionToDelete) {
            storageService.deleteStrengthSession(id).catch(e => console.error("Failed to delete strength session", e));
        }

        // Also remove from universalActivities if it's there
        setUniversalActivities(prev => prev.filter(a => a.id !== id));
    }, [storageService]);

    // ============================================
    // Exercise Management
    // ============================================

    const addExercise = useCallback((data: Omit<ExerciseEntry, 'id' | 'createdAt'>): ExerciseEntry => {
        const newEntry: ExerciseEntry = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
            calorieBreakdown: data.calorieBreakdown || (data.caloriesBurned > 0 ? `Källhänvisning: Manuellt inlägg\nBeräkning: Baserad på angiven intensitet (${data.intensity}) och längd (${data.durationMinutes} min).` : undefined),
        };
        setExerciseEntries(prev => [...prev, newEntry]);

        skipAutoSave.current = true;
        storageService.saveExerciseEntry(newEntry).catch(e => console.error("Failed to save exercise", e));

        // Life Stream: Add event (Simplified: all activities trigger a feed event)
        const typeLabel = (data.type.charAt(0).toUpperCase() + data.type.slice(1)).replace('Strength', 'Styrka').replace('Walking', 'Promenad').replace('Running', 'Löpning').replace('Cycling', 'Cykling');

        const isStrength = data.type === 'strength';

        emitFeedEvent(
            isStrength ? 'WORKOUT_STRENGTH' : 'WORKOUT_CARDIO',
            data.notes || typeLabel,
            {
                type: isStrength ? 'WORKOUT_STRENGTH' : 'WORKOUT_CARDIO',
                exerciseType: data.type,
                duration: data.durationMinutes,
                distance: data.distance,
                calories: data.caloriesBurned,
                intensity: data.intensity
            },
            [
                { label: 'Tid', value: data.durationMinutes, unit: 'min', icon: '⏱️' },
                ...(data.distance ? [{ label: 'Distans', value: data.distance.toFixed(1), unit: 'km', icon: '📍' }] : []),
                { label: 'Energi', value: Math.round(data.caloriesBurned), unit: 'kcal', icon: '🔥' }
            ],
            `${data.distance ? `${data.distance.toFixed(1)} km • ` : ''}${data.durationMinutes} min`
        );

        return newEntry;
    }, [emitFeedEvent, logAction, skipAutoSave]);

    const updateExercise = useCallback((id: string, updates: Partial<ExerciseEntry>) => {
        const existing = exerciseEntries.find(e => e.id === id);

        if (!existing) {
            // Fallback 1: Check strengthSessions
            const strSession = strengthSessions.find(s => s.id === id);
            if (strSession) {
                updateStrengthSession(id, {
                    name: updates.title || strSession.name,
                    notes: updates.notes || strSession.notes,
                    duration: updates.durationMinutes || strSession.duration,
                    excludeFromStats: updates.excludeFromStats !== undefined ? updates.excludeFromStats : strSession.excludeFromStats
                });
                return;
            }

            // Fallback 2: Check universalActivities (Strava/Virtual)
            // This allows editing Strava activities (Type, Duration, Title, Notes)
            const uniActivity = universalActivities.find(a => a.id === id);
            if (uniActivity) {
                // Optimistic Update
                setUniversalActivities(prev => prev.map(ua => {
                    if (ua.id === id) {
                        return {
                            ...ua,
                            plan: {
                                ...ua.plan,
                                title: updates.title || ua.plan?.title,
                                activityType: updates.type || ua.plan?.activityType || ua.performance?.activityType || 'other',
                                distanceKm: updates.distance !== undefined ? updates.distance : (ua.plan?.distanceKm || 0)
                            },
                            performance: {
                                ...ua.performance,
                                activityType: updates.type || ua.performance?.activityType,
                                durationMinutes: updates.durationMinutes !== undefined ? updates.durationMinutes : ua.performance?.durationMinutes,
                                notes: updates.notes || ua.performance?.notes,
                                subType: updates.subType || ua.performance?.subType,
                                // Also update distance in performance if changed
                                distanceKm: updates.distance !== undefined ? updates.distance : ua.performance?.distanceKm,
                                excludeFromStats: updates.excludeFromStats !== undefined ? updates.excludeFromStats : ua.performance?.excludeFromStats
                            }
                        } as UniversalActivity;
                    }
                    return ua;
                }));

                // Persist to Backend
                const dateParam = uniActivity.date.split('T')[0];
                fetch(`/api/activities/${id}?date=${dateParam}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify({
                        title: updates.title,
                        notes: updates.notes,
                        durationMinutes: updates.durationMinutes,
                        type: updates.type,
                        distance: updates.distance,
                        intensity: updates.intensity,
                        subType: updates.subType,
                        location: updates.location,
                        hyroxStats: updates.hyroxStats,
                        excludeFromStats: updates.excludeFromStats
                    })
                }).catch(e => console.error("Failed to persist virtual activity update:", e));
                return;
            }

            return;
        }

        const updated = { ...existing, ...updates };

        // If intensity or duration updated and it's a manual entry (or we want to override for manual edits), refresh the breakdown
        if ((updates.intensity || updates.durationMinutes || updates.caloriesBurned) && !updates.calorieBreakdown) {
            updated.calorieBreakdown = `Källhänvisning: Manuellt inlägg\nBeräkning: Baserad på angiven intensitet (${updated.intensity}) och längd (${updated.durationMinutes} min).`;
        }

        // Update local exerciseEntries
        setExerciseEntries(prev => prev.map(e => e.id === id ? updated : e));

        // ALSO update universalActivities if this ID matches a server activity
        // This ensures Strava activities get their title and subType updated and persisted
        setUniversalActivities(prev => prev.map(ua => {
            if (ua.id === id) {
                return {
                    ...ua,
                    plan: updates.title ? {
                        ...ua.plan,
                        title: updates.title,
                        activityType: ua.plan?.activityType || ua.performance?.activityType || 'other',
                        distanceKm: ua.plan?.distanceKm || ua.performance?.distanceKm || 0
                    } : ua.plan,
                    performance: {
                        ...ua.performance,
                        subType: updates.subType || ua.performance?.subType
                    }
                } as UniversalActivity;
            }
            return ua;
        }));

        // PERSISTENCE FIX: Ensure manual entries also sync their metadata to the backend
        const token = localStorage.getItem('auth_token');
        if (token) {
            const dateParam = updated.date.split('T')[0];
            fetch(`/api/activities/${id}?date=${dateParam}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: updated.title,
                    notes: updated.notes,
                    durationMinutes: updated.durationMinutes,
                    type: updated.type,
                    distance: updated.distance,
                    intensity: updated.intensity,
                    subType: updated.subType,
                    location: updated.location,
                    hyroxStats: updated.hyroxStats,
                    excludeFromStats: updated.excludeFromStats
                })
            }).catch(e => console.error("Failed to persist manual activity update:", e));
        }

        skipAutoSave.current = true;

        if (existing.date && updated.date && existing.date !== updated.date) {
            // Date changed: Delete old, Save new
            storageService.deleteExerciseEntry(id, existing.date).catch(e => console.error("Failed to delete old exercise", e));
            storageService.saveExerciseEntry(updated).catch(e => console.error("Failed to save new exercise", e));
        } else {
            storageService.saveExerciseEntry(updated).catch(e => console.error("Failed to update exercise", e));
        }
    }, [exerciseEntries, strengthSessions, universalActivities, updateStrengthSession, storageService, skipAutoSave]);

    const deleteExercise = useCallback((id: string) => {
        let entryToDelete: ExerciseEntry | undefined;
        let sessionToDelete: StrengthWorkout | undefined;
        let activityToDelete: UniversalActivity | undefined;

        // 1. Legacy Entries
        setExerciseEntries(prev => {
            const entry = prev.find(e => e.id === id);
            if (entry) {
                entryToDelete = entry;
            }
            return prev.filter(e => e.id !== id);
        });

        if (entryToDelete) {
            storageService.deleteExerciseEntry(id, entryToDelete.date).catch(e => console.error("Failed to delete exercise", e));
        }

        // 2. Strength Sessions
        setStrengthSessions(prev => {
            const session = prev.find(s => s.id === id);
            if (session) {
                sessionToDelete = session;
            }
            return prev.filter(s => s.id !== id);
        });

        if (sessionToDelete) {
            storageService.deleteStrengthSession(id).catch(e => console.error("Failed to delete strength session", e));
        }

        // 3. Universal Activities (Strava/Merged etc)
        setUniversalActivities(prev => {
            const activity = prev.find(a => a.id === id);
            if (activity) {
                activityToDelete = activity;

                // If this was a merged activity, we should restore visibility of original activities
                if (activity.mergeInfo?.isMerged && activity.mergeInfo.originalActivityIds) {
                    const originalIds = activity.mergeInfo.originalActivityIds;
                    return prev
                        .filter(a => a.id !== id)
                        .map(a => {
                            if (originalIds.includes(a.id)) {
                                const updated = { ...a };
                                delete updated.mergedIntoId;
                                return updated;
                            }
                            return a;
                        });
                }
            }
            return prev.filter(a => a.id !== id);
        });

        if (activityToDelete) {
            storageService.deleteUniversalActivity(id, activityToDelete.date).catch(e => console.error("Failed to delete universal activity", e));
        }
    }, [storageService]);

    const calculateExerciseCalories = useCallback((type: ExerciseType, duration: number, intensity: ExerciseIntensity): number => {
        const weight = getLatestWeight();

        // MET values
        const METS: Record<ExerciseType, Record<ExerciseIntensity, number>> = {
            running: { low: 6, moderate: 8, high: 11, ultra: 14 },
            cycling: { low: 4, moderate: 6, high: 10, ultra: 12 },
            strength: { low: 2.5, moderate: 3.5, high: 5.0, ultra: 7.0 }, // Adjusted downwards to align better with Strava
            walking: { low: 2.5, moderate: 3.5, high: 4.5, ultra: 5.5 },
            swimming: { low: 5, moderate: 7, high: 10, ultra: 12 },
            yoga: { low: 2, moderate: 2.5, high: 3.5, ultra: 4 },
            hyrox: { low: 6, moderate: 8, high: 10, ultra: 12 },
            hybrid: { low: 4, moderate: 6, high: 8, ultra: 10 },
            recovery: { low: 2, moderate: 3, high: 4, ultra: 5 },
            cardio: { low: 5, moderate: 7, high: 9, ultra: 11 },
            climbing: { low: 5, moderate: 7.5, high: 10, ultra: 12 },
            football: { low: 6, moderate: 8, high: 10, ultra: 12 },
            other: { low: 3, moderate: 4.5, high: 6, ultra: 8 }
        };

        const met = METS[type][intensity];
        return Math.round(met * weight * (duration / 60));
    }, [getLatestWeight]);

    // ============================================
    // Derived: Unified Activities (Manual + Strava + Strength)
    // ============================================

    const unifiedActivities = useMemo(() => {
        const serverEntries = universalActivities
            .filter(u => !u.mergedIntoId) // Filter out merged activities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        const normalizedServer = serverEntries.map(e => {
            const u = universalActivities.find(item => item.id === e.id);

            let source = 'strava';
            let sw = undefined;

            if (u?.mergeInfo?.isMerged && u.mergeInfo.originalActivityIds) {
                source = 'merged';
                // Try to find the original strength workout if this is a merged activity
                for (const orgId of u.mergeInfo.originalActivityIds) {
                    const cleanId = orgId.replace('strength-', '');
                    const match = strengthSessions.find(s => s.id === cleanId || s.id === orgId || orgId === `strength-${s.id}`);
                    if (match) {
                        sw = match;
                        break;
                    }
                }
            }

            return {
                ...e,
                source: source as any,
                avgHeartRate: u?.performance?.avgHeartRate,
                maxHeartRate: u?.performance?.maxHeartRate,
                _mergeData: {
                    strava: e,
                    universalActivity: u,
                    strengthWorkout: sw
                }
            };
        });
        const normalizedLocal = exerciseEntries.map(e => ({ ...e, source: 'manual' as const }));

        // Convert strength workouts to ExerciseEntry format
        const rawStrengthEntries = (strengthSessions as any[]).map(w => {
            const workoutName = (w.name || w.title || '').toLowerCase();

            // 1. Identify cardio exercises within the workout
            const cardioExercises = w.exercises.filter((ex: any) => isDistanceBasedExercise(ex.exerciseName));

            // 2. Calculate Cardio Time vs Total Time
            // Most sets are reps, but cardio sets have duration in seconds or minutes.
            const cardioTimeSeconds = cardioExercises.reduce((sum: number, ex: any) =>
                sum + ex.sets.reduce((s: number, set: any) => s + (set.timeSeconds || 0), 0), 0);

            let totalDurationMinutes = w.duration || w.durationMinutes;
            if (!totalDurationMinutes || totalDurationMinutes === 0) {
                const totalTimeSeconds = w.exercises.reduce((sum: number, ex: any) =>
                    sum + ex.sets.reduce((s: number, set: any) => s + (set.timeSeconds || 0), 0), 0);
                totalDurationMinutes = totalTimeSeconds > 0 ? Math.round(totalTimeSeconds / 60) : 0;
            }

            const cardioDurationMinutes = cardioTimeSeconds / 60;

            const isExplicitCardioWorkout = /^cardio\b/i.test(workoutName) ||
                workoutName.includes('cycl') || workoutName.includes('cyk') || workoutName.includes('bike') ||
                workoutName.includes('run') || workoutName.includes('löp') ||
                workoutName.includes('walk') || workoutName.includes('gång');

            const isHybrid = !isExplicitCardioWorkout && totalDurationMinutes > 0 && (cardioDurationMinutes / totalDurationMinutes) > 0.25;

            // 3. Helper to determine the best EXERCISE_TYPE
            const getPrimaryCardioType = (exercises: any[]): ExerciseType => {
                if (exercises.length === 0) return 'cardio';

                let hasCycling = false;
                let hasRunning = false;
                let hasWalking = false;
                let hasOther = false;

                exercises.forEach(ex => {
                    const exName = ex.exerciseName.toLowerCase();
                    if (exName.includes('cycl') || exName.includes('cyk') || exName.includes('bike')) hasCycling = true;
                    else if (exName.includes('run') || exName.includes('löp')) hasRunning = true;
                    else if (exName.includes('walk') || exName.includes('gång')) hasWalking = true;
                    else hasOther = true;
                });

                const typesCount = [hasCycling, hasRunning, hasWalking, hasOther].filter(Boolean).length;
                if (typesCount > 1) return 'cardio';

                if (hasCycling) return 'cycling';
                if (hasRunning) return 'running';
                if (hasWalking) return 'walking';
                return 'cardio';
            };

            let finalType: ExerciseType = 'strength';
            if (isExplicitCardioWorkout) {
                const strippedBase = workoutName
                    .replace(/^cardio\s*[:\-]?\s*/i, '')
                    .replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(morning|lunch|afternoon|evening|night)\s*[:\-]?\s*/i, '')
                    .trim();
                finalType = getPrimaryCardioType([{ exerciseName: strippedBase || workoutName }, ...cardioExercises]);
            } else if (isHybrid) {
                finalType = 'hybrid';
            }

            if (totalDurationMinutes === 0) {
                totalDurationMinutes = finalType === 'strength' || finalType === 'hybrid' ? 60 : 0;
            }

            // Sum distance for the whole session
            const totalDistance = w.exercises.reduce((sum: number, ex: any) =>
                sum + ex.sets.reduce((s: number, set: any) => s + (set.distance || 0), 0), 0);

            return {
                id: w.id,
                date: w.date,
                type: finalType,
                durationMinutes: totalDurationMinutes,
                intensity: 'moderate' as const,
                caloriesBurned: calculateExerciseCalories(finalType, totalDurationMinutes, 'moderate'),
                distance: totalDistance > 0 ? totalDistance / 1000 : undefined, // Convert to km
                tonnage: w.totalVolume || 0,
                totalSets: w.totalSets || 0,
                totalReps: w.totalReps || 0,
                title: w.name || w.title || (finalType === 'hybrid' ? 'Hybridpass' : 'Styrkepass'),
                notes: w.notes,
                source: 'strength',
                createdAt: w.createdAt || new Date().toISOString(),
                subType: w.subType,
                hyroxStats: (w as any).hyroxStats,
                externalId: undefined,
                movingTime: totalDurationMinutes * 60,
                excludeFromStats: w.excludeFromStats,
                _mergeData: {
                    strengthWorkout: w
                }
            };
        });

        // Content-based deduplication (Defense in Depth against near-identical duplicates with different IDs)
        const strengthEntries: typeof rawStrengthEntries = [];
        const seenCombined = new Set<string>();

        rawStrengthEntries.forEach(se => {
            const dateKey = se.date.split('T')[0];
            // Key: date-tonnage-approxDuration (10 min buckets)
            const durationBucket = Math.round(se.durationMinutes / 10) * 10;
            const contentKey = `${dateKey}-${se.tonnage}-${durationBucket}`;

            if (!seenCombined.has(contentKey)) {
                strengthEntries.push(se);
                seenCombined.add(contentKey);
            } else {
                console.log(`🔍 Combined duplicate strength session detected: ${se.title} (${se.tonnage}kg, ${se.durationMinutes}min)`);
            }
        });

        // Smart Merge: Combine StrengthLog with Strava data
        const mergedStravaIds = new Set<string>();

        // Group strength sessions by date for better matching
        const strengthByDate = new Map<string, typeof strengthEntries[0][]>();
        strengthEntries.forEach(se => {
            const d = se.date.split('T')[0];
            if (!strengthByDate.has(d)) strengthByDate.set(d, []);
            strengthByDate.get(d)!.push(se);
        });

        // Group ALL strava activities by date for smarter matching
        const stravaActivitiesByDate = new Map<string, typeof normalizedServer[0][]>();
        normalizedServer.forEach(e => {
            const d = e.date.split('T')[0];
            if (!stravaActivitiesByDate.has(d)) stravaActivitiesByDate.set(d, []);
            stravaActivitiesByDate.get(d)!.push(e);
        });

        const isTypeCompatible = (slType: ExerciseType, stravaType: string): boolean => {
            const sType = stravaType.toLowerCase();
            if (sType === 'cardio' || sType.includes('cardio')) return true;

            if (slType === 'strength') {
                return sType.includes('weight') || sType.includes('styrka') || sType.includes('strength') || sType === 'other';
            }
            if (slType === 'cycling') {
                return sType.includes('ride') || sType.includes('bike') || sType.includes('cycl') || sType.includes('cykel') || sType === 'other';
            }
            if (slType === 'running') {
                return sType.includes('run') || sType.includes('löp') || sType === 'other';
            }
            if (slType === 'walking') {
                return sType.includes('walk') || sType.includes('gång') || sType === 'other';
            }
            if (slType === 'cardio') {
                return sType.includes('strength') || sType.includes('cardio') || sType.includes('run') || sType.includes('ride') || sType.includes('cycl') || sType.includes('walk') || sType.includes('swim') || sType.includes('row') || sType.includes('elliptical') || sType === 'other';
            }
            if (slType === 'hybrid') {
                return true; // Hybrid could be anything
            }
            return sType === 'other' || sType === slType; // Fallback
        };

        const mergedStrengthEntries: any[] = [];

        // Sort strength entries by duration DESC so substantial workouts get priority during greedy merge
        const sortedStrengthEntries = [...strengthEntries].sort((a, b) => b.durationMinutes - a.durationMinutes);

        // Iterate through all local strength entries and try to find a match
        sortedStrengthEntries.forEach(se => {
            const sw = (strengthSessions as any[]).find(s => s.id === se.id);
            const dateKey = se.date.split('T')[0];
            const candidates = stravaActivitiesByDate.get(dateKey) || [];

            // 0. Respect explicit separation
            if (sw?.mergeInfo?.isMerged === false) {
                mergedStrengthEntries.push(se);
                return;
            }

            // 1. Filter candidates by type compatibility
            const compatibleCandidates = candidates.filter(c => isTypeCompatible(se.type, c.type || 'other'));

            // 2. Check for explicit persistence (already merged in DB)
            let match: any = null;
            if (sw?.mergeInfo?.isMerged && sw.mergeInfo.stravaActivityId) {
                match = compatibleCandidates.find(c => c.id === sw.mergeInfo?.stravaActivityId);
            }

            // 3. Otherwise try auto-matching
            if (!match) {
                // Filter out already merged ones
                const availableCandidates = compatibleCandidates.filter(c => !mergedStravaIds.has(c.id));

                // Find best match among available compatible candidates
                // 1. By approximate duration (within 10 mins) - moving time
                match = availableCandidates.find(c => Math.abs(c.durationMinutes - se.durationMinutes) <= 10);

                // 2. By approximate duration (within 20 mins) - a bit looser
                if (!match) {
                    match = availableCandidates.find(c => Math.abs(c.durationMinutes - se.durationMinutes) <= 20);
                }

                // 3. Also compare against elapsed time (Strava rest periods can inflate the gap)
                //    e.g. Strava moving time=68min but elapsed=96min, StrengthLog duration=96min
                if (!match) {
                    match = availableCandidates.find(c => {
                        const elapsedSec = (c as any)._mergeData?.universalActivity?.performance?.elapsedTimeSeconds;
                        if (!elapsedSec) return false;
                        const elapsedMin = elapsedSec / 60;
                        return Math.abs(elapsedMin - se.durationMinutes) <= 10;
                    });
                }

                // 4. If no match, just take the first available one IF there's only one compatible candidate left for this day
                if (!match && availableCandidates.length === 1) {
                    match = availableCandidates[0];
                }
            }

            if (match) {
                mergedStravaIds.add(match.id);
                const universalMatch = universalActivities.find(u => u.id === match!.id);
                const perf = universalMatch?.performance;
                const sw = (strengthSessions as any[]).find(s => s.id === se.id);

                mergedStrengthEntries.push({
                    ...se,
                    source: 'merged' as const,
                    caloriesBurned: match.caloriesBurned || se.caloriesBurned,
                    durationMinutes: match.durationMinutes || se.durationMinutes,
                    totalSets: se.totalSets,
                    totalReps: se.totalReps,
                    avgHeartRate: perf?.avgHeartRate,
                    maxHeartRate: perf?.maxHeartRate,
                    subType: match.subType,
                    _mergeData: {
                        strava: match,
                        strength: se,
                        strengthWorkout: sw,
                        universalActivity: universalMatch,
                    },
                    hyroxStats: se.hyroxStats || (sw as any)?.hyroxStats || (universalMatch?.performance as any)?.hyroxStats
                });
            } else {
                mergedStrengthEntries.push(se);
            }
        });

        // Any Strava activities NOT merged should still be included as 'strava' source
        const deduplicatedServer = normalizedServer.filter(e => !mergedStravaIds.has(e.id));

        let initialResult = [...deduplicatedServer, ...normalizedLocal, ...mergedStrengthEntries];

        // 🚀 SMART MERGE FILTERING: 
        // If an activity (local or strava) was merged into a virtual parent in the backend,
        // it must be completely hidden from the unified list.
        const allMergedChildIds = new Set<string>();
        universalActivities.forEach(u => {
            if (u.mergeInfo?.isMerged && u.mergeInfo.originalActivityIds) {
                u.mergeInfo.originalActivityIds.forEach(id => {
                    allMergedChildIds.add(id);
                    // Also strip the source prefix if it exists (e.g. strava-123 -> 123)
                    if (id.includes('-')) {
                        allMergedChildIds.add(id.split('-').slice(1).join('-'));
                    }
                });
            }
            if (u.mergedIntoId) {
                allMergedChildIds.add(u.id);
            }
        });

        initialResult = initialResult.filter(e => !allMergedChildIds.has(e.id) && !(e.externalId && allMergedChildIds.has(e.externalId)));

        // Final De-duplication: Ensure only one entry per unique ID (Defense in Depth)
        const finalMap = new Map<string, typeof initialResult[0]>();
        initialResult.forEach(item => {
            const existing = finalMap.get(item.id);
            if (!existing) {
                finalMap.set(item.id, item);
            } else {
                // Priority: merged > strava/strength > manual
                const getPriority = (source: string) => {
                    if (source === 'merged') return 3;
                    if (source === 'strava' || source === 'strength') return 2;
                    return 1;
                };
                if (getPriority(item.source) > getPriority(existing.source)) {
                    finalMap.set(item.id, item);
                }
            }
        });

        return Array.from(finalMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [universalActivities, exerciseEntries, strengthSessions]);

    // ============================================
    // Automatic Reconciliation
    // ============================================

    useEffect(() => {
        if (!isLoaded || plannedActivities.length === 0 || unifiedActivities.length === 0) return;

        let hasChanges = false;
        const usedActivityIds = new Set<string>(); // Prevent double-matching

        const updatedPlanned = plannedActivities.map(planned => {
            // Only sync those that are still 'PLANNED'
            // or those that have reconciliation data but might need updating (though COMPLETED is terminal here for auto-sync)
            if (planned.status !== 'PLANNED') return planned;

            // Find matching activity on same date with matching type
            const candidates = unifiedActivities
                .filter(actual => !usedActivityIds.has(actual.id))
                .map(actual => {
                    const sameDate = actual.date.split('T')[0] === planned.date.split('T')[0];
                    if (!sameDate) return { actual, score: 0, reason: "Annat datum" };

                    // Type mapping for reconciliation
                    const pType = planned.type;
                    const aType = actual.type;

                    // Type compatibility check
                    const isRunMatch = pType === 'RUN' && (aType === 'running' || aType === 'walking' || aType === 'other');
                    const isStrengthMatch = pType === 'STRENGTH' && aType === 'strength';
                    const isBikeMatch = pType === 'BIKE' && aType === 'cycling';
                    const isHyroxMatch = pType === 'HYROX' && (aType === 'running' || aType === 'strength' || aType === 'other');

                    if (!isRunMatch && !isStrengthMatch && !isBikeMatch && !isHyroxMatch) {
                        return { actual, score: 0, reason: `Inkompatibel typ: ${pType} vs ${aType}` };
                    }

                    // Calculate match score (0-100)
                    let score = 50; // Base score for type match on same date
                    const reasons: string[] = [`Matchande träningstyp (${pType})`];

                    // Duration similarity bonus (up to +20 points)
                    const plannedDuration = planned.estimatedDistance ? planned.estimatedDistance * 6 : 45;
                    const actualDuration = actual.durationMinutes || 0;
                    if (actualDuration > 0 && plannedDuration > 0) {
                        const durationDiff = Math.abs(actualDuration - plannedDuration) / plannedDuration;
                        if (durationDiff <= 0.40) { // More lenient duration diff (40%)
                            const bonus = Math.round(20 * (1 - durationDiff / 0.40));
                            score += bonus;
                            reasons.push(`Liknande längd (+${bonus}p)`);
                        }
                    }

                    // Time proximity bonus (up to +15 points)
                    if (planned.startTime && actual.date.includes('T')) {
                        const plannedHM = planned.startTime.split(':').map(Number);
                        const actualTime = actual.date.split('T')[1];
                        if (actualTime && actualTime.includes(':')) {
                            const actualHM = actualTime.split(':').map(Number);
                            const plannedMinutes = (plannedHM[0] || 0) * 60 + (plannedHM[1] || 0);
                            const actualMinutes = (actualHM[0] || 0) * 60 + (actualHM[1] || 0);
                            const timeDiffMinutes = Math.abs(plannedMinutes - actualMinutes);
                            if (timeDiffMinutes <= 240) { // Within 4 hours
                                const bonus = Math.round(15 * (1 - timeDiffMinutes / 240));
                                score += bonus;
                                reasons.push(`Tidsnära (+${bonus}p, diff: ${timeDiffMinutes}m)`);
                            }
                        } else {
                            // Actual activity has no time - give a bonus for being "date-only" to help auto-matching
                            score += 15;
                            reasons.push("Ingen specifik tid på loggat pass (+15p)");
                        }
                    } else if (!planned.startTime) {
                        // No specific time planned - give a generic bonus for "anytime today"
                        score += 15;
                        reasons.push("Ingen specifik tid planerad (+15p)");
                    }

                    // Title similarity bonus (+10)
                    if (planned.title && actual.title) {
                        const pTitle = planned.title.toLowerCase();
                        const aTitle = actual.title.toLowerCase();
                        if (pTitle.includes(aTitle) || aTitle.includes(pTitle)) {
                            score += 10;
                            reasons.push("Titel-matchning (+10p)");
                        }
                    }

                    return { actual, score, reason: reasons.join(", ") };
                })
                .filter(c => c.score > 0)
                .sort((a, b) => b.score - a.score);

            // Bonus: If there is exactly one compatible activity today, give it a "Unique Candidate" bonus
            if (candidates.length === 1 && candidates[0].score >= 50) {
                candidates[0].score += 10;
                candidates[0].reason += ", Ensam kandidat idag (+10p)";
            }

            const bestMatch = candidates[0];
            // Require at least 60 score to auto-reconcile
            if (bestMatch && bestMatch.score >= 60) {
                hasChanges = true;
                usedActivityIds.add(bestMatch.actual.id);
                console.log(`[DataContext] Auto-matched: "${planned.title}" -> "${bestMatch.actual.type}" (Score: ${bestMatch.score})`);
                return {
                    ...planned,
                    status: 'COMPLETED' as const,
                    completedDate: bestMatch.actual.date,
                    actualDistance: bestMatch.actual.distance || planned.estimatedDistance,
                    actualTimeSeconds: (bestMatch.actual.durationMinutes || 0) * 60,
                    externalId: bestMatch.actual.id,
                    reconciliation: {
                        score: bestMatch.score,
                        matchReason: bestMatch.reason,
                        bestCandidateId: bestMatch.actual.id,
                        reconciledAt: new Date().toISOString()
                    }
                };
            } else if (bestMatch) {
                // Store candidate info even if not a strong enough match
                // but ONLY if it changed from what was there before
                if (planned.reconciliation?.bestCandidateId !== bestMatch.actual.id || planned.reconciliation?.score !== bestMatch.score) {
                    hasChanges = true;
                    console.log(`[DataContext] candidate for "${planned.title}": ${bestMatch.score}% - ${bestMatch.reason}`);
                    return {
                        ...planned,
                        reconciliation: {
                            score: bestMatch.score,
                            matchReason: bestMatch.reason,
                            bestCandidateId: bestMatch.actual.id,
                            reconciledAt: new Date().toISOString()
                        }
                    };
                }
            }

            return planned;
        });

        if (hasChanges) {
            const newlyChanged = updatedPlanned.filter((p, i) => {
                const old = plannedActivities[i];
                return p.status !== old.status || p.reconciliation?.score !== old.reconciliation?.score;
            });

            console.log(`[DataContext] Auto-reconciliation found ${newlyChanged.length} changes.`);
            setPlannedActivities(updatedPlanned);

            // Persist changes to storage
            newlyChanged.forEach(p => {
                skipAutoSave.current = true;
                storageService.savePlannedActivity(p).catch(e => console.error("Failed to persist reconciliation update:", e));
            });
        }
    }, [unifiedActivities, plannedActivities, isLoaded, skipAutoSave]);

    const getExercisesForDate = useCallback((date: string): ExerciseEntry[] => {
        // Use startsWith to match YYYY-MM-DD even if activity has time time YYYY-MM-DDTHH:mm:ss
        return unifiedActivities.filter(e => e.date.startsWith(date));
    }, [unifiedActivities]);

    // ============================================
    // Coach / Plan / Competition Actions
    // ============================================

    const addCompetition = useCallback((data: Omit<Competition, 'id' | 'createdAt'>): Competition => {
        const newComp: Competition = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString()
        };
        setCompetitions(prev => [...prev, newComp]);
        return newComp;
    }, []);

    const updateCompetition = useCallback((id: string, updates: Partial<Competition>) => {
        setCompetitions(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }, []);

    const deleteCompetition = useCallback((id: string) => {
        setCompetitions(prev => prev.filter(c => c.id !== id));
    }, []);

    const calculateParticipantPoints = useCallback((compId: string, userId: string, date: string): number => {
        const comp = competitions.find(c => c.id === compId);
        if (!comp) return 0;
        // Logic for calculating points based on rules will be implemented in a service/util
        return 0; // Placeholder
    }, [competitions]);

    const addTrainingCycle = useCallback((data: Omit<TrainingCycle, 'id'>): TrainingCycle => {
        const newCycle: TrainingCycle = {
            ...data,
            id: generateId()
        };
        setTrainingCycles(prev => [...prev, newCycle]);
        return newCycle;
    }, []);

    const updateTrainingCycle = useCallback((id: string, updates: Partial<TrainingCycle>) => {
        setTrainingCycles(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    }, []);

    const deleteTrainingCycle = useCallback((id: string) => {
        setTrainingCycles(prev => prev.filter(c => c.id !== id));
    }, []);

    const addGoal = useCallback((data: Omit<PerformanceGoal, 'id' | 'createdAt'>): PerformanceGoal => {
        const newGoal: PerformanceGoal = {
            ...data,
            id: generateId(),
            userId: currentUser?.id || 'unknown',
            createdAt: new Date().toISOString()
        };
        setPerformanceGoals(prev => [...prev, newGoal]);
        // Persist Granularly
        skipAutoSave.current = true;
        storageService.saveGoal(newGoal).catch(e => console.error("Failed to save goal", e));
        return newGoal;
    }, [currentUser, skipAutoSave]);

    const updateGoal = useCallback((id: string, updates: Partial<PerformanceGoal>) => {
        setPerformanceGoals(prev => {
            const next = prev.map(g => g.id === id ? { ...g, ...updates } : g);
            const updatedGoal = next.find(g => g.id === id);
            if (updatedGoal) {
                skipAutoSave.current = true;
                storageService.saveGoal(updatedGoal).catch(e => console.error("Failed to update goal", e));
            }
            return next;
        });
    }, [skipAutoSave]);

    const deleteGoal = useCallback((id: string) => {
        setPerformanceGoals(prev => prev.filter(g => g.id !== id));
        skipAutoSave.current = true;
        storageService.deleteGoal(id).catch(e => console.error("Failed to delete goal", e));
    }, [skipAutoSave]);

    const getGoalsForCycle = useCallback((cycleId: string): PerformanceGoal[] => {
        return performanceGoals.filter(g => g.cycleId === cycleId);
    }, [performanceGoals]);

    const addTrainingPeriod = useCallback((data: Omit<TrainingPeriod, 'id' | 'createdAt' | 'updatedAt'>): TrainingPeriod => {
        const newPeriod: TrainingPeriod = {
            ...data,
            id: generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setTrainingPeriods(prev => [...prev, newPeriod]);
        skipAutoSave.current = true;
        storageService.savePeriod(newPeriod).catch(e => console.error("Failed to save period", e));
        return newPeriod;
    }, [skipAutoSave]);

    const updateTrainingPeriod = useCallback((id: string, updates: Partial<TrainingPeriod>) => {
        setTrainingPeriods(prev => {
            const next = prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p);
            const updatedPeriod = next.find(p => p.id === id);
            if (updatedPeriod) {
                skipAutoSave.current = true;
                storageService.savePeriod(updatedPeriod).catch(e => console.error("Failed to update period", e));
            }
            return next;
        });
    }, [skipAutoSave]);

    const deleteTrainingPeriod = useCallback((id: string) => {
        // 1. Remove period locally
        setTrainingPeriods(prev => prev.filter(p => p.id !== id));
        skipAutoSave.current = true;
        storageService.deletePeriod(id).catch(e => console.error("Failed to delete period", e));

        // 2. Unlink goals locally (Orphan them)
        setPerformanceGoals(prev => prev.map(g => {
            if (g.periodId === id) {
                const updated = { ...g, periodId: undefined };
                // We should also sync this update to backend
                storageService.saveGoal(updated).catch(e => console.error("Failed to unlink goal", e));
                return updated;
            }
            return g;
        }));
    }, [skipAutoSave]);

    const updateCoachConfig = useCallback((updates: Partial<CoachConfig>) => {
        setCoachConfig(prev => prev ? { ...prev, ...updates } : updates as CoachConfig);
    }, []);

    const generateCoachPlanAction = useCallback((stravaHistory: StravaActivity[], configOverride?: CoachConfig) => {
        const config = configOverride || coachConfig;
        if (!config) return;
        const newPlan = generateTrainingPlan(config, stravaHistory, plannedActivities);
        setPlannedActivities(newPlan);
    }, [coachConfig, plannedActivities]);

    const deletePlannedActivity = useCallback((id: string) => {
        setPlannedActivities(prev => prev.filter(a => a.id !== id));
        skipAutoSave.current = true;
        storageService.deletePlannedActivity(id).catch(e => console.error("Failed to delete planned activity", e));
    }, [skipAutoSave]);

    const updatePlannedActivity = useCallback((id: string, updates: Partial<PlannedActivity>) => {
        setPlannedActivities(prev => {
            const next = prev.map(a => a.id === id ? { ...a, ...updates } : a);
            const updated = next.find(a => a.id === id);
            if (updated) {
                skipAutoSave.current = true;
                storageService.savePlannedActivity(updated).catch(e => console.error("Failed to update planned activity", e));
            }
            return next;
        });
    }, [skipAutoSave]);

    const savePlannedActivities = useCallback((newActivities: PlannedActivity[]) => {
        setPlannedActivities(prev => {
            const ids = new Set(newActivities.map(a => a.id));
            const filtered = prev.filter(a => !ids.has(a.id));

            const next = [...filtered, ...newActivities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Sync to API
            skipAutoSave.current = true;
            storageService.savePlannedActivities(newActivities).catch(e => console.error("Failed to save planned activities", e));

            return next;
        });
    }, [skipAutoSave]);

    const completePlannedActivity = useCallback((activityId: string, actualDist?: number, actualTime?: number, feedback?: PlannedActivity['feedback']) => {
        setPlannedActivities(prev => {
            const next = prev.map(a => {
                if (a.id === activityId) {
                    return {
                        ...a,
                        status: 'COMPLETED' as const,
                        feedback,
                        completedDate: getISODate(),
                        actualDistance: actualDist || a.estimatedDistance,
                        actualTimeSeconds: actualTime
                    };
                }
                return a;
            });

            const completed = next.find(a => a.id === activityId);
            const original = prev.find(a => a.id === activityId);

            if (completed && original?.status !== 'COMPLETED') {
                skipAutoSave.current = true;
                storageService.savePlannedActivity(completed).catch(e => console.error("Failed to save completed plan", e));

                // Automatically add to exercise log
                addExercise({
                    date: completed.completedDate!,
                    type: 'running',
                    durationMinutes: Math.round((actualTime || (completed.estimatedDistance * 300)) / 60), // fallback to 5min/km
                    intensity: feedback === 'HARD' || feedback === 'TOO_HARD' ? 'high' : 'moderate',
                    caloriesBurned: calculateExerciseCalories('running', (actualTime || (completed.estimatedDistance * 300)) / 60, 'moderate'),
                    distance: actualDist || completed.estimatedDistance,
                    notes: `Coached Session: ${completed.title}. Feedback: ${feedback || 'None'}`
                });
            }

            return next;
        });
    }, [addExercise, calculateExerciseCalories, skipAutoSave]);

    const addCoachGoal = useCallback((goalData: Omit<CoachGoal, 'id' | 'createdAt' | 'isActive'>) => {
        const newGoal: CoachGoal = {
            ...goalData,
            id: generateId(),
            createdAt: new Date().toISOString(),
            isActive: (coachConfig?.goals?.length || 0) === 0 // First goal is active
        };
        setCoachConfig(prev => prev ? { ...prev, goals: [...(prev.goals || []), newGoal] } : {
            userProfile: { maxHr: 190, restingHr: 60 },
            preferences: { weeklyVolumeKm: 30, longRunDay: 'Sunday', intervalDay: 'Tuesday', trainingDays: [2, 4, 0] },
            goals: [newGoal]
        });
    }, [coachConfig]);

    const activateCoachGoal = useCallback((goalId: string) => {
        setCoachConfig(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                goals: prev.goals.map(g => ({ ...g, isActive: g.id === goalId }))
            };
        });
    }, []);

    const deleteCoachGoal = useCallback((goalId: string) => {
        setCoachConfig(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                goals: prev.goals.filter(g => g.id !== goalId)
            };
        });
    }, []);

    // Race Definitions
    const addRaceDefinition = useCallback((data: Omit<RaceDefinition, 'id'>): RaceDefinition => {
        const newDef: RaceDefinition = {
            ...data,
            id: generateId()
        };
        setRaceDefinitions(prev => [...prev, newDef]);
        skipAutoSave.current = true;
        storageService.saveRaceDefinition(newDef).catch(e => console.error("Failed to save race def", e));
        return newDef;
    }, [skipAutoSave]);

    const updateRaceDefinition = useCallback((id: string, updates: Partial<RaceDefinition>) => {
        setRaceDefinitions(prev => {
            const next = prev.map(d => d.id === id ? { ...d, ...updates } : d);
            const updated = next.find(d => d.id === id);
            if (updated) {
                skipAutoSave.current = true;
                storageService.saveRaceDefinition(updated).catch(e => console.error("Failed to update race def", e));
            }
            return next;
        });
    }, [skipAutoSave]);

    const deleteRaceDefinition = useCallback((id: string) => {
        setRaceDefinitions(prev => prev.filter(d => d.id !== id));
        skipAutoSave.current = true;
        storageService.deleteRaceDefinition(id).catch(e => console.error("Failed to delete race def", e));
    }, [skipAutoSave]);

    const addRaceIgnoreRule = useCallback((data: Omit<RaceIgnoreRule, 'id'>): RaceIgnoreRule => {
        const newRule: RaceIgnoreRule = {
            ...data,
            id: generateId()
        };
        setRaceIgnoreRules(prev => [...prev, newRule]);
        skipAutoSave.current = true;
        storageService.saveRaceIgnoreRule(newRule).catch(e => console.error("Failed to save ignore rule", e));
        return newRule;
    }, [skipAutoSave]);

    const deleteRaceIgnoreRule = useCallback((id: string) => {
        setRaceIgnoreRules(prev => prev.filter(r => r.id !== id));
        skipAutoSave.current = true;
        storageService.deleteRaceIgnoreRule(id).catch(e => console.error("Failed to delete ignore rule", e));
    }, [skipAutoSave]);

    return {
        // State
        exerciseEntries,
        strengthSessions,
        competitions,
        trainingCycles,
        performanceGoals,
        trainingPeriods,
        coachConfig,
        plannedActivities,
        universalActivities,
        unifiedActivities,

        // Setters
        setExerciseEntries,
        setStrengthSessions,
        setCompetitions,
        setTrainingCycles,
        setPerformanceGoals,
        setTrainingPeriods,
        setCoachConfig,
        setPlannedActivities,
        setUniversalActivities,

        // Actions
        addStrengthSession,
        updateStrengthSession,
        deleteStrengthSession,
        addExercise,
        updateExercise,
        deleteExercise,
        calculateExerciseCalories,
        getExercisesForDate,
        addCompetition,
        updateCompetition,
        deleteCompetition,
        calculateParticipantPoints,
        addTrainingCycle,
        updateTrainingCycle,
        deleteTrainingCycle,
        addGoal,
        updateGoal,
        deleteGoal,
        getGoalsForCycle,
        addTrainingPeriod,
        updateTrainingPeriod,
        deleteTrainingPeriod,
        updateCoachConfig,
        generateCoachPlan: generateCoachPlanAction,
        deletePlannedActivity,
        updatePlannedActivity,
        savePlannedActivities,
        completePlannedActivity,
        addCoachGoal,
        activateCoachGoal,
        deleteCoachGoal,
        // Race Defs
        raceDefinitions,
        raceIgnoreRules,
        addRaceDefinition,
        updateRaceDefinition,
        deleteRaceDefinition,
        addRaceIgnoreRule,
        deleteRaceIgnoreRule,
        setRaceDefinitions, // Exposed for loading
        setRaceIgnoreRules, // Exposed for loading
    };
}
