import React, { useMemo } from 'react';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';

interface KonditionViewProps {
    days: number;
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
}

export function KonditionView({ days, exerciseEntries, universalActivities }: KonditionViewProps) {
    // Filter cardio-related exercises
    const cardioTypes = ['running', 'cycling', 'swimming', 'walking', 'hiking', 'cardio', 'löpning', 'cykling', 'simning', 'promenad', 'run', 'ride', 'swim', 'walk', 'hike'];

    // Combine exerciseEntries (manual) with universalActivities (Strava)
    const allEntries = useMemo(() => {
        // Map universal activities to exercise entries
        const stravaEntries = universalActivities
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        // Combine and dedupe by date+type
        const combined = [...exerciseEntries, ...stravaEntries];
        const seen = new Set<string>();
        return combined.filter(e => {
            const key = `${e.date}-${e.type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [exerciseEntries, universalActivities]);

    const filteredEntries = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return allEntries.filter(e => {
            const isCardio = cardioTypes.some(t => e.type.toLowerCase().includes(t));
            const inRange = new Date(e.date) >= cutoff;
            return isCardio && inRange;
        });
    }, [allEntries, days]);

    // Weekly distance/duration data
    const weeklyData = useMemo(() => {
        const weeks: Record<string, { distance: number; duration: number; calories: number }> = {};
        filteredEntries.forEach(e => {
            const date = new Date(e.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const key = weekStart.toISOString().split('T')[0];
            if (!weeks[key]) weeks[key] = { distance: 0, duration: 0, calories: 0 };
            weeks[key].distance += e.distance || 0;
            weeks[key].duration += e.durationMinutes || 0;
            weeks[key].calories += e.caloriesBurned || 0;
        });
        return Object.entries(weeks)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-8)
            .map(([week, data]) => ({ week, ...data }));
    }, [filteredEntries]);

    const maxDistance = Math.max(...weeklyData.map(d => d.distance), 1);

    // Summary stats
    const totalDistance = filteredEntries.reduce((s, e) => s + (e.distance || 0), 0);
    const totalDuration = filteredEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
    const totalCalories = filteredEntries.reduce((s, e) => s + (e.caloriesBurned || 0), 0);
    const avgPace = totalDistance > 0 ? totalDuration / totalDistance : 0;

    // Activity type breakdown
    const activityBreakdown = useMemo(() => {
        const types: Record<string, { count: number; distance: number; duration: number }> = {};
        filteredEntries.forEach(e => {
            const type = e.type.toLowerCase();
            if (!types[type]) types[type] = { count: 0, distance: 0, duration: 0 };
            types[type].count++;
            types[type].distance += e.distance || 0;
            types[type].duration += e.durationMinutes || 0;
        });
        return Object.entries(types)
            .map(([type, data]) => ({ type, ...data }))
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5);
    }, [filteredEntries]);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-sky-400">{filteredEntries.length}</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Pass</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-emerald-400">{totalDistance.toFixed(1)}</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Km totalt</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-white">{Math.round(totalDuration / 60)}</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Timmar</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-rose-400">{Math.round(totalCalories / 1000)}k</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Kalorier</p>
                </div>
            </div>

            {/* Pace Card (if running) */}
            {avgPace > 0 && (
                <div className="bg-sky-950/30 border border-sky-500/20 rounded-2xl p-5 flex items-center gap-6">
                    <div className="text-4xl">🏃</div>
                    <div>
                        <p className="text-xs text-sky-400 uppercase font-bold">Snitt tempo</p>
                        <p className="text-3xl font-black text-white">
                            {Math.floor(avgPace)}:{String(Math.round((avgPace % 1) * 60)).padStart(2, '0')}
                            <span className="text-sm text-slate-400 ml-1">min/km</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Weekly Distance Chart */}
            {weeklyData.length > 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">📈 Distans per vecka</h3>
                    <div className="flex items-end gap-2 h-32">
                        {weeklyData.map((d) => {
                            const height = (d.distance / maxDistance) * 100;
                            return (
                                <div key={d.week} className="flex-1 flex flex-col items-center gap-1 group">
                                    <span className="text-[10px] text-sky-400 font-bold opacity-0 group-hover:opacity-100">{d.distance.toFixed(1)} km</span>
                                    <div
                                        className="w-full bg-gradient-to-t from-sky-600 to-sky-400 rounded-t hover:from-sky-500 hover:to-sky-300 transition-all"
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                    />
                                    <span className="text-[9px] text-slate-600">{d.week.slice(5)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Activity Breakdown */}
            {activityBreakdown.length > 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">🎯 Aktivitetstyper</h3>
                    <div className="space-y-3">
                        {activityBreakdown.map((act, i) => (
                            <div key={act.type} className="flex items-center gap-3">
                                <span className="text-lg font-black text-slate-600 w-6">{i + 1}</span>
                                <div className="flex-1">
                                    <p className="text-white font-bold capitalize">{act.type}</p>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                        <span>{act.count} pass</span>
                                        <span className="text-emerald-400">{act.distance.toFixed(1)} km</span>
                                        <span className="text-sky-400">{Math.round(act.duration)} min</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {filteredEntries.length === 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-12 text-center">
                    <p className="text-4xl mb-4">🏃</p>
                    <p className="text-slate-400">Ingen konditionsdata för vald period.</p>
                    <p className="text-sm text-slate-600 mt-2">Synka med Strava eller logga konditionspass manuellt.</p>
                </div>
            )}
        </div>
    );
}
