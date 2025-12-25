import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext.tsx';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import { ExerciseEntry, UniversalActivity } from '../models/types.ts';

// Activity Detail Modal Component
function ActivityDetailModal({
    activity,
    universalActivity,
    onClose
}: {
    activity: ExerciseEntry & { source: string };
    universalActivity?: UniversalActivity;
    onClose: () => void;
}) {
    const perf = universalActivity?.performance;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white capitalize">{activity.type}</h2>
                        <p className="text-slate-400 font-mono">{activity.date}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl">×</button>
                </div>

                {/* Source Badge */}
                {activity.source === 'strava' && (
                    <div className="inline-flex items-center gap-2 bg-[#FC4C02]/20 text-[#FC4C02] px-3 py-1.5 rounded-lg text-xs font-bold uppercase">
                        <span>🔥</span> Synkad från Strava
                    </div>
                )}

                {/* Main Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black text-white">{activity.durationMinutes}</p>
                        <p className="text-xs text-slate-500 uppercase">Minuter</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black text-emerald-400">{activity.distance || '-'}</p>
                        <p className="text-xs text-slate-500 uppercase">Km</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black text-rose-400">{activity.caloriesBurned}</p>
                        <p className="text-xs text-slate-500 uppercase">Kcal</p>
                    </div>
                </div>

                {/* Heart Rate (if available) */}
                {(perf?.avgHeartRate || perf?.maxHeartRate) && (
                    <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4">
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

                {/* Elevation (if available) */}
                {perf?.elevationGain && perf.elevationGain > 0 && (
                    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-4">
                        <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">⛰️ Höjdmeter</h3>
                        <span className="text-2xl font-black text-white">{Math.round(perf.elevationGain)}</span>
                        <span className="text-xs text-slate-400 ml-1">m</span>
                    </div>
                )}

                {/* Notes */}
                {(activity.notes || perf?.notes) && (
                    <div className="bg-slate-800/50 rounded-xl p-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">📝 Anteckning</h3>
                        <p className="text-white">{activity.notes || perf?.notes}</p>
                    </div>
                )}

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                    Stäng
                </button>
            </div>
        </div>
    );
}

export function ActivitiesPage() {
    const { universalActivities, exerciseEntries: localEntries } = useData();
    const [filter, setFilter] = useState('all');
    const [selectedActivity, setSelectedActivity] = useState<(ExerciseEntry & { source: string }) | null>(null);

    const allActivities = useMemo(() => {
        const serverEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        const normalizedServer = serverEntries.map(e => ({ ...e, source: 'strava' }));
        const normalizedLocal = localEntries.map(e => ({ ...e, source: 'manual' }));

        return [...normalizedServer, ...normalizedLocal].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    }, [universalActivities, localEntries]);

    const filteredActivities = allActivities.filter(a => {
        if (filter === 'strava') return a.source === 'strava';
        if (filter === 'manual') return a.source === 'manual';
        return true;
    });

    // Find corresponding UniversalActivity for the selected item
    const selectedUniversal = selectedActivity
        ? universalActivities.find(u => u.id === selectedActivity.id)
        : undefined;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white mb-2">Aktivitetslogg</h1>
                    <p className="text-slate-400">Alla dina pass, samlade på ett ställe.</p>
                </div>
                <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                        Alla ({allActivities.length})
                    </button>
                    <button
                        onClick={() => setFilter('strava')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'strava' ? 'bg-[#FC4C02] text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Strava
                    </button>
                    <button
                        onClick={() => setFilter('manual')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === 'manual' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Manuella
                    </button>
                </div>
            </header>

            <div className="bg-slate-900/50 border border-white/5 rounded-3xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-xs uppercase font-bold text-slate-500 border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4">Datum</th>
                            <th className="px-6 py-4">Typ</th>
                            <th className="px-6 py-4">Källa</th>
                            <th className="px-6 py-4 text-right">Tid</th>
                            <th className="px-6 py-4 text-right">Distans</th>
                            <th className="px-6 py-4 text-right">Kalorier</th>
                            <th className="px-6 py-4">Notering</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredActivities.map((activity, i) => (
                            <tr
                                key={activity.id || i}
                                className="hover:bg-white/5 transition-colors cursor-pointer"
                                onClick={() => setSelectedActivity(activity)}
                            >
                                <td className="px-6 py-4 font-mono text-white">
                                    {activity.date}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="capitalize text-white font-bold">{activity.type}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {activity.source === 'strava' ? (
                                        <span className="inline-flex items-center gap-1 text-[#FC4C02] font-bold text-[10px] uppercase tracking-wider bg-[#FC4C02]/10 px-2 py-1 rounded">
                                            Strava
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-blue-400 font-bold text-[10px] uppercase tracking-wider bg-blue-500/10 px-2 py-1 rounded">
                                            Manuell
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-300">
                                    {activity.durationMinutes} min
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-300">
                                    {activity.distance ? `${activity.distance} km` : '-'}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-rose-400">
                                    {activity.caloriesBurned} kcal
                                </td>
                                <td className="px-6 py-4 text-xs italic opacity-50 truncate max-w-[200px]">
                                    {activity.notes}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredActivities.length === 0 && (
                    <div className="p-12 text-center text-slate-500 italic">
                        Inga aktiviteter hittades.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedActivity && (
                <ActivityDetailModal
                    activity={selectedActivity}
                    universalActivity={selectedUniversal}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}

