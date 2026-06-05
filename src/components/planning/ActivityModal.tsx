import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PlannedActivity, generateId } from '../../models/types.ts';
import { notificationService } from '../../services/notificationService.ts';
import { X, Zap, Plus, Trophy, AlertTriangle, Clock, Dumbbell, Timer, Bike, Activity, Wind, Waves, Disc, TrendingUp, Target } from 'lucide-react';
import { TrainingSuggestion } from '../../utils/trainingSuggestions.ts';
import { useSmartTrainingSuggestions } from '../../hooks/useSmartTrainingSuggestions.ts';
import { useData } from '../../context/DataContext.tsx';
import { useSettings } from '../../context/SettingsContext.tsx';
import { useHRZones } from '../profile/hooks/useHRZones.ts';

interface ActivityModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string | null;
    editingActivity: PlannedActivity | null;
    onSave: (activity: PlannedActivity) => void;
    onDelete?: (id: string) => void;
    weeklyStats: any;
    goalProgress: any;
}

export function ActivityModal({
    isOpen,
    onClose,
    selectedDate,
    editingActivity,
    onSave,
    onDelete,
    weeklyStats,
    goalProgress
}: ActivityModalProps) {


    // Internal Form State
    const [formType, setFormType] = useState<'RUN' | 'STRENGTH' | 'HYROX' | 'BIKE' | 'REST' | 'CARDIO' | 'OTHER'>('RUN');
    // New: Sub-category state for UI chips (only for RUN)
    const [runSubCategory, setRunSubCategory] = useState<'EASY' | 'LONG_RUN' | 'INTERVALS' | 'RECOVERY'>('EASY');
    // New: Sub-type state for CARDIO
    const [formSubType, setFormSubType] = useState<'cycling' | 'cross-trainer' | 'rowing' | 'stair-master' | 'skierg' | 'cardio' | 'other'>('cardio');

    const [formDuration, setFormDuration] = useState('00:45');
    const [formDistance, setFormDistance] = useState('');
    const [formTonnage, setFormTonnage] = useState(''); // New Strength Input
    const [formMuscleGroups, setFormMuscleGroups] = useState<string[]>([]); // New Strength Input
    const [formNotes, setFormNotes] = useState('');
    const [formIntensity, setFormIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');
    const [isRace, setIsRace] = useState(false);
    const [formGoalA, setFormGoalA] = useState('');
    const [formGoalB, setFormGoalB] = useState('');
    const [formGoalC, setFormGoalC] = useState('');
    const [formPace, setFormPace] = useState('05:30'); // Tempo in mm:ss per km
    const [formTitle, setFormTitle] = useState('');

    // Ref to track which field was last changed by the user to prevent circular calculation loops
    const lastChanged = useRef<'pace' | 'duration' | 'distance' | 'preset' | null>(null);

    // Hyrox specific
    const [formIncludesRunning, setFormIncludesRunning] = useState(true);
    const [formHyroxFocus, setFormHyroxFocus] = useState<'hybrid' | 'strength' | 'cardio'>('hybrid');
    const [formStatus, setFormStatus] = useState<'PLANNED' | 'COMPLETED' | 'SKIPPED' | 'CHANGED'>('PLANNED');
    const [formStartTime, setFormStartTime] = useState('');
    const [formDate, setFormDate] = useState(selectedDate || '');
    const [formCalculationMode, setFormCalculationMode] = useState<'original' | 'distance'>('original');
    const [formTargetSpeedKmh, setFormTargetSpeedKmh] = useState<string>('');
    const [formTargetWattsRange, setFormTargetWattsRange] = useState<string>('');

    const { 
        exerciseEntries, 
        plannedActivities, 
        currentUser, 
        updateCurrentUser, 
        universalActivities,
        unifiedActivities,
        reconciliation
    } = useData();
    const { settings } = useSettings();
    const { savedZones, detectedZones } = useHRZones();

    const hasExistingActivity = React.useMemo(() => {
        if (!selectedDate) return false;
        const hasPlanned = plannedActivities.some(a =>
            a.date === selectedDate &&
            a.status !== 'COMPLETED' &&
            a.id !== editingActivity?.id
        );
        const hasCompleted = exerciseEntries.some(e => e.date === selectedDate);
        return hasPlanned || hasCompleted;
    }, [selectedDate, plannedActivities, exerciseEntries, editingActivity]);

    // Find previous race results matching the current race name
    const previousRaceResults = useMemo(() => {
        if (!isRace || !editingActivity?.title) return [];

        // Extract core race name: remove emojis, "TÄVLING", year, km, etc.
        const raceTitle = editingActivity.title
            .replace(/🏆/g, '').replace(/TÄVLING/gi, '').trim();
        if (!raceTitle || raceTitle.length < 3) return [];

        // Normalize: lowercase, strip common suffixes
        const normalize = (s: string) => s.toLowerCase()
            .replace(/\d{4}/g, '').replace(/\d+[\.,]?\d*\s*km/gi, '')
            .replace(/[^\wåäöÅÄÖ\s]/g, '').trim();
        const coreName = normalize(raceTitle);
        if (!coreName || coreName.length < 3) return [];

        // Search exerciseEntries for past races
        const fromExercises = exerciseEntries
            .filter(e => {
                if (e.subType !== 'race' || !e.title) return false;
                const entryCore = normalize(e.title);
                return entryCore.includes(coreName) || coreName.includes(entryCore);
            })
            .map(e => ({
                date: e.date,
                title: e.title || 'Tävling',
                distance: e.distance || 0,
                durationMinutes: e.durationMinutes || 0,
                timeFormatted: e.durationMinutes
                    ? `${Math.floor(e.durationMinutes / 60)}:${String(Math.round(e.durationMinutes % 60)).padStart(2, '0')}`
                    : null,
                pace: e.distance && e.durationMinutes
                    ? `${Math.floor(e.durationMinutes / e.distance)}:${String(Math.round((e.durationMinutes / e.distance % 1) * 60)).padStart(2, '0')}`
                    : null,
                source: 'log' as const
            }));

        // Also search completed planned activities that are races
        const fromPlanned = plannedActivities
            .filter(p => {
                if (!p.isRace || p.status !== 'COMPLETED' || !p.title) return false;
                const entryCore = normalize(p.title);
                return entryCore.includes(coreName) || coreName.includes(entryCore);
            })
            .map(p => ({
                date: p.date,
                title: p.title,
                distance: p.actualDistance || p.estimatedDistance || 0,
                durationMinutes: p.actualTimeSeconds ? p.actualTimeSeconds / 60 : (p.durationMinutes || 0),
                timeFormatted: p.actualTimeSeconds
                    ? `${Math.floor(p.actualTimeSeconds / 3600)}:${String(Math.floor((p.actualTimeSeconds % 3600) / 60)).padStart(2, '0')}:${String(p.actualTimeSeconds % 60).padStart(2, '0')}`
                    : null,
                pace: null,
                source: 'plan' as const
            }));

        // Deduplicate by date, prefer exercise entries
        const byDate = new Map<string, typeof fromExercises[0]>();
        [...fromPlanned, ...fromExercises].forEach(r => {
            byDate.set(r.date, r);
        });

        return Array.from(byDate.values())
            .filter(r => r.date !== editingActivity?.date) // Exclude current race
            .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
    }, [isRace, editingActivity, exerciseEntries, plannedActivities]);

    // 2. Smart Suggestions Hook
    const smartSuggestions = useSmartTrainingSuggestions(selectedDate, weeklyStats, goalProgress);

    // Calculate run stats and presets for suggestions and default values
    const runStats = useMemo(() => {
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(now.getMonth() - 6);

        // From exerciseEntries
        const exerciseRuns = exerciseEntries
            .filter(e =>
                (e.type === 'running') &&
                new Date(e.date) >= sixMonthsAgo &&
                new Date(e.date) <= now &&
                e.distance && e.distance > 0 &&
                !e.excludeFromStats
            )
            .map(e => ({
                date: new Date(e.date),
                distance: e.distance || 0,
                durationMinutes: (e as any).durationMinutes || 0,
                category: (e as any).category || 'EASY',
                avgHeartRate: (e as any).heartRateAvg || (e as any).performance?.avgHeartRate || 0
            }));

        // From universalActivities (Strava)
        const stravaRuns = (universalActivities || [])
            .filter(ua => {
                const actType = (ua.performance?.activityType as string || '').toLowerCase();
                return (
                    (actType === 'running' || actType === 'run') &&
                    new Date(ua.date) >= sixMonthsAgo &&
                    new Date(ua.date) <= now &&
                    (ua.performance?.distanceKm || 0) > 0
                );
            })
            .map(ua => ({
                date: new Date(ua.date),
                distance: ua.performance?.distanceKm || 0,
                durationMinutes: (ua.performance as any).durationMinutes || 0,
                category: (ua as any).category || 'EASY',
                avgHeartRate: ua.performance?.avgHeartRate || (ua as any).heartRateAvg || 0
            }));

        // Combine and deduplicate
        const allRunsMap = new Map<string, { date: Date, distance: number, durationMinutes: number, category: string, avgHeartRate: number }>();
        [...exerciseRuns, ...stravaRuns].forEach(run => {
            const key = run.date.toISOString().split('T')[0];
            const existing = allRunsMap.get(key);
            if (!existing || run.distance > existing.distance) {
                allRunsMap.set(key, run);
            }
        });
        const allRuns = Array.from(allRunsMap.values());

        // Calculate average for recent 5 weeks
        const fiveWeeksAgo = new Date();
        fiveWeeksAgo.setDate(now.getDate() - 35);
        const recentRuns = allRuns.filter(r => r.date >= fiveWeeksAgo);
        const avgDistance = recentRuns.length >= 3
            ? recentRuns.reduce((sum, r) => sum + r.distance, 0) / recentRuns.length
            : null;

        // Find average "INTERVAL" and "TEMPO" pace
        const intervalRuns = allRuns.filter(r => r.category === 'INTERVALS' && r.durationMinutes > 0 && r.distance > 0);
        const avgIntervalPace = intervalRuns.length > 0
            ? intervalRuns.reduce((sum, r) => sum + (r.durationMinutes / r.distance), 0) / intervalRuns.length
            : 4.5; // Default faster

        const tempoRuns = allRuns.filter(r => r.category === 'TEMPO' && r.durationMinutes > 0 && r.distance > 0);
        const avgTempoPace = tempoRuns.length > 0
            ? tempoRuns.reduce((sum, r) => sum + (r.durationMinutes / r.distance), 0) / tempoRuns.length
            : 4.75; // Default

        // Find average "EASY" pace
        const easyRuns = allRuns.filter(r => r.category === 'EASY' && r.durationMinutes > 0 && r.distance > 0);
        const avgEasyPace = easyRuns.length > 0
            ? easyRuns.reduce((sum, r) => sum + (r.durationMinutes / r.distance), 0) / easyRuns.length
            : 5.5; // Default


        // Bucketing for presets
        const distanceBuckets: Record<string, { count: number, paceCount: number, totalPace: number }> = {};
        allRuns.forEach(run => {
            const rounded = (Math.round(run.distance * 2) / 2).toFixed(1);
            if (!distanceBuckets[rounded]) {
                distanceBuckets[rounded] = { count: 0, paceCount: 0, totalPace: 0 };
            }
            distanceBuckets[rounded].count += 1;
            if (run.durationMinutes && run.durationMinutes > 0 && run.distance > 0) {
                const pace = run.durationMinutes / run.distance;
                if (pace >= 3 && pace <= 12) {
                    distanceBuckets[rounded].totalPace += pace;
                    distanceBuckets[rounded].paceCount += 1;
                }
            }
        });

        const sortedDistances = Object.entries(distanceBuckets)
            .filter(([d, data]) => parseFloat(d) >= 2 && data.count >= 2)
            .sort((a, b) => b[1].count - a[1].count);

        const spacedDistances: typeof sortedDistances = [];
        sortedDistances.forEach(([d, data]) => {
            const dist = parseFloat(d);
            const tooClose = spacedDistances.some(([existingD]) =>
                Math.abs(parseFloat(existingD) - dist) < 1
            );
            if (!tooClose && spacedDistances.length < 5) {
                spacedDistances.push([d, data]);
            }
        });

        const frequentPresets = spacedDistances.length >= 2
            ? spacedDistances.map(([d, data]) => ({
                distance: parseFloat(d),
                count: data.count,
                avgPace: data.paceCount > 0 ? data.totalPace / data.paceCount : 5.5,
                label: `${d} km`,
                isDefault: false
            }))
            : [
                { distance: 5, count: 0, avgPace: 5.5, label: '5 km', isDefault: true },
                { distance: 7, count: 0, avgPace: 5.5, label: '7 km', isDefault: true },
                { distance: 10, count: 0, avgPace: 5.5, label: '10 km', isDefault: true },
                { distance: 15, count: 0, avgPace: 5.75, label: '15 km', isDefault: true },
                { distance: 21.1, count: 0, avgPace: 6.0, label: 'Halvmaraton', isDefault: true },
            ];

        return { allRuns, avgDistance, frequentPresets, avgEasyPace, avgIntervalPace, avgTempoPace };
    }, [exerciseEntries, universalActivities]);

    // Calculate zone paces based on heart rate zones from running history
    const zonePaces = useMemo(() => {
        const zones = (savedZones || detectedZones)?.zones;
        const defaultPaces = {
            1: 6.5, // 6:30 min/km
            2: 5.75, // 5:45 min/km
            3: 5.25, // 5:15 min/km
            4: 4.75, // 4:45 min/km
            5: 4.25  // 4:15 min/km
        };

        const paceSums: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const paceCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        const getZoneOfHeartRate = (hr: number) => {
            if (!hr) return 0;
            if (zones) {
                if (zones.z1 && hr >= zones.z1.min && hr <= zones.z1.max) return 1;
                if (zones.z2 && hr >= zones.z2.min && hr <= zones.z2.max) return 2;
                if (zones.z3 && hr >= zones.z3.min && hr <= zones.z3.max) return 3;
                if (zones.z4 && hr >= zones.z4.min && hr <= zones.z4.max) return 4;
                if (zones.z5 && hr >= zones.z5.min && hr <= zones.z5.max) return 5;
                if (zones.z1 && hr < zones.z1.min) return 1;
                if (zones.z5 && hr > zones.z5.max) return 5;
                if (zones.z1 && zones.z2 && hr > zones.z1.max && hr < zones.z2.min) return 1;
                if (zones.z2 && zones.z3 && hr > zones.z2.max && hr < zones.z3.min) return 2;
                if (zones.z3 && zones.z4 && hr > zones.z3.max && hr < zones.z4.min) return 3;
                if (zones.z4 && zones.z5 && hr > zones.z4.max && hr < zones.z5.min) return 4;
            } else {
                const max = 190;
                const rest = 60;
                const reserve = max - rest;
                const getHRVal = (intensity: number) => Math.round(reserve * intensity + rest);
                if (hr < getHRVal(0.60)) return 1;
                if (hr < getHRVal(0.70)) return 2;
                if (hr < getHRVal(0.80)) return 3;
                if (hr < getHRVal(0.90)) return 4;
                return 5;
            }
            return 0;
        };

        runStats.allRuns.forEach(run => {
            const hr = (run as any).avgHeartRate;
            if (hr && hr > 0 && run.durationMinutes && run.distance) {
                const zone = getZoneOfHeartRate(hr);
                if (zone >= 1 && zone <= 5) {
                    const pace = run.durationMinutes / run.distance;
                    if (pace >= 3 && pace <= 12) {
                        paceSums[zone] += pace;
                        paceCounts[zone] += 1;
                    }
                }
            }
        });

        const result: Record<number, { pace: number; display: string; count: number; rangeStr: string }> = {};
        for (let z = 1; z <= 5; z++) {
            const avgPace = paceCounts[z] > 0 ? (paceSums[z] / paceCounts[z]) : defaultPaces[z as 1|2|3|4|5];
            const mins = Math.floor(avgPace);
            const secs = Math.round((avgPace - mins) * 60);
            
            let rangeStr = '';
            if (zones) {
                const zoneKey = `z${z}`;
                const zData = (zones as any)[zoneKey];
                if (zData) {
                    rangeStr = `${zData.min}-${zData.max} bpm`;
                }
            } else {
                const max = 190;
                const rest = 60;
                const reserve = max - rest;
                const getHRVal = (intensity: number) => Math.round(reserve * intensity + rest);
                const bounds = [
                    { min: rest, max: getHRVal(0.60) },
                    { min: getHRVal(0.60), max: getHRVal(0.70) },
                    { min: getHRVal(0.70), max: getHRVal(0.80) },
                    { min: getHRVal(0.80), max: getHRVal(0.90) },
                    { min: getHRVal(0.90), max: max }
                ];
                rangeStr = `${bounds[z-1].min}-${bounds[z-1].max} bpm`;
            }

            result[z] = {
                pace: avgPace,
                display: `${mins}:${secs.toString().padStart(2, '0')}`,
                count: paceCounts[z],
                rangeStr
            };
        }
        return result;
    }, [runStats.allRuns, savedZones, detectedZones]);

    // Smart Note Logic: Update "X km" in notes when distance changes
    useEffect(() => {
        if (formDistance && formNotes) {
            const regex = /(\d+(?:[.,]\d+)?)\s*km/i;
            const match = formNotes.match(regex);
            if (match) {
                const currentNoteDist = parseFloat(match[1].replace(',', '.'));
                const newDist = parseFloat(formDistance);
                if (Math.abs(currentNoteDist - newDist) > 0.1) {
                    const newNote = formNotes.replace(regex, `${formDistance} km`);
                    setFormNotes(newNote);
                }
            }
        }
    }, [formDistance]);

    // Smart Note Logic: Update "(HH:MM)" duration in notes when duration changes
    useEffect(() => {
        if (formDuration && formNotes) {
            const regex = /\((\d{2}:\d{2})\)/;
            const match = formNotes.match(regex);
            if (match && match[1] !== formDuration) {
                setFormNotes(formNotes.replace(regex, `(${formDuration})`));
            }
        }
    }, [formDuration]);

    // Auto-calculate duration from distance and pace
    useEffect(() => {
        // Only trigger if pace, distance or preset was changed by user, or if it's a RUN
        if (formType === 'RUN' && formDistance && formPace && (lastChanged.current === 'pace' || lastChanged.current === 'distance' || lastChanged.current === 'preset' || lastChanged.current === null)) {
            const distKm = parseFloat(formDistance.replace(',', '.'));
            if (isNaN(distKm) || distKm <= 0) return;
            const paceParts = formPace.split(':');
            if (paceParts.length !== 2) return;
            const pm = parseInt(paceParts[0]);
            const ps = parseInt(paceParts[1]);
            if (isNaN(pm)) return;

            const paceMinutes = pm + (isNaN(ps) ? 0 : ps / 60);
            if (paceMinutes <= 0) return;
            const totalMinutes = Math.round(distKm * paceMinutes);

            if (isNaN(totalMinutes)) return;

            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const newDuration = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            if (newDuration !== formDuration && !newDuration.includes('NaN')) {
                setFormDuration(newDuration);
            }
        }
    }, [formDistance, formPace, formType]);

    // Auto-calculate pace from distance and duration
    useEffect(() => {
        // Only trigger if duration was changed explicitly by the user
        if (formType === 'RUN' && formDistance && formDuration && lastChanged.current === 'duration') {
            const distKm = parseFloat(formDistance.replace(',', '.'));
            if (isNaN(distKm) || distKm <= 0) return;
            const [hours, minutes] = formDuration.split(':').map(Number);
            const totalMinutes = (hours * 60) + minutes;
            if (isNaN(totalMinutes) || totalMinutes <= 0) return;

            const paceDecimal = totalMinutes / distKm;
            if (isNaN(paceDecimal) || paceDecimal === Infinity) return;

            const paceMins = Math.floor(paceDecimal);
            const paceSecs = Math.round((paceDecimal - paceMins) * 60);
            const newPace = `${paceMins.toString().padStart(2, '0')}:${paceSecs.toString().padStart(2, '0')}`;
            if (newPace !== formPace && !newPace.includes('NaN')) {
                setFormPace(newPace);
            }
        }
    }, [formDuration, formDistance, formType]);

    // Initialize Form on Open
    useEffect(() => {
        if (isOpen && selectedDate) {
            lastChanged.current = null; // Reset on open to allow initial auto-calculations if needed
            if (editingActivity) {
                // Robust mapping to handle lowercase types from ExerciseEntry and uppercase from PlannedActivity
                const rawType = (editingActivity.type as string).toUpperCase();
                if (rawType === 'RUNNING' || rawType === 'RUN') setFormType('RUN');
                else if (rawType === 'STRENGTH') setFormType('STRENGTH');
                else if (rawType === 'HYROX') setFormType('HYROX');
                else if (rawType === 'CYCLING' || rawType === 'BIKE') setFormType('BIKE');
                else if (rawType === 'REST') setFormType('REST');
                else if (rawType === 'CARDIO') setFormType('CARDIO');
                else setFormType('OTHER');

                if (editingActivity.subType) setFormSubType(editingActivity.subType as any);

                if (editingActivity.category === 'LONG_RUN') setRunSubCategory('LONG_RUN');
                else if (editingActivity.category === 'INTERVALS' || editingActivity.category === 'TEMPO') setRunSubCategory('INTERVALS');
                else if (editingActivity.category === 'RECOVERY') setRunSubCategory('RECOVERY');
                else setRunSubCategory('EASY');

                const durMatch = editingActivity.description?.match(/\((\d{2}:\d{2})\)$/);
                setFormDuration(durMatch ? durMatch[1] : '00:45');
                setFormDistance(editingActivity.estimatedDistance ? Number(editingActivity.estimatedDistance).toFixed(1) : '');
                setFormTonnage(editingActivity.tonnage ? editingActivity.tonnage.toString() : '');
                setFormMuscleGroups(editingActivity.muscleGroups || []);
                setFormNotes(editingActivity.description || '');
                setFormIntensity(editingActivity.targetHrZone <= 2 ? 'low' : editingActivity.targetHrZone >= 4 ? 'high' : 'moderate');
                setIsRace(editingActivity.isRace || false);
                setFormGoalA(editingActivity.raceDetails?.goals?.a || '');
                setFormGoalB(editingActivity.raceDetails?.goals?.b || '');
                setFormGoalC(editingActivity.raceDetails?.goals?.c || '');
                setFormIncludesRunning(editingActivity.includesRunning ?? true);
                setFormHyroxFocus((editingActivity as any).hyroxFocus || 'hybrid');
                setFormStartTime(editingActivity.startTime || '');
                setFormStatus(editingActivity.status === 'DRAFT' ? 'PLANNED' : editingActivity.status as any);
                setFormDate(editingActivity.date || selectedDate || '');
                setFormCalculationMode(editingActivity.calculationMode as any || 'original');
                setFormTargetSpeedKmh(editingActivity.targetSpeedKmh?.toString() || '');
                setFormTargetWattsRange(editingActivity.targetWattsRange || '');
                setFormTitle(editingActivity.title || '');
            } else {
                setFormType('RUN');
                setRunSubCategory('EASY');
                setFormDuration('00:45');
                setFormDistance('');
                setFormTonnage('');
                setFormMuscleGroups([]);
                setFormNotes('');
                setFormIntensity('moderate');
                setIsRace(false);
                setFormGoalA('');
                setFormGoalB('');
                setFormGoalC('');
                setFormIncludesRunning(true);
                setFormHyroxFocus('hybrid');
                setFormStartTime('');
                setFormStatus('PLANNED');
                setFormDate(selectedDate || '');
                setFormCalculationMode('original');
                setFormTargetSpeedKmh('');
                setFormTargetWattsRange('');
                setFormTitle('');
            }
        }
    }, [isOpen, selectedDate, editingActivity]);

    // Helper to handle Run Sub-category clicks
    const handleRunSubCategoryClick = (sub: 'EASY' | 'LONG_RUN' | 'INTERVALS' | 'RECOVERY') => {
        lastChanged.current = 'pace'; // Treat sub-category click as pace change for recovery
        setRunSubCategory(sub);

        // Auto-update pace based on sub-category and history
        let targetPaceDecimal = runStats.avgEasyPace;
        if (sub === 'RECOVERY') {
            setFormIntensity('low');
            targetPaceDecimal = runStats.avgEasyPace + 0.5;
        } else if (sub === 'INTERVALS') {
            setFormIntensity('high');
            targetPaceDecimal = runStats.avgIntervalPace || 4.5;
        } else if (sub === 'LONG_RUN') {
            setFormIntensity('moderate');
            targetPaceDecimal = runStats.avgEasyPace + 0.25;
        } else {
            setFormIntensity('moderate');
            targetPaceDecimal = runStats.avgEasyPace;
        }

        const mins = Math.floor(targetPaceDecimal);
        const secs = Math.round((targetPaceDecimal - mins) * 60);
        setFormPace(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    // Toggle Muscle Group Helper
    const toggleMuscleGroup = (muscle: string) => {
        setFormMuscleGroups(prev =>
            prev.includes(muscle)
                ? prev.filter(m => m !== muscle)
                : [...prev, muscle]
        );
    };

    const handleSave = () => {
        console.log('ActivityModal: handleSave triggered');
        try {
            if (!formDate) {
                notificationService.notify('error', 'Datum saknas');
                return;
            }

            console.log('ActivityModal: formDate validated:', formDate);

            // Parse hh:mm to minutes for internal logic/description if needed
            const [hours, minutes] = formDuration.split(':').map(Number);
            const totalMinutes = (hours * 60) + minutes;

            // Determine Final Category
            let finalCategory = 'EASY';
            if (formType === 'RUN') {
                if (isRace) finalCategory = 'RACE';
                else finalCategory = runSubCategory;
            } else if (formType === 'STRENGTH') {
                finalCategory = 'STRENGTH';
            } else if (formType === 'HYROX') {
                // If Hyrox is strength-focused, categorize as STRENGTH
                finalCategory = formHyroxFocus === 'strength' ? 'STRENGTH' : 'INTERVALS';
            } else if (formType === 'REST') {
                finalCategory = 'REST';
            } else if (formType === 'CARDIO' || formType === 'BIKE') {
                finalCategory = 'CARDIO';
            } else {
                finalCategory = 'OTHER';
            }

            // Determine Title
            let autoTitle = 'Pass';
            if (formType === 'RUN') {
                if (isRace) autoTitle = 'TÄVLING 🏆';
                else if (runSubCategory === 'LONG_RUN') autoTitle = 'Långpass';
                else if (runSubCategory === 'INTERVALS') autoTitle = 'Intervaller';
                else if (runSubCategory === 'RECOVERY') autoTitle = 'Återhämtning';
                else autoTitle = 'Löpning';
            } else if (formType === 'STRENGTH') {
                autoTitle = 'Styrka';
                const isPush = ['chest', 'shoulders', 'arms'].every(m => formMuscleGroups.includes(m)) && formMuscleGroups.length <= 4;
                const isPull = ['back', 'arms'].every(m => formMuscleGroups.includes(m)) && formMuscleGroups.length <= 3;
                const isLegs = formMuscleGroups.includes('legs') && formMuscleGroups.length <= 2;
                if (isPush) autoTitle = 'Styrka: Push';
                else if (isPull) autoTitle = 'Styrka: Pull';
                else if (isLegs) autoTitle = 'Styrka: Ben';
            } else if (formType === 'HYROX') {
                autoTitle = 'Hyrox';
            } else if (formType === 'REST') {
                autoTitle = 'Vilodag';
            } else if (formType === 'CARDIO') {
                if (formSubType === 'cross-trainer') autoTitle = 'Cross trainer';
                else if (formSubType === 'rowing') autoTitle = 'Rodd';
                else if (formSubType === 'stair-master') autoTitle = 'Trappmaskin';
                else if (formSubType === 'skierg') autoTitle = 'Skierg';
                else autoTitle = 'Allmän Cardio';
            } else if (formType === 'BIKE') {
                const totalMins = (hours * 60) + minutes;
                autoTitle = `Cykel ${totalMins} min`;
            }

            const finalTitle = formTitle.trim() || autoTitle;

            const activityData: PlannedActivity = {
                id: editingActivity?.id || generateId(),
                date: formDate,
                type: formType,
                category: finalCategory as PlannedActivity['category'],
                subType: (formType === 'CARDIO' || formType === 'BIKE') ? (formType === 'BIKE' ? 'cycling' : formSubType) : undefined,
                title: finalTitle,
                description: formNotes || `${formType === 'REST' ? 'Vila och återhämtning' : finalTitle + ' pass'} (${formDuration})`,
                estimatedDistance: formDistance ? parseFloat(formDistance.replace(',', '.')) : 0,
                durationMinutes: totalMinutes || undefined,

                // Hyrox & Strength
                tonnage: (formType === 'STRENGTH' || formType === 'HYROX') && formTonnage ? parseInt(formTonnage) : undefined,
                muscleGroups: formType === 'STRENGTH' ? formMuscleGroups as any : undefined,

                // Hyrox specific
                includesRunning: formType === 'HYROX' ? formIncludesRunning : undefined,
                hyroxFocus: formType === 'HYROX' ? formHyroxFocus : undefined,
                startTime: formStartTime || undefined, // Now available for all types

                targetPace: '',
                targetHrZone: formType === 'REST' ? 1 : (formIntensity === 'low' ? 2 : formIntensity === 'moderate' ? 3 : 4),
                structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 } as PlannedActivity['structure'],
                status: formStatus as any,
                calculationMode: formCalculationMode as any,
                targetSpeedKmh: formType === 'BIKE' && formTargetSpeedKmh ? parseFloat(formTargetSpeedKmh.replace(',', '.')) : undefined,
                targetWattsRange: formType === 'BIKE' ? formTargetWattsRange : undefined,
                isRace: isRace,
                order: isRace ? 0 : undefined,
                raceDetails: isRace ? {
                    ...editingActivity?.raceDetails,
                    goals: {
                        a: formGoalA || undefined,
                        b: formGoalB || undefined,
                        c: formGoalC || undefined
                    }
                } : undefined
            };

            console.log('ActivityModal: Calling onSave with:', activityData);
            onSave(activityData);
            console.log('ActivityModal: onSave finished');
            onClose();
        } catch (err) {
            console.error('ActivityModal: handleSave CRASHED:', err);
            notificationService.notify('error', 'Ett tekniskt fel uppstod: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    const handleApplySuggestion = (s: TrainingSuggestion) => {
        if (!formDate) return;

        // Map suggestion type to form category
        let category = 'EASY';
        if (s.type === 'STRENGTH') category = 'STRENGTH';
        else if (s.type === 'REST') category = 'REST';
        else if (s.type === 'HYROX') category = 'INTERVALS';
        else if (s.label.includes('Långpass')) category = 'LONG_RUN';
        else if (s.label.includes('Intervaller') || s.label.includes('Tempo') || s.label.includes('Kvalitet')) category = 'INTERVALS';
        else if (s.label.includes('Återhämtning')) category = 'RECOVERY';

        const newActivity: PlannedActivity = {
            id: generateId(),
            date: formDate,
            type: (s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'REST' ? 'REST' : 'RUN') as PlannedActivity['type'],
            category: category as PlannedActivity['category'],
            title: s.label,
            description: s.description,
            estimatedDistance: s.distance || 0,
            durationMinutes: s.duration,
            targetPace: '',
            targetHrZone: s.intensity === 'low' ? 2 : s.intensity === 'moderate' ? 3 : 4,
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            status: 'PLANNED'
        };

        onSave(newActivity);
        onClose();
    };

    // Handler to add multiple suggestions at once (e.g., Uppjogg + Nerjogg)
    const handleApplyGroup = (group: TrainingSuggestion[]) => {
        if (!formDate) return;

        group.forEach((s) => {
            // Uppjogg always before race (order 0), Nerjogg always after (order 9999)
            const isNerjogg = s.label.toLowerCase().includes('nerjogg');
            const newActivity: PlannedActivity = {
                id: generateId(),
                date: formDate,
                type: 'RUN' as PlannedActivity['type'],
                category: 'RECOVERY' as PlannedActivity['category'],
                title: s.label,
                description: s.description,
                estimatedDistance: s.distance || 0,
                durationMinutes: s.duration,
                targetPace: '',
                targetHrZone: 2,
                structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
                status: 'PLANNED',
                order: isNerjogg ? 9999 : 0
            };
            onSave(newActivity);
        });
        onClose();
    };

    // Get Suggestion Color
    const getSuggestionColor = (s: TrainingSuggestion) => {
        if (s.label.includes('Måljakt')) return 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400';
        if (s.type === 'STRENGTH') return 'from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400';
        if (s.label.includes('Återhämtning') || s.type === 'REST') return 'from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400';
        if (s.label.includes('Intervaller') || s.label.includes('Tempo') || s.label.includes('Kvalitet') || s.intensity === 'high') return 'from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400';

        // Default (Distance/Vanlig)
        return 'from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            {editingActivity ? '✏️ Redigera' : `📅 Planera`}
                            <span className="text-slate-400">|</span>
                            <span className="text-blue-500">{formDate}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar grow">
                    {/* Actual Performance for Completed Sessions */}
                    {editingActivity && formStatus === 'COMPLETED' && (editingActivity.actualDistance || editingActivity.actualTimeSeconds) && (
                        <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                            <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-3 flex items-center gap-2">
                                <Activity size={12} /> Genomfört resultat:
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {editingActivity.actualDistance ? (
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Faktisk Distans</div>
                                        <div className="text-sm font-black text-slate-900 dark:text-white flex items-baseline gap-1.5">
                                            {editingActivity.actualDistance.toFixed(2)} <span className="text-[10px] text-slate-400">km</span>
                                            {editingActivity.estimatedDistance > 0 && (
                                                <span className={`text-[10px] font-bold ${editingActivity.actualDistance >= editingActivity.estimatedDistance ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    ({(editingActivity.actualDistance - editingActivity.estimatedDistance) > 0 ? '+' : ''}{(editingActivity.actualDistance - editingActivity.estimatedDistance).toFixed(1)})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                {editingActivity.actualTimeSeconds ? (
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Faktisk Tid</div>
                                        <div className="text-sm font-black text-slate-900 dark:text-white">
                                            {Math.floor(editingActivity.actualTimeSeconds / 60)} <span className="text-[10px] text-slate-400">min</span>
                                            {editingActivity.durationMinutes && (
                                                <span className={`ml-1.5 text-[10px] font-bold ${editingActivity.actualTimeSeconds/60 >= editingActivity.durationMinutes ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    ({Math.round(editingActivity.actualTimeSeconds/60 - editingActivity.durationMinutes)}m)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {/* Double Session Warning */}
                    {hasExistingActivity && !editingActivity && (
                        <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                            <div>
                                <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">Dubbelpass?</h4>
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-tight mt-0.5">
                                    Det finns redan träning registrerad eller planerad på detta datum.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {!editingActivity && smartSuggestions.length > 0 && (() => {
                        const filtered = smartSuggestions.filter(s => {
                            if (formType === 'STRENGTH') return s.type === 'STRENGTH';
                            if (formType === 'RUN') return s.type === 'RUN' || s.type === 'REST';
                            if (formType === 'HYROX') return s.type === 'HYROX' || s.type === 'STRENGTH' || s.type === 'RUN';
                            return true;
                        });
                        if (filtered.length === 0) return null;

                        // Detect grouped suggestions (e.g., race-day pair)
                        const groupIds = [...new Set(filtered.filter(s => s.groupId).map(s => s.groupId!))];
                        const hasGroup = groupIds.length > 0;

                        return (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <Zap size={14} className="text-amber-500 fill-amber-500" />
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                                        {hasGroup ? 'Tävlingsdag' : 'Smarta Förslag'}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {filtered.map(s => {
                                        const colorClasses = s.groupId
                                            ? 'from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400'
                                            : getSuggestionColor(s);
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => handleApplySuggestion(s)}
                                                className={`w-full p-3 bg-gradient-to-r border rounded-xl flex items-center justify-between group hover:scale-[1.02] transition-transform text-left ${colorClasses}`}
                                            >
                                                <div>
                                                    <div className="text-xs font-black mb-0.5">{s.label}</div>
                                                    <div className="text-[10px] opacity-80 font-medium">{s.description}</div>
                                                </div>
                                                <div className="p-1.5 bg-white/50 dark:bg-slate-800/50 rounded-full shadow-sm">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {/* "Add Both" button for grouped suggestions */}
                                    {groupIds.map(gid => {
                                        const group = filtered.filter(s => s.groupId === gid);
                                        if (group.length < 2) return null;
                                        return (
                                            <button
                                                key={`group-${gid}`}
                                                onClick={() => handleApplyGroup(group)}
                                                className="w-full p-3 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl flex items-center justify-between group hover:scale-[1.02] transition-transform text-left text-yellow-800 dark:text-yellow-300 shadow-sm"
                                            >
                                                <div>
                                                    <div className="text-xs font-black mb-0.5">✨ Lägg till båda</div>
                                                    <div className="text-[10px] opacity-80 font-medium">
                                                        {group.map(s => s.label.replace(/ [\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u, '')).join(' + ')}
                                                    </div>
                                                </div>
                                                <div className="p-1.5 bg-yellow-200/80 dark:bg-yellow-800/50 rounded-full shadow-sm">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Form */}
                    <div className="space-y-4">
                        {/* Status Selector - Only visible when editing an existing activity */}
                        {editingActivity && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-2">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1">Status</label>
                                <div className="flex gap-1.5">
                                    {[
                                        { id: 'PLANNED', label: 'Planerat', color: 'blue' },
                                        { id: 'COMPLETED', label: 'Klart', color: 'emerald' },
                                        { id: 'SKIPPED', label: 'Överhoppat', color: 'slate' },
                                        { id: 'CHANGED', label: 'Bytt', color: 'amber' },
                                    ].map((s) => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setFormStatus(s.id as any)}
                                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${formStatus === s.id
                                                ? `bg-${s.color}-500 text-white border-${s.color}-500 shadow-md`
                                                : `bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-${s.color}-300`
                                                }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Steg 1: Aktivitetstyp & Kategori */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-3">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Steg 1: Typ & Kategori</div>
                            {/* Type Selector */}
                            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                                <button
                                    onClick={() => setFormType('RUN')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'RUN' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Löpning
                                </button>
                                {(settings.trainingInterests?.strength ?? true) && (
                                    <button
                                        onClick={() => setFormType('STRENGTH')}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'STRENGTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Styrka
                                    </button>
                                )}
                                {settings.trainingInterests?.hyrox && (
                                    <button
                                        onClick={() => setFormType('HYROX')}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'HYROX' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Hyrox
                                    </button>
                                )}
                                <button
                                    onClick={() => setFormType('CARDIO')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'CARDIO' || formType === 'BIKE' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Cardio
                                </button>
                                <button
                                    onClick={() => setFormType('REST')}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'REST' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-600 dark:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    Vila
                                </button>
                            </div>

                            {/* Cardio Sub-Type Selector */}
                            {(formType === 'CARDIO' || formType === 'BIKE') && (
                                <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
                                    {[
                                        { id: 'cycling', label: 'Cykling', icon: <Bike size={14} />, activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-md', inactiveClass: 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-emerald-300' },
                                        { id: 'cross-trainer', label: 'Cross trainer', icon: <Disc size={14} />, activeClass: 'bg-teal-500 text-white border-teal-500 shadow-md', inactiveClass: 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-teal-300' },
                                        { id: 'rowing', label: 'Rodd', icon: <Waves size={14} />, activeClass: 'bg-blue-500 text-white border-blue-500 shadow-md', inactiveClass: 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-300' },
                                        { id: 'stair-master', label: 'Trappmaskin', icon: <TrendingUp size={14} />, activeClass: 'bg-indigo-500 text-white border-indigo-500 shadow-md', inactiveClass: 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300' },
                                        { id: 'skierg', label: 'Skierg', icon: <Wind size={14} />, activeClass: 'bg-sky-500 text-white border-sky-500 shadow-md', inactiveClass: 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-sky-300' },
                                        { id: 'cardio', label: 'Allmän Cardio', icon: <Activity size={14} />, activeClass: 'bg-slate-500 text-white border-slate-500 shadow-md', inactiveClass: 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300' },
                                    ].map((sub) => {
                                        const isActive = (formType === 'BIKE' && sub.id === 'cycling') || (formType === 'CARDIO' && formSubType === sub.id);
                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={() => {
                                                    if (sub.id === 'cycling') setFormType('BIKE');
                                                    else {
                                                        setFormType('CARDIO');
                                                        setFormSubType(sub.id as any);
                                                    }
                                                }}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${isActive ? sub.activeClass : sub.inactiveClass}`}
                                            >
                                                {sub.icon}
                                                {sub.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Run Sub-Category Selector */}
                            {formType === 'RUN' && (
                                <div className="flex gap-1.5 pt-1 pb-1 overflow-x-auto no-scrollbar">
                                    {[
                                        { id: 'EASY', label: 'Distans', activeClass: 'bg-blue-500 text-white border-blue-500 shadow-md transform scale-105', inactiveClass: 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-300' },
                                        { id: 'LONG_RUN', label: 'Långpass', activeClass: 'bg-indigo-500 text-white border-indigo-500 shadow-md transform scale-105', inactiveClass: 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300' },
                                        { id: 'INTERVALS', label: 'Intervall/Tempo', activeClass: 'bg-rose-500 text-white border-rose-500 shadow-md transform scale-105', inactiveClass: 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-rose-300' },
                                        { id: 'RECOVERY', label: 'Återhämtning', activeClass: 'bg-emerald-500 text-white border-emerald-500 shadow-md transform scale-105', inactiveClass: 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 hover:border-emerald-300' },
                                    ].map((sub) => {
                                        const isActive = runSubCategory === sub.id;
                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={() => handleRunSubCategoryClick(sub.id as any)}
                                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-all border ${isActive ? sub.activeClass : sub.inactiveClass}`}
                                            >
                                                {sub.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Title Field */}
                            <div className="pt-1">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Titel / Namn på passet</label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="T.ex. Vanlig dag, Långpass (lämna tom för standardnamn)"
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Race & Move Date Toggle */}
                            <div className="flex flex-wrap justify-between items-center gap-2 pt-1">
                                {editingActivity && (
                                    <div className="flex-1 min-w-[150px]">
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Flytta pass</label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                )}
                                {formType === 'RUN' && (
                                    <button
                                        onClick={() => setIsRace(!isRace)}
                                        className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${isRace ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 text-yellow-600 dark:text-yellow-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                    >
                                        <Trophy size={16} className={isRace ? 'fill-yellow-500' : ''} />
                                        <span className="text-xs font-black uppercase">Tävling</span>
                                    </button>
                                )}
                            </div>

                            {/* Race Goals & Previous Results */}
                            {formType === 'RUN' && isRace && (
                                <div className="mt-2 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Trophy size={14} className="text-amber-500 fill-amber-500" />
                                        <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Målsättningar</span>
                                    </div>

                                    {/* Previous Race Results */}
                                    {previousRaceResults.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                📊 Tidigare resultat
                                            </div>
                                            <div className="space-y-1.5">
                                                {previousRaceResults.slice(0, 3).map(r => (
                                                    <div key={r.date} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                                                        <div>
                                                            <div className="text-xs font-black text-slate-800 dark:text-slate-200">{r.title}</div>
                                                            <div className="text-[10px] text-slate-500 font-medium">{r.date}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            {r.timeFormatted && (
                                                                <div className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">{r.timeFormatted}</div>
                                                            )}
                                                            <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 justify-end">
                                                                {r.distance > 0 && <span>{r.distance.toFixed(1)} km</span>}
                                                                {r.pace && <span>({r.pace} /km)</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Goal Inputs: A / B / C */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 mb-1 ml-0.5 tracking-wider">🥇 Mål A</label>
                                            <input
                                                type="text"
                                                value={formGoalA}
                                                onChange={(e) => setFormGoalA(e.target.value)}
                                                placeholder="Drömtid"
                                                className="w-full bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/40 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-0.5 tracking-wider">🥈 Mål B</label>
                                            <input
                                                type="text"
                                                value={formGoalB}
                                                onChange={(e) => setFormGoalB(e.target.value)}
                                                placeholder="Realistiskt"
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-0.5 tracking-wider">🥉 Mål C</label>
                                            <input
                                                type="text"
                                                value={formGoalC}
                                                onChange={(e) => setFormGoalC(e.target.value)}
                                                placeholder="Säkert"
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Smarta Förslag för Tävling (Warmup/Cooldown) */}
                                    <div className="pt-2 border-t border-amber-200/50 dark:border-amber-800/30">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                                            <Zap size={10} className="fill-amber-500" /> Smarta förslag för tävlingsdagen
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const warmup: PlannedActivity = {
                                                        id: generateId(),
                                                        date: formDate,
                                                        type: 'RUN',
                                                        category: 'EASY',
                                                        title: 'Uppjogg',
                                                        description: '20 min lätt löpning inför tävling',
                                                        durationMinutes: 20,
                                                        estimatedDistance: 3,
                                                        status: 'PLANNED',
                                                        order: -1 // Before race
                                                    };
                                                    const cooldown: PlannedActivity = {
                                                        id: generateId(),
                                                        date: formDate,
                                                        type: 'RUN',
                                                        category: 'RECOVERY',
                                                        title: 'Nerjogg',
                                                        description: '20 min lätt löpning efter tävling',
                                                        durationMinutes: 20,
                                                        estimatedDistance: 3,
                                                        status: 'PLANNED',
                                                        order: 1 // After race
                                                    };
                                                    if (window.confirm('Vill du lägga till både uppjogg och nerjogg inför denna tävling?')) {
                                                        (window as any)._pendingRacesActivities = [warmup, cooldown];
                                                        notificationService.notify('info', 'Uppjogg och Nerjogg kommer att sparas tillsammans med tävlingen.');
                                                    }
                                                }}
                                                className="flex-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 p-2 rounded-xl text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                            >
                                                Lägg till Uppjogg & Nerjogg
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Steg 2: Mål & Planering */}
                        {formType !== 'REST' && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-4">
                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Steg 2: Mål & Upplägg</div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* DISTANS for RUN/BIKE */}
                                    {formType === 'RUN' || formType === 'BIKE' ? (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Distans (km)</label>
                                            <div className="space-y-2">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={formDistance}
                                                    onChange={(e) => {
                                                        lastChanged.current = 'distance';
                                                        setFormDistance(e.target.value);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        const step = 0.5;
                                                        const current = parseFloat(formDistance) || 0;
                                                        if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            lastChanged.current = 'distance';
                                                            setFormDistance((current + step).toFixed(1));
                                                        } else if (e.key === 'ArrowDown' && current >= step) {
                                                            e.preventDefault();
                                                            lastChanged.current = 'distance';
                                                            setFormDistance((current - step).toFixed(1));
                                                        }
                                                    }}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    placeholder="0.0"
                                                />
                                            </div>

                                            {formType === 'RUN' && (
                                                <div className="mt-2 space-y-1 animate-in fade-in duration-200">
                                                    <div className="flex justify-between items-center ml-0.5">
                                                        <span className="text-[9px] font-black uppercase text-slate-400">Distanser (snitt/vanliga):</span>
                                                        {runStats.avgDistance && !editingActivity && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    lastChanged.current = 'distance';
                                                                    setFormDistance(runStats.avgDistance!.toFixed(1));
                                                                }}
                                                                className="text-[8px] font-black uppercase text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-900/20 border border-blue-150 dark:border-blue-800/40 px-1.5 py-0.5 rounded-md hover:scale-105 transition-transform"
                                                                title={`Din snittdistans senaste 5 veckor: ${runStats.avgDistance.toFixed(1)} km. Klicka för att välja.`}
                                                            >
                                                                Snitt: {runStats.avgDistance.toFixed(1)}k
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-5 gap-1">
                                                        {runStats.frequentPresets.map((preset: any) => {
                                                            const isActive = formDistance === preset.distance.toFixed(1);
                                                            const label = preset.distance === 21.1 || preset.distance === 21.0975 ? 'HM' : 
                                                                          preset.distance === 42.195 ? 'M' : 
                                                                          `${preset.distance.toFixed(0)}k`;
                                                            return (
                                                                <button
                                                                    key={preset.distance}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        lastChanged.current = 'preset';
                                                                        setFormDistance(preset.distance.toFixed(1));
                                                                        const paceMinutes = Math.floor(preset.avgPace);
                                                                        const paceSeconds = Math.round((preset.avgPace - paceMinutes) * 60);
                                                                        setFormPace(`${paceMinutes.toString().padStart(2, '0')}:${paceSeconds.toString().padStart(2, '0')}`);

                                                                        const totalMinutes = preset.distance * preset.avgPace;
                                                                        const roundedUp = Math.ceil(totalMinutes / 5) * 5;
                                                                        const hours = Math.floor(roundedUp / 60);
                                                                        const mins = roundedUp % 60;
                                                                        setFormDuration(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
                                                                    }}
                                                                    className={`flex flex-col items-center justify-center py-1 rounded-lg border text-[9px] font-bold transition-all hover:scale-102 ${isActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : 'border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 hover:bg-emerald-50/50'}`}
                                                                    title={`${preset.label} (Snittempo: ${Math.floor(preset.avgPace)}:${Math.round((preset.avgPace - Math.floor(preset.avgPace)) * 60).toString().padStart(2, '0')} /km)`}
                                                                >
                                                                    <span className="font-black text-[9px]">{label}</span>
                                                                    {preset.count > 0 ? (
                                                                        <span className="opacity-50 text-[6.5px] leading-none mt-0.5">({preset.count}x)</span>
                                                                    ) : (
                                                                        <span className="opacity-35 text-[6.5px] leading-none mt-0.5">Def</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : formType === 'STRENGTH' ? (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Måltonnage</label>
                                            <div className="space-y-2 relative">
                                                <input
                                                    type="number"
                                                    value={formTonnage}
                                                    onChange={(e) => setFormTonnage(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kg</span>
                                            </div>
                                        </div>
                                    ) : <div className="hidden md:block"></div>}

                                    {/* TEMPO for RUN/BIKE - calculates duration automatically */}
                                    {(formType === 'RUN' || formType === 'BIKE') ? (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Tempo (min/km)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={formPace}
                                                    onChange={(e) => {
                                                        lastChanged.current = 'pace';
                                                        setFormPace(e.target.value);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        const parts = formPace.split(':');
                                                        const pm = parseInt(parts[0]);
                                                        const ps = parts.length === 2 ? parseInt(parts[1]) : 0;

                                                        const totalSeconds = (!isNaN(pm))
                                                            ? pm * 60 + (isNaN(ps) ? 0 : ps)
                                                            : 330; // Default 5:30
                                                        const step = 5; // 5 second increments

                                                        let newSeconds = totalSeconds;
                                                        if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            newSeconds = totalSeconds - step; // Faster pace
                                                            if (newSeconds < 60) newSeconds = 60; // Min 1:00 min/km
                                                        } else if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            newSeconds = totalSeconds + step; // Slower pace
                                                            if (newSeconds > 900) newSeconds = 900; // Max 15:00 min/km
                                                        }

                                                        if (newSeconds !== totalSeconds) {
                                                            const mins = Math.floor(newSeconds / 60);
                                                            const secs = newSeconds % 60;
                                                            lastChanged.current = 'pace';
                                                            setFormPace(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
                                                        }
                                                    }}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    placeholder="05:30"
                                                />
                                                {formDistance && formPace && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500">
                                                        → {formDuration}
                                                    </span>
                                                )}
                                            </div>

                                            {formType === 'RUN' && (
                                                <div className="mt-2 space-y-1 animate-in fade-in duration-200">
                                                    <span className="text-[9px] font-black uppercase text-slate-400 block ml-0.5">Pulszoner (historiskt tempo):</span>
                                                    <div className="grid grid-cols-5 gap-1">
                                                        {[1, 2, 3, 4, 5].map((z) => {
                                                            const zoneInfo = zonePaces[z];
                                                            const isActive = formPace === zoneInfo.display;
                                                            const zoneColors = [
                                                                'border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 bg-blue-50/20 hover:bg-blue-50/50',
                                                                'border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 hover:bg-emerald-50/50',
                                                                'border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 bg-amber-50/20 hover:bg-amber-50/50',
                                                                'border-orange-100 dark:border-orange-900/40 text-orange-600 dark:text-orange-400 bg-orange-50/20 hover:bg-orange-50/50',
                                                                'border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 bg-rose-50/20 hover:bg-rose-50/50'
                                                            ][z - 1];
                                                            const activeColors = [
                                                                'bg-blue-500 text-white border-blue-500 shadow-sm',
                                                                'bg-emerald-500 text-white border-emerald-500 shadow-sm',
                                                                'bg-amber-500 text-white border-amber-500 shadow-sm',
                                                                'bg-orange-500 text-white border-orange-500 shadow-sm',
                                                                'bg-rose-500 text-white border-rose-500 shadow-sm'
                                                            ][z - 1];

                                                            return (
                                                                <button
                                                                    key={z}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        lastChanged.current = 'pace';
                                                                        setFormPace(zoneInfo.display);
                                                                        setFormIntensity(z <= 2 ? 'low' : z === 3 ? 'moderate' : 'high');
                                                                    }}
                                                                    className={`flex flex-col items-center justify-center py-1 rounded-lg border text-[9px] font-bold transition-all hover:scale-102 ${isActive ? activeColors : zoneColors}`}
                                                                    title={`${zoneInfo.rangeStr || ''}`}
                                                                >
                                                                    <span className="font-black text-[9px]">Z{z}</span>
                                                                    <span className="opacity-95 font-black text-[8px] leading-tight tracking-tighter mt-0.5">{zoneInfo.display}</span>
                                                                    {zoneInfo.rangeStr && (
                                                                        <span className="opacity-60 text-[6.5px] font-semibold leading-none mt-0.5 tracking-tighter">{zoneInfo.rangeStr.replace(' bpm', '')}</span>
                                                                    )}
                                                                    {zoneInfo.count > 0 && (
                                                                        <span className="opacity-40 text-[6.5px] font-medium leading-none tracking-tighter">({zoneInfo.count}x)</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Intensitet</label>
                                            <select
                                                value={formIntensity}
                                                onChange={(e) => setFormIntensity(e.target.value as any)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                                            >
                                                <option value="low">Låg (Zon 1-2)</option>
                                                <option value="moderate">Medel (Zon 3)</option>
                                                <option value="high">Hög (Zon 4-5)</option>
                                            </select>
                                        </div>
                                    )}
                                </div>



                                {/* Cycling Specific: Tempo (km/h) and Watts */}
                                {formType === 'BIKE' && (
                                    <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Tempo (km/h)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={formTargetSpeedKmh}
                                                    onChange={(e) => setFormTargetSpeedKmh(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                    placeholder="30.0"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">km/h</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Watt-intervall</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={formTargetWattsRange}
                                                    onChange={(e) => setFormTargetWattsRange(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                                    placeholder="t.ex. 200-220"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">W</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Intensity Selector for RUN/BIKE */}
                                {(formType === 'RUN' || formType === 'BIKE') && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Intensitet</label>
                                        <select
                                            value={formIntensity}
                                            onChange={(e) => setFormIntensity(e.target.value as any)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                                        >
                                            <option value="low">Låg (Zon 1-2)</option>
                                            <option value="moderate">Medel (Zon 3)</option>
                                            <option value="high">Hög (Zon 4-5)</option>
                                        </select>
                                    </div>
                                )}

                                {/* Calorie Calculation Mode - Only for RUN */}
                                {formType === 'RUN' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Kalkylmodell (Kcal)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormCalculationMode('original')}
                                                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formCalculationMode === 'original' ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'}`}
                                            >
                                                MET (Standard)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormCalculationMode('distance')}
                                                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formCalculationMode === 'distance' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-300'}`}
                                            >
                                                {settings.runningCalorieFactor || 0.92} kcal/kg/km
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Strength Specific Inputs */}
                                {formType === 'STRENGTH' && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2">
                                        {/* Presets */}
                                        <div className="flex gap-2">
                                            {[
                                                { label: 'PUSH', muscles: ['chest', 'shoulders', 'arms'] },
                                                { label: 'PULL', muscles: ['back', 'arms'] },
                                                { label: 'LEGS', muscles: ['legs'] },
                                                { label: 'FULL', muscles: ['legs', 'chest', 'back', 'shoulders', 'arms', 'core'] }
                                            ].map(preset => (
                                                <button
                                                    key={preset.label}
                                                    type="button"
                                                    onClick={() => setFormMuscleGroups(preset.muscles)}
                                                    className="flex-1 py-1.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-[10px] font-black text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Muscle Group Selection */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Muskelgrupper</label>
                                            <div className="flex flex-wrap gap-2">
                                                {[
                                                    { id: 'legs', label: 'Ben' },
                                                    { id: 'chest', label: 'Bröst' },
                                                    { id: 'back', label: 'Rygg' },
                                                    { id: 'arms', label: 'Armar' },
                                                    { id: 'shoulders', label: 'Axlar' },
                                                    { id: 'core', label: 'Mage/Core' }
                                                ].map((group) => (
                                                    <button
                                                        key={group.id}
                                                        type="button"
                                                        onClick={() => toggleMuscleGroup(group.id)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${formMuscleGroups.includes(group.id)
                                                            ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-purple-300'
                                                            }`}
                                                    >
                                                        {group.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Hyrox Specific Inputs */}
                                {formType === 'HYROX' && (
                                    <div className="space-y-4 animate-in slide-in-from-top-2 p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Hyrox-fokus</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormHyroxFocus('hybrid')}
                                                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formHyroxFocus === 'hybrid' ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-300'}`}
                                                >
                                                    Hybrid
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormHyroxFocus('strength')}
                                                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formHyroxFocus === 'strength' ? 'bg-purple-500 text-white border-purple-500' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-purple-300'}`}
                                                >
                                                    💪 Styrka
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormHyroxFocus('cardio')}
                                                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${formHyroxFocus === 'cardio' ? 'bg-blue-500 text-white border-blue-500' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300'}`}
                                                >
                                                    🏃 Cardio
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-slate-500 italic">
                                                {formHyroxFocus === 'strength' ? 'Räknas som styrkepass i statistiken' :
                                                    formHyroxFocus === 'cardio' ? 'Räknas som cardiopass i statistiken' :
                                                        'Räknas som hybridpass i statistiken'}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-200">Inkluderar löpning?</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormIncludesRunning(!formIncludesRunning)}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${formIncludesRunning ? 'bg-amber-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formIncludesRunning ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        {formIncludesRunning && (
                                            <div className="space-y-1 animate-in slide-in-from-top-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Distans (km)</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={formDistance}
                                                        onChange={e => {
                                                            lastChanged.current = 'distance';
                                                            setFormDistance(e.target.value);
                                                        }}
                                                        placeholder="t.ex. 8"
                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">km</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tonnage (kg)</label>
                                            <div className="relative">
                                                <Dumbbell className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="number"
                                                    value={formTonnage}
                                                    onChange={e => setFormTonnage(e.target.value)}
                                                    placeholder="t.ex. 5000"
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tonnage - Only for STRENGTH */}
                                {formType === 'STRENGTH' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tonnage (kg)</label>
                                        <div className="relative">
                                            <Dumbbell className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="number"
                                                value={formTonnage}
                                                onChange={e => setFormTonnage(e.target.value)}
                                                placeholder="t.ex. 5000"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Duration Time Picker */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">⏱ Varaktighet (t.ex. 1h20m)</label>
                                    <div className="relative">
                                        <Timer className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="time"
                                            value={formDuration}
                                            onChange={e => { lastChanged.current = "duration"; setFormDuration(e.target.value); }}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Steg 3: Detaljer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-3">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                {formType === 'REST' ? 'Steg 2: Detaljer' : 'Steg 3: Detaljer & Anteckningar'}
                            </div>

                            {/* Start Time - Available for all non-REST activity types */}
                            {formType !== 'REST' && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Starttid (frivilligt)</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            type="time"
                                            value={formStartTime}
                                            onChange={e => setFormStartTime(e.target.value)}
                                            placeholder="08:00"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Anteckningar</label>
                                <textarea
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium h-24 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    placeholder="Beskriv passet..."
                                />
                            </div>
                        </div>

                        {/* Manual Match UI */}
                        {editingActivity && formStatus === 'PLANNED' && (() => {
                            const unmatchedOnDay = unifiedActivities.filter(act => 
                                act.date.split('T')[0] === formDate &&
                                !plannedActivities.some(p => p.externalId === act.id)
                            );
                            
                            const bestCandidateId = editingActivity.reconciliation?.bestCandidateId;
                            
                            if (unmatchedOnDay.length > 0) {
                                return (
                                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                        <div className="text-[10px] font-black uppercase text-indigo-400 tracking-wider mb-2 flex items-center gap-2">
                                            <Target size={12} /> Pass genomfört? Matcha för att dölja:
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            {unmatchedOnDay.map(act => {
                                                const isBest = act.id === bestCandidateId;
                                                return (
                                                    <button 
                                                        key={act.id}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            reconciliation.reconcileActivity(editingActivity.id, act.id);
                                                            onClose();
                                                        }}
                                                        className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all border ${isBest ? 'bg-indigo-500 text-white border-indigo-400 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-500'}`}
                                                    >
                                                        {isBest ? '✨ Matcha förslag: ' : ''}{act.title || act.type} ({Math.round(act.durationMinutes)} min)
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-2 text-[9px] text-slate-400 leading-tight">
                                            Genom att matcha flyttas passet till "Genomfört" och dess statistik används för analys.
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {editingActivity && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (confirm('Är du säker på att du vill ta bort detta pass?')) {
                                        onDelete?.(editingActivity.id);
                                    }
                                }}
                                className="w-full py-3 text-rose-500 font-black uppercase tracking-widest rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all border border-rose-100 dark:border-rose-900/30 text-xs"
                            >
                                Ta bort pass
                            </button>
                        )}

                        <button
                            onClick={handleSave}
                            className={`w-full py-4 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${isRace ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-orange-500/20' : 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/20'
                                }`}
                        >
                            {editingActivity ? 'Uppdatera Pass' : (isRace ? 'Spara Tävling' : 'Spara Pass')}
                        </button>
                    </div>
                </div >
            </div >
        </div >
    );
}
