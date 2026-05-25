import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseEntry, UniversalActivity, StravaAthlete } from '../../models/types.ts';
import { StrengthWorkout } from '../../models/strengthTypes.ts';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { formatDuration, formatPace, getRelativeTime, formatSwedishDate, formatSpeed, formatSecondsToTime } from '../../utils/dateUtils.ts';
import { calculatePerformanceScore, calculateGAP, getPerformanceBreakdown, getBestEffortsForActivity, getFastestSince } from '../../utils/performanceEngine.ts';
import { useHRZones } from '../profile/hooks/useHRZones.ts';
import { HeartRateZones } from '../training/HeartRateZones.tsx';
import { PowerZones } from '../training/PowerZones.tsx';
import { extractFtpFromHistory, AssaultBikeMath } from '../../utils/cyclingCalculations.ts';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceArea, ComposedChart } from 'recharts';
import { EXERCISE_TYPES, INTENSITIES } from '../training/ExerciseModal.tsx';
import { ExerciseType, ExerciseIntensity, ExerciseSubType, HyroxStation, HyroxActivityStats } from '../../models/types.ts';
import { WorkoutStructureCard } from './WorkoutStructureCard.tsx';
import { IntervalSplitsCard } from './IntervalSplitsCard.tsx';
import { parseWorkout } from '../../utils/workoutParser.ts';
import { segmentSplits } from '../../utils/splitsSegmenter.ts';
import { parseHyroxText } from '../../utils/hyroxParser.ts';
import { Wand2, Zap, ArrowRight, Trophy as TrophyIcon, Activity, HeartPulse, Medal, Heart, Timer, History, Award, Mountain, Target, TrendingUp, BarChart3, Clock, Star, ChevronDown, Calendar, Dumbbell, Repeat, Search, Bike, Footprints, Calculator, AlertTriangle, Scissors } from 'lucide-react';
import { isCompetition } from '../../utils/activityUtils.ts';
import { normalizeRaceTitle } from '../training/races/utils.ts';
import { usePrepAggregation, PrepEvent } from '../training/hooks/usePrepAggregation.ts';
import { snapToTrack } from '../../utils/trackUtils.ts';

import { ExpandableExercise } from './detail/ExpandableExercise.tsx';
import { SplitsSparkline } from './detail/SplitsSparkline.tsx';
import { IntervalMiniSummary } from './detail/IntervalMiniSummary.tsx';
import { BestEffortPerformanceCard } from './detail/BestEffortPerformanceCard.tsx';
import { RaceHistoryCard } from './detail/RaceHistoryCard.tsx';
import { PrepTabContent } from './detail/PrepTabContent.tsx';
import { SessionGroup } from './detail/SessionGroup.tsx';

export interface ActivityDetailModalProps {

    activity: ExerciseEntry & { source: string; _mergeData?: any };
    universalActivity?: UniversalActivity;
    onClose: () => void;
    onSeparate?: () => void;
    initiallyEditing?: boolean;
    onSelectActivity?: (id: string | null) => void;
}

