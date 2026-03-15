import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { StrengthWorkout } from '../../models/strengthTypes.ts';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { formatDuration, formatPace, getRelativeTime, formatSwedishDate, formatSpeed, formatSecondsToTime } from '../../utils/dateUtils.ts';
import { calculatePerformanceScore, calculateGAP, getPerformanceBreakdown } from '../../utils/performanceEngine.ts';
import { HeartRateZones } from '../training/HeartRateZones.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

import { EXERCISE_TYPES, INTENSITIES } from '../training/ExerciseModal.tsx';

import { ExerciseType, ExerciseIntensity, ExerciseSubType, HyroxStation, HyroxActivityStats } from '../../models/types.ts';
import { WorkoutStructureCard } from './WorkoutStructureCard.tsx';
import { IntervalSplitsCard } from './IntervalSplitsCard.tsx';
import { parseWorkout } from '../../utils/workoutParser.ts';
import { segmentSplits } from '../../utils/splitsSegmenter.ts';
import { parseHyroxText } from '../../utils/hyroxParser.ts';
import { Wand2, Zap, ArrowRight, Trophy, Activity, HeartPulse } from 'lucide-react';

// Expandable Exercise Component - click to show sets
const ExpandableExercise = React.memo(({ exercise }: { exercise: any }) => {
    const [expanded, setExpanded] = useState(false);
    const totalReps = exercise.sets.reduce((s: number, set: any) => s + (set.reps || 0), 0);
    const totalDistance = exercise.sets.reduce((s: number, set: any) => s + (set.distance || 0), 0);
    const volume = exercise.totalVolume || 0;

    return (
        <div className="bg-slate-800/30 rounded-lg overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex justify-between items-center text-sm px-3 py-2 hover:bg-slate-700/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">{expanded ? '▼' : '▶'}</span>
                    <span className="text-white font-bold truncate">{exercise.exerciseName}</span>
                </div>
                <div className="flex gap-3 text-xs text-slate-400">
                    <span>{exercise.sets.length} set</span>
                    {totalDistance > 0 ? (
                        <span className="text-emerald-400 font-mono">{totalDistance}m</span>
                    ) : (
                        <span className="text-blue-400">{totalReps} reps</span>
                    )}
                    {volume > 0 && (
                        <span className="text-purple-400 font-mono">
                            {volume >= 1000 ? `${(volume / 1000).toFixed(1)}t` : `${Math.round(volume)}kg`}
                        </span>
                    )}
                </div>
            </button>
            {expanded && (
                <div className="px-3 pb-2 space-y-1 border-t border-white/5">
                    {exercise.sets.map((set: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 text-slate-400">
                            <span className="text-slate-500 font-mono">#{i + 1}</span>
                            <div className="flex gap-4">
                                {set.weight > 0 && <span className="text-white font-mono">{set.weight}kg</span>}
                                {set.reps > 0 && <span className="text-blue-400">× {set.reps}</span>}
                                {set.distance > 0 && <span className="text-emerald-400 font-mono">{set.distance}m</span>}
                                {set.time && <span className="text-slate-500 font-mono">{set.time}</span>}
                                {set.rpe && <span className="text-amber-400">RPE {set.rpe}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

// Helper Component: Sparkline for Splits (Pace & HR)
const SplitsSparkline = React.memo(({ splits }: { splits: any[] }) => {
    if (!splits || splits.length < 2) return null;

    const data = splits.map((s, i) => ({
        index: i + 1,
        pace: s.movingTime / (Math.max(s.distance, 1) / 1000),
        hr: s.averageHeartrate || 0,
    }));

    // Find min/max for better scaling
    const validHrs = data.filter(d => d.hr > 0).map(d => d.hr);
    const minHr = validHrs.length > 0 ? Math.min(...validHrs) - 5 : 40;
    const maxHr = validHrs.length > 0 ? Math.max(...validHrs) + 5 : 200;

    return (
        <div className="h-24 w-full mt-4 bg-black/20 rounded-xl p-2 border border-white/5">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: any, name: string) => [
                            name === 'pace' ? `${Math.floor(value / 60)}:${(Math.round(value % 60)).toString().padStart(2, '0')} /km` : `${Math.round(value)} bpm`,
                            name === 'pace' ? 'Tempo' : 'Puls'
                        ]}
                    />
                    <Line
                        type="monotone"
                        dataKey="pace"
                        name="pace"
                        stroke="#fb7185"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="pace"
                        connectNulls
                    />
                    <Line
                        type="monotone"
                        dataKey="hr"
                        name="hr"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={false}
                        yAxisId="hr"
                        connectNulls
                    />
                    <YAxis yAxisId="pace" hide domain={['auto', 'auto']} reversed />
                    <YAxis yAxisId="hr" hide domain={[minHr, maxHr]} />
                </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-between px-2 text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">
                <span>Start</span>
                <div className="flex gap-4">
                    <span className="text-rose-400">Tempo</span>
                    <span className="text-indigo-400">Puls</span>
                </div>
                <span>Mål</span>
            </div>
        </div>
    );
});

// Helper Component: Mini Interval Summary
const IntervalMiniSummary = React.memo(({ segmentedSplits }: { segmentedSplits: any }) => {
    if (!segmentedSplits) return null;
    const { classified, summary, type } = segmentedSplits;
    const isSustained = type === 'sustained';

    const colors: Record<string, string> = {
        warmup: 'bg-emerald-500',
        interval: 'bg-amber-400',
        recovery: 'bg-slate-600',
        cooldown: 'bg-blue-400',
    };

    return (
        <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl p-4 mt-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                    {isSustained ? 'Passutvärdering' : 'Intervallsammanfattning'}
                </h4>
                <div className="text-[10px] font-bold text-slate-400">
                    {summary.totalIntervalKm.toFixed(1)}km
                </div>
            </div>

            {/* Colored Ribbon */}
            <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-slate-800 mb-4 shadow-inner">
                {classified.map((s: any, i: number) => (
                    <div
                        key={i}
                        className={`${colors[s.role] || 'bg-slate-700'} hover:brightness-125 transition-all cursor-help`}
                        style={{ flex: s.distance }}
                        title={`${s.role}: ${s.distance.toFixed(0)}m`}
                    />
                ))}
            </div>

            {/* Phase stats */}
            <div className={`grid ${isSustained && summary.totalRecoveryKm === 0 ? 'grid-cols-3' : 'grid-cols-4'} gap-2`}>
                <div className="text-center group">
                    <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-emerald-500 transition-colors">Uppjogg</div>
                    <div className="text-[11px] font-black text-emerald-400">{summary.warmupKm.toFixed(1)}k</div>
                </div>
                <div className="text-center group flex flex-col items-center">
                    <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-amber-400 transition-colors">
                        {isSustained ? 'Huvudpass' : 'Intervaller'}
                    </div>
                    <div className="text-[11px] font-black text-amber-300">{summary.totalIntervalKm.toFixed(1)}k</div>
                    {summary.avgIntervalPace > 0 && (
                        <div className="text-[9px] text-amber-400/80 font-mono mt-0.5">{formatPace(summary.avgIntervalPace).replace('/km', '')}/km</div>
                    )}
                </div>
                {(!isSustained || summary.totalRecoveryKm > 0) && (
                    <div className="text-center group">
                        <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-white transition-colors">Vila</div>
                        <div className="text-[11px] font-black text-slate-300">{summary.totalRecoveryKm.toFixed(1)}k</div>
                    </div>
                )}
                <div className="text-center group">
                    <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-blue-400 transition-colors">Nerjogg</div>
                    <div className="text-[11px] font-black text-blue-300">{summary.cooldownKm.toFixed(1)}k</div>
                </div>
            </div>
        </div>
    );
});

export interface ActivityDetailModalProps {
    activity: ExerciseEntry & { source: string; _mergeData?: any };
    universalActivity?: UniversalActivity;
    onClose: () => void;
    onSeparate?: () => void;
    initiallyEditing?: boolean;
    setSelectedActivityId?: (id: string | null) => void;
}

// Activity Detail Modal Component
export function ActivityDetailModal({
    activity,
    universalActivity,
    onClose,
    onSeparate,
    initiallyEditing = false,
    setSelectedActivityId
}: ActivityDetailModalProps) {
    const navigate = useNavigate();
    const { 
        exerciseEntries, 
        universalActivities, 
        updateExercise, 
        deleteExercise, 
        addExercise, 
        calculateExerciseCalories 
    } = useData();
    const { user, token } = useAuth();

    // Support finding the latest version of this activity from current context
    const currentActivity = exerciseEntries.find(e => e.id === activity.id) || activity;
    const currentUniversal = universalActivities.find(u => u.id === activity.id) || universalActivity;

    const perf = currentUniversal?.performance || (currentActivity as any).performance || (currentActivity as any)._mergeData?.universalActivity?.performance;
    const [isEditing, setIsEditing] = useState(initiallyEditing);
    const [viewMode, setViewMode] = useState<'combined' | 'diff' | 'raw'>('combined');

    // Make tabs linkable by parsing the selectedActivityId (if available) for a tab suffix.
    // E.g. activityId="123/splits" means tab="splits" for activity "123"
    const initialTab = React.useMemo(() => {
        // Find if window.location.search has ?activityId=123/splits
        const searchParams = new URLSearchParams(window.location.search);
        const activityParam = searchParams.get('activityId');
        if (activityParam && activityParam.includes('/')) {
            const parts = activityParam.split('/');
            const maybeTab = parts[1];
            if (['stats', 'compare', 'splits', 'merge', 'analysis'].includes(maybeTab)) {
                return maybeTab as 'stats' | 'compare' | 'splits' | 'merge' | 'analysis';
            }
        }
        return 'stats';
    }, []);

    const [activeTab, setActiveTabLocal] = useState<'stats' | 'compare' | 'splits' | 'merge' | 'analysis'>(initialTab);

    const setActiveTab = (tab: 'stats' | 'compare' | 'splits' | 'merge' | 'analysis') => {
        setActiveTabLocal(tab);
        if (setSelectedActivityId) {
            // Update URL parameters directly via parent's state handler
            const baseId = activity.id;
            setSelectedActivityId(`${baseId}/${tab}`);
        }
    };

    const [isUnmerging, setIsUnmerging] = useState(false);

    // Hyrox Parser State
    const [showParser, setShowParser] = useState(false);
    const [parseText, setParseText] = useState('');

    // Extraction State
    const [showExtractForm, setShowExtractForm] = useState(false);
    const [extractForm, setExtractForm] = useState({
        distance: '',
        duration: '', // hh:mm:ss
        title: '',
        isHiddenInCalendar: true // Default to true for extracts to avoid double-counting
    });

    // Edit Form State
    const [editForm, setEditForm] = useState({
        title: currentUniversal?.plan?.title || (currentActivity as any)._mergeData?.universalActivity?.plan?.title || currentActivity.title || currentActivity.notes || '',
        type: currentActivity.type,
        duration: (currentActivity.durationMinutes || 0).toString(),
        intensity: currentActivity.intensity || 'moderate',
        notes: currentActivity.notes || '',
        subType: currentActivity.subType || 'default',
        tonnage: currentActivity.tonnage ? currentActivity.tonnage.toString() : '',
        distance: currentActivity.distance ? currentActivity.distance.toString() : '',
        location: currentActivity.location || '',
        excludeFromStats: currentActivity.excludeFromStats || false,
        isHiddenInCalendar: perf?.isHiddenInCalendar || false,
        hyroxStats: currentActivity.hyroxStats || { runSplits: [], stations: {} }
    });

    // Local title state for immediate optimistic updates
    const [displayTitle, setDisplayTitle] = useState(currentUniversal?.plan?.title || (currentActivity as any)._mergeData?.universalActivity?.plan?.title || currentActivity.title || currentActivity.notes || currentActivity.type || 'Aktivitet');

    // Sync display title if prop/current changes
    useEffect(() => {
        const t = currentUniversal?.plan?.title || (currentActivity as any)._mergeData?.universalActivity?.plan?.title || currentActivity.title || currentActivity.notes || currentActivity.type;
        if (t) setDisplayTitle(t);
    }, [currentUniversal?.plan?.title, (currentActivity as any)._mergeData?.universalActivity?.plan?.title, currentActivity.title, currentActivity.notes, currentActivity.type]);

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
    const splits = perf?.splits || (currentActivity as any).splits || [];
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
            notes: `Utdrag från: ${displayTitle}`,
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
            setExtractForm({ distance: '', duration: '', title: '', isHiddenInCalendar: true });
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

    // Parse workout for analysis & categorization
    const parsedWorkout = React.useMemo(() => {
        const title = universalActivity?.plan?.title || activity._mergeData?.universalActivity?.plan?.title || activity.type || 'Workout';
        const desc = universalActivity?.plan?.description || activity._mergeData?.universalActivity?.plan?.description || activity.notes || '';
        return parseWorkout(title, desc);
    }, [universalActivity, activity]);

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
    const existingLaps = perf?.laps || (currentActivity as any)._mergeData?.universalActivity?.performance?.laps || (currentActivity as any).laps;

    // Analysis visibility criteria
    const hasHeartRate = (perf?.avgHeartRate && perf.avgHeartRate > 0) || (currentActivity.heartRateAvg && currentActivity.heartRateAvg > 0);
    const hasWorkoutStructure = parsedWorkout.segments.length > 0;

    const existingSplits = splits;
    const isWorthyOfAnalysis = hasSplits || (hasHeartRate && currentActivity.type !== 'strength') || hasWorkoutStructure;

    const segmentedSplits = React.useMemo(() => {
        if (!existingSplits || existingSplits.length < 3) return null;
        return segmentSplits(existingSplits, parsedWorkout, currentActivity.title || currentActivity.type);
    }, [existingSplits, parsedWorkout, currentActivity]);

    const areLapsAndSplitsIdentical = React.useMemo(() => {
        if (!splits || !existingLaps || splits.length !== existingLaps.length) return false;
        return splits.every((s: any, i: number) => {
            const lap = existingLaps[i];
            return Math.abs(s.distance - lap.distance) < 2 && Math.abs(s.movingTime - lap.movingTime) < 2;
        });
    }, [splits, existingLaps]);


    // Detect if child of another activity
    const parentActivity = React.useMemo(() => {
        if (!currentActivity.extractedFromId) return null;
        return exerciseEntries.find(e => e.id === currentActivity.extractedFromId);
    }, [currentActivity.extractedFromId, exerciseEntries]);

    // Sub-performances (Internal measurements like 5k tests extracted from this session)
    const subPerformances = React.useMemo(() => {
        return exerciseEntries.filter(e => e.extractedFromId === currentActivity.id);
    }, [exerciseEntries, currentActivity.id]);

    // Smart Extraction Detection (Performance Markers)
    const smartExtractInfo = React.useMemo(() => {
        if (activity.extractedFromId) return null; // Don't suggest extracts from extracts
        const text = ((activity.title || '') + ' ' + (activity.notes || '')).toLowerCase();

        // 5k patterns
        if (text.includes('5k max') || text.includes('5km max') || text.includes('5 k max') || text.includes('snabb 5k')) {
            return { distance: 5.0, title: '5k Max', label: '⚡ Spara 5k-tid' };
        }
        // 10k patterns
        if (text.includes('10k max') || text.includes('10km max') || text.includes('10 k max') || text.includes('snabb 10k')) {
            return { distance: 10.0, title: '10k Max', label: '⚡ Spara 10k-tid' };
        }
        // General patterns
        if (text.includes('max') || text.includes('test') || text.includes('pb') || text.includes('pers')) {
            const distMatch = text.match(/(\d+(?:[.,]\d+)?)\s*km/);
            if (distMatch) {
                const d = parseFloat(distMatch[1].replace(',', '.'));
                return { distance: d, title: `${d}km Max`, label: `⚡ Spara ${d}km-tid` };
            }
        }
        return null;
    }, [activity.id, activity.title, activity.notes]);

    const handleApplySmartExtract = () => {
        if (!smartExtractInfo) return;
        setExtractForm({
            ...extractForm,
            distance: smartExtractInfo.distance.toString(),
            title: smartExtractInfo.title,
            duration: '', // User still needs to input duration for accurate PR tracking
            isHiddenInCalendar: true
        });
        setShowExtractForm(true);
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
    useEffect(() => {
        if (isEditing && editForm.subType === 'default' && parsedWorkout?.suggestedSubType &&
            parsedWorkout.suggestedSubType !== 'default' && parsedWorkout.suggestedSubType !== 'tempo') {
            setEditForm(prev => ({ ...prev, subType: parsedWorkout.suggestedSubType as any }));
        }
    }, [isEditing, parsedWorkout]);

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


    const [isFetchingSplits, setIsFetchingSplits] = useState(false);
    const [fetchSplitsResult, setFetchSplitsResult] = useState<'idle' | 'success' | 'error'>('idle');

    // Auto-fetch splits if Strava activity is missing them
    useEffect(() => {
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
            (typeof externalId === 'string' && (externalId.startsWith('strava_') || /^\d+$/.test(externalId))) ||
            (typeof externalId === 'number');

        // Check for existing data
        const existingSplits = perf?.splits || (activity as any).performance?.splits || activity._mergeData?.universalActivity?.performance?.splits || (activity as any).splits;
        const existingLaps = perf?.laps || (activity as any).performance?.laps || activity._mergeData?.universalActivity?.performance?.laps || (activity as any).laps;

        // We trigger fetch if EITHER splits or laps are missing
        const needsFetch = (!existingSplits || existingSplits.length === 0) || (!existingLaps || existingLaps.length === 0);

        // Relaxed condition: we don't strictly REQUIRE token in state if we have cookies, 
        // but it's good practice to log if it's there. The backend handles the cookie.
        if (effectivelyStrava && externalId && needsFetch && fetchSplitsResult === 'idle' && !isFetchingSplits) {
            console.log("🚀 ActivityDetailModal: Triggering Strava split fetch for", { externalId, source, id: activity.id });
            const fetchSplits = async () => {
                setIsFetchingSplits(true);
                try {
                    // Sanitize externalId: strip 'strava_' prefix if present
                    const sanitizedId = typeof externalId === 'string' ? externalId.replace('strava_', '') : externalId.toString();

                    console.log("Fetching splits/laps from Strava API for external ID:", sanitizedId);
                    const res = await fetch(`/api/strava/activities/${sanitizedId}/splits`, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });

                    if (res.ok) {
                        const data = await res.json();
                        console.log("Strava response data:", data);
                        if ((data.splits && data.splits.length > 0) || (data.laps && data.laps.length > 0)) {

                            // Transform strava splits to our format
                            const mappedSplits = data.splits.map((s: any) => ({
                                split: s.split,
                                distance: s.distance,
                                elapsedTime: s.elapsed_time,
                                movingTime: s.moving_time,
                                elevationDiff: s.elevation_difference,
                                averageSpeed: s.average_speed,
                                averageHeartrate: s.average_heartrate,
                                paceZone: s.pace_zone
                            }));

                            console.log("Fetched strava splits, saving to activity:", mappedSplits);

                            // Update local UI immediately via updateExercise
                            // Map laps
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

                            updateExercise(activity.id, { splits: mappedSplits, laps: mappedLaps } as any);
                            setFetchSplitsResult('success');

                            // Then persist to backend in the background
                            const dateParam = activity.date.split('T')[0];
                            await fetch(`/api/activities/${activity.id}?date=${dateParam}`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    performance: {
                                        ...(perf || {}),
                                        splits: mappedSplits,
                                        laps: mappedLaps
                                    }
                                })
                            });
                        } else {
                            console.log("No splits found in Strava API response");
                            setFetchSplitsResult('error');
                        }
                    } else if (res.status === 404) {
                        console.warn("Strava splits not found (404)");
                        setFetchSplitsResult('error');
                    } else {
                        console.error("❌ ActivityDetailModal: Split fetch failed with status:", res.status);
                        setFetchSplitsResult('error');
                    }
                } catch (err) {
                    console.error("❌ ActivityDetailModal: Split fetch error:", err);
                    setFetchSplitsResult('error');
                } finally {
                    setIsFetchingSplits(false);
                }
            };

            fetchSplits();
        }
    }, [activity.id, activity.source, activity.externalId, (activity as any).platform, universalActivity, token, existingSplits, fetchSplitsResult, updateExercise, isFetchingSplits]);

    // Apply Category Helper - Updates the EXISTING activity's subType
    const handleApplyCategory = (category: ExerciseSubType) => {
        // Always update the existing activity - never create a duplicate
        updateExercise(activity.id, { subType: category });
        // No alert, rely on UI update
    };

    // Auto-apply category if confidence is high
    useEffect(() => {
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
        e.preventDefault();

        const duration = parseInt(editForm.duration) || 0;
        const calories = calculateExerciseCalories(editForm.type, duration, editForm.intensity);

        const commonData = {
            title: editForm.title,
            type: editForm.type,
            durationMinutes: duration,
            intensity: editForm.intensity,
            notes: editForm.notes,
            subType: editForm.subType as any,
            tonnage: editForm.tonnage ? parseFloat(editForm.tonnage) : undefined,
            distance: editForm.distance ? parseFloat(editForm.distance) : undefined,
            caloriesBurned: calories,
            location: editForm.location,
            excludeFromStats: editForm.excludeFromStats,
            isHiddenInCalendar: editForm.isHiddenInCalendar,
            hyroxStats: editForm.type === 'hyrox' ? editForm.hyroxStats : undefined
        };

        // Local update (works for 'manual', 'strava', and 'merged')
        updateExercise(activity.id, commonData);
        setIsEditing(false);
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
                                distanceKm: universalActivity.plan?.distanceKm || universalActivity.performance?.distanceKm || 0
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

    useEffect(() => {
        // Reset check if activity changes (though modal usually remounts, this handles prop changes)
        if (titleCheckedRef.current !== activity.id) {
            titleCheckedRef.current = null;
        }

        if (titleCheckedRef.current === activity.id) return;

        if (isTrulyMerged && originalActivities.length > 0) {
            const stravaSource = originalActivities.find(a => a.performance?.source?.source === 'strava');
            const currentTitle = universalActivity?.plan?.title || activity.title;
            const stravaTitle = stravaSource?.plan?.title || stravaSource?.performance?.notes;

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
                                        distanceKm: universalActivity.plan?.distanceKm || universalActivity.performance?.distanceKm || 0
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

    // ESC to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div id="activity-detail-modal" className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200"
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

                        {/* Type Selection */}
                        <div className="grid grid-cols-4 gap-2">
                            {EXERCISE_TYPES.map(t => (
                                <button
                                    key={t.type}
                                    type="button"
                                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${editForm.type === t.type ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-white/5 text-slate-400 opacity-60 hover:opacity-100'}`}
                                    onClick={() => setEditForm({ ...editForm, type: t.type })}
                                >
                                    <span className="text-xl">{t.icon}</span>
                                    <span className="text-[10px] font-bold">{t.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Längd (min)</label>
                                <input
                                    type="number"
                                    value={editForm.duration}
                                    onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                    className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500/50"
                                />
                                {perf?.elapsedTimeSeconds && Math.abs((perf.elapsedTimeSeconds / 60) - parseInt(editForm.duration || '0')) > 1 && (
                                    <div className="flex gap-2 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditForm({ ...editForm, duration: Math.round(perf.elapsedTimeSeconds! / 60).toString() })}
                                            className="text-[10px] bg-slate-800 border border-white/10 px-2 py-1 rounded text-slate-400 hover:text-white"
                                        >
                                            Använd totaltid ({Math.round(perf.elapsedTimeSeconds / 60)} min)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditForm({ ...editForm, duration: Math.round((perf.durationMinutes || 0)).toString() })}
                                            className="text-[10px] bg-slate-800 border border-white/10 px-2 py-1 rounded text-slate-400 hover:text-white"
                                        >
                                            Använd rörelsetid ({Math.round(perf.durationMinutes || 0)} min)
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Intensitet</label>
                                <select
                                    value={editForm.intensity}
                                    onChange={e => setEditForm({ ...editForm, intensity: e.target.value as ExerciseIntensity })}
                                    className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none focus:outline-none focus:border-emerald-500/50"
                                >
                                    {INTENSITIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Variable Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Kategori</label>
                                <select
                                    value={editForm.subType || 'default'}
                                    onChange={e => setEditForm({ ...editForm, subType: e.target.value as ExerciseSubType })}
                                    className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none text-xs focus:outline-none focus:border-emerald-500/50"
                                >
                                    <option value="default">Standard</option>
                                    <option value="interval">Intervaller</option>
                                    <option value="long-run">Långpass</option>
                                    <option value="race">Tävling</option>
                                    <option value="tonnage">Styrka (Tonnage)</option>
                                    <option value="competition">Tävlingsmoment</option>
                                    <option value="default">Standard</option>
                                </select>
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

                            {(editForm.type === 'running' || editForm.type === 'cycling' || editForm.type === 'walking' || editForm.type === 'swimming' || editForm.type === 'hyrox') && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Distans (km)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="-"
                                        value={editForm.distance}
                                        onChange={e => setEditForm({ ...editForm, distance: e.target.value })}
                                        className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500/50"
                                    />
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
                            <div className="space-y-1 col-span-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Plats / Ort</label>
                                <input
                                    type="text"
                                    placeholder="T.ex. Stockholm, Båstad..."
                                    value={editForm.location}
                                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                                    className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500/50"
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

                        {/* HYROX EDITOR - Only show if type is hyrox */}
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
                                    <p className={`text-xs font-bold ${editForm.excludeFromStats ? 'text-rose-400' : 'text-white'}`}>Exkludera från Statistik & Rekord</p>
                                    <p className="text-[10px] text-slate-500">Aktiviteten räknas inte med i statistik och poäng</p>
                                </div>
                            </div>
                            <div className={`w-10 h-6 rounded-full relative transition-all ${editForm.excludeFromStats ? 'bg-rose-500' : 'bg-slate-700'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.excludeFromStats ? 'left-5' : 'left-1'}`} />
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
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    {(() => {
                                        const typeInfo = EXERCISE_TYPES.find(t => t.type === activity.type) || EXERCISE_TYPES.find(t => t.type === 'other');
                                        return (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 text-slate-300 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                                <span>{typeInfo?.icon === 'Activity' ? <Activity size={12} className="text-emerald-400" /> : typeInfo?.icon}</span>
                                                {typeInfo?.label}
                                            </div>
                                        );
                                    })()}

                                    {/* Subtype Label for Intervals */}
                                    {activity.subType === 'interval' && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                            <span>📈</span> Intervaller
                                            {(parsedWorkout as any).summary && <span className="opacity-70 ml-1">({(parsedWorkout as any).summary})</span>}
                                        </div>
                                    )}

                                    {/* Parent Activity Link */}
                                    {parentActivity && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/50 rounded-full border border-white/5 text-[10px]">
                                            <span className="text-slate-500 font-bold uppercase tracking-wider">Utdrag från:</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedActivityId?.(parentActivity.id);
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
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm text-[10px] font-black uppercase tracking-wider">
                                            <span>✂️</span> Utdrag
                                        </div>
                                    )}
                                    {isTrulyMerged && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm text-[10px] font-black uppercase tracking-wider">
                                            <Zap size={10} className="fill-amber-500" />
                                            Sammanslagen
                                        </div>
                                    )}
                                </div>

                                {/* Title Row */}
                                <div className="flex items-center gap-3">
                                    <h2 className="text-3xl sm:text-4xl font-black text-white italic tracking-tight capitalize truncate" title={displayTitle}>
                                        {displayTitle}
                                    </h2>
                                    {!isMerged && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setViewMode(viewMode === 'raw' ? 'combined' : 'raw')}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm shrink-0 ${viewMode === 'raw' ? 'bg-slate-600 text-white' : 'bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
                                                title="Visa rådata"
                                            >
                                                📄
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors shadow-sm shrink-0"
                                                title="Redigera aktivitet"
                                            >
                                                ✎
                                            </button>
                                        </div>
                                    )}
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
                            <div className="bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/20 rounded-2xl p-4 animate-in slide-in-from-top-2 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-amber-500/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-lg shadow-inner">💡</div>
                                    <div>
                                        <h4 className="text-sm font-black text-white italic">Rekord-potential identifierad! 🚀</h4>
                                        <p className="text-[10px] text-slate-400">Det verkar som att detta pass innehåller en <strong>{smartExtractInfo.title}</strong> som du kan spara som eget rekord.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleApplySmartExtract}
                                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-[10px] uppercase rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                                >
                                    {smartExtractInfo.label}
                                </button>
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
                        {fetchSplitsResult === 'success' && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 animate-in slide-in-from-top-2 mb-4 transition-all duration-1000 delay-3000 opacity-100" style={{ animation: 'fadeOut 1s forwards 3s' }}>
                                <span>✅</span>
                                <p className="text-xs font-bold text-emerald-400">Kilometertider & laps hämtades från Strava!</p>
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
                            <div className="bg-slate-800/20 rounded-2xl p-4 border border-white/5 space-y-3 mt-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Kategorisera om</p>
                                    <span className="text-[10px] text-slate-600 italic">Ändra vid felaktig import</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {EXERCISE_TYPES.map(t => (
                                        <button
                                            key={t.type}
                                            type="button"
                                            onClick={() => handleRecategorize(t.type)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${activity.type === t.type
                                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                                : 'bg-slate-800/40 text-slate-400 border-white/5 hover:bg-slate-700/50 hover:text-slate-300'
                                                }`}
                                        >
                                            <span>{t.icon}</span> {t.label}
                                            {activity.type === t.type && <span className="ml-1 opacity-50">✓</span>}
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
                                                        {activity.distance ? `${activity.distance.toFixed(2)} km` : '-'}
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
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* COMBINED VIEW - Now also for Hyrox */}
                        {(viewMode === 'combined' || !isMerged) && activeTab === 'stats' && (
                            <>
                                {/* Main Stats Display - Swaps between Strava Card and Generic Grid */}
                                {showStravaCard ? (
                                    <div className="space-y-4">
                                        <div className="bg-[#FC4C02]/5 border border-[#FC4C02]/20 rounded-2xl p-5 space-y-4 shadow-xl shadow-[#FC4C02]/5 mb-2">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-black text-[#FC4C02] uppercase text-xs tracking-widest flex items-center gap-2">
                                                    <span>🔥</span> Strava-data
                                                </h4>
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
                                                            className="text-[10px] font-bold text-white bg-[#FC4C02] px-3 py-1.5 rounded-lg hover:shadow-lg hover:shadow-[#FC4C02]/20 transition-all flex items-center gap-1.5 uppercase tracking-tighter"
                                                        >
                                                            Öppna i Strava ↗
                                                        </a>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Hero Stats */}
                                            <div className="grid grid-cols-3 gap-4 border-b border-[#FC4C02]/10 pb-5">
                                                {(activity.distance || 0) > 0 && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-[#FC4C02]/60 uppercase font-black tracking-widest mb-1">Distans</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-3xl font-black text-white">{(activity.distance || 0).toFixed(1)}</span>
                                                            <span className="text-xs uppercase text-slate-500 font-bold">km</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-[#FC4C02]/60 uppercase font-black tracking-widest mb-1">Tid</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-3xl font-black text-white">{activity.durationMinutes > 0 ? formatDuration(activity.durationMinutes * 60) : '-'}</span>
                                                    </div>
                                                </div>

                                                {(activity.distance || 0) > 0 && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-[#FC4C02]/60 uppercase font-black tracking-widest mb-1">{activity.type === 'cycling' ? 'Snittfart' : 'Snittempo'}</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-3xl font-black text-white">
                                                                {activity.type === 'cycling'
                                                                    ? formatSpeed((activity.durationMinutes * 60) / (activity.distance || 1))
                                                                    : formatPace((activity.durationMinutes * 60) / (activity.distance || 1)).replace('/km', '')
                                                                }
                                                            </span>
                                                            <span className="text-xs uppercase text-slate-500 font-bold">{activity.type === 'cycling' ? 'km/h' : '/km'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Minigraph */}
                                            {existingSplits && existingSplits.length > 2 && (
                                                <SplitsSparkline splits={existingSplits} />
                                            )}

                                            {/* Secondary Stats Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 pt-2">
                                                {/* Heart Rate */}
                                                {(!!perf?.avgHeartRate || !!activity.heartRateAvg) && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Medelpuls</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-white">{Math.round(perf?.avgHeartRate || activity.heartRateAvg || 0)}</span>
                                                            <span className="text-[10px] uppercase text-slate-500">bpm</span>
                                                            {perf?.maxHeartRate && <span className="text-[9px] text-rose-500 font-black ml-1">MAX {Math.round(perf.maxHeartRate)}</span>}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Elevation Gain */}
                                                {!!perf?.elevationGain && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Höjdmeter</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-white">{Math.round(perf.elevationGain)}</span>
                                                            <span className="text-[10px] uppercase text-slate-500">m</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* GAP */}
                                                {((activity.distance || 0) > 0 && (perf?.elevationGain || 0) > 0) && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Effektivt Tempo (GAP)</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-white">
                                                                {formatPace(calculateGAP((activity.durationMinutes * 60) / (activity.distance || 1), perf.elevationGain!, activity.distance || 0)).replace('/km', '')}
                                                            </span>
                                                            <span className="text-[10px] uppercase text-slate-500">/km</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Energy */}
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Energi</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span
                                                            className={`text-xl font-black text-white ${activity.calorieBreakdown ? 'cursor-help border-b border-white/20' : ''}`}
                                                            title={activity.calorieBreakdown}
                                                        >
                                                            {activity.caloriesBurned || perf?.calories || '-'}
                                                        </span>
                                                        <span className="text-[10px] uppercase text-slate-500">kcal</span>
                                                    </div>
                                                </div>

                                                {/* Watts */}
                                                {!!perf?.averageWatts && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Effekt</span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-white">{Math.round(perf.averageWatts)}</span>
                                                            <span className="text-[10px] uppercase text-slate-500">w</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Achievements */}
                                                {(perf?.achievementCount || perf?.prCount || perf?.kudosCount) ? (
                                                    <div className="flex flex-col col-span-2">
                                                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Prestationer</span>
                                                        <div className="flex items-center gap-4">
                                                            {(perf?.prCount || 0) > 0 && (
                                                                <div className="flex items-center gap-1.5 sh-tooltip" title={`${perf.prCount} Personbästa`}>
                                                                    <span className="text-orange-400">⚡</span>
                                                                    <span className="text-lg font-black text-white">{perf.prCount}</span>
                                                                    <span className="text-[9px] text-slate-500 uppercase font-bold">PB</span>
                                                                </div>
                                                            )}
                                                            {(perf?.achievementCount || 0) > 0 && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-yellow-400">🏆</span>
                                                                    <span className="text-lg font-black text-white">{perf.achievementCount}</span>
                                                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Awards</span>
                                                                </div>
                                                            )}
                                                            {(perf?.kudosCount || 0) > 0 && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-pink-400">❤️</span>
                                                                    <span className="text-lg font-black text-white">{perf.kudosCount}</span>
                                                                    <span className="text-[9px] text-slate-500 uppercase font-bold">Kudos</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        {/* Interval Summary Block (Strava) */}
                                        {activity.subType === 'interval' && segmentedSplits && (
                                            <IntervalMiniSummary segmentedSplits={segmentedSplits} />
                                        )}
                                    </div>
                                ) : (
                                    /* Generic Stats Grid (Non-Strava) */
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-slate-800/50 rounded-xl p-4 text-center flex flex-col justify-center items-center">
                                                <p className="text-2xl font-black text-white">{activity.durationMinutes > 0 ? formatDuration(activity.durationMinutes * 60) : '-'}</p>
                                                <p className="text-xs text-slate-500 uppercase">
                                                    Tid {perf?.elapsedTimeSeconds && Math.abs(perf.elapsedTimeSeconds - (activity.durationMinutes * 60)) > 60 ? '(Rörelse)' : ''}
                                                </p>
                                                {perf?.elapsedTimeSeconds && Math.abs(perf.elapsedTimeSeconds - (activity.durationMinutes * 60)) > 60 && (
                                                    <p className="text-[10px] text-rose-400 font-bold mt-1 bg-rose-500/10 px-2 py-0.5 rounded">
                                                        Totaltid: {formatDuration(perf.elapsedTimeSeconds)}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Distance (Only if running/has value) */}
                                            {(activity.distance || 0) > 0 ? (
                                                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-black text-emerald-400">{(activity.distance || 0).toFixed(1)}</p>
                                                    <p className="text-xs text-slate-500 uppercase">Km</p>
                                                </div>
                                            ) : null}

                                            {/* Tonnage (Only if strength/has value) */}
                                            {(activity.tonnage && activity.tonnage > 0) ? (
                                                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-black text-purple-400">{(activity.tonnage / 1000).toFixed(1)}</p>
                                                    <p className="text-xs text-slate-500 uppercase">Ton</p>
                                                </div>
                                            ) : null}

                                            {/* Pace Card (Only if distance exists) */}
                                            {(activity.distance || 0) > 0 ? (
                                                <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                                    <p className="text-2xl font-black text-emerald-400">
                                                        {activity.type === 'cycling'
                                                            ? formatSpeed((activity.durationMinutes * 60) / (activity.distance || 1))
                                                            : formatPace((activity.durationMinutes * 60) / (activity.distance || 1)).replace('/km', '')
                                                        }
                                                    </p>
                                                    <p className="text-xs text-slate-500 uppercase">{activity.type === 'cycling' ? 'Fart' : 'Tempo'}</p>
                                                </div>
                                            ) : null}
                                        </div>

                                        {/* Interval Summary (Generic) */}
                                        {activity.subType === 'interval' && segmentedSplits && (
                                            <IntervalMiniSummary segmentedSplits={segmentedSplits} />
                                        )}
                                    </div>
                                )}

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
                                                    onClick={() => setSelectedActivityId?.(sub.id)}
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

                                {/* Heart Rate Zone Visualization (for cardio with HR data) */}
                                {(perf?.avgHeartRate || activity.heartRateAvg) && activity.type?.toLowerCase() !== 'strength' && (
                                    <HeartRateZones
                                        avgHeartRate={Math.round(perf?.avgHeartRate || activity.heartRateAvg || 0)}
                                        maxHeartRate={(perf?.maxHeartRate || activity.heartRateMax) ? Math.round(perf?.maxHeartRate || activity.heartRateMax || 0) : undefined}
                                        duration={activity.durationMinutes ? activity.durationMinutes * 60 : undefined}
                                    />
                                )}

                                {/* Simple HR display fallback (for strength or merged) - Only show if Strava Card is NOT shown */}
                                {(perf?.avgHeartRate || perf?.maxHeartRate) && activity.type?.toLowerCase() === 'strength' && !showStravaCard && (
                                    <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 w-fit">
                                        <h3 className="text-xs font-bold text-red-400 uppercase mb-2">❤️ Puls</h3>
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

                                {/* Exercises from StrengthLog (if merged/strength) */}
                                {strengthWorkout?.exercises && strengthWorkout.exercises.length > 0 && (
                                    <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4">
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


                                {segmentedSplits && (
                                    <IntervalSplitsCard segmented={segmentedSplits} />
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

                                                        return (
                                                            <tr key={split.split} className="hover:bg-indigo-500/10 transition-colors group">

                                                                <td className="px-4 py-3 font-mono font-bold text-slate-400 text-center">
                                                                    {split.split}
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
                                                                            ❤️ {Math.round(split.averageHeartrate)}
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
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">⚖️ Jämför med liknande pass</h3>
                                    <span className="text-[10px] text-slate-500 uppercase font-mono">Baserat på distans (+/- 25%)</span>
                                </div>

                                {similarActivities.length > 0 ? (
                                    <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-white/5">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-950/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-slate-500 font-bold uppercase text-[10px]">Datum</th>
                                                    <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">{activity.type === 'cycling' ? 'Fart' : 'Tempo'}</th>
                                                    {activity.elevationGain !== undefined && <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">Höjd</th>}
                                                    <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">Puls</th>
                                                    <th className="px-4 py-3 text-right text-slate-500 font-bold uppercase text-[10px]">Greens</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-mono">
                                                <tr className="bg-indigo-500/15 group relative">
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-white font-bold">{formatSwedishDate(activity.date)}</span>
                                                            <span className="text-[10px] text-indigo-400 font-bold uppercase">Detta pass</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-white font-bold">{
                                                                activity.distance
                                                                    ? (activity.type === 'cycling'
                                                                        ? formatSpeed((activity.durationMinutes * 60) / activity.distance)
                                                                        : formatPace((activity.durationMinutes * 60) / activity.distance)
                                                                    )
                                                                    : '-'
                                                            }</span>
                                                            <span className="text-[9px] text-slate-500 uppercase">{activity.distance} km</span>
                                                        </div>
                                                    </td>
                                                    {activity.elevationGain !== undefined && (
                                                        <td className="px-4 py-4 text-right text-emerald-400 font-bold">{Math.round(activity.elevationGain)}m</td>
                                                    )}
                                                    <td className="px-4 py-4 text-right text-rose-400 font-bold">{perf?.avgHeartRate ? Math.round(perf.avgHeartRate) : '-'}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className="bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded">
                                                            {calculatePerformanceScore(activity) || '-'}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {similarActivities.map(a => {
                                                    const aPaceSec = a.distance ? (a.durationMinutes * 60 / a.distance) : 0;
                                                    const aScore = calculatePerformanceScore(a);
                                                    return (
                                                        <tr key={a.id} className="hover:bg-white/5 transition-colors">
                                                            <td className="px-4 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-slate-300">{formatSwedishDate(a.date)}</span>
                                                                    <span className="text-[10px] text-slate-500 uppercase">{getRelativeTime(a.date)}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-slate-300">{aPaceSec ? (activity.type === 'cycling' ? formatSpeed(aPaceSec) : formatPace(aPaceSec)) : '-'}</span>
                                                                    <span className="text-[9px] text-slate-500 uppercase">{a.distance} km</span>
                                                                </div>
                                                            </td>
                                                            {activity.elevationGain !== undefined && (
                                                                <td className="px-4 py-4 text-right text-slate-400">{Math.round(a.elevationGain || 0)}m</td>
                                                            )}
                                                            <td className="px-4 py-4 text-right text-slate-400">{a.heartRateAvg ? Math.round(a.heartRateAvg) : '-'}</td>
                                                            <td className="px-4 py-4 text-right">
                                                                <span className={`text-[10px] font-black px-2 py-1 rounded ${aScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    aScore >= 60 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-500/20 text-slate-400'
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
                                    <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-dashed border-white/5">
                                        <span className="text-3xl block mb-2 opacity-50">🔍</span>
                                        <div className="text-slate-500 italic text-sm">Inga liknande pass inom +/- 25% distans hittades.</div>
                                    </div>
                                )}
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
                                {splits.some((s: any) => s.averageHeartrate) && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-bold text-rose-400 uppercase">❤️ Pulsutveckling</h3>
                                        <div className="h-48 bg-slate-800/30 rounded-xl p-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={splits.map((s: any, i: number) => ({
                                                    km: `Km ${i + 1}`,
                                                    hr: s.averageHeartrate
                                                }))}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                    <XAxis dataKey="km" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
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
                                                            <td className="px-4 py-3 text-white font-bold">{l.name || `Varv ${i+1}`}</td>
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
                                                return (
                                                    <tr key={i} className="hover:bg-indigo-500/10 transition-colors group">
                                                        <td className="px-4 py-3 text-white font-bold">{i + 1} km</td>
                                                        <td className="px-4 py-3 text-right text-slate-300">
                                                            {Math.floor(s.movingTime / 60)}:{(s.movingTime % 60).toString().padStart(2, '0')}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-indigo-400">
                                                            {Math.floor(splitPace / 60)}:{(Math.round(splitPace % 60)).toString().padStart(2, '0')} /km
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

                        {/* SMART EXTRACTION HINT (PERFORMANCE MARKERS) */}
                        {smartExtractInfo && !showExtractForm && !activity.extractedFromId && subPerformances.length === 0 && (
                            <div className="bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/20 rounded-2xl p-4 animate-in slide-in-from-top-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-lg">⚡</div>
                                    <div>
                                        <h4 className="text-sm font-black text-white italic">Nyckelinsats identifierad! ⚡</h4>
                                        <p className="text-[10px] text-slate-400">Det verkar som att detta pass innehåller en <strong>{smartExtractInfo.title}</strong> som du kan spara som en separat prestationsmätning.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleApplySmartExtract}
                                    className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-[10px] uppercase rounded-xl transition-all shadow-lg shadow-amber-500/20"
                                >
                                    {smartExtractInfo.label}
                                </button>
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
                                                                        <p className="text-rose-400 font-mono text-xs">❤️ {avgHr}</p>
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
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-4 animate-in slide-in-from-bottom-2">
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
