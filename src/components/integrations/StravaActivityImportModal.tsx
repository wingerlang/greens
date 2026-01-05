import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';

interface ImportedActivity {
    externalId: string;
    platform: 'strava' | 'garmin';
    date: string;
    type: string;
    durationMinutes: number;
    intensity: string;
    caloriesBurned: number;
    distance?: number;
    notes: string;
    heartRateAvg?: number;
    heartRateMax?: number;
    elevationGain?: number;
    prCount?: number;
    kudosCount?: number;
}

interface StravaActivityImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const EXERCISE_ICONS: Record<string, string> = {
    running: '🏃',
    cycling: '🚴',
    swimming: '🏊',
    strength: '🏋️',
    walking: '🚶',
    yoga: '🧘',
    other: '⚡',
};

export function StravaActivityImportModal({ isOpen, onClose }: StravaActivityImportModalProps) {
    const { token } = useAuth();
    const { addExercise, exerciseEntries } = useData();
    const [activities, setActivities] = useState<ImportedActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);
    const [importedCount, setImportedCount] = useState(0);

    // Fetch activities on open
    useEffect(() => {
        if (isOpen) {
            fetchActivities();
        }
    }, [isOpen]);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            // Get activities from last 30 days
            const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
            const res = await fetch(`/api/strava/activities?after=${thirtyDaysAgo}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.activities) {
                // Filter out already imported activities
                const existingExternalIds = new Set(
                    exerciseEntries
                        .filter((e: any) => e.externalId)
                        .map((e: any) => e.externalId)
                );

                const newActivities = data.activities.filter(
                    (a: ImportedActivity) => !existingExternalIds.has(a.externalId)
                );

                setActivities(newActivities);
                // Select all by default
                setSelected(new Set(newActivities.map((a: ImportedActivity) => a.externalId)));
            }
        } catch (err) {
            console.error('Failed to fetch activities:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (externalId: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(externalId)) {
            newSelected.delete(externalId);
        } else {
            newSelected.add(externalId);
        }
        setSelected(newSelected);
    };

    const selectAll = () => {
        setSelected(new Set(activities.map(a => a.externalId)));
    };

    const selectNone = () => {
        setSelected(new Set());
    };

    const handleImport = async () => {
        setImporting(true);
        let count = 0;

        for (const activity of activities) {
            if (selected.has(activity.externalId)) {
                try {
                    addExercise({
                        date: activity.date,
                        type: activity.type as any,
                        durationMinutes: activity.durationMinutes,
                        intensity: activity.intensity as any,
                        caloriesBurned: activity.caloriesBurned,
                        distance: activity.distance,
                        notes: activity.notes,
                        externalId: activity.externalId,
                        platform: activity.platform,
                        heartRateAvg: activity.heartRateAvg,
                        heartRateMax: activity.heartRateMax,
                        elevationGain: activity.elevationGain,
                    });
                    count++;
                } catch (err) {
                    console.error('Failed to import activity:', activity.externalId, err);
                }
            }
        }

        setImportedCount(count);
        setImporting(false);

        // Show success and close after delay
        setTimeout(() => {
            onClose();
            setImportedCount(0);
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay backdrop-blur-md bg-slate-950/80" onClick={onClose}>
            <div
                className="modal-content max-w-2xl w-full bg-slate-900 border border-white/10 shadow-2xl rounded-3xl overflow-hidden max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-br from-orange-500/20 to-slate-900 p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#FC4C02] flex items-center justify-center">
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Importera Aktiviteter</h2>
                            <p className="text-xs text-slate-400">Senaste 30 dagarna från Strava</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                            <p className="text-slate-400 text-sm">Hämtar aktiviteter...</p>
                        </div>
                    ) : importedCount > 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-4xl">
                                ✅
                            </div>
                            <p className="text-white font-bold">{importedCount} aktiviteter importerade!</p>
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                            <div className="text-4xl">🎉</div>
                            <p className="text-slate-400">Inga nya aktiviteter att importera!</p>
                            <p className="text-xs text-slate-500">Alla dina Strava-aktiviteter är redan synkade.</p>
                        </div>
                    ) : (
                        <>
                            {/* Selection Controls */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-xs text-slate-400">
                                    {selected.size} av {activities.length} valda
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAll}
                                        className="text-xs text-emerald-400 hover:text-emerald-300 font-bold"
                                    >
                                        Välj alla
                                    </button>
                                    <span className="text-slate-600">|</span>
                                    <button
                                        onClick={selectNone}
                                        className="text-xs text-slate-400 hover:text-slate-300 font-bold"
                                    >
                                        Avmarkera
                                    </button>
                                </div>
                            </div>

                            {/* Activity List */}
                            <div className="space-y-2">
                                {activities.map(activity => (
                                    <div
                                        key={activity.externalId}
                                        onClick={() => toggleSelect(activity.externalId)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${selected.has(activity.externalId)
                                                ? 'bg-orange-500/10 border-orange-500/30'
                                                : 'bg-slate-950/50 border-white/5 hover:bg-slate-800/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Checkbox */}
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected.has(activity.externalId)
                                                    ? 'bg-orange-500 border-orange-500 text-white'
                                                    : 'border-slate-600'
                                                }`}>
                                                {selected.has(activity.externalId) && '✓'}
                                            </div>

                                            {/* Icon */}
                                            <div className="text-2xl">
                                                {EXERCISE_ICONS[activity.type] || '⚡'}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1">
                                                <div className="font-bold text-white text-sm">{activity.notes}</div>
                                                <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                                                    <span>{new Date(activity.date).toLocaleDateString('sv-SE')}</span>
                                                    <span>•</span>
                                                    <span>{activity.durationMinutes} min</span>
                                                    {activity.distance && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{activity.distance} km</span>
                                                        </>
                                                    )}
                                                    {activity.heartRateAvg && (
                                                        <>
                                                            <span>•</span>
                                                            <span>❤️ {activity.heartRateAvg} bpm</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-emerald-400">-{activity.caloriesBurned} kcal</div>
                                                {activity.prCount && activity.prCount > 0 && (
                                                    <div className="text-xs text-amber-400">🏆 {activity.prCount} PR</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {activities.length > 0 && !importing && importedCount === 0 && (
                    <div className="p-4 border-t border-white/5 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs uppercase tracking-wider transition-all"
                        >
                            Avbryt
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={selected.size === 0}
                            className="flex-[2] py-3 rounded-xl bg-[#FC4C02] hover:bg-[#E34402] text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Importera {selected.size} Aktiviteter
                        </button>
                    </div>
                )}

                {importing && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                        <span className="text-orange-400 font-bold text-sm">Importerar...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