// Activity Detail Modal Component
export function ActivityDetailModal({
    activity,
    universalActivity,
    onClose,
    onSeparate,
    initiallyEditing = false,
    onSelectActivity
}: ActivityDetailModalProps) {

    const {
        currentUser,
        exerciseEntries,
        universalActivities,
        updateExercise,
        deleteExercise,
        addExercise,
        calculateExerciseCalories,
        getLatestWeight
    } = useData();
    const { user, token } = useAuth();
    const { savedZones, detectedZones } = useHRZones();

    // Support finding the latest version of this activity from current context
    const currentActivity = exerciseEntries.find(e => e.id === activity.id || (e.externalId && e.externalId === activity.externalId)) || activity;
    const currentUniversal = universalActivities.find(u => u.id === activity.id || (u.performance?.source?.externalId && u.performance.source.externalId === activity.externalId)) || universalActivity;

    // Detect if child of another activity
    const parentActivity = React.useMemo(() => {
        if (!currentActivity.extractedFromId) return null;
        return exerciseEntries.find(e => e.id === currentActivity.extractedFromId);
    }, [currentActivity.extractedFromId, exerciseEntries]);

    const parentUniversal = React.useMemo(() => {
        if (!currentActivity.extractedFromId) return null;
        return universalActivities.find(u => u.id === currentActivity.extractedFromId);
    }, [currentActivity.extractedFromId, universalActivities]);

    const perf = currentUniversal?.performance || (currentActivity as any).performance || (currentActivity as any)._mergeData?.universalActivity?.performance;






    const [isEditing, setIsEditing] = React.useState(initiallyEditing);
    const [viewMode, setViewMode] = React.useState<'combined' | 'diff' | 'raw'>('combined');
    const [showKudos, setShowKudos] = React.useState(false);
    const [kudos, setKudos] = React.useState<StravaAthlete[]>([]);
    const [loadingKudos, setLoadingKudos] = React.useState(false);
    const [isForcingFetch, setIsForcingFetch] = React.useState(false);

    // Parse workout for analysis & categorization
    const parsedWorkout = React.useMemo(() => {
        const title = universalActivity?.plan?.title || activity._mergeData?.universalActivity?.plan?.title || activity.type || 'Workout';
        const desc = universalActivity?.plan?.description || activity._mergeData?.universalActivity?.plan?.description || activity.notes || '';
        return parseWorkout(title, desc);
    }, [universalActivity, activity]);

    const [editForm, setEditForm] = React.useState({
        title: currentUniversal?.plan?.title || (currentActivity as any)._mergeData?.universalActivity?.plan?.title || currentActivity.title || currentActivity.notes || '',
        type: currentActivity.type,
        duration: Math.round(currentActivity.durationMinutes || 0).toString(),
        intensity: currentActivity.intensity || 'moderate',
        notes: currentActivity.notes || '',
        subType: currentActivity.subType || 'default',
        tonnage: currentActivity.tonnage ? currentActivity.tonnage.toString() : '',
        distance: currentActivity.distance ? currentActivity.distance.toString() : '',
        location: currentActivity.location || '',
        excludeFromStats: currentActivity.excludeFromStats || false,
        excludeFromRecords: currentActivity.excludeFromRecords || false,
        excludeHeartRate: currentActivity.excludeHeartRate || false,
        isHiddenInCalendar: perf?.isHiddenInCalendar || false,
        hyroxStats: currentActivity.hyroxStats || { runSplits: [], stations: {} },
        startKm: '0',
        averageWatts: (parsedWorkout?.averagePower || perf?.averageWatts || currentActivity.averageWatts || '').toString(),
        averageHeartRate: (perf?.avgHeartRate || currentActivity.heartRateAvg || '').toString(),
        maxHeartRate: (perf?.maxHeartRate || currentActivity.heartRateMax || '').toString(),
        placement: currentActivity.raceDetails?.placement?.toString() || '',
        totalParticipants: currentActivity.raceDetails?.totalParticipants?.toString() || '',
        originalCalories: (currentActivity.isCalorieAdjusted) ? (currentActivity as any).originalCalories : activity.originalCalories || 0,
        calculationMode: (currentActivity.isCalorieAdjusted) ? (currentActivity as any).calculationMode || 'adjusted' : 'original' as 'original' | 'hr' | 'distance' | 'met' | 'average' | 'adjusted' | 'watts',
        useTheoreticalKcal: currentActivity.isCalorieAdjusted && (currentActivity as any).calculationMode === 'watts',
        elapsedTimeSeconds: perf?.elapsedTimeSeconds || (currentActivity as any).elapsedTimeSeconds || (currentActivity.durationMinutes || 0) * 60
    });

    const handleSyncTimes = async (target: 'moving' | 'elapsed', seconds?: number) => {
        const val = seconds ?? (target === 'moving' ? (perf?.elapsedTimeSeconds || 0) : (activity.durationMinutes * 60));
        if (val <= 0) return;

        const updates: any = {};
        if (target === 'moving') {
            updates.durationMinutes = Math.round(val / 60);
        } else {
            updates.elapsedTimeSeconds = val;
        }

        updateExercise(activity.id, {
            ...updates,
            performance: {
                ...(perf || {}),
                ...updates
            }
        });

        // Also update local edit form if it exists
        setEditForm(prev => ({
            ...prev,
            duration: target === 'moving' ? Math.round(val / 60).toString() : prev.duration,
            elapsedTimeSeconds: target === 'elapsed' ? val : prev.elapsedTimeSeconds
        }));
    };

    const handleFixWithTotalTime = () => {
        if (!perf?.elapsedTimeSeconds) return;
        handleSyncTimes('moving', perf.elapsedTimeSeconds);
    };

    // Make tabs linkable by parsing the selectedActivityId (if available) for a tab suffix.
    // E.g. activityId="123/splits" means tab="splits" for activity "123"
    const initialTab = React.useMemo(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const activityParam = searchParams.get('activityId');
        if (activityParam && activityParam.includes('/')) {
            const parts = activityParam.split('/');
            const maybeTab = parts[1];
            if (['stats', 'compare', 'splits', 'merge', 'analysis', 'prep'].includes(maybeTab)) {
                return maybeTab as 'stats' | 'compare' | 'splits' | 'merge' | 'analysis' | 'prep';
            }
        }
        return 'stats';
    }, []);

    const [activeTab, setActiveTabLocal] = React.useState<'stats' | 'compare' | 'splits' | 'merge' | 'analysis' | 'prep'>(initialTab);
    const [timeframeWeeks, setTimeframeWeeks] = React.useState(12);

    const setActiveTab = (tab: 'stats' | 'compare' | 'splits' | 'merge' | 'analysis' | 'prep') => {
        setActiveTabLocal(tab);
        if (onSelectActivity) {
            // Update URL parameters directly via parent's state handler
            const baseId = activity.id;
            onSelectActivity(`${baseId}/${tab}`);
        }
    };

    const [isUnmerging, setIsUnmerging] = React.useState(false);
    
    // Parse workout for analysis & categorization

    // Hyrox Parser State
    const [showParser, setShowParser] = React.useState(false);
    const [parseText, setParseText] = React.useState('');

    // Extraction State
    const [showExtractForm, setShowExtractForm] = React.useState(false);
    const [extractForm, setExtractForm] = React.useState({
        distance: '',
        duration: '', // hh:mm:ss
        title: '',
        isHiddenInCalendar: true, // Default to true for extracts to avoid double-counting
        startKm: '0'
    });

    // Edit Form State
    const [showHrOverride, setShowHrOverride] = React.useState(!!(perf?.avgHeartRate && perf?.originalAvgHeartRate && perf.avgHeartRate !== perf.originalAvgHeartRate));
    
    const originalHr = useMemo(() => {
        return {
            avg: perf?.originalAvgHeartRate || (activity as any)._mergeData?.strava?.heartRateAvg || activity.heartRateAvg,
            max: perf?.originalMaxHeartRate || (activity as any)._mergeData?.strava?.heartRateMax || activity.heartRateMax
        };
    }, [perf, activity]);

    const [hoveredExtractEffort, setHoveredExtractEffort] = React.useState<{ startKm: number; durationSeconds: number; title: string } | null>(null);

    // Local title state for immediate optimistic updates
    const [displayTitle, setDisplayTitle] = React.useState(currentUniversal?.plan?.title || (currentActivity as any)._mergeData?.universalActivity?.plan?.title || currentActivity.title || currentActivity.type || 'Aktivitet');

    // Sync display title if prop/current changes
    React.useEffect(() => {
        const t = currentUniversal?.plan?.title || (currentActivity as any)._mergeData?.universalActivity?.plan?.title || currentActivity.title || currentActivity.type;
        if (t) setDisplayTitle(t);
    }, [currentUniversal?.plan?.title, (currentActivity as any)._mergeData?.universalActivity?.plan?.title, currentActivity.title, currentActivity.type]);

    // Sync notes & title from activity data changes for Edit Form
    React.useEffect(() => {
        const startKmMatch = (currentActivity.notes || '').match(/\[START_KM:\s*([\d.]+)\]/);
        const startKm = startKmMatch ? startKmMatch[1] : '0';
        
        // Only update notes in form if we aren't currently editing it, 
        // OR if the current form notes are just the type (default) and we have real notes now
        setEditForm(prev => {
            const updates: any = { startKm };
            if (currentActivity.notes && (prev.notes === currentActivity.type || !prev.notes || isForcingFetch)) {
                updates.notes = currentActivity.notes;
            }
            if (currentUniversal?.plan?.title && (prev.title === currentActivity.type || !prev.title || isForcingFetch)) {
                updates.title = currentUniversal.plan.title;
            }
            return { ...prev, ...updates };
        });
    }, [currentActivity.notes, currentUniversal?.plan?.title, isForcingFetch]);

    // Sync editForm with activity data changes (e.g. from background sync or auto-apply)
    React.useEffect(() => {
        const activityWatts = (parsedWorkout?.averagePower || perf?.averageWatts || currentActivity.averageWatts || '').toString();
        
        // Map the internal state to the editForm calculationMode
        // If it's calorie adjusted, we look at the specific mode if available
        let activityMode: any = currentActivity.isCalorieAdjusted ? ((currentActivity as any).calculationMode || 'adjusted') : 'original';
        
        // Heuristic: If we have watts data and no specific mode is set, or it's 'original',
        // we should probably be in 'watts' mode for cycling
        if (activityWatts && activityWatts !== '0' && (activity.type === 'cycling' || activity.type === 'hyrox') && (activityMode === 'original' || activityMode === 'adjusted')) {
            activityMode = 'watts';
        }

        // Only update if changed and we are NOT currently editing (to avoid jumping while typing)
        // EXCEPT for the wattage field if it was empty/zero, then we want to auto-fill it even if editing
        if (activityWatts && activityWatts !== '0' && activityWatts !== editForm.averageWatts && (!editForm.averageWatts || editForm.averageWatts === '0')) {
             console.log("ActivityDetailModal: Syncing auto-detected watts to editForm:", activityWatts);
             setEditForm(prev => ({ 
                ...prev, 
                averageWatts: activityWatts, 
                calculationMode: activityMode,
                useTheoreticalKcal: activityMode === 'watts'
             }));
        } else if (activityMode !== editForm.calculationMode && !isEditing) {
             setEditForm(prev => ({ ...prev, calculationMode: activityMode, useTheoreticalKcal: activityMode === 'watts' }));
        }
    }, [perf?.averageWatts, currentActivity.averageWatts, parsedWorkout?.averagePower, currentActivity.isCalorieAdjusted, (currentActivity as any).calculationMode, isEditing, activity.type]);

    // Stations definition
    const HYROX_STATIONS: { id: HyroxStation; label: string; icon: string }[] = [
        { id: 'ski_erg', label: '1000m Ski Erg', icon: '⛷️' },
        { id: 'sled_push', label: '50m Sled Push', icon: '🛒' },
        { id: 'sled_pull', label: '50m Sled Pull', icon: '🚜' },
        { id: 'burpee_broad_jumps', label: '80m BBJ', icon: '🐸' },
        { id: 'rowing', label: '1000m Rowing', icon: '🚣' },
        { id: 'farmers_carry', label: '200m Farmers', icon: '👜' },
        { id: 'sandbag_lunges', label: '100m Lunges', icon: '🎒' },
        { id: 'wall_balls', label: 'Wall Balls', icon: '🏐' },
    ];

    // Recalculate derived properties from currentActivity
    const splits = (perf?.splits && perf.splits.length > 0)
        ? perf.splits
        : ((currentActivity as any).splits && (currentActivity as any).splits.length > 0)
            ? (currentActivity as any).splits
            : (currentActivity.extractedFromId && parentUniversal?.performance?.splits)
                ? parentUniversal.performance.splits
                : [];

    const isTrackMode = !!perf?.isTrack;

    const correctedSplits = React.useMemo(() => {
        if (!isTrackMode || !splits.length) return splits;
        return splits.map((s: any) => ({
            ...s,
            distance: snapToTrack(s.distance)
        }));
    }, [splits, isTrackMode]);
    const handleExtractSubmit = async () => {
        if (!extractForm.distance || !extractForm.duration || !extractForm.title) {
            alert('Vänligen fyll i alla fält för utdraget.');
            return;
        }

        // Parse duration hh:mm:ss to minutes
        const parts = extractForm.duration.split(':').map(Number);
        let durationMin = 0;
        if (parts.length === 3) {
            durationMin = (parts[0] * 60) + parts[1] + (parts[2] / 60);
        } else if (parts.length === 2) {
            durationMin = parts[0] + (parts[1] / 60);
        } else {
            durationMin = Number(extractForm.duration);
        }

        const distance = parseFloat(extractForm.distance);
        if (isNaN(distance) || isNaN(durationMin)) {
            alert('Ogiltig distans eller tid.');
            return;
        }

        const newExtract: Omit<ExerciseEntry, 'id' | 'createdAt'> = {
            date: activity.date,
            type: activity.type,
            title: extractForm.title,
            distance: distance,
            durationMinutes: durationMin,
            intensity: activity.intensity,
            notes: `Utdrag från: ${displayTitle}${extractForm.startKm && extractForm.startKm !== '0' ? ` [START_KM: ${extractForm.startKm}]` : ''}`,
            extractedFromId: activity.id,
            source: 'manual',
            subType: 'default',
            isHiddenInCalendar: extractForm.isHiddenInCalendar,
            caloriesBurned: 0 // Will be recalculated by backend or when needed
        };

        try {
            // 1. Create the extract
            addExercise(newExtract);

            // 2. Automatically mark parent as "Quality" (Tempo) if it was default
            if (activity.subType === 'default') {
                updateExercise(activity.id, { subType: 'tempo' });
                // We should also persist this to the backend if token exists (handled by our standard persistence logic)
                if (token) {
                    const dateParam = activity.date.split('T')[0];
                    fetch(`/api/activities/${activity.id}?date=${dateParam}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ subType: 'tempo' })
                    }).catch(err => console.error('Failed to auto-update parent subtype:', err));
                }
            }

            setShowExtractForm(false);
            setExtractForm({ distance: '', duration: '', title: '', isHiddenInCalendar: true, startKm: '0' });
            alert('Prestationsmätningen har sparats!');
        } catch (e) {
            console.error('Failed to create extract:', e);
            alert('Kunde inte spara prestationsmätningen.');
        }
    };

    // Check if this is a manually merged activity (using our new merge system)
    const isMergedActivity = universalActivity?.mergeInfo?.isMerged === true;
    const mergeData = activity._mergeData;
    const isMerged = activity.source === 'merged' && !!mergeData;

    // Unified Merge State
    const isTrulyMerged = isMergedActivity || isMerged;
    const effectiveMergeInfo = universalActivity?.mergeInfo || mergeData;

    // Check if THIS activity has been merged INTO another activity (i.e., it's a component)
    const isMergedInto = universalActivity?.mergedIntoId != null;

    const parentMergedActivity = isMergedInto
        ? universalActivities.find(u => u.id === universalActivity?.mergedIntoId)
        : null;

    // Hyrox Visualization Data
    // Fallback: If hyroxStats is missing (e.g. from Strava import), try to parse from notes
    const hyroxStats = React.useMemo(() => {
        if (activity.hyroxStats) return activity.hyroxStats;
        if (activity.type === 'hyrox' && activity.notes) {
            const parsed = parseHyroxText(activity.notes);
            // Only return if meaningful data found
            if (Object.keys(parsed.stations).length > 0 || parsed.runSplits.some(r => r > 0)) {
                return parsed;
            }
        }
        return undefined;
    }, [activity.hyroxStats, activity.type, activity.notes]);

    // const hyroxStats = activity.hyroxStats; // OLD
    const isHyrox = currentActivity.type === 'hyrox';

    const hasSplits = splits.length > 0;
    const existingLaps = (perf?.laps && perf.laps.length > 0)
        ? perf.laps
        : ((currentActivity as any).laps && (currentActivity as any).laps.length > 0)
            ? (currentActivity as any).laps
            : (currentActivity.extractedFromId && parentUniversal?.performance?.laps)
                ? parentUniversal.performance.laps
                : [];

    const correctedLaps = React.useMemo(() => {
        if (!isTrackMode || !existingLaps.length) return existingLaps;
        return existingLaps.map((l: any) => ({
            ...l,
            distance: snapToTrack(l.distance)
        }));
    }, [existingLaps, isTrackMode]);

    const displayDistance = React.useMemo(() => {
        if (!isTrackMode) return activity.distance || 0;
        if (correctedLaps.length > 0 && Math.abs(correctedLaps.reduce((s, l) => s + l.distance, 0) / 1000 - (activity.distance || 0)) < 0.5) {
            return correctedLaps.reduce((s, l) => s + l.distance, 0) / 1000;
        }
        return snapToTrack((activity.distance || 0) * 1000) / 1000;
    }, [activity.distance, isTrackMode, correctedLaps]);

    // Analysis visibility criteria
    const hasHeartRate = (perf?.avgHeartRate && perf.avgHeartRate > 0) || (currentActivity.heartRateAvg && currentActivity.heartRateAvg > 0);
    const hasWorkoutStructure = parsedWorkout.segments.length > 0;

    const existingSplits = correctedSplits;
    const isWorthyOfAnalysis = hasSplits || (hasHeartRate && currentActivity.type !== 'strength') || hasWorkoutStructure;

    const areLapsAndSplitsIdentical = React.useMemo(() => {
        if (!splits || !existingLaps || splits.length !== existingLaps.length) return false;
        return splits.every((s: any, i: number) => {
            const lap = existingLaps[i];
            return Math.abs(s.distance - lap.distance) < 2 && Math.abs(s.movingTime - lap.movingTime) < 2;
        });
    }, [splits, existingLaps]);

    const segmentedSplits = React.useMemo(() => {
        const useLaps = existingLaps && existingLaps.length >= 3 && !areLapsAndSplitsIdentical;
        const source = useLaps
            ? correctedLaps.map((l: any, i: number) => ({
                split: i + 1,
                distance: l.distance,
                movingTime: l.movingTime,
                elapsedTime: l.elapsedTime,
                averageHeartrate: l.averageHeartrate || l.avgHeartRate || l.heartRateAvg,
                elevationDiff: l.elevationDiff
            }))
            : existingSplits;

        if (!source || source.length < 3) return null;
        return segmentSplits(source, parsedWorkout, currentActivity.title || currentActivity.type);
    }, [existingSplits, existingLaps, areLapsAndSplitsIdentical, parsedWorkout, currentActivity]);


    // Sub-performances (Internal measurements like 5k tests extracted from this session)
    const subPerformances = React.useMemo(() => {
        return exerciseEntries.filter(e => e.extractedFromId === currentActivity.id);
    }, [exerciseEntries, currentActivity.id]);

    // Smart Extraction Detection (Performance Markers)
    // Only show when there's a genuinely noteworthy effort (PB or fastest in ~90 days)
    const smartExtractInfo = React.useMemo(() => {
        if (activity.extractedFromId) return null; // Don't suggest extracts from extracts
        // Reality Checks: 
        // 1. Tävlingar är sällan intervaller (undvik att irritera användaren med extraktions-tips då)
        if (isCompetition(activity)) return null;

        const bestEfforts = getBestEffortsForActivity(universalActivity || (activity as any));

        // We look for common distances to suggest extraction
        const suggestions = bestEfforts
            .filter(be => {
                const distanceKm = be.distance / 1000;
                const isCommon = [1, 2, 3, 5, 10].includes(distanceKm) || be.name.includes('mile');

                // Reality check: If total distance is > 15km and extraction is < 1km, it's likely just a random fast km
                if ((activity.distance || 0) > 15 && distanceKm <= 1) return false;

                // Reality check: Extraction should be a significant part of the activity unless it's a test
                if (distanceKm < (activity.distance || 0) * 0.05) return false;

                return isCommon;
            })
            .sort((a, b) => b.distance - a.distance) // Prioritize longer distances
            .slice(0, 3);

        if (suggestions.length > 0) {
            const allActivities = universalActivities || [];
            const currentDate = new Date(activity.date || currentActivity?.date || '').getTime();
            const ninetyDaysAgo = currentDate - (90 * 24 * 60 * 60 * 1000);

            const efforts = suggestions.map(e => {
                const result = getFastestSince(currentUniversal || (currentActivity as any), e.distance, e.movingTime, allActivities);
                const isPB = result === 'PB';
                
                // Check if this is the fastest in the last 90 days
                let isFastestInQuarter = false;
                if (!isPB && result === null) {
                    // result === null means no historical effort found that's faster => could be PB or first time
                    isFastestInQuarter = true;
                }
                if (!isPB && !isFastestInQuarter) {
                    // There IS a faster effort somewhere in history. Check if it's older than 90 days.
                    const fasterActivity = result as { id: string; date: string; title: string } | null;
                    if (fasterActivity && new Date(fasterActivity.date).getTime() < ninetyDaysAgo) {
                        isFastestInQuarter = true;
                    }
                }
                
                return {
                    startKm: (e as any).startKm || 0,
                    durationSeconds: e.movingTime,
                    distance: e.distance / 1000,
                    isPB,
                    isFastestInQuarter,
                    result,
                    title: `${e.name} (${(e as any).startKm || 1}-${((e as any).startKm || 1) + Math.floor(e.distance / 1000)} km)`
                };
            });

            // Only show the banner if at least one effort is noteworthy (PB or fastest in quarter)
            const hasNoteworthyEffort = efforts.some(e => e.isPB || e.isFastestInQuarter);
            if (!hasNoteworthyEffort) return null;

            return {
                distance: suggestions[0].distance / 1000,
                title: suggestions[0].name,
                topEfforts: efforts
            };
        }
        return null;
    }, [activity.id, universalActivity?.performance]);

    const activeHighlightRange = React.useMemo(() => {
        if (hoveredExtractEffort) {
            return {
                start: hoveredExtractEffort.startKm,
                end: hoveredExtractEffort.startKm + Math.floor(smartExtractInfo?.distance || 0)
            };
        }
        if (activity.extractedFromId) {
            const startVal = parseFloat(editForm.startKm || '0');
            return {
                start: startVal,
                end: startVal + (activity.distance || 0)
            };
        }
        return undefined;
    }, [hoveredExtractEffort, activity.extractedFromId, editForm.startKm, activity.distance, smartExtractInfo?.distance]);

    const handleApplySmartExtract = (effort: { startKm: number; durationSeconds: number; title: string; distance?: number }) => {
        const distance = effort.distance || smartExtractInfo?.distance;
        if (!distance) {
            console.error('❌ Ingen distans hittades för extraktion', effort);
            return;
        }

        const formatSecondsToDuration = (sec: number) => {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = Math.round(sec % 60);
            if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            return `${m}:${s.toString().padStart(2, '0')}`;
        };

        setExtractForm({
            ...extractForm,
            distance: distance.toString(),
            title: effort.title,
            startKm: effort.startKm.toString(),
            duration: formatSecondsToDuration(effort.durationSeconds),
            isHiddenInCalendar: true
        });
        
        setShowExtractForm(true);

        // Scroll to form after a short delay to allow render
        setTimeout(() => {
            const form = document.querySelector('#extraction-form');
            if (form) {
                form.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };


    // Auto-populate subtype in edit form if detected
    const handleRecategorize = async (newType: ExerciseType) => {
        if (activity.type === newType) return;

        console.log(`🔄 Omkategoriserar aktivitet ${activity.id} till ${newType}...`);

        // Update local state immediately (optimistic)
        updateExercise(activity.id, { type: newType });

        // Persist to backend
        if (token) {
            try {
                const dateParam = activity.date.split('T')[0];
                const res = await fetch(`/api/activities/${activity.id}?date=${dateParam}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ type: newType })
                });

                if (res.ok) {
                    console.log(`✅ Aktivitet omkategoriserad till ${newType}`);
                    // Close modal on success for fundamental changes to ensure the UI refreshes
                    onClose();
                } else if (res.status === 404 && universalActivity) {
                    // Fallback to upsert if PATCH fails with 404
                    console.log('⚠️ PATCH 404 (omkategorisering), försöker POST...');
                    const { userId: _u, ...activityData } = universalActivity;
                    const updatedActivity = {
                        ...activityData,
                        performance: {
                            ...universalActivity.performance,
                            activityType: newType
                        },
                        plan: {
                            title: universalActivity.plan?.title || activity.title || activity.notes || 'Aktivitet',
                            ...universalActivity.plan,
                            activityType: newType
                        }
                    };
                    const postRes = await fetch('/api/activities', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(updatedActivity)
                    });
                    if (postRes.ok) {
                        onClose();
                    }
                }
            } catch (e) {
                console.error('❌ Error persisting recategorization:', e);
            }
        }
    };
    React.useEffect(() => {
        if (isEditing && editForm.subType === 'default' && parsedWorkout?.suggestedSubType &&
            parsedWorkout.suggestedSubType !== 'default' && parsedWorkout.suggestedSubType !== 'tempo') {
            setEditForm(prev => ({ ...prev, subType: parsedWorkout.suggestedSubType as any }));
        }
    }, [isEditing, parsedWorkout]);

    const fetchKudos = async (externalId: string) => {
        if (!token) return;
        setLoadingKudos(true);
        try {
            const res = await fetch(`/api/strava/activities/${externalId}/kudos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setKudos(data.kudos || []);
            }
        } catch (error) {
            console.error('Failed to fetch kudos:', error);
        } finally {
            setLoadingKudos(false);
        }
    };

    // Get original activities for merged view
    const originalActivities = React.useMemo(() => {
        // 1. Try standard lookup via IDs
        if (isTrulyMerged && effectiveMergeInfo?.originalActivityIds?.length > 0) {
            const found = universalActivities.filter(u => effectiveMergeInfo.originalActivityIds!.includes(u.id));
            if (found.length > 0) return found;
        }

        // 2. Fallback: Reconstruct from _mergeData logic (Legacy/Manual merge)
        if (isTrulyMerged && mergeData) {
            const reconstructed: UniversalActivity[] = [];

            // A. Strength Part
            if (mergeData.strengthWorkout) {
                reconstructed.push({
                    id: 'strength-part',
                    userId: (activity as Record<string, any>).userId || '',
                    date: activity.date,
                    status: 'COMPLETED',
                    plan: {
                        title: mergeData.strengthWorkout.title || 'Strength Workout',
                        activityType: 'strength',
                        distanceKm: 0
                    },
                    performance: {
                        source: { source: 'strength' },
                        durationMinutes: mergeData.strengthWorkout.durationMinutes || 0,
                        calories: mergeData.strengthWorkout.estimatedCalories || 0,
                        activityType: 'strength',
                        notes: 'Reconstructed from StrengthLog data'
                    }
                } as UniversalActivity);
            }

            // B. Strava/Cardio Part
            if (mergeData.universalActivity) {
                reconstructed.push(mergeData.universalActivity);
            }

            return reconstructed;
        }

        return [];
    }, [isTrulyMerged, effectiveMergeInfo, universalActivities, mergeData, activity]);

    // Combine manual entries with mapped universal activities
    const allActivities = React.useMemo(() => {
        const stravaEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);
        return [...exerciseEntries, ...stravaEntries];
    }, [exerciseEntries, universalActivities]);

    const perfBreakdown = getPerformanceBreakdown(activity, allActivities);
    const strengthWorkout = mergeData?.strengthWorkout;

    // Derived variables for view logic
    const showStravaCard = activity.source === 'strava' || isTrulyMerged;

    const calorieOptions = React.useMemo(() => {
        const duration = parseInt(editForm.duration) || 0;
        const weight = getLatestWeight() || 75;
        const avgWatts = editForm.averageWatts ? parseFloat(editForm.averageWatts) : undefined;
        const effectiveAvgHr = editForm.averageHeartRate ? parseInt(editForm.averageHeartRate) : (perf?.avgHeartRate || activity.heartRateAvg || 0);
        const distance = editForm.distance ? parseFloat(editForm.distance) : undefined;

        const options = {
            original: activity.originalCalories || activity.caloriesBurned || 0,
            hr: calculateExerciseCalories(editForm.type, duration, editForm.intensity, editForm.notes, undefined, effectiveAvgHr, undefined),
            distance: calculateExerciseCalories(editForm.type, duration, editForm.intensity, editForm.notes, undefined, undefined, distance),
            met: calculateExerciseCalories(editForm.type, duration, editForm.intensity, editForm.notes, undefined, undefined, undefined),
            watts: avgWatts ? AssaultBikeMath.calculateCyclingKcal(avgWatts, duration) : 0
        };

        const available = Object.values(options).filter(v => v > 0);
        const average = available.length > 0 ? Math.round(available.reduce((a, b) => a + b, 0) / available.length) : 0;

        return { ...options, average };
    }, [editForm, activity, perf, calculateExerciseCalories, getLatestWeight]);

    // Unmerge handler
    const handleUnmerge = async () => {
        if (!universalActivity?.id || !token) return;
        setIsUnmerging(true);
        try {
            const response = await fetch(`/api/activities/${universalActivity.id}/separate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await response.json();
            if (result.success) {
                onClose();
                window.location.reload();
            } else {
                alert(`Separering misslyckades: ${result.error}`);
            }
        } catch (e) {
            alert('Separering misslyckades: Nätverksfel');
        } finally {
            setIsUnmerging(false);
        }
    };

    // Find similar activities for comparison
    const similarActivities = React.useMemo(() => {
        if (!activity.type) return [];

        return allActivities
            .filter(a =>
                a.id !== activity.id &&
                (a.type?.toLowerCase() === activity.type?.toLowerCase()) &&
                activity.distance && a.distance &&
                Math.abs(a.distance - activity.distance) < (activity.distance * 0.25)
            )
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);
    }, [activity, allActivities]);

    const isRace = React.useMemo(() => isCompetition(activity), [activity]);




    const [isFetchingSplits, setIsFetchingSplits] = React.useState(false);
    const [fetchSplitsResult, setFetchSplitsResult] = React.useState<'idle' | 'success' | 'error'>('idle');

    // Auto-fetch splits if Strava activity is missing them
    React.useEffect(() => {
        // Reset fetch state if the activity ID changes
        if (activity.id !== (window as any)._lastActivityId) {
            setFetchSplitsResult('idle');
            (window as any)._lastActivityId = activity.id;
        }

        const perf = universalActivity?.performance || (activity as any).performance || activity._mergeData?.universalActivity?.performance;
        const source = perf?.source?.source || activity.platform || (activity as any).source || (activity as any).platform;
        const externalId = perf?.source?.externalId || activity.externalId;

        // More robust Strava detection
        const effectivelyStrava =
            source === 'strava' ||
            (activity as any).platform === 'strava' ||
            (typeof externalId === 'string' && (externalId.startsWith('strava_') || /^\d+$/.test(externalId))) ||
            (typeof externalId === 'number' && externalId > 0);

        // Check for existing data
        const existingSplits = (perf?.splits && perf.splits.length > 0)
            ? perf.splits
            : ((activity as any).splits && (activity as any).splits.length > 0)
                ? (activity as any).splits
                : [];
        const existingLaps = (perf?.laps && perf.laps.length > 0)
            ? perf.laps
            : ((activity as any).laps && (activity as any).laps.length > 0)
                ? (activity as any).laps
                : [];

        const isStrengthLike =
            activity.type?.toLowerCase() === 'strength' ||
            activity.type?.toLowerCase() === 'weighttraining' ||
            activity.type?.toLowerCase() === 'workout' ||
            activity.type?.toLowerCase().includes('styrka');

        // We trigger fetch only if BOTH splits and laps are completely missing
        const needsFetch = (!existingSplits || existingSplits.length === 0) && (!existingLaps || existingLaps.length === 0);

        // Relaxed condition: we don't strictly REQUIRE token in state if we have cookies, 
        // but it's good practice to log if it's there. The backend handles the cookie.
        // If it's a force sync, we ignore the isStrengthLike check (user knows what they are doing)
        const canSync = effectivelyStrava && (isForcingFetch || !isStrengthLike) && (externalId || source === 'strava');

        if (canSync && (needsFetch || isForcingFetch) && fetchSplitsResult === 'idle' && !isFetchingSplits) {
            console.log("🚀 ActivityDetailModal: Triggering Strava split fetch for", { externalId, source, id: activity.id, isForcingFetch });
            const fetchSplits = async () => {
                setIsFetchingSplits(true);
                try {
                    // Sanitize externalId: strip 'strava_' prefix if present. Safe null check.
                    if (!externalId) {
                        console.warn("Strava sync triggered but no externalId found.");
                        setFetchSplitsResult('error');
                        setIsFetchingSplits(false);
                        setIsForcingFetch(false);
                        return;
                    }
                    const sanitizedId = typeof externalId === 'string' ? externalId.replace('strava_', '') : externalId.toString();

                    console.log("Fetching splits/laps from Strava API for external ID:", sanitizedId);
                    const res = await fetch(`/api/strava/activities/${sanitizedId}/splits${isForcingFetch ? '?force=true' : ''}`, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });

                    if (res.ok) {
                        const data = await res.json();
                        console.log("Strava response data:", data);

                        // We consider it a success if we get splits, laps OR a description
                        if ((data.splits && data.splits.length > 0) || (data.laps && data.laps.length > 0) || data.description || data.name) {

                            // Map Splits
                            const mappedSplits = (data.splits || []).map((s: any) => ({
                                split: s.split,
                                distance: s.distance,
                                elapsedTime: s.elapsed_time,
                                movingTime: s.moving_time,
                                elevationDiff: s.elevation_difference,
                                averageSpeed: s.average_speed,
                                averageHeartrate: s.average_heartrate,
                                paceZone: s.pace_zone
                            }));

                            // Map Laps
                            const mappedLaps = (data.laps || []).map((l: any) => ({
                                name: l.name,
                                elapsedTime: l.elapsed_time,
                                movingTime: l.moving_time,
                                distance: l.distance,
                                averageSpeed: l.average_speed,
                                averageHeartrate: l.average_heartrate,
                                lapIndex: l.lap_index,
                                split: l.split
                            }));

                            // Map Best Efforts
                            const mappedBestEfforts = (data.best_efforts || []).map((be: any) => ({
                                name: be.name,
                                distance: be.distance,
                                elapsedTime: be.elapsed_time,
                                movingTime: be.moving_time,
                                startDate: be.start_date,
                                prRank: be.pr_rank
                            }));

                            // Prepare updates for local UI
                            const updates: any = { 
                                splits: mappedSplits, 
                                laps: mappedLaps,
                                bestEfforts: mappedBestEfforts,
                                averageHeartRate: data.average_heartrate,
                                maxHeartRate: data.max_heartrate,
                                averageWatts: data.average_watts,
                                maxWatts: data.max_watts,
                                elevationGain: data.total_elevation_gain,
                                calories: data.calories || data.kilojoules || 0
                            };

                            if (data.moving_time && (isForcingFetch || !activity.durationMinutes)) {
                                updates.durationMinutes = Math.round(data.moving_time / 60);
                            }
                            if (data.elapsed_time && (isForcingFetch || !perf?.elapsedTimeSeconds)) {
                                updates.elapsedTimeSeconds = data.elapsed_time;
                            }

                            if (data.description && (!activity.notes || activity.notes === activity.type || activity.notes === "" || isForcingFetch)) {
                                updates.notes = data.description;
                            }

                            if (data.name && (isForcingFetch || !displayTitle || displayTitle === activity.type || displayTitle === activity.notes)) {
                                updates.title = data.name;
                                setDisplayTitle(data.name);
                            }

                            // Update local UI state
                            updateExercise(activity.id, updates);
                            
                            // ALSO update the modal's local editForm so the user sees it immediately
                            setEditForm(prev => ({
                                ...prev,
                                notes: updates.notes || prev.notes,
                                title: updates.title || prev.title,
                                duration: updates.durationMinutes ? updates.durationMinutes.toString() : prev.duration,
                                elapsedTimeSeconds: updates.elapsedTimeSeconds || prev.elapsedTimeSeconds
                            }));

                            // We consider the "fetching" part done now
                            setIsFetchingSplits(false);
                            setIsForcingFetch(false);
                            setFetchSplitsResult('success');

                            // Persist to backend (Non-blocking)
                            const dateParam = activity.date.split('T')[0];
                            fetch(`/api/activities/${activity.id}?date=${dateParam}`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    title: updates.title,
                                    durationMinutes: updates.durationMinutes || activity.durationMinutes,
                                    notes: updates.notes || activity.notes,
                                    heartRateAvg: updates.averageHeartRate || activity.heartRateAvg,
                                    heartRateMax: updates.maxHeartRate || activity.heartRateMax,
                                    averageWatts: updates.averageWatts || activity.averageWatts,
                                    maxWatts: updates.maxWatts || activity.maxWatts,
                                    caloriesBurned: updates.calories || activity.caloriesBurned,
                                    performance: {
                                        ...(perf || {}),
                                        splits: mappedSplits,
                                        laps: mappedLaps,
                                        bestEfforts: mappedBestEfforts,
                                        notes: updates.notes || perf?.notes || activity.notes,
                                        durationMinutes: updates.durationMinutes || activity.durationMinutes,
                                        elapsedTimeSeconds: updates.elapsedTimeSeconds || perf?.elapsedTimeSeconds,
                                        averageHeartRate: updates.averageHeartRate || perf?.averageHeartRate,
                                        maxHeartRate: updates.maxHeartRate || perf?.maxHeartRate,
                                        averageWatts: updates.averageWatts || perf?.averageWatts,
                                        maxWatts: updates.maxWatts || perf?.maxWatts,
                                        elevationGain: updates.elevationGain || perf?.elevationGain,
                                        calories: updates.calories || perf?.calories
                                    }
                                })
                            }).then(async (pRes) => {
                                if (pRes.status === 404) {
                                    // If not found, it's likely a Strava activity not yet in our DB, try POST
                                    console.log("Activity not found for PATCH, attempting upsert via POST...");
                                    const { userId: _u, ...activityData } = universalActivity || {};
                                    await fetch('/api/activities', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify({
                                            ...activityData,
                                            id: activity.id,
                                            date: activity.date,
                                            type: activity.type,
                                            title: updates.title || activity.title,
                                            heartRateAvg: updates.averageHeartRate || activity.heartRateAvg,
                                            heartRateMax: updates.maxHeartRate || activity.heartRateMax,
                                            averageWatts: updates.averageWatts || activity.averageWatts,
                                            maxWatts: updates.maxWatts || activity.maxWatts,
                                            caloriesBurned: updates.calories || activity.caloriesBurned,
                                            performance: {
                                                ...(perf || {}),
                                                splits: mappedSplits,
                                                laps: mappedLaps,
                                                bestEfforts: mappedBestEfforts,
                                                notes: updates.notes || perf?.notes || activity.notes,
                                                durationMinutes: updates.durationMinutes || activity.durationMinutes,
                                                elapsedTimeSeconds: updates.elapsedTimeSeconds || perf?.elapsedTimeSeconds,
                                                averageHeartRate: updates.averageHeartRate || perf?.averageHeartRate,
                                                maxHeartRate: updates.maxHeartRate || perf?.maxHeartRate,
                                                averageWatts: updates.averageWatts || perf?.averageWatts,
                                                maxWatts: updates.maxWatts || perf?.maxWatts,
                                                elevationGain: updates.elevationGain || perf?.elevationGain,
                                                calories: updates.calories || perf?.calories
                                            }
                                        })
                                    });
                                }
                            }).catch(err => console.error("Background persistence failed:", err));
                        } else {
                            console.log("No detailed data found in Strava API response");
                            setFetchSplitsResult('error');
                            setIsFetchingSplits(false);
                            setIsForcingFetch(false);
                        }
                    } else {
                        const errorData = await res.json().catch(() => ({}));
                        console.error("❌ ActivityDetailModal: Split fetch failed:", {
                            status: res.status,
                            error: errorData.error
                        });
                        setFetchSplitsResult('error');
                        setIsFetchingSplits(false);
                        setIsForcingFetch(false);
                    }
                } catch (err) {
                    console.error("❌ ActivityDetailModal: Split fetch error:", err);
                    setFetchSplitsResult('error');
                    setIsFetchingSplits(false);
                    setIsForcingFetch(false);
                }
            };

            fetchSplits();
        }
    }, [activity.id, activity.source, activity.externalId, (activity as any).platform, universalActivity, token, existingSplits, fetchSplitsResult, updateExercise, isFetchingSplits, isForcingFetch]);

    // Auto-apply power if found in description (specifically for cycling)
    React.useEffect(() => {
        // Only auto-apply if:
        // 1. We found an average power in the description
        // 2. It's a cycling activity
        // 3. Current averageWatts is missing or different
        if (parsedWorkout?.averagePower && 
            activity.type === 'cycling' && 
            (perf?.averageWatts !== parsedWorkout.averagePower)) {
            
            console.log("ActivityDetailModal: Auto-applying parsed average power:", parsedWorkout.averagePower);
            
            // Determine if we should also update calculation mode
            // We do it if it's not already 'adjusted' or something specifically set by user
            const shouldUpdateMode = !activity.isCalorieAdjusted || activity.caloriesBurned === 0;

            updateExercise(activity.id, { 
                averageWatts: parsedWorkout.averagePower,
                performance: {
                    ...(perf || {}),
                    averageWatts: parsedWorkout.averagePower
                },
                ...(shouldUpdateMode ? {
                    calculationMode: 'watts',
                    isCalorieAdjusted: true
                } : {})
            });
            
            // Persist to backend if token exists
            if (token) {
                const dateParam = activity.date.split('T')[0];
                fetch(`/api/activities/${activity.id}?date=${dateParam}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        averageWatts: parsedWorkout.averagePower,
                        ...(shouldUpdateMode ? {
                            calculationMode: 'watts',
                            isCalorieAdjusted: true
                        } : {})
                    })
                }).catch(err => console.error('Failed to auto-apply power:', err));
            }
        }
    }, [parsedWorkout?.averagePower, activity.id, activity.type, activity.averageWatts, perf?.averageWatts, token]);

    // Apply Category Helper - Updates the EXISTING activity's subType
    const handleApplyCategory = (category: ExerciseSubType) => {
        // Always update the existing activity - never create a duplicate
        updateExercise(activity.id, { subType: category });
        // No alert, rely on UI update
    };

    // Auto-apply category if confidence is high
    React.useEffect(() => {
        // Only if we have a suggestion and current is default
        if (parsedWorkout?.suggestedSubType &&
            parsedWorkout.suggestedSubType !== 'default' &&
            (activity.subType === 'default' || !activity.subType)) {

            // "High Confidence" Logic:
            // 1. If it's explicitly 'long-run' or 'tempo' (keyword match), we trust it.
            // 2. If it's 'interval', we want to see > 2 interval segments or a high segment count.
            //    (A single interval might be a misinterpretation of a steady run with a lap)

            const isKeywordMatch = parsedWorkout.suggestedSubType === 'long-run' || parsedWorkout.suggestedSubType === 'tempo';
            const intervalCount = parsedWorkout.segments.filter(s => s.type === 'INTERVAL').length;
            const isSolidIntervals = parsedWorkout.suggestedSubType === 'interval' && intervalCount >= 2;

            if (isKeywordMatch || isSolidIntervals) {
                // Auto-apply!
                handleApplyCategory(parsedWorkout.suggestedSubType as any);
                // Toast or Console log? User requested it happens automatically.
                // We rely on UI update to show the change.
            }
        }
    }, [parsedWorkout, activity.subType, activity.source]); // activity.subType dep ensures we don't loop if it changes

    // Handle Save
    const handleSave = async (e: React.FormEvent) => {
        try {
            e.preventDefault();
            console.log("ActivityDetailModal: handleSave triggered", { calculationMode: editForm.calculationMode });

            const duration = parseInt(editForm.duration) || 0;
            const avgWatts = editForm.averageWatts ? parseFloat(editForm.averageWatts) : undefined;
            const distance = editForm.distance ? parseFloat(editForm.distance) : undefined;
            let calories = calorieOptions[editForm.calculationMode as keyof typeof calorieOptions] || calorieOptions.original;
            let isCalorieAdjusted = editForm.calculationMode !== 'original';
            const originalCalories = (activity as any).originalCalories || perf?.originalCalories || calorieOptions.original;

            // Legacy/Special Watts handling (Keep for UI sync if needed, but calculationMode is the new master)
            if (editForm.calculationMode === 'watts' && avgWatts && avgWatts > 0) {
                calories = calorieOptions.watts;
                isCalorieAdjusted = true;
            } else if (editForm.calculationMode === 'average') {
                calories = calorieOptions.average;
                isCalorieAdjusted = true;
            } else if (editForm.calculationMode === 'hr') {
                calories = calorieOptions.hr;
                isCalorieAdjusted = true;
            } else if (editForm.calculationMode === 'distance') {
                calories = calorieOptions.distance;
                isCalorieAdjusted = true;
            } else if (editForm.calculationMode === 'met') {
                calories = calorieOptions.met;
                isCalorieAdjusted = true;
            }

            let updatedNotes = editForm.notes;
            if ((editForm as any).startKm && parseFloat((editForm as any).startKm) >= 0) {
                updatedNotes = updatedNotes.replace(/\[START_KM:\s*[\d.]+\]/g, '').trim();
                updatedNotes += ` [START_KM: ${parseFloat((editForm as any).startKm).toFixed(1)}]`;
            }

            const commonData = {
                title: editForm.title,
                type: editForm.type,
                durationMinutes: duration,
                intensity: editForm.intensity,
                notes: updatedNotes,
                subType: editForm.subType as any,
                tonnage: editForm.tonnage ? parseFloat(editForm.tonnage) : undefined,
                distance: editForm.distance ? parseFloat(editForm.distance) : undefined,
                heartRateAvg: editForm.averageHeartRate ? parseInt(editForm.averageHeartRate) : undefined,
                heartRateMax: editForm.maxHeartRate ? parseInt(editForm.maxHeartRate) : undefined,
                averageWatts: avgWatts,
                caloriesBurned: calories,
                isCalorieAdjusted,
                calculationMode: editForm.calculationMode,
                originalCalories,
                location: editForm.location,
                excludeFromStats: editForm.excludeFromStats,
                excludeFromRecords: editForm.excludeFromRecords,
                excludeHeartRate: editForm.excludeHeartRate,
                isHiddenInCalendar: editForm.isHiddenInCalendar,
                hyroxStats: editForm.type === 'hyrox' ? editForm.hyroxStats : undefined,
                raceDetails: editForm.subType === 'race' || editForm.subType === 'competition' ? {
                    ...(activity.raceDetails || {}),
                    placement: (function() {
                        const val = ((editForm as any).placement || '').toString().trim();
                        if (val.includes('/')) return parseInt(val.split('/')[0]) || undefined;
                        return parseInt(val) || undefined;
                    })(),
                    totalParticipants: (function() {
                        const val = ((editForm as any).totalParticipants || '').toString().trim();
                        if (val.includes('/')) return parseInt(val.split('/')[1]) || undefined;
                        return parseInt(val) || undefined;
                    })()
                } : activity.raceDetails,
                elapsedTimeSeconds: editForm.elapsedTimeSeconds
            };

            // Local update (works for 'manual', 'strava', and 'merged')
            // Local update and persistence (Context handles both)
            updateExercise(activity.id, {
                ...commonData,
                averageWatts: avgWatts,
                isCalorieAdjusted,
                caloriesBurned: calories,
                performance: {
                    ...(perf || {}),
                    averageWatts: avgWatts,
                    avgHeartRate: commonData.heartRateAvg,
                    maxHeartRate: commonData.heartRateMax,
                    calories: calories,
                    isCalorieAdjusted,
                    calculationMode: editForm.calculationMode,
                    originalCalories,
                    durationMinutes: duration,
                    distanceKm: commonData.distance,
                    notes: updatedNotes,
                    activityType: editForm.type
                },
                plan: {
                    ...(universalActivity?.plan || {}),
                    title: editForm.title,
                    activityType: editForm.type,
                    distanceKm: commonData.distance
                },
                excludeHeartRate: editForm.excludeHeartRate
            });

            console.log("ActivityDetailModal: updateExercise called successfully");
            setIsEditing(false);
        } catch (error) {
            console.error("ActivityDetailModal: handleSave FAILED:", error);
            alert("Ett fel uppstod vid sparande: " + (error instanceof Error ? error.message : String(error)));
        }
    };

    // Handle Delete
    const handleDelete = () => {
        if (confirm('Är du säker på att du vill ta bort denna aktivitet?')) {
            deleteExercise(activity.id);
            onClose();
        }
    };

    // Update Title Helper
    const handleUpdateTitle = async (newTitle: string) => {
        if (!newTitle) return;
        setDisplayTitle(newTitle); // Immediate UI update
        updateExercise(activity.id, { title: newTitle });

        // Persist to backend
        if (token) {
            try {
                const dateParam = activity.date.split('T')[0];
                const res = await fetch(`/api/activities/${activity.id}?date=${dateParam}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ title: newTitle })
                });

                if (res.status === 404) {
                    // Fallback to Upsert (POST) - MUST use universalActivity to preserve all Strava data
                    if (universalActivity) {
                        const { userId: _u, ...activityData } = universalActivity;
                        const updatedActivity = {
                            ...activityData,
                            plan: {
                                ...universalActivity.plan,
                                title: newTitle,
                                activityType: universalActivity.plan?.activityType || universalActivity.performance?.activityType || 'other',
                                distanceKm: activity.distance || universalActivity.plan?.distanceKm || universalActivity.performance?.distanceKm || 0
                            }
                        };
                        await fetch('/api/activities', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(updatedActivity)
                        });
                    } else {
                        console.warn("Skipping fallback POST: universalActivity not available, would corrupt data");
                    }
                }
            } catch (e) {
                console.error("Failed to persist title:", e);
            }
        }
    };

    // Enforce Strava Title Priority on Mount
    const titleCheckedRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        // Reset check if activity changes (though modal usually remounts, this handles prop changes)
        if (titleCheckedRef.current !== activity.id) {
            titleCheckedRef.current = null;
        }

        if (titleCheckedRef.current === activity.id) return;

        if (isTrulyMerged && originalActivities.length > 0) {
            const stravaSource = originalActivities.find(a => a.performance?.source?.source === 'strava');
            const currentTitle = universalActivity?.plan?.title || activity.title;
            const stravaTitle = stravaSource?.plan?.title || (stravaSource as any)?.title || (stravaSource?.performance?.activityType ? `Strava ${stravaSource.performance.activityType}` : 'Strava Activity');

            // If we have a Strava title, and the current title is likely a default/fallback (or just different),
            // we update it. We check if it's NOT already the Strava title.
            // We use a loose check or just force it effectively.
            if (stravaTitle && currentTitle !== stravaTitle) {
                setDisplayTitle(stravaTitle); // Sync local state
                updateExercise(activity.id, { title: stravaTitle });

                // Persist auto-fix
                if (token) {
                    const dateParam = activity.date.split('T')[0];
                    fetch(`/api/activities/${activity.id}?date=${dateParam}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ title: stravaTitle })
                    }).then(async (res) => {
                        if (res.status === 404) {
                            // Fallback to Upsert - MUST use universalActivity to preserve all Strava data
                            if (universalActivity) {
                                const { userId: _u, ...activityData } = universalActivity;
                                const updatedActivity = {
                                    ...activityData,
                                    plan: {
                                        ...universalActivity.plan,
                                        title: stravaTitle,
                                        activityType: universalActivity.plan?.activityType || universalActivity.performance?.activityType || 'other',
                                        distanceKm: activity.distance || universalActivity.plan?.distanceKm || universalActivity.performance?.distanceKm || 0
                                    }
                                };
                                await fetch('/api/activities', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify(updatedActivity)
                                });
                            } else {
                                console.warn("Skipping fallback POST: universalActivity not available");
                            }
                        }
                    }).catch(e => console.error("Auto-persist failed:", e));
                }
            }

            // Mark as checked so we don't loop
            titleCheckedRef.current = activity.id;
        }
    }, [isTrulyMerged, originalActivities, universalActivity?.plan?.title, activity.title, activity.id, token]);

    const handleCopyJson = () => {
        const payload: any = {
            titel: displayTitle,
            datum: activity.date,
            typ: activity.type,
            tid: activity.durationMinutes ? `${Math.floor(activity.durationMinutes)} min ${Math.round((activity.durationMinutes % 1) * 60)} sek` : '0 min',
            distans: activity.distance ? `${activity.distance.toFixed(2)} km` : undefined,
        };

        if (perf) {
            if (perf.avgHeartRate) payload.pulsSnitt = `${Math.round(perf.avgHeartRate)} bpm`;
            if (perf.maxHeartrate) payload.pulsMax = `${Math.round(perf.maxHeartrate)} bpm`;

            if (activity.distance && perf.durationMinutes) {
                const speedKmh = (activity.distance / (perf.durationMinutes / 60));
                payload.hastighetSnitt = `${speedKmh.toFixed(1)} km/h`;
                // Average pace in seconds per km
                const paceSec = (perf.durationMinutes * 60) / activity.distance;
                payload.tempoSnitt = `${Math.floor(paceSec / 60)}:${Math.round(paceSec % 60).toString().padStart(2, '0')} /km`;
            }
        }

        if (splits && splits.length > 0) {
            payload.splittar = splits.map((s: any, idx: number) => {
                const distMeters = s.distance || 1000;
                const paceSec = s.movingTime / (distMeters / 1000);
                return {
                    km: s.split || idx + 1,
                    tid: formatSecondsToTime(s.movingTime),
                    puls: s.averageHeartrate || s.avgHeartRate ? Math.round(s.averageHeartrate || s.avgHeartRate) : undefined,
                    tempo: `${Math.floor(paceSec / 60)}:${Math.round(paceSec % 60).toString().padStart(2, '0')} /km`
                };
            });
        }

        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        alert('Kopierat till JSON! 📋');
    };

    // ESC to close
    React.useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div id="activity-detail-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* EDIT MODE */}
                {isEditing ? (
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-2xl font-black text-white">Redigera aktivitet</h2>
                            <button type="button" onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-white">✕</button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Titel</label>
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                placeholder="Passets namn..."
                                className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white font-bold focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>

                        {/* Type Selection - Radically Compacted */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5 p-1.5 bg-slate-950/50 rounded-2xl border border-white/5">
                            {EXERCISE_TYPES.map(t => (
                                <button
                                    key={t.type}
                                    type="button"
                                    className={`py-1.5 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border ${editForm.type === t.type ? 'bg-emerald-500 border-emerald-400 text-slate-900 shadow-lg shadow-emerald-500/20' : 'bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                    onClick={() => setEditForm({ ...editForm, type: t.type })}
                                >
                                    <span className="text-base">{t.icon}</span>
                                    <span className="text-[8px] font-black uppercase tracking-tighter truncate w-full text-center px-0.5">{t.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Time Discrepancy Warning in Edit Mode */}
                        {editForm.elapsedTimeSeconds > 0 && Math.abs(editForm.elapsedTimeSeconds - (parseInt(editForm.duration) || 0) * 60) > 120 && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500">
                                        <Timer size={16} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Tidsavvikelse</p>
                                        <p className="text-[11px] text-white font-bold">
                                            Rörelse: {formatDuration(parseInt(editForm.duration) * 60)} vs Totalt: {formatDuration(editForm.elapsedTimeSeconds)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => setEditForm(prev => ({ ...prev, duration: Math.round(prev.elapsedTimeSeconds / 60).toString() }))}
                                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[9px] font-black uppercase rounded-lg transition-all"
                                    >
                                        Använd Total ⚡
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            console.log("ActivityDetailModal: Resetting to moving time...");
                                            // Find original moving time from sources
                                            const stravaOrig = originalActivities.find(o => o.performance?.source?.source === 'strava');
                                            const originalMovingMin = stravaOrig?.performance?.durationMinutes || perf?.durationMinutes || activity.durationMinutes;
                                            
                                            if (originalMovingMin) {
                                                setEditForm(prev => ({ ...prev, duration: Math.round(originalMovingMin).toString() }));
                                            } else {
                                                console.warn("ActivityDetailModal: No original moving time found");
                                            }
                                        }}
                                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase rounded-lg transition-all border border-white/5"
                                    >
                                        Återställ Rörelse
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Rörelse (min)</label>
                                <input
                                    type="number"
                                    value={editForm.duration}
                                    onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                    className="w-full bg-slate-800/80 border border-white/5 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Totaltid (min)</label>
                                <input
                                    type="number"
                                    value={Math.round(editForm.elapsedTimeSeconds / 60)}
                                    onChange={e => setEditForm({ ...editForm, elapsedTimeSeconds: (parseInt(e.target.value) || 0) * 60 })}
                                    className="w-full bg-slate-800/80 border border-white/5 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono opacity-60"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Intensitet</label>
                                <select
                                    value={editForm.intensity}
                                    onChange={e => setEditForm({ ...editForm, intensity: e.target.value as ExerciseIntensity })}
                                    className="w-full bg-slate-800/80 border border-white/5 rounded-xl px-3 py-1.5 text-sm text-white appearance-none focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                                >
                                    {INTENSITIES.map(i => <option key={i.value} value={i.value} className="bg-slate-900">{i.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Kategori</label>
                                <select
                                    value={editForm.subType || 'default'}
                                    onChange={e => setEditForm({ ...editForm, subType: e.target.value as ExerciseSubType })}
                                    className="w-full bg-slate-800/80 border border-white/5 rounded-xl px-3 py-1.5 text-sm text-white appearance-none focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
                                >
                                    <option value="default">Standard</option>
                                    <option value="interval">Intervaller</option>
                                    <option value="long-run">Långpass</option>
                                    <option value="race">Lopp</option>
                                    <option value="tonnage">Styrka</option>
                                    <option value="competition">Tävling</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Average Watts / Distance / Tonnage - Dynamic Row */}
                            {['cycling', 'cardio', 'other'].includes(editForm.type) ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 ml-1">
                                        <Zap size={10} /> Effekt (Watt)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Avg..."
                                        value={editForm.averageWatts}
                                        onChange={e => setEditForm({ ...editForm, averageWatts: e.target.value })}
                                        className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                                    />
                                    {parseFloat(editForm.averageWatts) > 0 && (
                                        <div 
                                            onClick={() => setEditForm(prev => {
                                                const newUseTheoretical = !prev.useTheoreticalKcal;
                                                return { 
                                                    ...prev, 
                                                    useTheoreticalKcal: newUseTheoretical,
                                                    calculationMode: newUseTheoretical ? 'watts' : 'original'
                                                };
                                            })}
                                            className={`mt-1.5 flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${editForm.calculationMode === 'watts' ? 'bg-amber-500/20 border-amber-500/30' : 'bg-slate-900/50 border-white/5 opacity-60'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black uppercase text-amber-500 tracking-tighter">Beräkna Kcal från Watt</span>
                                                <span className="text-[10px] text-white font-mono">{Math.round((parseFloat(editForm.averageWatts) * (parseInt(editForm.duration) || 0) * 60) / 1000)} kcal</span>
                                            </div>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${editForm.useTheoreticalKcal ? 'bg-amber-500 border-amber-400' : 'border-white/20'}`}>
                                                {editForm.useTheoreticalKcal && <Zap size={10} className="text-slate-900" fill="currentColor" />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (editForm.type === 'running' || editForm.type === 'cycling' || editForm.type === 'walking' || editForm.type === 'swimming' || editForm.type === 'hyrox' || editForm.type === 'cardio') ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Distans (km)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={editForm.distance}
                                        onChange={e => setEditForm({ ...editForm, distance: e.target.value })}
                                        className="w-full bg-slate-800/80 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                    />
                                </div>
                            ) : editForm.type === 'strength' ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tonnage (kg)</label>
                                    <input
                                        type="number"
                                        placeholder="Totalt..."
                                        value={editForm.tonnage}
                                        onChange={e => setEditForm({ ...editForm, tonnage: e.target.value })}
                                        className="w-full bg-slate-800/80 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                    />
                                </div>
                            ) : null}

                            {/* Heart Rate & Pulse Data */}
                            <div className="md:col-span-2 space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                            <HeartPulse size={12} className="text-rose-500" /> Pulsdata
                                        </label>
                                        {(originalHr.avg || originalHr.max) ? (
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                Givarpuls: <span className="text-slate-300">{originalHr.avg || '-'}</span> snitt / <span className="text-slate-300">{originalHr.max || '-'}</span> max
                                            </p>
                                        ) : (
                                            <p className="text-[10px] text-slate-500 font-bold uppercase italic">Ingen sensordata tillgänglig</p>
                                        )}
                                    </div>
                                    
                                    <button
                                        type="button"
                                        onClick={() => setShowHrOverride(!showHrOverride)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all border ${
                                            showHrOverride 
                                            ? 'bg-rose-500 text-white border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                                            : 'bg-slate-800 text-rose-500 border-rose-500/20 hover:border-rose-500/50'
                                        }`}
                                    >
                                        {showHrOverride ? '✓ Aktiv Override' : 'Manuellt korrigera'}
                                    </button>
                                </div>

                                {showHrOverride && (
                                    <div className="grid grid-cols-2 gap-4 bg-rose-500/5 p-4 rounded-2xl border border-rose-500/20 animate-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 ml-1">
                                                Snittpuls (Manuell)
                                            </label>
                                            <input
                                                type="number"
                                                placeholder={originalHr.avg?.toString() || "BPM..."}
                                                value={editForm.averageHeartRate}
                                                onChange={e => setEditForm({ ...editForm, averageHeartRate: e.target.value })}
                                                className="w-full bg-slate-900 border-white/10 rounded-xl p-3 text-white focus:border-rose-500 outline-none font-mono text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 ml-1">
                                                Maxpuls (Manuell)
                                            </label>
                                            <input
                                                type="number"
                                                placeholder={originalHr.max?.toString() || "BPM..."}
                                                value={editForm.maxHeartRate}
                                                onChange={e => setEditForm({ ...editForm, maxHeartRate: e.target.value })}
                                                className="w-full bg-slate-900 border-white/10 rounded-xl p-3 text-white focus:border-rose-500 outline-none font-mono text-sm"
                                            />
                                        </div>
                                        <div className="col-span-2 flex items-start gap-2 bg-rose-500/10 p-2 rounded-lg">
                                            <AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                            <p className="text-[9px] text-rose-200 font-bold uppercase tracking-tight leading-relaxed">
                                                Manuellt angiven puls prioriteras vid beräkningar av kalorier och intensitetspoäng för detta pass.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Race Toggle */}
                            <div className="md:col-span-2">
                                <div
                                    onClick={() => setEditForm(prev => ({ ...prev, subType: prev.subType === 'race' ? 'default' : 'race' }))}
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${editForm.subType === 'race' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-800 border-white/5 opacity-80 hover:opacity-100'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg ${editForm.subType === 'race' ? 'opacity-100' : 'opacity-40'}`}>🏁</span>
                                        <div>
                                            <p className={`text-xs font-bold ${editForm.subType === 'race' ? 'text-amber-400' : 'text-white'}`}>Tävling / Race</p>
                                            <p className="text-[10px] text-slate-500">Markera att detta pass var ett tävlingslopp</p>
                                        </div>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full relative transition-all ${editForm.subType === 'race' ? 'bg-amber-500' : 'bg-slate-700'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.subType === 'race' ? 'left-5' : 'left-1'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Hyrox Toggle for specific competition mode */}
                            {editForm.type === 'hyrox' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Typ</label>
                                    <div className="flex bg-slate-800 rounded-xl p-1 border border-white/5">
                                        {[
                                            { id: 'competition', label: 'Tävling' },
                                            { id: 'race', label: 'Simulering' },
                                            { id: 'default', label: 'Träning' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setEditForm({ ...editForm, subType: opt.id as any })}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${editForm.subType === opt.id
                                                    ? 'bg-emerald-500 text-slate-900 shadow'
                                                    : 'text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}


                            {/* Placement Inputs for Race Mode */}
                            {(editForm.subType === 'race' || editForm.subType === 'competition') && (
                                <div className="grid grid-cols-2 gap-4 md:col-span-2 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-amber-500 uppercase">🏁 Placering</label>
                                        <input
                                            type="text"
                                            placeholder="t.ex. 1"
                                            value={editForm.placement}
                                            onChange={e => setEditForm({ ...editForm, placement: e.target.value })}
                                            className="w-full bg-slate-900 border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-amber-500 uppercase">Deltagare</label>
                                        <input
                                            type="text"
                                            placeholder="Totalt antal"
                                            value={editForm.totalParticipants}
                                            onChange={e => setEditForm({ ...editForm, totalParticipants: e.target.value })}
                                            className="w-full bg-slate-900 border-white/10 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Start KM Slider for Extracts */}
                            {activity.extractedFromId && parentUniversal && (
                                <div className="space-y-1 bg-slate-800/50 p-3 rounded-xl border border-white/5 md:col-span-2">
                                    <label className="text-xs font-bold text-amber-400 uppercase flex justify-between">
                                        <span>Skjutreglage: Start-kilometer</span>
                                        <span>{parseFloat((editForm as any).startKm || '0').toFixed(1)} km</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max={Math.max(0, (parentUniversal?.performance?.distanceKm || 0) - (parseFloat(editForm.distance) || 0))}
                                        step="0.1"
                                        value={(editForm as any).startKm || '0'}
                                        onChange={e => setEditForm(prev => ({ ...prev, startKm: e.target.value }))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                        <span>0.0 km</span>
                                        <span>{Math.max(0, (parentUniversal?.performance?.distanceKm || 0) - (parseFloat(editForm.distance) || 0)).toFixed(1)} km</span>
                                    </div>
                                </div>
                            )}

                            {editForm.type === 'strength' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Tonnage (kg)</label>
                                    <input
                                        type="number"
                                        placeholder="-"
                                        value={editForm.tonnage}
                                        onChange={e => setEditForm({ ...editForm, tonnage: e.target.value })}
                                        className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                            )}

                            {/* Location Input */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Plats / Ort</label>
                                <input
                                    type="text"
                                    placeholder="T.ex. Stockholm, Båstad..."
                                    value={editForm.location}
                                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                                    className="w-full bg-slate-800/80 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                                />
                            </div>

                            {/* HIDE TOGGLE */}
                            <div className="space-y-1 col-span-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Visa i kalender</label>
                                <div
                                    onClick={() => setEditForm({ ...editForm, isHiddenInCalendar: !editForm.isHiddenInCalendar })}
                                    className="flex items-center gap-3 cursor-pointer group p-3 bg-slate-800 hover:bg-slate-750 border border-white/5 rounded-xl transition-colors h-[46px]"
                                >
                                    <div className="relative">
                                        <div className={`w-8 h-4 rounded-full transition-colors border border-white/5 ${!editForm.isHiddenInCalendar ? 'bg-emerald-500/50' : 'bg-rose-500/50'}`}></div>
                                        <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-transform ${!editForm.isHiddenInCalendar ? 'translate-x-5 left-1' : 'translate-x-1 left-0'}`}></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-200 group-hover:text-white transition-colors">
                                        {!editForm.isHiddenInCalendar ? 'Synlig' : 'Dold'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Anteckningar</label>
                            <textarea
                                rows={3}
                                value={editForm.notes}
                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white resize-none focus:outline-none focus:border-emerald-500/50"
                            />
                        </div>

                        {/* Kaloriberäkning Source Selector */}
                        <div className="md:col-span-2 space-y-2 pt-2 border-t border-white/5">
                            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                                <Search size={10} /> Kaloriberäkning (Källa)
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                {[
                                    { id: 'original', label: activity.source === 'strava' ? 'Strava' : 'Original', val: calorieOptions.original, icon: <Activity size={12} />, color: 'text-orange-400' },
                                    { id: 'hr', label: 'Pulsdata', val: calorieOptions.hr, icon: <HeartPulse size={12} />, color: 'text-rose-400', disabled: calorieOptions.hr === 0 },
                                    { id: 'distance', label: 'kg/km', val: calorieOptions.distance, icon: <Footprints size={12} />, color: 'text-emerald-400', disabled: calorieOptions.distance === 0 },
                                    { id: 'met', label: 'Schablon', val: calorieOptions.met, icon: <Clock size={12} />, color: 'text-sky-400' },
                                    { id: 'watts', label: 'Watt', val: calorieOptions.watts, icon: <Zap size={12} />, color: 'text-amber-400', disabled: calorieOptions.watts === 0 },
                                    { id: 'average', label: 'Snitt', val: calorieOptions.average, icon: <Calculator size={12} />, color: 'text-purple-400' }
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        disabled={opt.disabled}
                                        onClick={() => setEditForm({ 
                                            ...editForm, 
                                            calculationMode: opt.id as any,
                                            useTheoreticalKcal: opt.id === 'watts'
                                        })}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${opt.disabled ? 'opacity-20 cursor-not-allowed grayscale' :
                                            editForm.calculationMode === opt.id
                                                ? 'bg-white/10 border-white/20 shadow-lg scale-[1.02]'
                                                : 'bg-slate-800/40 border-white/5 opacity-60 hover:opacity-100 hover:bg-slate-800'
                                            }`}
                                    >
                                        <div className={`flex items-center gap-1.5 mb-1 ${opt.color} font-black uppercase text-[8px]`}>
                                            {opt.icon} {opt.label}
                                        </div>
                                        <div className="text-xs font-mono font-bold text-white">
                                            {opt.val} <span className="text-[8px] opacity-40 font-black">kcal</span>
                                        </div>
                                        {editForm.calculationMode === opt.id && (
                                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {editForm.type === 'hyrox' && (
                            <div className="space-y-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Hyrox Splits</h3>
                                    <div className="text-xs text-slate-500 font-mono">
                                        Total: <span className="text-emerald-400 font-bold">{
                                            formatDuration(
                                                (editForm.hyroxStats?.runSplits?.reduce((a, b) => a + (b || 0), 0) || 0) +
                                                (Object.values(editForm.hyroxStats?.stations || {}).reduce((a, b) => a + (b || 0), 0) || 0)
                                            )
                                        }</span>
                                    </div>
                                </div>

                                {/* Parser Toggle */}
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowParser(!showParser)}
                                        className="text-xs text-amber-500 font-bold flex items-center gap-1 hover:text-amber-400"
                                    >
                                        <Wand2 size={12} /> {showParser ? 'Göm import' : 'Importera från text'}
                                    </button>
                                </div>

                                {showParser && (
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 space-y-2 animate-in slide-in-from-top-2">
                                        <textarea
                                            value={parseText}
                                            onChange={e => setParseText(e.target.value)}
                                            placeholder="Klistra in mellantider här (t.ex. 'R1: 05:30', 'S1: 04:00')..."
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-mono text-white h-24 focus:outline-none focus:border-amber-500/50"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const parsed = parseHyroxText(parseText);
                                                    setEditForm({
                                                        ...editForm,
                                                        hyroxStats: {
                                                            runSplits: parsed.runSplits.map((v, i) => v || editForm.hyroxStats?.runSplits?.[i] || 0),
                                                            stations: { ...editForm.hyroxStats?.stations, ...parsed.stations }
                                                        }
                                                    });
                                                    setShowParser(false);
                                                    setParseText('');
                                                }}
                                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold rounded-lg"
                                            >
                                                Applicera
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {/* 8 Rounds */}
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2">
                                            {/* Run Split */}
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">🏃</span>
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-500">Run {i + 1} (1km)</label>
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="text"
                                                            placeholder="mm:ss"
                                                            value={editForm.hyroxStats?.runSplits?.[i] ? formatSecondsToTime(editForm.hyroxStats.runSplits[i]) : ''}
                                                            onChange={e => {
                                                                // Parse mm:ss to seconds
                                                                const parts = e.target.value.split(':');
                                                                let sec = 0;
                                                                if (parts.length === 2) {
                                                                    sec = (parseInt(parts[0]) * 60) + parseInt(parts[1]);
                                                                } else if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
                                                                    sec = parseInt(parts[0]);
                                                                }

                                                                const newSplits = [...(editForm.hyroxStats?.runSplits || [])];
                                                                newSplits[i] = sec;

                                                                setEditForm({
                                                                    ...editForm,
                                                                    hyroxStats: {
                                                                        ...editForm.hyroxStats,
                                                                        runSplits: newSplits
                                                                    }
                                                                });
                                                            }}
                                                            className="w-full bg-slate-900 border-white/10 rounded-lg p-2 text-white font-mono text-sm focus:border-emerald-500/50 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Station Split */}
                                            <div className="flex items-center gap-3 pl-8 border-l-2 border-slate-700/50 ml-2">
                                                <span className="text-xl">{HYROX_STATIONS[i].icon}</span>
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[10px] uppercase font-bold text-amber-500/80">{HYROX_STATIONS[i].label}</label>
                                                    <input
                                                        type="text"
                                                        placeholder="mm:ss"
                                                        value={editForm.hyroxStats?.stations?.[HYROX_STATIONS[i].id] ? formatSecondsToTime(editForm.hyroxStats.stations?.[HYROX_STATIONS[i].id] as number) : ''}
                                                        onChange={e => {
                                                            const parts = e.target.value.split(':');
                                                            let sec = 0;
                                                            if (parts.length === 2) {
                                                                sec = (parseInt(parts[0]) * 60) + parseInt(parts[1]);
                                                            } else if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
                                                                sec = parseInt(parts[0]);
                                                            }

                                                            setEditForm({
                                                                ...editForm,
                                                                hyroxStats: {
                                                                    ...editForm.hyroxStats,
                                                                    stations: {
                                                                        ...editForm.hyroxStats?.stations,
                                                                        [HYROX_STATIONS[i].id]: sec
                                                                    }
                                                                }
                                                            });
                                                        }}
                                                        className="w-full bg-slate-900 border-white/10 rounded-lg p-2 text-white font-mono text-sm focus:border-amber-500/50 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats Exclusion Toggle */}
                        <div
                            onClick={() => setEditForm({ ...editForm, excludeFromStats: !editForm.excludeFromStats })}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${editForm.excludeFromStats ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-800 border-white/5 opacity-60 hover:opacity-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`text-lg ${editForm.excludeFromStats ? 'opacity-100' : 'opacity-40'}`}>🚫</span>
                                <div>
                                    <p className={`text-xs font-bold ${editForm.excludeFromStats ? 'text-rose-400' : 'text-white'}`}>Exkludera från all statistik</p>
                                    <p className="text-[10px] text-slate-500">Döljs helt från total distans och alla beräkningar</p>
                                </div>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-all ${editForm.excludeFromStats ? 'bg-rose-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.excludeFromStats ? 'left-5' : 'left-1'}`} />
                            </div>
                        </div>

                        {/* Records Exclusion Toggle */}
                        <div
                            onClick={() => setEditForm({ ...editForm, excludeFromRecords: !editForm.excludeFromRecords })}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${editForm.excludeFromRecords ? 'bg-orange-500/10 border-orange-500/30' : 'bg-slate-800 border-white/5 opacity-60 hover:opacity-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`text-lg ${editForm.excludeFromRecords ? 'opacity-100' : 'opacity-40'}`}>✂️</span>
                                <div>
                                    <p className={`text-xs font-bold ${editForm.excludeFromRecords ? 'text-orange-400' : 'text-white'}`}>Undanta från Rekord/Topplistor</p>
                                    <p className="text-[10px] text-slate-500">Perfekt för intervallpass med ståvila (Visas ej i PB-stegar)</p>
                                </div>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-all ${editForm.excludeFromRecords ? 'bg-orange-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.excludeFromRecords ? 'left-5' : 'left-1'}`} />
                            </div>
                        </div>

                        {/* Exclude HR Toggle */}
                        <div
                            onClick={() => setEditForm(prev => ({ ...prev, excludeHeartRate: !prev.excludeHeartRate }))}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${editForm.excludeHeartRate ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-800 border-white/5 opacity-60 hover:opacity-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`text-lg ${editForm.excludeHeartRate ? 'opacity-100' : 'opacity-40'}`}>🖤</span>
                                <div>
                                    <p className={`text-xs font-bold ${editForm.excludeHeartRate ? 'text-rose-400' : 'text-white'}`}>Dölj/Inaktivera Puls</p>
                                    <p className="text-[10px] text-slate-500">Döljer puls från grafer och statistik (vid t.ex. mätfel)</p>
                                </div>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-all ${editForm.excludeHeartRate ? 'bg-rose-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.excludeHeartRate ? 'left-5' : 'left-1'}`} />
                            </div>
                        </div>

                        {/* Action Buttons (Moved here from view footer) */}
                        <div className="pt-4 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {isMergedActivity && (
                                <button
                                    type="button"
                                    onClick={handleUnmerge}
                                    disabled={isUnmerging}
                                    className="bg-amber-600/20 hover:bg-amber-500/30 text-amber-500 disabled:opacity-50 font-bold py-2.5 rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5"
                                >
                                    {isUnmerging ? '⏳...' : '🔀 Separera'}
                                </button>
                            )}
                            {isMerged && onSeparate && !isMergedActivity && (
                                <button
                                    type="button"
                                    onClick={onSeparate}
                                    className="bg-amber-600/20 hover:bg-amber-500/30 text-amber-500 font-bold py-2.5 rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5"
                                >
                                    🔀 Separera
                                </button>
                            )}

                            {(activity.type === 'running' || activity.type === 'cycling' || activity.type === 'walking' || activity.type === 'swimming') && !activity.extractedFromId && (
                                <button
                                    type="button"
                                    onClick={() => setShowExtractForm(!showExtractForm)}
                                    className={`font-bold py-2.5 rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5 ${showExtractForm ? 'bg-amber-500 text-slate-900' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'}`}
                                >
                                    ✂️ Mätning
                                </button>
                            )}


                            <button
                                type="button"
                                onClick={handleDelete}
                                className="bg-rose-500/10 text-rose-400 font-bold hover:bg-rose-500 hover:text-white transition-colors py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 md:col-start-4"
                            >
                                Radera
                            </button>
                        </div>

                        <div className="flex gap-3 pt-6 border-t border-white/5 mt-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="flex-1 px-6 py-3 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 hover:text-white transition-colors"
                            >
                                Avbryt
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-6 py-3 rounded-xl bg-emerald-500 text-slate-900 font-bold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                            >
                                Spara
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                            <div className="flex-1 min-w-0">
                                {/* Type & Badges Row */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                    {(() => {
                                        const typeInfo = EXERCISE_TYPES.find(t => t.type === activity.type) || EXERCISE_TYPES.find(t => t.type === 'other');
                                        return (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest shadow-lg">
                                                <span className="text-emerald-400">{typeInfo?.icon === 'Activity' ? <Activity size={14} /> : typeInfo?.icon}</span>
                                                {typeInfo?.label}
                                            </div>
                                        );
                                    })()}

                                    {/* Date and Time Since Label */}
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 text-slate-300 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest shadow-sm">
                                        <Calendar size={12} className="text-slate-500" /> {formatSwedishDate(activity.date)}
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 text-[10px] font-black uppercase tracking-widest shadow-sm">
                                        <Clock size={12} className="text-indigo-400/70" /> {getRelativeTime(activity.date)}
                                    </div>

                                    {/* Subtype Label for Intervals */}
                                    {activity.subType === 'interval' && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-black uppercase tracking-widest shadow-sm">
                                            <Activity size={12} className="text-violet-400/70" /> Intervaller
                                            {(parsedWorkout as any).summary && <span className="opacity-70 ml-1">{(parsedWorkout as any).summary}</span>}
                                        </div>
                                    )}

                                    {/* Parent Activity Link */}
                                    {parentActivity && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-xl border border-white/5 text-[10px] shadow-sm">
                                            <span className="text-slate-500 font-bold uppercase tracking-widest">Utdrag från:</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectActivity?.(parentActivity.id);
                                                }}
                                                className="font-black text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 group/link"
                                            >
                                                <span className="truncate max-w-[150px]">{parentActivity.title || 'Huvudpasset'}</span>
                                                <ArrowRight size={10} className="group-hover/link:translate-x-0.5 transition-transform" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Badges */}
                                    {activity.extractedFromId && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm text-[10px] font-black uppercase tracking-widest">
                                            <Scissors size={12} className="text-indigo-400/70" /> Utdrag
                                        </div>
                                    )}
                                    {isTrulyMerged && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm text-[10px] font-black uppercase tracking-widest">
                                            <Zap size={12} className="text-amber-500/70 fill-amber-500/70" />
                                            Sammanslagen
                                        </div>
                                    )}
                                </div>

                                {/* Title Row */}
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h2 className="text-3xl sm:text-4xl font-black text-white italic tracking-tight capitalize break-words flex-1 leading-tight" title={displayTitle}>
                                            {displayTitle}
                                        </h2>
                                        {isCompetition(activity) && (
                                            <div className="bg-amber-500 text-slate-900 text-[11px] font-black px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xl shadow-amber-500/20">
                                                <TrophyIcon size={14} /> RACE
                                                {(activity.heartRateAvg || perf?.avgHeartRate) && (
                                                    <span className="ml-1.5 border-l border-black/20 pl-1.5 font-mono">
                                                        {Math.round(activity.heartRateAvg || perf?.avgHeartRate || 0)} BPM
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopyJson}
                                            className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shadow-sm shrink-0"
                                            title="Kopiera till JSON"
                                        >
                                            📋
                                        </button>
                                        <button
                                            onClick={() => setViewMode(viewMode === 'raw' ? 'combined' : 'raw')}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm shrink-0 ${viewMode === 'raw' ? 'bg-slate-600 text-white' : 'bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                                            title="Visa rådata"
                                        >
                                            📄
                                        </button>
                                        <button
                                            onClick={() => {
                                                const [y, m, d] = activity.date.split('T')[0].split('-');
                                                const monthNames = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
                                                const monthName = monthNames[parseInt(m) - 1];
                                                onClose();
                                                navigate(`/träning/${y}/${monthName}/${parseInt(d)}`);
                                            }}
                                            className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shadow-sm shrink-0"
                                            title="Gå till dag i kalendern"
                                        >
                                            📅
                                        </button>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shadow-sm shrink-0"
                                            title="Redigera aktivitet"
                                        >
                                            ✎
                                        </button>
                                    </div>
                                </div>

                                {/* Hyrox Specific Header Data */}
                                {isHyrox && (activity.subType === 'competition' || activity.subType === 'race') && (
                                    <div className="flex gap-4 mt-2">
                                        <div className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                                            Total Tid: <span className="text-white text-sm">{formatDuration(activity.durationMinutes * 60)}</span>
                                        </div>
                                        {hyroxStats && (
                                            <div className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                                                Stations: <span className="text-amber-400 text-sm">
                                                    {formatSecondsToTime(Object.values(hyroxStats.stations || {}).reduce((a, b) => a + (b || 0), 0))}
                                                </span>
                                            </div>
                                        )}
                                        {hyroxStats && (
                                            <div className="text-[10px] uppercase font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
                                                Run: <span className="text-emerald-400 text-sm">
                                                    {formatSecondsToTime(hyroxStats.runSplits?.reduce((a, b) => a + (b || 0), 0) || 0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* HYROX VISUALIZATION */}
                        {/* HYROX VISUALIZATION */}
                        {isHyrox && hyroxStats && activeTab === 'stats' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Timeline / Split View */}
                                    <div className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Race Breakdown</h4>
                                        <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <div key={i} className="flex flex-col gap-1">
                                                    {/* Run Segment */}
                                                    <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                                        <span className="text-emerald-500 text-xs">🏃 1km Run</span>
                                                        <div className="flex-1 border-b border-dashed border-emerald-500/20 mx-2" />
                                                        <span className="font-mono font-bold text-sm text-emerald-400">
                                                            {formatSecondsToTime(hyroxStats.runSplits?.[i] || 0)}
                                                        </span>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="flex justify-center -my-1 relative z-10">
                                                        <span className="text-[10px] text-slate-600">↓</span>
                                                    </div>

                                                    {/* Station Segment */}
                                                    <div className="flex items-center gap-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                                        <span className="text-xl">{HYROX_STATIONS[i].icon}</span>
                                                        <span className="text-amber-500 text-xs font-bold">{HYROX_STATIONS[i].label}</span>
                                                        <div className="flex-1 border-b border-dashed border-amber-500/20 mx-2" />
                                                        <span className="font-mono font-bold text-sm text-amber-400">
                                                            {formatSecondsToTime(hyroxStats.stations?.[HYROX_STATIONS[i].id] || 0)}
                                                        </span>
                                                    </div>

                                                    {/* Connector line unless last */}
                                                    {i < 7 && (
                                                        <div className="flex justify-center -my-1 relative z-10">
                                                            <span className="text-[10px] text-slate-600">↓</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Analysis / Charts */}
                                    <div className="space-y-4">
                                        {/* Distribution Chart */}
                                        <div className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 h-[200px] flex flex-col">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tid per kategori</h4>
                                            <div className="flex-1 flex items-end gap-4 px-4 pb-2">
                                                {(() => {
                                                    const totalRun = hyroxStats.runSplits?.reduce((a, b) => a + (b || 0), 0) || 0;
                                                    const totalStation = Object.values(hyroxStats.stations || {}).reduce((a, b) => a + (b || 0), 0) || 0;
                                                    const total = totalRun + totalStation || 1;

                                                    return (
                                                        <>
                                                            <div className="flex-1 flex flex-col gap-2 items-center group">
                                                                <div className="w-full bg-emerald-500/20 rounded-t-xl relative overflow-hidden transition-all group-hover:bg-emerald-500/30" style={{ height: `${(totalRun / total) * 100}%` }}>
                                                                    <div className="absolute inset-x-0 bottom-0 bg-emerald-500 opacity-20 h-full" />
                                                                </div>
                                                                <span className="text-xs font-bold text-emerald-400">{Math.round((totalRun / total) * 100)}%</span>
                                                                <span className="text-[10px] font-black uppercase text-slate-500">Run</span>
                                                            </div>
                                                            <div className="flex-1 flex flex-col gap-2 items-center group">
                                                                <div className="w-full bg-amber-500/20 rounded-t-xl relative overflow-hidden transition-all group-hover:bg-amber-500/30" style={{ height: `${(totalStation / total) * 100}%` }}>
                                                                    <div className="absolute inset-x-0 bottom-0 bg-amber-500 opacity-20 h-full" />
                                                                </div>
                                                                <span className="text-xs font-bold text-amber-400">{Math.round((totalStation / total) * 100)}%</span>
                                                                <span className="text-[10px] font-black uppercase text-slate-500">Stations</span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Station Ranking */}
                                        <div className="p-4 bg-slate-800/30 rounded-2xl border border-white/5 flex-1">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tidskrävande Stationer</h4>
                                            <div className="space-y-2">
                                                {Object.entries(hyroxStats.stations || {})
                                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                                    .map(([key, duration]) => {
                                                        const station = HYROX_STATIONS.find(s => s.id === key);
                                                        if (!station) return null;
                                                        return (
                                                            <div key={key} className="flex justify-between items-center text-xs">
                                                                <span className="flex items-center gap-2 text-slate-300">
                                                                    <span>{station.icon}</span>
                                                                    {station.label}
                                                                </span>
                                                                <span className="font-mono text-amber-400 font-bold">{formatSecondsToTime(duration as number)}</span>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Standard Content for Non-Hyrox (or just hide it if Hyrox?) 
                            We want to HIDE standard graphs if it's a Hyrox race to avoid clutter, 
                            but maybe keep notes etc. 
                        */}


                        {/* SMART EXTRACTION HINT */}
                        {smartExtractInfo && !showExtractForm && !activity.extractedFromId && subPerformances.length === 0 && (
                            <div className={`bg-gradient-to-r ${smartExtractInfo.topEfforts.some(e => e.isPB) ? 'from-amber-500/10 to-indigo-500/10 border-amber-500/20' : 'from-emerald-500/10 to-indigo-500/10 border-emerald-500/20'} border rounded-2xl p-4 animate-in slide-in-from-top-2 flex flex-col gap-3 shadow-xl shadow-amber-500/5`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full ${smartExtractInfo.topEfforts.some(e => e.isPB) ? 'bg-amber-500/20' : 'bg-emerald-500/20'} flex items-center justify-center text-lg shadow-inner`}>{smartExtractInfo.topEfforts.some(e => e.isPB) ? '🚀' : '⚡'}</div>
                                    <div>
                                        <h4 className="text-sm font-black text-white italic">
                                            {smartExtractInfo.topEfforts.some(e => e.isPB)
                                                ? 'Rekord-potential identifierad! 🚀'
                                                : 'Snabbaste på 90 dagar! ⚡'}
                                        </h4>
                                        <p className="text-[10px] text-slate-400">Det verkar som att detta pass innehåller en <strong>{smartExtractInfo.title}</strong>. Välj block att spara:</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                                    {(smartExtractInfo as any).topEfforts.map((effort: any, index: number) => (
                                        <button
                                            key={index}
                                            onClick={() => handleApplySmartExtract(effort)}
                                            onMouseEnter={() => setHoveredExtractEffort(effort)}
                                            onMouseLeave={() => setHoveredExtractEffort(null)}
                                            className={`px-3 py-2 border rounded-xl transition-all shadow-md font-bold flex flex-col items-center justify-center group ${effort.isPB ? 'bg-amber-500/20 border-amber-500/50 hover:bg-amber-500 hover:text-slate-900 border-amber-400' : effort.isFastestInQuarter ? 'bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-900' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-white/5'}`}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] font-mono group-hover:text-slate-950 font-black">Km {effort.startKm}-{effort.startKm + Math.floor(effort.distance)}</span>
                                                {effort.isPB && <span className="text-[10px]" title="Ditt snabbaste någonsin på denna distans!">🏆</span>}
                                                {!effort.isPB && effort.isFastestInQuarter && <span className="text-[10px]" title="Snabbaste på 90 dagar!">⚡</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[10px] font-black ${effort.isPB ? 'text-amber-500 group-hover:text-amber-900' : 'text-indigo-400'}`}>{effort.distance >= 1 ? `${effort.distance}k` : `${Math.round(effort.distance * 1000)}m`}</span>
                                                <span className="text-sm font-black text-white group-hover:text-slate-950">
                                                    {(() => {
                                                        const sec = effort.durationSeconds;
                                                        const h = Math.floor(sec / 3600);
                                                        const m = Math.floor((sec % 3600) / 60);
                                                        const s = Math.round(sec % 60);
                                                        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
                                                    })()}
                                                </span>
                                            </div>
                                            <span className="text-[9px] text-slate-500 group-hover:text-slate-800">
                                                {formatPace(effort.durationSeconds / effort.distance)} /km
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}


                        {/* Warning Banner: This activity is a component of a merge */}
                        {isMergedInto && parentMergedActivity && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
                                <div className="text-3xl">🔒</div>
                                <div className="flex-1">
                                    <h4 className="text-amber-400 font-bold text-sm">Denna aktivitet är dold</h4>
                                    <p className="text-amber-300/70 text-xs">
                                        Den ingår i en sammanslagen aktivitet och visas normalt inte i listor.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        // Navigate to parent merged activity
                                        // We need to trigger opening the parent - for now, close and let user find it
                                        // A more sophisticated approach would be to pass a callback
                                        onClose();
                                        // Optionally: emit an event or use context to open parent
                                    }}
                                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                                >
                                    Visa sammanslagen →
                                </button>
                            </div>
                        )}

                        {/* Tabs */}
                        <div className="flex border-b border-white/5">
                            <button
                                onClick={() => setActiveTab('stats')}
                                className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'stats' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                            >
                                Statistik
                            </button>
                            {(activity.distance || 0) > 0 && (
                                <button
                                    onClick={() => setActiveTab('compare')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'compare' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    Jämför
                                </button>
                            )}
                            {(hasSplits || (existingLaps && existingLaps.length > 0)) && (
                                <button
                                    onClick={() => setActiveTab('splits')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'splits' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    Splits & Laps
                                </button>
                            )}
                            {isTrulyMerged && (
                                <button
                                    onClick={() => setActiveTab('merge')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'merge' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    <span>⚡</span> Sammanslagen ({originalActivities.length})
                                </button>
                            )}
                            {isWorthyOfAnalysis && (
                                <button
                                    onClick={() => setActiveTab('analysis')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'analysis' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    <span>🧩</span> Analys
                                </button>
                            )}
                            {isCompetition(activity) && (
                                <button
                                    onClick={() => setActiveTab('prep')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'prep' ? 'text-emerald-400 border-emerald-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    <span>📈</span> Förberedelse
                                </button>
                            )}
                        </div>


                        {/* Auto-fetch Strava Splits Indicator */}
                        {isFetchingSplits && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-2 mb-4">
                                <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                                <p className="text-xs font-bold text-amber-400">Hämtar kilometertider & laps från Strava...</p>
                            </div>
                        )}
                        {fetchSplitsResult === 'error' && (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-2 mb-4">
                                <span>⚠️</span>
                                <p className="text-xs font-bold text-rose-400">Kunde inte hämta detaljer från Strava.</p>
                            </div>
                        )}
                        {fetchSplitsResult === 'success' && !isFetchingSplits && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-2 mb-4 transition-all duration-1000 delay-3000 opacity-100" style={{ animation: 'fadeOut 1s forwards 3s' }}>
                                <span>✅</span>
                                <p className="text-xs font-bold text-emerald-400">Information hämtades från Strava och beskrivningen har analyserats!</p>
                            </div>
                        )}

                        {/* Source Badge + View Toggle for Merged */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            {(() => {
                                if (activity.source === 'strength') {
                                    return (
                                        <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                                            <span>💪</span> StrengthLog
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Ultra Label */}
                            {activity.type === 'running' && activity.distance && activity.distance >= 42.2 && (
                                <div className="inline-flex items-center gap-2 bg-pink-500/20 text-pink-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase animate-pulse">
                                    <span>🦅</span> Ultra
                                </div>
                            )}

                        </div>

                        {/* Recategorization Section - Only visible in EDIT mode */}
                        {isEditing && (
                            <div className="bg-slate-800/20 rounded-2xl p-3 border border-white/5 space-y-2 mt-4">
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] ml-1">Snabb-kategorisera</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {EXERCISE_TYPES.map(t => (
                                        <button
                                            key={t.type}
                                            type="button"
                                            onClick={() => handleRecategorize(t.type)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${activity.type === t.type
                                                ? 'bg-amber-500 border-amber-400 text-slate-900 shadow-lg'
                                                : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800 hover:text-slate-200'
                                                }`}
                                        >
                                            <span>{t.icon}</span> {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* DIFF VIEW */}
                        {/* MERGE TAB CONTENT - DIFF TABLE */}
                        {isTrulyMerged && activeTab === 'merge' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                                        <span className="text-amber-400">⚡</span> Sammanslagen Analys
                                    </h3>
                                    <span className="text-xs text-slate-500 font-mono">
                                        Jämför data från {originalActivities.length} källor
                                    </span>
                                </div>

                                <div className="bg-slate-800/50 rounded-2xl overflow-hidden border border-white/5">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-950/50 text-xs uppercase font-black text-slate-500">
                                                <tr>
                                                    <th className="px-6 py-4">Fält</th>
                                                    {originalActivities.map((original, i) => (
                                                        <th key={original.id} className="px-6 py-4 text-center min-w-[140px]">
                                                            <div className={`flex flex-col gap-1 ${original.performance?.source?.source === 'strava' ? 'text-[#FC4C02]' : 'text-purple-400'}`}>
                                                                <span>{original.performance?.source?.source === 'strava' ? 'Strava' : 'StrengthLog/Annat'}</span>
                                                                <span className="text-[9px] opacity-70 font-normal capitalize">
                                                                    {original.plan?.title || original.performance?.activityType}
                                                                </span>
                                                            </div>
                                                        </th>
                                                    ))}
                                                    <th className="px-6 py-4 text-right text-emerald-400">Resultat</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {/* Title */}
                                                <tr className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-400">Namn</td>
                                                    {originalActivities.map((a) => {
                                                        const sourceTitle = a.plan?.title || a.performance?.notes || '-';
                                                        const isActive = displayTitle === sourceTitle;

                                                        return (<td key={a.id} className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => handleUpdateTitle(sourceTitle)}
                                                                disabled={isActive}
                                                                className={`font-mono text-xs truncate max-w-[150px] px-2 py-1 rounded transition-all ${isActive
                                                                    ? 'bg-emerald-500/20 text-emerald-400 font-bold cursor-default ring-1 ring-emerald-500/50'
                                                                    : 'text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer'
                                                                    }`}
                                                                title={`Använd detta namn: ${sourceTitle}`}
                                                            >
                                                                {sourceTitle}
                                                            </button>
                                                        </td>
                                                        );
                                                    })}
                                                    <td className="px-6 py-4 text-right font-bold text-white font-mono text-xs">
                                                        {universalActivity?.plan?.title || activity.title || activity.type}
                                                    </td>
                                                </tr>
                                                {/* Description */}
                                                <tr className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-400">Beskrivning</td>
                                                    {originalActivities.map((a) => (
                                                        <td key={a.id} className="px-6 py-4 text-center text-slate-500 text-xs truncate max-w-[150px]" title={a.plan?.description || a.performance?.notes || ''}>
                                                            {a.plan?.description || a.performance?.notes || '-'}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-4 text-right text-slate-400 text-xs">
                                                        {universalActivity?.plan?.description || activity.notes || '-'}
                                                    </td>
                                                </tr>
                                                {/* Duration */}
                                                <tr className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-400">Tid</td>
                                                    {originalActivities.map((a) => (
                                                        <td key={a.id} className="px-6 py-4 text-center text-slate-300 font-mono">
                                                            {formatDuration((a.performance?.durationMinutes || 0) * 60)}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-400 font-mono">
                                                        {formatDuration(activity.durationMinutes * 60)}
                                                    </td>
                                                </tr>
                                                {/* Distance */}
                                                <tr className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-400">Distans</td>
                                                    {originalActivities.map((a) => (
                                                        <td key={a.id} className="px-6 py-4 text-center text-slate-300 font-mono">
                                                            {a.performance?.distanceKm ? `${a.performance.distanceKm.toFixed(2)} km` : '-'}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-400 font-mono">
                                                        {displayDistance ? `${displayDistance.toFixed(2)} km` : '-'}
                                                    </td>
                                                </tr>
                                                {/* Calories */}
                                                <tr className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-400">Energi</td>
                                                    {originalActivities.map((a) => (
                                                        <td key={a.id} className="px-6 py-4 text-center text-slate-300 font-mono">
                                                            {a.performance?.calories ? `${a.performance.calories} kcal` : '-'}
                                                        </td>
                                                    ))}
                                                    <td
                                                        className={`px-6 py-4 text-right font-bold text-emerald-400 font-mono ${activity.calorieBreakdown ? 'cursor-help border-b border-emerald-400/20 md:border-b-0' : ''}`}
                                                        title={activity.calorieBreakdown}
                                                    >
                                                        {activity.caloriesBurned ? `${activity.caloriesBurned} kcal` : '-'}
                                                        {activity.isCalorieAdjusted && (
                                                            <span className="text-[10px] text-amber-500 ml-1" title={`Justerat från ${activity.originalCalories} kcal`}>✨</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {/* HR */}
                                                <tr className="hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-slate-400">Puls</td>
                                                    {originalActivities.map((a) => (
                                                        <td key={a.id} className="px-6 py-4 text-center text-slate-300 font-mono">
                                                            {a.performance?.avgHeartRate ? `${Math.round(a.performance.avgHeartRate)} bpm` : '-'}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-4 text-right font-bold text-emerald-400 font-mono">
                                                        {perf?.avgHeartRate ? `${Math.round(perf.avgHeartRate)} bpm` : '-'}
                                                    </td>
                                                </tr>
                                                {/* Power */}
                                                {(activity.type === 'cycling' || originalActivities.some(a => a.performance?.averageWatts)) && (
                                                    <tr className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-400">Effekt</td>
                                                        {originalActivities.map((a) => (
                                                            <td key={a.id} className="px-6 py-4 text-center text-slate-300 font-mono">
                                                                {a.performance?.averageWatts ? `${Math.round(a.performance.averageWatts)} W` : '-'}
                                                            </td>
                                                        ))}
                                                        <td className="px-6 py-4 text-right font-bold text-emerald-400 font-mono">
                                                            {perf?.averageWatts ? `${Math.round(perf.averageWatts)} W` : '-'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* COMBINED VIEW - Now also for Hyrox */}
                        {(viewMode === 'combined' || !isMerged) && activeTab === 'stats' && (
                            <>
                                {/* Extract Parent Link Banner */}
                                {activity.extractedFromId && parentUniversal && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between mb-4 shadow-lg shadow-amber-500/5 animate-pulse-subtle">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-amber-500/20 p-2 rounded-xl text-amber-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-amber-500 font-bold uppercase">Utdragen från</p>
                                                <h4 className="text-sm font-black text-white">{parentUniversal.plan?.title || 'Originalpass'}</h4>
                                                <p className="text-[10px] text-slate-400">Total distans: {(parentUniversal.performance?.distanceKm || 0).toFixed(1)} km</p>
                                            </div>
                                        </div>
                                        {onSelectActivity && (
                                            <button
                                                onClick={() => onSelectActivity(parentUniversal.id)}
                                                className="text-xs font-bold text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-500 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                Visa Original ↗
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Exercises from StrengthLog (if merged/strength) - MOVED HERE FOR PRECEDENCE */}
                                {strengthWorkout?.exercises && strengthWorkout.exercises.length > 0 && (
                                    <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4 mb-4">
                                        <h3 className="text-xs font-bold text-purple-400 uppercase mb-3">💪 Övningar {isMerged && <span className="text-slate-500">(från StrengthLog)</span>}</h3>
                                        <div className="space-y-1 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                            {strengthWorkout.exercises
                                                .filter((ex: any) => ex.totalVolume > 0 || ex.sets.length > 0)
                                                .map((ex: any, i: number) => (
                                                    <ExpandableExercise key={i} exercise={ex} />
                                                ))}
                                        </div>
                                    </div>
                                )}

                                                                {/* Unified Coros-style Stats Display */}
                                <div className="space-y-6">
                                    {/* Warnings and Strava Actions */}
                                    {showStravaCard && (
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#FC4C02]/5 border border-[#FC4C02]/20 rounded-xl p-3 shadow-md shadow-[#FC4C02]/5 gap-3">
                                            <h4 className="font-black text-[#FC4C02] uppercase text-xs tracking-widest flex items-center gap-1.5">
                                                <Activity size={14} className="mb-0.5" /> Strava-data
                                            </h4>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    disabled={isFetchingSplits}
                                                    onClick={() => {
                                                        setIsForcingFetch(true);
                                                        setFetchSplitsResult('idle');
                                                    }}
                                                    className={`text-[9px] font-black uppercase border px-2 py-1.5 rounded-lg transition-all flex items-center gap-1 ${isFetchingSplits ? 'bg-white/10 border-white/10 text-slate-500 cursor-not-allowed' : fetchSplitsResult === 'success' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : fetchSplitsResult === 'error' ? 'text-rose-500 border-rose-500/30 bg-rose-500/10' : 'text-[#FC4C02]/60 hover:text-[#FC4C02] border-[#FC4C02]/20 hover:bg-[#FC4C02]/10'}`}
                                                    title="Hämta om data från Strava"
                                                >
                                                    {isFetchingSplits ? (
                                                        <>
                                                            <div className="w-3.5 h-3.5 border-2 border-[#FC4C02]/20 border-t-[#FC4C02] rounded-full animate-spin" />
                                                            Synkar...
                                                        </>
                                                    ) : fetchSplitsResult === 'success' ? (
                                                        <>✓ Synkad</>
                                                    ) : fetchSplitsResult === 'error' ? (
                                                        <>⚠ Fel</>
                                                    ) : (
                                                        <>↻ Synka om</>
                                                    )}
                                                </button>
                                                {(() => {
                                                    let stravaLink = null;
                                                    if (activity.source === 'strava' && activity.externalId) {
                                                        stravaLink = `https://www.strava.com/activities/${activity.externalId.replace('strava_', '')}`;
                                                    } else if (isTrulyMerged) {
                                                        const stravaOriginals = originalActivities
                                                            .filter(o => o.performance?.source?.source === 'strava' && o.performance?.source?.externalId)
                                                            .sort((a, b) => (b.performance?.distanceKm || 0) - (a.performance?.distanceKm || 0));
                                                        if (stravaOriginals.length > 0) {
                                                            const extId = stravaOriginals[0].performance?.source?.externalId?.replace('strava_', '');
                                                            stravaLink = `https://www.strava.com/activities/${extId}`;
                                                        }
                                                    }
                                                    return stravaLink ? (
                                                        <a
                                                            href={stravaLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] font-black text-white bg-[#FC4C02] px-3 py-1.5 rounded-lg hover:shadow-lg hover:shadow-[#FC4C02]/20 transition-all flex items-center gap-1.5 uppercase tracking-tighter"
                                                        >
                                                            Öppna ↗
                                                        </a>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {/* Time Discrepancy Warning */}
                                    {perf?.elapsedTimeSeconds && Math.abs(perf.elapsedTimeSeconds - (activity.durationMinutes * 60)) > 30 && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500">
                                                    <Timer size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Tidsavvikelse identifierad</p>
                                                    <p className="text-[11px] text-white font-bold">
                                                        Rörelsetid ({formatDuration(activity.durationMinutes * 60)}) vs Totaltid ({formatDuration(perf.elapsedTimeSeconds)}).
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button 
                                                    onClick={() => handleSyncTimes('moving', perf.elapsedTimeSeconds)}
                                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-lg transition-all border border-white/10 shadow-sm"
                                                    title="Sätt passets längd till den totala tiden (inklusive pauser)"
                                                >
                                                    Använd Totaltid ⏱️
                                                </button>
                                                <button 
                                                    onClick={() => {}}
                                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-900 text-[10px] font-black uppercase rounded-lg transition-all shadow-lg shadow-emerald-500/20"
                                                    title="Behåll den kortare rörelsetiden (exkluderar pauser)"
                                                >
                                                    Behåll Rörelsetid ✅
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Primary Hero Stats Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {/* Distance */}
                                        {(displayDistance || 0) > 0 && activity.type !== 'strength' && (
                                            <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 flex flex-col justify-center transition-all hover:bg-slate-800/60 hover:scale-[1.02] hover:border-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/10 cursor-default group">
                                                <span className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-1">Distans</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl sm:text-5xl font-black text-white">{(displayDistance || 0).toFixed(2)}</span>
                                                    <span className="text-sm uppercase text-slate-500 font-bold">km</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Time */}
                                        <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 flex flex-col justify-center transition-all hover:bg-slate-800/60 hover:scale-[1.02] hover:border-amber-500/20 hover:shadow-xl hover:shadow-amber-500/10 cursor-default group">
                                            <span className="text-[10px] text-amber-500 uppercase font-black tracking-widest mb-1">
                                                {perf?.elapsedTimeSeconds && Math.abs(perf.elapsedTimeSeconds - (activity.durationMinutes * 60)) > 0.1 ? 'Rörelsetid' : 'Tid'}
                                            </span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl sm:text-4xl font-black text-white">{activity.durationMinutes > 0 ? formatDuration(activity.durationMinutes * 60) : '-'}</span>
                                            </div>
                                            {perf?.elapsedTimeSeconds && Math.abs(perf.elapsedTimeSeconds - (activity.durationMinutes * 60)) > 0.1 && (
                                                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                                    Total: <span className="text-slate-400">{formatDuration(perf.elapsedTimeSeconds)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pace / Speed */}
                                        {(displayDistance || 0) > 0 && activity.type !== 'strength' && (
                                            <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 flex flex-col justify-center col-span-2 md:col-span-1 transition-all hover:bg-slate-800/60 hover:scale-[1.02] hover:border-sky-500/20 hover:shadow-xl hover:shadow-sky-500/10 cursor-default group">
                                                <span className="text-[10px] text-sky-500 uppercase font-black tracking-widest mb-1">
                                                    {activity.type === 'cycling' ? 'Fart' : 'Tempo'}
                                                </span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl sm:text-4xl font-black text-white">
                                                        {activity.type === 'cycling'
                                                            ? formatSpeed((activity.durationMinutes * 60) / (displayDistance || 1))
                                                            : formatPace((activity.durationMinutes * 60) / (displayDistance || 1)).replace('/km', '')
                                                        }
                                                    </span>
                                                    <span className="text-sm uppercase text-slate-500 font-bold">{activity.type === 'cycling' ? 'km/h' : '/km'}</span>
                                                </div>
                                                {perf?.elapsedTimeSeconds && Math.abs(perf.elapsedTimeSeconds - (activity.durationMinutes * 60)) > 0.1 && (
                                                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                                        Total: <span className="text-slate-400">
                                                            {activity.type === 'cycling'
                                                                ? formatSpeed(perf.elapsedTimeSeconds / (displayDistance || 1))
                                                                : formatPace(perf.elapsedTimeSeconds / (displayDistance || 1)).replace('/km', '')
                                                            }
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {/* Tonnage for Strength */}
                                        {(activity.tonnage && activity.tonnage > 0) && (
                                            <div className="bg-slate-800/40 rounded-2xl p-5 border border-white/5 flex flex-col justify-center transition-all hover:bg-slate-800/60 hover:scale-[1.02] hover:border-purple-500/20 hover:shadow-xl hover:shadow-purple-500/10 cursor-default group">
                                                <span className="text-[10px] text-purple-500 uppercase font-black tracking-widest mb-1">Volym</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl sm:text-5xl font-black text-white">{(activity.tonnage / 1000).toFixed(1)}</span>
                                                    <span className="text-sm uppercase text-slate-500 font-bold">ton</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Minigraph */}
                                    {existingSplits && existingSplits.length > 2 && (
                                        <div className="bg-slate-800/20 rounded-2xl p-4 border border-white/5">
                                            <h4 className="font-black text-slate-500 uppercase text-[10px] tracking-widest mb-3 flex items-center gap-2">
                                                <span>📈</span> Tempo & Puls över tid
                                            </h4>
                                            <SplitsSparkline 
                                                splits={existingSplits} 
                                                highlightRange={activeHighlightRange} 
                                                excludeHeartRate={activity.excludeHeartRate}
                                            />
                                        </div>
                                    )}

                                    {/* Secondary Stats Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                        {/* Heart Rate */}
                                        {(!!perf?.avgHeartRate || !!activity.heartRateAvg) && (
                                            <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5 flex flex-col hover:bg-slate-800/50 hover:border-white/10 transition-all group">
                                                <span className="text-[9px] text-rose-500 uppercase font-black tracking-widest mb-1">Puls (Snitt)</span>
                                                {activity.excludeHeartRate ? (
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="text-xl font-black text-slate-600 flex items-center gap-1 italic" title="Pulsen har markerats som felaktig och exkluderats från statistik.">
                                                            --
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const updates = { excludeHeartRate: false };
                                                                setEditForm(prev => ({ ...prev, ...updates }));
                                                                updateExercise(activity.id, updates);
                                                            }}
                                                            className="text-[8px] font-black text-emerald-500 uppercase hover:underline mt-1"
                                                        >
                                                            Aktivera igen
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1 group">
                                                        <div className="flex items-baseline gap-1">
                                                            <span 
                                                                className={`text-2xl font-black text-white ${perf?.originalAvgHeartRate ? 'cursor-help' : ''}`}
                                                                title={perf?.originalAvgHeartRate ? `Manuellt korrigerad från sensorpuls: ${perf.originalAvgHeartRate} bpm` : undefined}
                                                            >
                                                                {Math.round(perf?.avgHeartRate || activity.heartRateAvg || 0)}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase">bpm</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {perf?.maxHeartRate && (
                                                                <span className="text-[9px] text-slate-400 font-bold">Max: {Math.round(perf.maxHeartRate)}</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updates = { excludeHeartRate: true };
                                                                    setEditForm(prev => ({ ...prev, ...updates }));
                                                                    updateExercise(activity.id, updates);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase border border-rose-500/20 transition-all hover:bg-rose-500 hover:text-white ml-auto"
                                                            >
                                                                Dölj
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Elevation Gain */}
                                        {!!perf?.elevationGain && (
                                            <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5 flex flex-col hover:bg-slate-800/50 hover:border-white/10 transition-all group">
                                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Höjdmeter</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-white">{Math.round(perf.elevationGain)}</span>
                                                    <span className="text-[10px] uppercase text-slate-500 font-bold">m</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Energy */}
                                        <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5 flex flex-col hover:bg-slate-800/50 hover:border-white/10 transition-all group">
                                            <span className="text-[9px] text-orange-400 uppercase font-black tracking-widest mb-1">Energi</span>
                                            <div className="flex items-baseline gap-1">
                                                <span
                                                    className={`text-2xl font-black text-white ${currentActivity.calorieBreakdown ? 'cursor-help border-b border-white/20' : ''}`}
                                                    title={currentActivity.calorieBreakdown || (currentActivity.isCalorieAdjusted ? `Justerat från ${currentActivity.originalCalories} kcal (Strava) pga låg puls/intensitet.` : undefined)}
                                                >
                                                    {currentActivity.caloriesBurned || perf?.calories || '-'}
                                                </span>
                                                <span className="text-[10px] uppercase text-slate-500 font-bold">kcal</span>
                                            </div>
                                            {currentActivity.isCalorieAdjusted && (
                                                <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-1">✨ Justerad</span>
                                            )}
                                        </div>

                                        {/* GAP */}
                                        {((activity.distance || 0) > 0 && (perf?.elevationGain || 0) > 0) && activity.type !== 'strength' && (
                                            <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5 flex flex-col hover:bg-slate-800/50 hover:border-white/10 transition-all group">
                                                <span className="text-[9px] text-indigo-400 uppercase font-black tracking-widest mb-1">Effektivt Tempo</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-white">
                                                        {formatPace(calculateGAP((activity.durationMinutes * 60) / (displayDistance || 1), perf.elevationGain!, displayDistance || 0)).replace('/km', '')}
                                                    </span>
                                                    <span className="text-[10px] uppercase text-slate-500 font-bold">/km</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Watts */}
                                        {(!!perf?.averageWatts || !!parsedWorkout?.averagePower || !!activity.averageWatts) && (
                                            <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5 flex flex-col hover:bg-slate-800/50 hover:border-white/10 transition-all group">
                                                <span className="text-[9px] text-yellow-500 uppercase font-black tracking-widest mb-1">Effekt</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-white">
                                                        {Math.round(parsedWorkout?.averagePower || perf?.averageWatts || activity.averageWatts || 0)}
                                                    </span>
                                                    <span className="text-[10px] uppercase text-slate-500 font-bold">W</span>
                                                </div>
                                                {parsedWorkout?.averagePower && perf?.averageWatts && Math.round(parsedWorkout.averagePower) !== Math.round(perf.averageWatts) ? (
                                                    <span className="text-[8px] text-amber-500 font-bold mt-1 uppercase" title={`Identifierat ${Math.round(parsedWorkout.averagePower)}w i beskrivningen (Strava anger ${Math.round(perf.averageWatts)}w)`}>Justerad</span>
                                                ) : !perf?.averageWatts && parsedWorkout?.averagePower ? (
                                                    <span className="text-[8px] text-amber-500 font-bold mt-1 uppercase" title="Identifierat i beskrivningen men ej sparat ännu">Identifierad</span>
                                                ) : null}
                                            </div>
                                        )}

                                        {/* Placement */}
                                        {activity.raceDetails?.placement && (
                                            <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5 flex flex-col hover:bg-slate-800/50 hover:border-white/10 transition-all group">
                                                <span className="text-[9px] text-amber-500 uppercase font-black tracking-widest mb-1">Placering</span>
                                                <div className={`flex items-baseline gap-1.5 font-black ${activity.raceDetails.placement === 1 ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : activity.raceDetails.placement === 2 ? 'text-slate-300' : activity.raceDetails.placement === 3 ? 'text-amber-700' : 'text-white'}`}>
                                                    <span className="text-2xl">#{activity.raceDetails.placement}</span>
                                                    {activity.raceDetails.totalParticipants && (
                                                        <span className="text-[10px] opacity-60 font-bold">/{activity.raceDetails.totalParticipants}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Achievements */}
                                        {(perf?.achievementCount || perf?.prCount || perf?.kudosCount) ? (
                                            <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5 flex flex-col col-span-2 sm:col-span-1 hover:bg-slate-800/50 hover:border-white/10 transition-all group">
                                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">Prestationer</span>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    {(perf?.prCount || 0) > 0 && (
                                                        <div className="flex items-center gap-1.5" title={`${perf.prCount} Personbästa`}>
                                                            <span className="text-orange-400 text-sm">⚡</span>
                                                            <span className="text-lg font-black text-white">{perf.prCount}</span>
                                                        </div>
                                                    )}
                                                    {(perf?.achievementCount || 0) > 0 && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-yellow-400 text-sm">🏆</span>
                                                            <span className="text-lg font-black text-white">{perf.achievementCount}</span>
                                                        </div>
                                                    )}
                                                    {(perf?.kudosCount || 0) > 0 && (
                                                        <div
                                                            className="relative"
                                                            onMouseEnter={() => {
                                                                const targetId = perf?.source?.externalId || activity.externalId;
                                                                if (targetId && kudos.length === 0 && !loadingKudos) {
                                                                    fetchKudos(targetId.toString());
                                                                }
                                                            }}
                                                        >
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setShowKudos(!showKudos);
                                                                }}
                                                                className="flex items-center gap-1.5 hover:text-orange-400 transition-colors"
                                                            >
                                                                <span className="text-pink-400 text-sm">❤️</span>
                                                                <span className="text-lg font-black text-white">{perf.kudosCount}</span>
                                                            </button>

                                                            {showKudos && (
                                                                <div className="absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-[70] p-2 animate-in fade-in zoom-in-95 duration-200">
                                                                    <div className="flex justify-between items-center mb-2 px-1">
                                                                        <span className="text-[10px] font-black uppercase text-slate-400">Kudos från</span>
                                                                        <button onClick={() => setShowKudos(false)} className="text-slate-500 hover:text-white">✕</button>
                                                                    </div>
                                                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar text-left">
                                                                        {loadingKudos ? (
                                                                            <div className="py-4 flex justify-center">
                                                                                <div className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                                                                            </div>
                                                                        ) : kudos.length > 0 ? (
                                                                            kudos.map((athlete, i) => (
                                                                                <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                                                                    <img src={athlete.profile} alt="" className="w-6 h-6 rounded-full border border-white/10" />
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="text-[10px] font-bold text-white truncate">{athlete.firstname} {athlete.lastname}</p>
                                                                                        {(athlete.city || athlete.country) && (
                                                                                            <p className="text-[8px] text-slate-500 truncate">{athlete.city}{athlete.city && athlete.country ? ', ' : ''}{athlete.country}</p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <p className="text-[10px] text-slate-500 text-center py-2 italic font-medium">Inga detaljer tillgängliga</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Strava Description */}
                                    {(() => {
                                        const notes = activity.notes || perf?.notes;
                                        const shouldShowNotes = notes && (notes.length >= 50 || notes.includes('\n'));
                                        if (shouldShowNotes) {
                                            return (
                                                <div className="bg-slate-800/30 rounded-2xl p-4 border border-white/5">
                                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 block">📝 Beskrivning</span>
                                                    <p className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                        {notes}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Interval Summary Block */}
                                    {activity.subType === 'interval' && segmentedSplits && (
                                        <IntervalMiniSummary segmentedSplits={segmentedSplits} />
                                    )}
                                </div>
                                {/* Sub-performances (extracted metrics) */}
                                {subPerformances.length > 0 && activeTab === 'stats' && (
                                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <span>📊</span> Ingående prestationer
                                            </h4>
                                            <span className="text-[10px] font-mono text-slate-600 bg-white/5 px-2 py-0.5 rounded-full">
                                                {subPerformances.length}st identifierade
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {subPerformances.map((sub, idx) => (
                                                <div
                                                    key={sub.id}
                                                    className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
                                                    onClick={() => onSelectActivity?.(sub.id)}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">{sub.title}</span>
                                                        <span className="text-[10px] text-slate-500">
                                                            Tid: {formatDuration(sub.durationMinutes * 60)}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-black text-white">{sub.distance?.toFixed(1)}km</div>
                                                        <div className="text-[10px] font-mono text-slate-400">
                                                            {formatPace((sub.durationMinutes * 60) / (sub.distance || 1)).replace('/km', '')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Best Efforts / Fastest Since */}
                                {(activity.type?.toLowerCase() === 'running' || activity.type?.toLowerCase() === 'trail run') && (currentUniversal) && (
                                    <BestEffortPerformanceCard
                                        activity={currentUniversal}
                                        allActivities={universalActivities}
                                        onSelectActivity={onSelectActivity}
                                        onExtract={handleApplySmartExtract}
                                    />
                                )}


                                {/* Heart Rate Zone Visualization (for cardio with HR data) */}
                                {(() => {
                                    const effectiveAvgHr = perf?.avgHeartRate || activity.heartRateAvg || (activity.extractedFromId && parentUniversal?.performance?.avgHeartRate ? Math.round(parentUniversal.performance.avgHeartRate) : 0);

                                    // 1. Prioritize profile saved max HR
                                    // 2. Then detected max HR from history
                                    // 3. Then age-based estimate
                                    // 4. Finally session peak as a last-resort fallback
                                    const profileMaxHr = savedZones?.maxHR || detectedZones?.maxHR;
                                    const birthYear = currentUser?.settings?.birthYear;
                                    const age = birthYear ? new Date().getFullYear() - birthYear : 30;

                                    const effectiveMaxHr = profileMaxHr || undefined;

                                    if (effectiveAvgHr > 0 && activity.type?.toLowerCase() !== 'strength') {
                                        return (
                                            <HeartRateZones
                                                avgHeartRate={effectiveAvgHr}
                                                maxHeartRate={effectiveMaxHr || undefined}
                                                age={age}
                                                duration={activity.durationMinutes ? activity.durationMinutes * 60 : undefined}
                                            />
                                        );
                                    }
                                    return null;
                                })()}

                                 {/* Power Zone Visualization (for activities with Watt data) */}
                                {(() => {
                                    const effectiveWatts = perf?.averageWatts || currentActivity.averageWatts;
                                    const combinedType = (currentActivity.type || '').toLowerCase();
                                    const isStrength = combinedType === 'strength';
                                    
                                    // Show power zones if we have watts and it's not a pure strength session
                                    if (effectiveWatts && effectiveWatts > 0 && !isStrength) {
                                        const ftpData = extractFtpFromHistory(universalActivities);
                                        const ftp = ftpData?.watts || 250; 
                                        
                                        return (
                                            <PowerZones 
                                                avgWatts={effectiveWatts}
                                                ftp={ftp}
                                                duration={currentActivity.durationMinutes ? currentActivity.durationMinutes * 60 : undefined}
                                            />
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Simple HR display fallback (for strength or merged) - Only show if Strava Card is NOT shown */}
                                {(perf?.avgHeartRate || perf?.maxHeartRate) && activity.type?.toLowerCase() === 'strength' && !showStravaCard && (
                                    <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 w-fit">
                                        <h3 className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-2"><Heart className="w-3.5 h-3.5" /> Puls</h3>
                                        <div className="flex gap-6">
                                            {perf?.avgHeartRate && (
                                                <div>
                                                    <span className="text-2xl font-black text-white">{Math.round(perf.avgHeartRate)}</span>
                                                    <span className="text-xs text-slate-400 ml-1">snitt bpm</span>
                                                </div>
                                            )}
                                            {perf?.maxHeartRate && (
                                                <div>
                                                    <span className="text-2xl font-black text-red-400">{Math.round(perf.maxHeartRate)}</span>
                                                    <span className="text-xs text-slate-400 ml-1">max bpm</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Elevation & Performance (GAP) - HIDDEN HERE, now in Strava box */}



                                {/* Notes */}
                                {/* Notes - Only show if they are NOT just a short title-like string (which is likely displayed in Header) */}
                                {(() => {
                                    const notes = activity.notes || perf?.notes;
                                    // If notes exist and are "meaty" (long or multiline), show them.
                                    // If they are short (<50 chars) and single line, assume it's a title that we've promoted to the header, so hide it here.
                                    const shouldShowNotes = notes && (notes.length >= 50 || notes.includes('\n'));

                                    if (shouldShowNotes) {
                                        return (
                                            <div className="bg-slate-800/50 rounded-xl p-4 mt-4">
                                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">📝 Anteckning</h3>
                                                <p className="text-white whitespace-pre-wrap">{notes}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Greens Score Tile HIDDEN */}
                            </>
                        )}

{/* Performance & Score Breakdown (Greens Index) */}
                                        {perfBreakdown.totalScore > 0 && (
                                            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 rounded-2xl p-5 mb-4 shadow-xl shadow-indigo-500/5 overflow-hidden relative group">
                                                {/* Background Accent */}
                                                <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/10 blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
                                                
                                                <div className="flex items-center justify-between mb-6 relative z-10">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-indigo-500/20 p-2.5 rounded-xl text-indigo-400 shadow-inner">
                                                            <TrendingUp size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Prestanda Analys</h4>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-2xl font-black text-white italic tracking-tight uppercase">Greens Index</span>
                                                                {perfBreakdown.isPersonalBest && (
                                                                    <div className="bg-amber-500 text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded uppercase animate-bounce-subtle">PB</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-4xl font-black text-white italic tracking-tighter leading-none flex items-baseline gap-1">
                                                            {Math.round(perfBreakdown.totalScore)}
                                                            <span className="text-xs text-indigo-400 not-italic tracking-normal">pts</span>
                                                        </div>
                                                        <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Total Score</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
                                                    {perfBreakdown.components.map((comp, idx) => (
                                                        <div key={idx} className="bg-slate-900/40 border border-white/5 p-3 rounded-xl flex items-center justify-between group/comp hover:border-indigo-500/20 transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-xl">{comp.icon}</div>
                                                                <div>
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{comp.label}</p>
                                                                    <p className={`text-sm font-black ${comp.color || 'text-white'} italic font-mono`}>{comp.value}</p>
                                                                </div>
                                                            </div>
                                                            <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden self-end mb-1">
                                                                <div 
                                                                    className={`h-full ${comp.color?.replace('text-', 'bg-') || 'bg-indigo-500'} transition-all duration-1000`} 
                                                                    style={{ width: `${Math.min(100, (comp.score / (comp.max || 100)) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-slate-400 italic leading-relaxed relative z-10">
                                                    " {perfBreakdown.summary} "
                                                </div>
                                            </div>
                                        )}

                        {/* ANALYSIS TAB */}
                        {activeTab === 'analysis' && (
                            <div className="space-y-4">
                                {/* Suggestion Banner */}
                                {parsedWorkout?.suggestedSubType &&
                                    parsedWorkout.suggestedSubType !== 'default' &&
                                    (activity.subType === 'default' || !activity.subType) && subPerformances.length === 0 && (
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-top-2">
                                            <div>
                                                <p className="text-xs font-bold text-amber-400 uppercase flex items-center gap-2">
                                                    <span>💡</span> Förslag: {parsedWorkout.suggestedSubType === 'interval' ? 'Intervaller' : parsedWorkout.suggestedSubType === 'long-run' ? 'Långpass' : parsedWorkout.suggestedSubType}
                                                </p>
                                                <p className="text-[10px] text-amber-200/70">
                                                    Analysen tyder på att detta är ett {parsedWorkout.suggestedSubType === 'interval' ? 'intervallpass' : 'långpass'}.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    handleApplyCategory(parsedWorkout.suggestedSubType as any);
                                                }}
                                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors"
                                            >
                                                Uppdatera
                                            </button>
                                        </div>
                                    )}


                                {/* Race History Analysis */}
                                {isCompetition(activity) && currentUniversal && (
                                    <RaceHistoryCard
                                        currentActivity={currentUniversal}
                                        allActivities={universalActivities}
                                        onSelectActivity={onSelectActivity}
                                    />
                                )}

                                {segmentedSplits && !isCompetition(activity) && (
                                    <IntervalSplitsCard 
                                        activity={{ ...currentActivity, performance: perf } as any} 
                                        segmented={segmentedSplits} 
                                        onToggleTrack={(isTrack) => updateExercise(activity.id, { isTrack } as any)}
                                    />
                                )}

                                {/* Splits / Laps Table (fallback when segmentation is unavailable) */}
                                {(!segmentedSplits && existingSplits && existingSplits.length > 0) && (
                                    <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden mt-6">
                                        <div className="p-4 bg-slate-800/50 border-b border-white/5 flex items-center justify-between">
                                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                                                <span className="text-amber-400">⏱️</span> Kilometertider
                                            </h3>
                                            <span className="text-xs text-slate-500 font-mono">{existingSplits.length} varv</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-950/50 text-xs uppercase font-black text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-3 rounded-tl-xl text-center">KM</th>
                                                        <th className="px-4 py-3">Tempo</th>
                                                        <th className="px-4 py-3">Puls</th>
                                                        <th className="px-4 py-3 hidden sm:table-cell">Höjd</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {existingSplits.map((split: any) => {
                                                        const isFastest = existingSplits.reduce((min: any, s: any) => s.movingTime < min.movingTime ? s : min, existingSplits[0]).split === split.split;
                                                        const paceStr = formatPace(split.movingTime / (split.distance / 1000));

                                                        const startKmVal = parseFloat(editForm.startKm || '0');
                                                        const isHighlighted = activity.extractedFromId && startKmVal >= 0 && (
                                                            split.split > startKmVal &&
                                                            split.split <= (startKmVal + (activity.distance || 0))
                                                        );

                                                        return (
                                                            <tr
                                                                key={split.split}
                                                                className={`hover:bg-indigo-500/10 transition-all group ${isHighlighted ? 'bg-amber-500/5 border-l-2 border-amber-500' : ''}`}
                                                            >
                                                                <td className="px-4 py-3 font-mono font-bold text-slate-400 text-center">
                                                                    {activity.extractedFromId && editForm.startKm ? (
                                                                        <span className={isHighlighted ? 'text-amber-400 font-black text-xs' : 'text-slate-500 text-[10px]'}>
                                                                            {(startKmVal + split.split - 1).toFixed(0)}-{(startKmVal + split.split).toFixed(0)}
                                                                        </span>
                                                                    ) : (
                                                                        split.split
                                                                    )}
                                                                </td>

                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`font-mono font-bold ${isFastest ? 'text-amber-400' : 'text-white'}`}>
                                                                            {paceStr}
                                                                        </span>
                                                                        {isFastest && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase tracking-wider hidden sm:inline-block">Snabbast</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {split.averageHeartrate ? (
                                                                        <span className="text-rose-400 font-mono text-xs flex items-center gap-1">
                                                                            <Heart className="w-2.5 h-2.5 text-rose-500/50" /> {Math.round(split.averageHeartrate)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-600">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 hidden sm:table-cell">
                                                                    {split.elevationDiff !== undefined ? (
                                                                        <span className={`font-mono text-xs ${split.elevationDiff > 0 ? 'text-emerald-400' : split.elevationDiff < 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                                                                            {split.elevationDiff > 0 ? '+' : ''}{Math.round(split.elevationDiff)}m
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-600">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <WorkoutStructureCard
                                    title={universalActivity?.plan?.title || activity.title || activity.type || 'Workout'}
                                    description={universalActivity?.plan?.description || activity.notes || ''}
                                    subPerformances={subPerformances}
                                />
                            </div>
                        )}

                        {/* PREP TAB */}
                        {activeTab === 'prep' && (isCompetition(activity) || (activity.distance || 0) > 20) && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4">
                                <PrepTabContent
                                    activity={currentActivity}
                                    allActivities={allActivities}
                                    timeframeWeeks={timeframeWeeks}
                                    setTimeframeWeeks={setTimeframeWeeks}
                                    onSelectActivity={onSelectActivity}
                                />

                                {isCompetition(activity) && (
                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrophyIcon className="text-amber-400 w-4 h-4" />
                                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Historik för {normalizeRaceTitle(displayTitle)}</h3>
                                        </div>
                                        <RaceHistoryCard
                                            currentActivity={currentUniversal!}
                                            allActivities={universalActivities}
                                            onSelectActivity={onSelectActivity}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* RAW DATA VIEW */}
                        {viewMode === 'raw' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase">📄 Rådata för felsökning</h3>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(JSON.stringify(activity, null, 2));
                                            // Optional: visual feedback could be added here, but keeping it simple as requested
                                        }}
                                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded transition-colors uppercase font-bold tracking-wider"
                                    >
                                        Kopiera JSON
                                    </button>
                                </div>
                                <div className="bg-slate-950 border border-white/5 rounded-xl p-4 overflow-auto max-h-[50vh] custom-scrollbar">
                                    <pre className="text-[10px] text-slate-500 font-mono leading-relaxed">
                                        {JSON.stringify(activity, null, 2)}
                                    </pre>
                                </div>
                                <p className="text-[10px] text-slate-600 italic">
                                    Denna vy visar den kombinerade JSON-strukturen för aktiviteten, inklusive merge-data och källinfo.
                                </p>
                            </div>
                        )}

                        {/* COMPARISON TAB */}
                        {activeTab === 'compare' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* RACE HIGHSCORES SECTION */}
                                {isRace && currentUniversal && (
                                    <RaceHistoryCard
                                        currentActivity={currentUniversal}
                                        allActivities={universalActivities}
                                        onSelectActivity={onSelectActivity}
                                    />
                                )}


                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                            <History size={16} /> Liknande träningspass
                                        </h3>
                                        <span className="text-[10px] text-slate-500 uppercase font-mono">Senaste och motsvarande (+/- 25% distans)</span>
                                    </div>

                                    {similarActivities.length > 0 ? (
                                        <div className="bg-slate-800/30 rounded-2xl overflow-hidden border border-white/5 shadow-xl">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-950/50">
                                                    <tr>
                                                        <th className="px-5 py-4 text-left text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-white/5">Datum</th>
                                                        <th className="px-5 py-4 text-right text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-white/5">{activity.type === 'cycling' ? 'Fart' : 'Tempo'}</th>
                                                        {activity.elevationGain !== undefined && <th className="px-5 py-4 text-right text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-white/5">Höjd</th>}
                                                        <th className="px-5 py-4 text-right text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-white/5">Puls</th>
                                                        <th className="px-5 py-4 text-right text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-white/5">Score</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 font-mono">
                                                    <tr className="bg-indigo-500/10 group relative border-l-4 border-l-indigo-500">
                                                        <td className="px-5 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="text-white font-black">{formatSwedishDate(activity.date)}</span>
                                                                <span className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter mt-0.5">Detta pass</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-5 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-indigo-200 font-black text-base">{
                                                                    activity.distance
                                                                        ? (activity.type === 'cycling'
                                                                            ? formatSpeed((activity.durationMinutes * 60) / activity.distance)
                                                                            : formatPace((activity.durationMinutes * 60) / activity.distance)
                                                                        )
                                                                        : '-'
                                                                }</span>
                                                                <span className="text-[9px] text-slate-500 uppercase font-bold">{activity.distance} km</span>
                                                            </div>
                                                        </td>
                                                        {activity.elevationGain !== undefined && (
                                                            <td className="px-5 py-5 text-right text-emerald-400 font-black text-sm">{Math.round(activity.elevationGain)}m</td>
                                                        )}
                                                        <td className="px-5 py-5 text-right text-rose-400 font-black text-sm">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Heart size={10} /> {perf?.avgHeartRate ? Math.round(perf.avgHeartRate) : '-'}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-5 text-right">
                                                            <span className="bg-indigo-500/30 text-indigo-400 ring-1 ring-indigo-500/50 text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg shadow-indigo-500/20">
                                                                {calculatePerformanceScore(activity) || '-'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {similarActivities.map(a => {
                                                        const aPaceSec = a.distance ? (a.durationMinutes * 60 / a.distance) : 0;
                                                        const aScore = calculatePerformanceScore(a);
                                                        return (
                                                            <tr key={a.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => onSelectActivity?.(a.id)}>
                                                                <td className="px-5 py-5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-slate-300 font-bold">{formatSwedishDate(a.date)}</span>
                                                                        <span className="text-[10px] text-slate-500 uppercase font-medium">{getRelativeTime(a.date)}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-5 text-right">
                                                                    <div className="flex flex-col items-end">
                                                                        <span className="text-slate-300 font-bold">{aPaceSec ? (activity.type === 'cycling' ? formatSpeed(aPaceSec) : formatPace(aPaceSec)) : '-'}</span>
                                                                        <span className="text-[9px] text-slate-500 uppercase">{a.distance} km</span>
                                                                    </div>
                                                                </td>
                                                                {activity.elevationGain !== undefined && (
                                                                    <td className="px-5 py-5 text-right text-slate-400 text-sm">{Math.round(a.elevationGain || 0)}m</td>
                                                                )}
                                                                <td className="px-5 py-5 text-right text-slate-400 text-sm">{a.heartRateAvg ? Math.round(a.heartRateAvg) : '-'}</td>
                                                                <td className="px-5 py-5 text-right">
                                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${aScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30' :
                                                                        aScore >= 60 ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30' : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/30'
                                                                        }`}>
                                                                        {aScore || '-'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-16 bg-slate-900/30 rounded-3xl border-2 border-dashed border-white/5">
                                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                                                <Search size={24} />
                                            </div>
                                            <h4 className="text-slate-400 font-bold text-sm mb-1">Inga liknande pass hittades</h4>
                                            <p className="text-slate-600 text-xs">Testa att springa fler pass med distans +/- 25% för jämförelse.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SPLITS TAB */}
                        {activeTab === 'splits' && (
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-indigo-400 uppercase">⏱️ Kilometertider</h3>

                                {/* Split Chart */}
                                <div className="h-48 bg-slate-800/30 rounded-xl p-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={splits.map((s: any, i: number) => {
                                            const distKm = s.distance / 1000;
                                            const paceVal = s.movingTime / (distKm || 1);
                                            return {
                                                km: `Km ${i + 1}`,
                                                seconds: paceVal,
                                                realDistance: distKm,
                                                movingTime: s.movingTime,
                                                label: distKm < 0.95 ? `Km ${i + 1} (${distKm.toFixed(2)}km)` : `Km ${i + 1}`
                                            };
                                        })}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis dataKey="km" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis hide domain={['dataMin - 30', 'dataMax + 30']} />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '4px' }}
                                                formatter={(val: number, name: any, props: any) => {
                                                    const payload = props.payload;
                                                    const min = Math.floor(val / 60);
                                                    const sec = Math.round(val % 60);
                                                    const paceStr = `${min}:${sec.toString().padStart(2, '0')} /km`;

                                                    if (payload.realDistance < 0.95) {
                                                        const m = Math.floor(payload.movingTime / 60);
                                                        const s = Math.round(payload.movingTime % 60);
                                                        const timeStr = `${m}:${s.toString().padStart(2, '0')}`;
                                                        return [
                                                            <div key="custom-tooltip">
                                                                <div className="text-white font-black">{paceStr}</div>
                                                                <div className="text-[10px] text-slate-500 mt-1">Tid: {timeStr} för {payload.realDistance.toFixed(2)} km</div>
                                                            </div>,
                                                            'Tempo'
                                                        ];
                                                    }

                                                    return [paceStr, 'Tempo'];
                                                }}
                                            />
                                            <Bar dataKey="seconds" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Heart Rate Intensity Graph (Split-based) */}
                                {/* Tempo intensity Graph (Split-based) */}
                                {splits.length >= 2 && (
                                    <div className="space-y-3 mb-6">
                                        <h3 className="text-sm font-bold text-indigo-400 uppercase">📈 Tempoutveckling</h3>
                                        <div className="h-48 bg-slate-800/30 rounded-xl p-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={splits.map((s: any, i: number) => ({
                                                    km: `Km ${i + 1}`,
                                                    pace: s.movingTime / (Math.max(s.distance, 1) / 1000)
                                                }))} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                                    <defs>
                                                        <linearGradient id="colorLargePace" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.01} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                    <XAxis dataKey="km" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />

                                                    {activeHighlightRange && (
                                                        <ReferenceArea
                                                            x1={`Km ${activeHighlightRange.start + 1}`}
                                                            x2={`Km ${activeHighlightRange.end}`}
                                                            fill="#f59e0b"
                                                            fillOpacity={0.15}
                                                        />
                                                    )}

                                                    <YAxis domain={['auto', 'auto']} reversed hide />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }}
                                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                                                        formatter={(val: number) => [`${Math.floor(val / 60)}:${(Math.round(val % 60)).toString().padStart(2, '0')} /km`, 'Tempo']}
                                                    />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="pace"
                                                        stroke="#818cf8"
                                                        strokeWidth={3}
                                                        fill="url(#colorLargePace)"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {splits.some((s: any) => s.averageHeartrate) && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-rose-400 uppercase flex items-center gap-2"><Heart className="w-4 h-4" /> Pulsutveckling</h3>
                                        <div className="h-48 bg-slate-800/30 rounded-xl p-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={splits.map((s: any, i: number) => ({
                                                    km: `Km ${i + 1}`,
                                                    hr: (s.averageHeartrate && s.averageHeartrate > 0) ? s.averageHeartrate : null
                                                }))}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                    <XAxis dataKey="km" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />

                                                    {activeHighlightRange && (
                                                        <ReferenceArea
                                                            x1={`Km ${activeHighlightRange.start + 1}`}
                                                            x2={`Km ${activeHighlightRange.end}`}
                                                            fill="#f59e0b"
                                                            fillOpacity={0.15}
                                                        />
                                                    )}

                                                    <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
                                                    <Tooltip
                                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px' }}
                                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                                                        formatter={(val: number) => [`${Math.round(val)} bpm`, 'Puls']}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="hr"
                                                        stroke="#f43f5e"
                                                        strokeWidth={3}
                                                        dot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }}
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                        connectNulls
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}

                                {/* Laps Table */}
                                {existingLaps && existingLaps.length > 0 && !areLapsAndSplitsIdentical && (
                                    <div className="bg-slate-800/50 rounded-xl overflow-hidden mt-6">
                                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                                <span>⏱️</span> Laps (Manuella / Auto)
                                            </h4>
                                            <span className="text-[10px] text-slate-500 font-mono">{existingLaps.length} varv</span>
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-950/50">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-slate-500">Varv</th>
                                                    <th className="px-4 py-2 text-right text-slate-500">Tid</th>
                                                    <th className="px-4 py-2 text-right text-slate-500">Distans</th>
                                                    <th className="px-4 py-2 text-right text-slate-500">Tempo</th>
                                                    <th className="px-4 py-2 text-right text-slate-500">Puls</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {existingLaps.map((l: any, i: number) => {
                                                    const lapPace = l.movingTime / (l.distance / 1000);
                                                    return (
                                                        <tr key={i} className="hover:bg-indigo-500/10 transition-colors group">
                                                            <td className="px-4 py-3 text-white font-bold">{l.name || `Varv ${i + 1}`}</td>
                                                            <td className="px-4 py-3 text-right text-slate-300">
                                                                {Math.floor(l.movingTime / 60)}:{(l.movingTime % 60).toString().padStart(2, '0')}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">
                                                                {(l.distance / 1000).toFixed(2)} km
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-amber-400 font-mono text-xs">
                                                                {isFinite(lapPace) ? `${Math.floor(lapPace / 60)}:${(Math.round(lapPace % 60)).toString().padStart(2, '0')} /km` : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-rose-400">
                                                                {l.averageHeartrate ? Math.round(l.averageHeartrate) : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Split Table */}
                                <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-950/50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-slate-500">Splitt</th>
                                                <th className="px-4 py-2 text-right text-slate-500">Tid</th>
                                                <th className="px-4 py-2 text-right text-slate-500">Tempo</th>
                                                <th className="px-4 py-2 text-right text-slate-500">Puls</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {splits.map((s: any, i: number) => {
                                                const splitPace = s.movingTime / (s.distance / 1000);

                                                const startKmVal = parseFloat(editForm.startKm || '0');
                                                const isHighlighted = activity.extractedFromId && startKmVal >= 0 && (
                                                    (i + 1) > startKmVal &&
                                                    (i + 1) <= (startKmVal + (activity.distance || 0))
                                                );

                                                return (
                                                    <tr key={i} className={`hover:bg-indigo-500/10 transition-colors group ${isHighlighted ? 'bg-amber-500/10 border-l-2 border-amber-500' : ''}`}>
                                                        <td className="px-4 py-3 text-white font-bold">
                                                            {activity.extractedFromId && editForm.startKm ? (
                                                                <span className={isHighlighted ? 'text-amber-400 font-black text-xs' : 'text-slate-400 text-[10px]'}>
                                                                    {(startKmVal + i).toFixed(0)}-{(startKmVal + i + 1).toFixed(0)} km
                                                                </span>
                                                            ) : (
                                                                `${i + 1} km`
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-300">
                                                            {Math.floor(s.movingTime / 60)}:{(s.movingTime % 60).toString().padStart(2, '0')}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-indigo-400">
                                                            {isFinite(splitPace) ? `${Math.floor(splitPace / 60)}:${(Math.round(splitPace % 60)).toString().padStart(2, '0')} /km` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-rose-400">
                                                            {s.averageHeartrate ? Math.round(s.averageHeartrate) : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}



                        {/* MERGE TAB - Shows original activities for manually merged activities */}
                        {activeTab === 'merge' && isMergedActivity && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">⚡ Sammanslagen aktivitet</h3>
                                    <span className="text-[10px] text-slate-500 uppercase font-mono">
                                        Skapad {effectiveMergeInfo?.mergedAt ? formatSwedishDate(effectiveMergeInfo.mergedAt.split('T')[0]) : '-'}
                                    </span>
                                </div>

                                <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4">
                                    <p className="text-sm text-slate-300 mb-4">
                                        Denna aktivitet är en sammanslagning av <strong className="text-amber-400">{originalActivities.length}</strong> separata aktiviteter.
                                        De kombinerade värdena (distans, tid, kalorier osv.) har räknats ut automatiskt.
                                    </p>

                                    {/* Original Activities List */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase">Ingående aktiviteter:</h4>
                                        {originalActivities.length > 0 ? (
                                            originalActivities.map((orig, idx) => {
                                                const title = orig.plan?.title || orig.performance?.notes || null;
                                                const avgHr = orig.performance?.avgHeartRate;

                                                return (
                                                    <button
                                                        key={orig.id}
                                                        className="w-full bg-slate-800/50 border border-white/5 rounded-lg p-3 hover:bg-slate-700/50 hover:border-amber-500/30 transition-all text-left group"
                                                        onClick={() => {
                                                            // Navigate to this component activity
                                                            navigate(`/logg?activityId=${orig.id}`);
                                                        }}
                                                        title={title || 'Visa aktivitet'}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400 group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors">
                                                                    {idx + 1}
                                                                </div>
                                                                <div>
                                                                    {title ? (
                                                                        <>
                                                                            <p className="text-white font-bold group-hover:text-amber-400 transition-colors truncate max-w-[200px]">{title}</p>
                                                                            <p className="text-xs text-slate-500 capitalize">{orig.performance?.activityType || 'Aktivitet'} • {formatSwedishDate(orig.date)}</p>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-white font-bold capitalize group-hover:text-amber-400 transition-colors">{orig.performance?.activityType || 'Aktivitet'}</p>
                                                                            <p className="text-xs text-slate-500">{formatSwedishDate(orig.date)}</p>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-4 text-sm items-center">
                                                                {orig.performance?.distanceKm && (
                                                                    <div className="text-right">
                                                                        <p className="text-emerald-400 font-mono font-bold">{orig.performance.distanceKm.toFixed(1)} km</p>
                                                                    </div>
                                                                )}
                                                                {orig.performance?.durationMinutes && (
                                                                    <div className="text-right">
                                                                        <p className="text-slate-300 font-mono">{formatDuration(orig.performance.durationMinutes * 60)}</p>
                                                                    </div>
                                                                )}
                                                                {avgHr && avgHr > 0 && (
                                                                    <div className="text-right">
                                                                        <p className="text-rose-400 font-mono text-xs flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500/50" /> {avgHr}</p>
                                                                    </div>
                                                                )}
                                                                {orig.performance?.distanceKm && orig.performance?.durationMinutes && (
                                                                    <div className="text-right">
                                                                        <p className="text-indigo-400 font-mono">{formatPace((orig.performance.durationMinutes * 60) / orig.performance.distanceKm)}</p>
                                                                    </div>
                                                                )}
                                                                <span className="text-slate-500 group-hover:text-amber-400 transition-colors">↗</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <p className="text-slate-500 italic text-sm">
                                                Originalaktiviteterna kunde inte hittas. De kan ha tagits bort.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Unmerge Option */}
                                <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">🔀 Ta isär aktiviteter</h4>
                                    <p className="text-sm text-slate-400 mb-4">
                                        Om sammanslagningen blev fel kan du separera dem igen. Den sammanslagna aktiviteten försvinner och de ursprungliga aktiviteterna visas på nytt.
                                    </p>
                                    <button
                                        onClick={handleUnmerge}
                                        disabled={isUnmerging}
                                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isUnmerging ? '⏳ Separerar...' : '🔀 Separera aktiviteter'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* EXTRACTION FORM */}
                        {showExtractForm && (
                            <div id="extraction-form" className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-4 animate-in slide-in-from-bottom-2">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                        <span>✂️</span> Extrahera distans-insats
                                    </h3>
                                    <button onClick={() => setShowExtractForm(false)} className="text-slate-500 hover:text-white">✕</button>
                                </div>
                                <p className="text-[10px] text-slate-400 italic">
                                    Skapa en separat logg för t.ex. ett snabbt 5k inom ett längre pass. Denna logg räknas för PR men dubbelräknar inte din totala träningsmängd.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Titel (t.ex. "Snabbt 5k")</label>
                                        <input
                                            type="text"
                                            value={extractForm.title}
                                            onChange={e => setExtractForm({ ...extractForm, title: e.target.value })}
                                            placeholder="Titel..."
                                            className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Distans (km)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={extractForm.distance}
                                            onChange={e => setExtractForm({ ...extractForm, distance: e.target.value })}
                                            placeholder="5.0"
                                            className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Tid (hh:mm:ss)</label>
                                        <input
                                            type="text"
                                            value={extractForm.duration}
                                            onChange={e => setExtractForm({ ...extractForm, duration: e.target.value })}
                                            placeholder="00:19:45"
                                            className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-amber-500/50"
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={extractForm.isHiddenInCalendar}
                                            onChange={e => setExtractForm({ ...extractForm, isHiddenInCalendar: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:bg-amber-500/50 transition-colors border border-white/5"></div>
                                        <div className="absolute left-1 top-1 w-2 h-2 bg-slate-400 rounded-full transition-transform peer-checked:translate-x-4 peer-checked:bg-amber-400"></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-amber-400/80 transition-colors">Dölj mätning från kalendern (rekommenderas)</span>
                                </label>

                                <button
                                    onClick={handleExtractSubmit}
                                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-2 rounded-xl text-xs transition-colors"
                                >
                                    Spara prestationsmätning
                                </button>
                            </div>
                        )}

                        {/* Footer Buttons - Only Close visible by default */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={onClose}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-wider"
                            >
                                Stäng
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
