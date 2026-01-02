import React, { useState, useEffect } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { StrengthWorkout } from '../../models/strengthTypes.ts';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { formatDuration, formatPace, getRelativeTime, formatSwedishDate, formatSpeed } from '../../utils/dateUtils.ts';
import { calculatePerformanceScore, calculateGAP, getPerformanceBreakdown } from '../../utils/performanceEngine.ts';
import { HeartRateZones } from '../training/HeartRateZones.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

import { EXERCISE_TYPES, INTENSITIES } from '../training/ExerciseModal.tsx';
import { ExerciseType, ExerciseIntensity, ExerciseSubType } from '../../models/types.ts';

// Expandable Exercise Component - click to show sets
function ExpandableExercise({ exercise }: { exercise: any }) {
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
}

export interface ActivityDetailModalProps {
    activity: ExerciseEntry & { source: string; _mergeData?: any };
    universalActivity?: UniversalActivity;
    onClose: () => void;
    onSeparate?: () => void;
    initiallyEditing?: boolean;
}

// Activity Detail Modal Component
export function ActivityDetailModal({
    activity,
    universalActivity,
    onClose,
    onSeparate,
    initiallyEditing = false
}: ActivityDetailModalProps) {
    const [isEditing, setIsEditing] = useState(initiallyEditing);
    const [viewMode, setViewMode] = useState<'combined' | 'diff' | 'raw'>('combined');
    const [activeTab, setActiveTab] = useState<'stats' | 'compare' | 'splits' | 'merge'>('stats');
    const [showScoreInfo, setShowScoreInfo] = useState(false);
    const [isUnmerging, setIsUnmerging] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState({
        type: activity.type,
        duration: activity.durationMinutes.toString(),
        intensity: activity.intensity || 'moderate',
        notes: activity.notes || '',
        subType: activity.subType || 'default',
        tonnage: activity.tonnage ? activity.tonnage.toString() : '',
        distance: activity.distance ? activity.distance.toString() : ''
    });

    const { exerciseEntries, universalActivities, updateExercise, deleteExercise, addExercise, calculateExerciseCalories } = useData();
    const { token } = useAuth();

    // Check if this is a manually merged activity (using our new merge system)
    const isMergedActivity = universalActivity?.mergeInfo?.isMerged === true;
    const mergeInfo = universalActivity?.mergeInfo;

    // Check if THIS activity has been merged INTO another activity (i.e., it's a component)
    const isMergedInto = universalActivity?.mergedIntoId != null;
    const parentMergedActivity = isMergedInto
        ? universalActivities.find(u => u.id === universalActivity?.mergedIntoId)
        : null;

    // Get original activities for merged view
    const originalActivities = React.useMemo(() => {
        if (!isMergedActivity || !mergeInfo?.originalActivityIds) return [];
        return universalActivities.filter(u => mergeInfo.originalActivityIds.includes(u.id));
    }, [isMergedActivity, mergeInfo, universalActivities]);

    // Combine manual entries with mapped universal activities
    const allActivities = React.useMemo(() => {
        const stravaEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);
        return [...exerciseEntries, ...stravaEntries];
    }, [exerciseEntries, universalActivities]);

    const perfBreakdown = getPerformanceBreakdown(activity, allActivities);
    const perf = universalActivity?.performance || activity._mergeData?.universalActivity?.performance;
    const mergeData = activity._mergeData;
    const isMerged = activity.source === 'merged' && mergeData;
    const strengthWorkout = mergeData?.strengthWorkout;

    // Derived splits helper
    const splits = perf?.splits || [];
    const hasSplits = splits.length > 0;

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

    // Handle Save
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const duration = parseInt(editForm.duration) || 0;
        const calories = calculateExerciseCalories(editForm.type, duration, editForm.intensity);

        const commonData = {
            type: editForm.type,
            durationMinutes: duration,
            intensity: editForm.intensity,
            notes: editForm.notes,
            subType: editForm.subType as any,
            tonnage: editForm.tonnage ? parseFloat(editForm.tonnage) : undefined,
            distance: editForm.distance ? parseFloat(editForm.distance) : undefined,
            caloriesBurned: calories
        };

        if (activity.source === 'strava' || activity.source === 'merged') {
            // Create manual override for foreign activity
            addExercise({
                ...commonData,
                date: activity.date,
                source: 'manual'
                // We don't link via externalId yet, just creating a new entry
            });
            // Close modal as the specific instance we were viewing (strava) is technically unchanged/hidden
            onClose();
        } else {
            // Local update
            updateExercise(activity.id, commonData);
            setIsEditing(false);
        }
    };

    // Handle Delete
    const handleDelete = () => {
        if (confirm('Är du säker på att du vill ta bort denna aktivitet?')) {
            deleteExercise(activity.id);
            onClose();
        }
    };

    // ESC to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" onClick={onClose}>
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
                                </select>
                            </div>

                            {(editForm.type === 'running' || editForm.type === 'cycling' || editForm.type === 'walking' || editForm.type === 'swimming') && (
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

                        <div className="flex gap-3 pt-4 border-t border-white/5">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="px-6 py-3 rounded-xl bg-rose-500/10 text-rose-400 font-bold hover:bg-rose-500 hover:text-white transition-colors"
                            >
                                Radera
                            </button>
                            <div className="flex-1 flex gap-3">
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
                        </div>
                    </form>
                ) : (
                    <>
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-white capitalize flex items-center gap-3">
                                    {activity.type}
                                    {/* Edit Button */}
                                    {!isMerged && activity.source !== 'strava' && (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                            title="Redigera aktivitet"
                                        >
                                            ✎
                                        </button>
                                    )}
                                </h2>
                                <p className="text-slate-400 font-mono">{activity.date}</p>
                            </div>
                            <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl">×</button>
                        </div>

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
                                        setSelectedActivity && setSelectedActivity(null);
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
                            {activity.distance && (
                                <button
                                    onClick={() => setActiveTab('compare')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'compare' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    Jämför
                                </button>
                            )}
                            {hasSplits && (
                                <button
                                    onClick={() => setActiveTab('splits')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'splits' ? 'text-indigo-400 border-indigo-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    Splits
                                </button>
                            )}
                            {isMergedActivity && (
                                <button
                                    onClick={() => setActiveTab('merge')}
                                    className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'merge' ? 'text-amber-400 border-amber-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                >
                                    <span>⚡</span> Sammanslagen ({originalActivities.length})
                                </button>
                            )}
                        </div>

                        {/* Source Badge + View Toggle for Merged */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            {(() => {
                                // For merged activities, find the longest Strava component to link
                                let stravaLink: string | null = null;
                                let stravaTitle: string | null = null;

                                if (isMergedActivity && originalActivities.length > 0) {
                                    const stravaOriginals = originalActivities
                                        .filter(o => o.performance?.source?.source === 'strava' && o.performance?.source?.externalId)
                                        .sort((a, b) => (b.performance?.distanceKm || 0) - (a.performance?.distanceKm || 0));
                                    if (stravaOriginals.length > 0) {
                                        const longest = stravaOriginals[0];
                                        const extId = longest.performance?.source?.externalId?.replace('strava_', '');
                                        stravaLink = `https://www.strava.com/activities/${extId}`;
                                        stravaTitle = longest.plan?.title || longest.performance?.notes || 'Strava Activity';
                                    }
                                }

                                // Display Strava sync badge
                                if (activity.source === 'strava' && activity.externalId) {
                                    return (
                                        <a
                                            href={`https://www.strava.com/activities/${activity.externalId.replace('strava_', '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-[#FC4C02]/20 text-[#FC4C02] px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-[#FC4C02]/30 transition-colors"
                                            title="Öppna i Strava"
                                        >
                                            <span>🔥</span> Synkad från Strava ↗
                                        </a>
                                    );
                                } else if (isMergedActivity && stravaLink) {
                                    // Merged activity with Strava component - link to longest
                                    return (
                                        <a
                                            href={stravaLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase hover:bg-emerald-500/30 transition-colors"
                                            title={`Öppna i Strava: ${stravaTitle}`}
                                        >
                                            <span>⚡</span> Sammanslagen (Strava: {stravaTitle?.slice(0, 20)}{(stravaTitle?.length || 0) > 20 ? '...' : ''}) ↗
                                        </a>
                                    );
                                } else if (isMergedActivity || isMerged) {
                                    // Merged activity without Strava link
                                    return (
                                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                                            <span>⚡</span> Sammanslagen Aktivitet
                                        </div>
                                    );
                                } else if (activity.source === 'strava') {
                                    // Strava without externalId
                                    return (
                                        <div className="inline-flex items-center gap-2 bg-[#FC4C02]/20 text-[#FC4C02] px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                                            <span>🔥</span> Synkad från Strava
                                        </div>
                                    );
                                } else if (activity.source === 'strength') {
                                    return (
                                        <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                                            <span>💪</span> StrengthLog
                                        </div>
                                    );
                                } else {
                                    // Manual or other - do not show redundant badge if Strava source was already shown as "Synkad"
                                    return null;
                                }
                            })()}

                            {/* Ultra Label */}
                            {activity.type === 'running' && activity.distance && activity.distance >= 42.2 && (
                                <div className="inline-flex items-center gap-2 bg-pink-500/20 text-pink-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase animate-pulse">
                                    <span>🦅</span> Ultra
                                </div>
                            )}
                        </div>

                        {/* DIFF VIEW */}
                        {isMerged && viewMode === 'diff' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-amber-400 uppercase">⚖️ Jämförelse mellan källor</h3>
                                <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-950/50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-slate-500">Fält</th>
                                                <th className="px-4 py-2 text-center text-purple-400">💪 StrengthLog</th>
                                                <th className="px-4 py-2 text-center text-[#FC4C02]">🔥 Strava</th>
                                                <th className="px-4 py-2 text-right text-slate-500">Valt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            <tr>
                                                <td className="px-4 py-3 text-white">⏱️ Tid</td>
                                                <td className="px-4 py-3 text-center text-slate-300">{formatDuration((mergeData.strength?.durationMinutes || 60) * 60)}</td>
                                                <td className="px-4 py-3 text-center text-slate-300">{formatDuration((mergeData.strava?.durationMinutes || 0) * 60)}</td>
                                                <td className="px-4 py-3 text-right text-emerald-400 font-bold">{formatDuration(activity.durationMinutes * 60)} ✓</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-white">🔥 Kalorier</td>
                                                <td className="px-4 py-3 text-center text-slate-500">-</td>
                                                <td className="px-4 py-3 text-center text-slate-300">{mergeData.strava?.caloriesBurned || '-'} kcal</td>
                                                <td className="px-4 py-3 text-right text-emerald-400 font-bold">{activity.caloriesBurned || '-'} ✓</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-white">❤️ Snitt puls</td>
                                                <td className="px-4 py-3 text-center text-slate-500">-</td>
                                                <td className="px-4 py-3 text-center text-slate-300">{perf?.avgHeartRate ? Math.round(perf.avgHeartRate) : '-'} bpm</td>
                                                <td className="px-4 py-3 text-right text-emerald-400 font-bold">{perf?.avgHeartRate ? `${Math.round(perf.avgHeartRate)} bpm ✓` : '-'}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-white">💪 Övningar</td>
                                                <td className="px-4 py-3 text-center text-emerald-400 font-bold">{strengthWorkout?.uniqueExercises || 0} st ✓</td>
                                                <td className="px-4 py-3 text-center text-slate-500">-</td>
                                                <td className="px-4 py-3 text-right text-emerald-400">{strengthWorkout?.uniqueExercises || 0}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-white">🎯 Set</td>
                                                <td className="px-4 py-3 text-center text-emerald-400 font-bold">{strengthWorkout?.totalSets || 0} ✓</td>
                                                <td className="px-4 py-3 text-center text-slate-500">-</td>
                                                <td className="px-4 py-3 text-right text-emerald-400">{strengthWorkout?.totalSets || 0}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[10px] text-slate-500">
                                    ✓ = Vald källa för fältet. Strava används för puls/kalorier/tid, StrengthLog för övningar/set.
                                </p>
                            </div>
                        )}

                        {/* COMBINED VIEW */}
                        {(viewMode === 'combined' || !isMerged) && activeTab === 'stats' && (
                            <>
                                {/* Main Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                        <p className="text-2xl font-black text-white">{activity.durationMinutes > 0 ? formatDuration(activity.durationMinutes * 60) : '-'}</p>
                                        <p className="text-xs text-slate-500 uppercase">Tid</p>
                                    </div>

                                    {/* Distance (Only if running/has value) */}
                                    {(activity.distance && activity.distance > 0) ? (
                                        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-emerald-400">{activity.distance.toFixed(1)}</p>
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
                                    {(activity.distance && activity.distance > 0) ? (
                                        <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-emerald-400">
                                                {activity.type === 'cycling'
                                                    ? formatSpeed((activity.durationMinutes * 60) / activity.distance)
                                                    : formatPace((activity.durationMinutes * 60) / activity.distance).replace('/km', '')
                                                }
                                            </p>
                                            <p className="text-xs text-slate-500 uppercase">{activity.type === 'cycling' ? 'Fart' : 'Tempo'}</p>
                                        </div>
                                    ) : null}

                                    <div
                                        className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-4 text-center cursor-pointer hover:bg-indigo-500/30 transition-all active:scale-95 shadow-lg shadow-indigo-500/10"
                                        onClick={() => setShowScoreInfo(!showScoreInfo)}
                                    >
                                        <p className="text-2xl font-black text-indigo-400">{perfBreakdown.totalScore}</p>
                                        <p className="text-xs text-slate-500 uppercase flex items-center justify-center gap-1">
                                            Greens Score
                                            <span className="text-[10px] opacity-50">{showScoreInfo ? '▼' : '▲'}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Greens Score Visual Breakdown */}
                                {showScoreInfo && (
                                    <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-4 duration-300">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-black text-white uppercase text-xs tracking-widest flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                Resultatanalys
                                            </h4>
                                            <span className="text-[10px] font-mono text-slate-500 uppercase">{perfBreakdown.summary}</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Big Score Gauge (CSS Simple) */}
                                            <div className="flex flex-col items-center justify-center py-2">
                                                <div className="relative w-28 h-28 flex items-center justify-center">
                                                    {perfBreakdown.isPersonalBest && (
                                                        <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-bounce z-10 border-2 border-slate-900">
                                                            🏆
                                                        </div>
                                                    )}
                                                    <svg className="w-full h-full -rotate-90">
                                                        <circle cx="56" cy="56" r="50" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                                        <circle
                                                            cx="56" cy="56" r="50" fill="transparent"
                                                            stroke="currentColor" strokeWidth="8"
                                                            strokeDasharray={314}
                                                            strokeDashoffset={314 - (314 * perfBreakdown.totalScore) / 100}
                                                            strokeLinecap="round"
                                                            className="text-indigo-500 transition-all duration-1000 ease-out"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                        <span className="text-3xl font-black text-white">{perfBreakdown.totalScore}</span>
                                                        <span className="text-[8px] text-slate-500 uppercase font-bold">Poäng</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Component Bars */}
                                            <div className="flex flex-col justify-center space-y-4">
                                                {perfBreakdown.components.map((comp, idx) => (
                                                    <div key={idx} className="space-y-1.5">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                                                                <span>{comp.icon}</span> {comp.label}
                                                                {comp.isPersonalBest && <span className="text-[8px] bg-yellow-500/10 text-yellow-500 px-1 rounded border border-yellow-500/20">PB</span>}
                                                            </span>
                                                            <span className={`text-xs font-mono font-bold ${comp.color}`}>{comp.value}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 delay-300 ${comp.color.replace('text-', 'bg-')}`}
                                                                style={{ width: `${Math.max(5, (comp.score / comp.max) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <p className={`text-[9px] italic leading-tight ${comp.isPersonalBest ? 'text-yellow-500/70' : 'text-slate-500'}`}>
                                                            {comp.description}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-white/5">
                                            <div className="bg-indigo-500/5 rounded-lg p-3 border border-indigo-500/10 text-[10px] text-slate-400 leading-relaxed">
                                                <strong className="text-indigo-400 block mb-1">💡 Tips för detta pass:</strong>
                                                {perfBreakdown.type === 'cardio' ?
                                                    "För att höja din Greens Score, försök sänka din ansträngning (puls) vid bibehållen hastighet, eller öka hastigheten vid samma puls genom förbättrad löpekonomi." :
                                                    "Din score speglar arbetstakten (kg/min). Kör du färre och längre vilar sänks poängen, medan ett högre tempo med bibehållen vikt höjer den."
                                                }
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Heart Rate Zone Visualization (for cardio with HR data) */}
                                {perf?.avgHeartRate && activity.type?.toLowerCase() !== 'strength' && (
                                    <HeartRateZones
                                        avgHeartRate={Math.round(perf.avgHeartRate)}
                                        maxHeartRate={perf.maxHeartRate ? Math.round(perf.maxHeartRate) : undefined}
                                        duration={activity.durationMinutes ? activity.durationMinutes * 60 : undefined}
                                    />
                                )}

                                {/* Simple HR display fallback (for strength or merged) */}
                                {(perf?.avgHeartRate || perf?.maxHeartRate) && activity.type?.toLowerCase() === 'strength' && (
                                    <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 w-fit">
                                        <h3 className="text-xs font-bold text-red-400 uppercase mb-2">❤️ Puls {isMerged && <span className="text-slate-500">(från Strava)</span>}</h3>
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

                                {/* Elevation & Performance (GAP) */}
                                <div className="grid grid-cols-2 gap-4">
                                    {(perf?.elevationGain > 0) && (
                                        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4">
                                            <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">⛰️ Höjdmeter</h3>
                                            <span className="text-2xl font-black text-white">{Math.round(perf.elevationGain)}</span>
                                            <span className="text-xs text-slate-400 ml-1">m</span>
                                        </div>
                                    )}
                                    {(activity.distance && activity.distance > 0 && perf?.elevationGain) ? (
                                        <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4">
                                            <h3 className="text-xs font-bold text-indigo-400 uppercase mb-2">📈 Effektivt Tempo (GAP)</h3>
                                            <span className="text-2xl font-black text-white">
                                                {formatPace(calculateGAP((activity.durationMinutes * 60) / activity.distance, perf.elevationGain, activity.distance))}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-1">/km</span>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Notes */}
                                {(activity.notes || perf?.notes) && (
                                    <div className="bg-slate-800/50 rounded-xl p-4">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">📝 Anteckning</h3>
                                        <p className="text-white">{activity.notes || perf?.notes}</p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* RAW DATA VIEW */}
                        {viewMode === 'raw' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase">📄 Rådata för felsökning</h3>
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
                                                            {calculatePerformanceScore(activity)}
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
                                                            <td className="px-4 py-4 text-right text-slate-400">{a.heartRateAvg || '-'}</td>
                                                            <td className="px-4 py-4 text-right">
                                                                <span className={`text-[10px] font-black px-2 py-1 rounded ${aScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    aScore >= 60 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-500/20 text-slate-400'
                                                                    }`}>
                                                                    {aScore}
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
                                        <BarChart data={splits.map((s: any, i: number) => ({
                                            km: `Km ${i + 1}`,
                                            seconds: s.movingTime,
                                            pace: (s.movingTime / 60).toFixed(2)
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                            <XAxis dataKey="km" stroke="#64748b" fontSize={10} />
                                            <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }}
                                                labelStyle={{ color: '#94a3b8' }}
                                                formatter={(val: number) => [`${Math.floor(val / 60)}:${(val % 60).toString().padStart(2, '0')}`, 'Tempo']}
                                            />
                                            <Bar dataKey="seconds" fill="#6366f1" radius={[4, 4, 0, 0]} minPointSize={2} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

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
                                                    <tr key={i}>
                                                        <td className="px-4 py-3 text-white font-bold">{i + 1} km</td>
                                                        <td className="px-4 py-3 text-right text-slate-300">
                                                            {Math.floor(s.movingTime / 60)}:{(s.movingTime % 60).toString().padStart(2, '0')}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-indigo-400">
                                                            {Math.floor(splitPace / 60)}:{(Math.round(splitPace % 60)).toString().padStart(2, '0')} /km
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-rose-400">
                                                            {s.averageHeartrate || '-'}
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
                                        Skapad {mergeInfo?.mergedAt ? formatSwedishDate(mergeInfo.mergedAt.split('T')[0]) : '-'}
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
                                                            // Open this component activity in a new modal
                                                            // For now, we'll use a simple approach - set it as selected
                                                            // This requires passing a callback or using context
                                                            // For simplicity, open in new tab via URL if possible
                                                            const extId = orig.performance?.source?.externalId;
                                                            if (extId) {
                                                                window.open(`https://www.strava.com/activities/${extId.replace('strava_', '')}`, '_blank');
                                                            }
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

                        {/* Action Buttons */}
                        <div className="flex gap-3 flex-wrap">
                            {isMergedActivity && (
                                <button
                                    onClick={handleUnmerge}
                                    disabled={isUnmerging}
                                    className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    {isUnmerging ? '⏳...' : '🔀 Separera'}
                                </button>
                            )}
                            {isMerged && onSeparate && !isMergedActivity && (
                                <button
                                    onClick={onSeparate}
                                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl transition-colors"
                                >
                                    🔀 Separera
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    window.location.href = `/workouts/builder?fromActivity=${activity.id}`;
                                }}
                                className={`flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-500/20`}
                            >
                                ⚡ Spara som Pass
                            </button>

                            {/* Raw Data Button - Moved to bottom per user request */}
                            <button
                                onClick={() => setViewMode(viewMode === 'raw' ? 'combined' : 'raw')}
                                className={`px-4 py-3 rounded-xl text-xs font-bold transition-colors ${viewMode === 'raw' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            >
                                📄 Rådata
                            </button>

                            <button
                                onClick={onClose}
                                className={`flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors`}
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
