import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { StrengthWorkout, StrengthStats, PersonalBest } from '../../models/strengthTypes.ts';

interface StyrkaViewProps {
    days: number;
}

export function StyrkaView({ days }: StyrkaViewProps) {
    const { token } = useAuth();
    const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
    const [stats, setStats] = useState<StrengthStats | null>(null);
    const [pbs, setPbs] = useState<PersonalBest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        const API_BASE = 'http://localhost:8000';

        const fetchData = async () => {
            try {
                const [workoutsRes, statsRes, pbsRes] = await Promise.all([
                    fetch(`${API_BASE}/api/strength/workouts`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE}/api/strength/stats`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_BASE}/api/strength/pbs`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                if (workoutsRes.ok) {
                    const data = await workoutsRes.json();
                    // Response is { workouts: [...] }
                    setWorkouts(data.workouts || []);
                }
                if (statsRes.ok) {
                    const data = await statsRes.json();
                    setStats(data.stats || null);
                }
                if (pbsRes.ok) {
                    const data = await pbsRes.json();
                    // Response is { personalBests: [...] }
                    setPbs(data.personalBests || []);
                }
            } catch (e) {
                console.error('Failed to fetch strength data', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token]);

    // Filter by days
    const filteredWorkouts = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return workouts.filter(w => new Date(w.date) >= cutoff);
    }, [workouts, days]);

    // Weekly volume data for chart
    const weeklyData = useMemo(() => {
        const weeks: Record<string, number> = {};
        filteredWorkouts.forEach(w => {
            const date = new Date(w.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const key = weekStart.toISOString().split('T')[0];
            weeks[key] = (weeks[key] || 0) + (w.totalVolume || 0);
        });
        return Object.entries(weeks)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-8)
            .map(([week, volume]) => ({ week, volume }));
    }, [filteredWorkouts]);

    const maxVolume = Math.max(...weeklyData.map(d => d.volume), 1);

    // Top exercises by volume
    const topExercises = useMemo(() => {
        const exercises: Record<string, { name: string; volume: number; count: number }> = {};
        filteredWorkouts.forEach(w => {
            w.exercises.forEach(ex => {
                if (!exercises[ex.exerciseName]) {
                    exercises[ex.exerciseName] = { name: ex.exerciseName, volume: 0, count: 0 };
                }
                exercises[ex.exerciseName].volume += ex.totalVolume || 0;
                exercises[ex.exerciseName].count++;
            });
        });
        return Object.values(exercises).sort((a, b) => b.volume - a.volume).slice(0, 5);
    }, [filteredWorkouts]);

    const totalVolume = filteredWorkouts.reduce((s, w) => s + (w.totalVolume || 0), 0);
    const totalSets = filteredWorkouts.reduce((s, w) => s + w.totalSets, 0);

    if (loading) {
        return <div className="text-center text-slate-400 py-12">Laddar styrkedata...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-purple-400">{filteredWorkouts.length}</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Pass</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-white">{totalSets}</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Totalt set</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-emerald-400">{Math.round(totalVolume / 1000)}t</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Ton lyft</p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
                    <p className="text-3xl font-black text-amber-400">{pbs.length}</p>
                    <p className="text-xs text-slate-500 uppercase mt-1">Personliga rekord</p>
                </div>
            </div>

            {/* Weekly Volume Chart */}
            {weeklyData.length > 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">📈 Volym per vecka</h3>
                    <div className="flex items-end gap-2 h-32">
                        {weeklyData.map((d, i) => {
                            const height = (d.volume / maxVolume) * 100;
                            return (
                                <div key={d.week} className="flex-1 flex flex-col items-center gap-1 group">
                                    <span className="text-[10px] text-purple-400 font-bold opacity-0 group-hover:opacity-100">{Math.round(d.volume / 1000)}t</span>
                                    <div
                                        className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t hover:from-purple-500 hover:to-purple-300 transition-all"
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                    />
                                    <span className="text-[9px] text-slate-600">{d.week.slice(5)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Top Exercises */}
            {topExercises.length > 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">🔥 Mest tränade övningar</h3>
                    <div className="space-y-3">
                        {topExercises.map((ex, i) => (
                            <div key={ex.name} className="flex items-center gap-3">
                                <span className="text-lg font-black text-slate-600 w-6">{i + 1}</span>
                                <div className="flex-1">
                                    <p className="text-white font-bold">{ex.name}</p>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                        <span>{ex.count} pass</span>
                                        <span className="text-emerald-400">{Math.round(ex.volume / 1000)}t kg</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent PBs */}
            {pbs.length > 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">🏆 Senaste rekord</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {pbs.slice(0, 4).map(pb => (
                            <div key={pb.id} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                <p className="text-xs text-amber-400 uppercase font-bold truncate">{pb.exerciseName}</p>
                                <p className="text-xl font-black text-white">{pb.value} kg</p>
                                <p className="text-[10px] text-slate-500">{pb.reps} reps @ {pb.weight} kg</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {filteredWorkouts.length === 0 && (
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-12 text-center">
                    <p className="text-4xl mb-4">💪</p>
                    <p className="text-slate-400">Ingen styrkedata för vald period.</p>
                    <p className="text-sm text-slate-600 mt-2">Gå till /styrka för att importera dina pass.</p>
                </div>
            )}
        </div>
    );
}
