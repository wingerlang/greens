import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StrengthWorkout, StrengthWorkoutExercise, PersonalBest, calculate1RM, isWeightedDistanceExercise, isDistanceBasedExercise } from '../../models/strengthTypes.ts';
import { UniversalActivity } from '../../models/types.ts';
import { useAuth } from '../../context/AuthContext.tsx';

interface WorkoutDetailModalProps {
    workout: StrengthWorkout;
    onClose: () => void;
    onSelectExercise?: (name: string) => void;
    pbs?: PersonalBest[];
}

export function WorkoutDetailModal({ workout, onClose, onSelectExercise, pbs = [] }: WorkoutDetailModalProps) {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [dailyActivities, setDailyActivities] = useState<UniversalActivity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);

    // ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Fetch activities for this day to find Strava link
    useEffect(() => {
        const fetchDailyActivities = async () => {
            if (!token || !workout.date) return;
            setLoadingActivities(true);
            try {
                // Fetch just this day
                const res = await fetch(`/api/activities?start=${workout.date}&end=${workout.date}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDailyActivities(data.activities || []);
                }
            } catch (error) {
                console.error('Failed to fetch daily activities for modal:', error);
            } finally {
                setLoadingActivities(false);
            }
        };

        fetchDailyActivities();
    }, [workout.date, token]);

    // Find matching Strava Activity
    const stravaActivity = useMemo(() => {
        if (!dailyActivities.length) return null;

        // Helper to safely get title and type
        const getDetails = (a: UniversalActivity) => {
            const title = a.plan?.title || '';
            const type = a.plan?.activityType || a.performance?.activityType || 'other';
            return { title, type };
        };

        // 1. Try to find a strength activity first
        const strengthActivity = dailyActivities.find(a => {
            const isStrava = a.performance?.source?.source === 'strava';
            const { title, type } = getDetails(a);

            return isStrava && (
                type === 'strength' ||
                title.toLowerCase().includes('styrka') ||
                title.toLowerCase().includes('strength')
            );
        });

        if (strengthActivity) return strengthActivity;

        // 2. Fallback: Find any Strava activity
        return dailyActivities.find(a => a.performance?.source?.source === 'strava');
    }, [dailyActivities]);


    // Aggregate exercises (handling supersets/split entries)
    const uniqueExercises = useMemo(() => {
        if (!workout) return [];
        const aggregated: Record<string, StrengthWorkoutExercise> = {};

        workout.exercises.forEach(ex => {
            const exId = ex.exerciseId; // Use ID or Name if ID missing? Assuming ID is consistent.
            if (!aggregated[exId]) {
                aggregated[exId] = { ...ex, sets: [...ex.sets] };
            } else {
                // Merge sets
                const current = aggregated[exId];
                const baseSetCount = current.sets.length;

                ex.sets.forEach((s, idx) => {
                    current.sets.push({
                        ...s,
                        setNumber: baseSetCount + idx + 1
                    });
                });

                // Merge volume
                current.totalVolume = (current.totalVolume || 0) + (ex.totalVolume || 0);

                // Update top set if better
                if (ex.topSet && (!current.topSet || ex.topSet.weight > current.topSet.weight)) {
                    current.topSet = ex.topSet;
                }
            }
        });

        return Object.values(aggregated).map((exercise, i) => {
            const isPB = pbs.some(pb => pb.workoutId === workout.id && pb.exerciseId === exercise.exerciseId);
            return {
                ...exercise,
                isPB
            };
        });
    }, [workout, pbs]);

    if (!workout) return null;

    const formattedDate = new Date(workout.date).toLocaleDateString('sv-SE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const categories = Array.from(new Set(workout.exercises.map(e => e.exerciseName))).slice(0, 3).join(', ');

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white capitalize">{formattedDate}</h2>
                        <p className="text-slate-400 text-sm mt-1">{workout.name || 'Styrkepass'}</p>
                        {categories && <p className="text-xs text-slate-500 mt-2 line-clamp-1">{categories}...</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-white text-3xl p-1 -mt-2 transition-colors"
                        >
                            ×
                        </button>
                        <div className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded font-bold">
                            {Math.round(workout.totalVolume / 1000)} ton
                        </div>
                    </div>
                </div>

                {/* Metabolic / Strava Stats */}
                {stravaActivity && stravaActivity.performance && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#FC4C02] flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-orange-500/20">
                                STR
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-black text-orange-400">Strava Data</p>
                                <p className="text-white font-bold text-sm">{stravaActivity.plan?.title || 'Strava Activity'}</p>
                            </div>
                        </div>

                        <div className="flex box-border gap-4 text-right">
                            {stravaActivity.performance.avgHeartRate && (
                                <div>
                                    <p className="text-[9px] uppercase font-bold text-slate-500">Medelpuls</p>
                                    <p className="text-lg font-black text-white flex items-center gap-1 justify-end">
                                        {Math.round(stravaActivity.performance.avgHeartRate)}
                                        <span className="text-red-500 text-xs">❤️</span>
                                    </p>
                                </div>
                            )}
                            {stravaActivity.performance.calories > 0 && (
                                <div>
                                    <p className="text-[9px] uppercase font-bold text-slate-500">Energi</p>
                                    <p className="text-lg font-black text-white flex items-center gap-1 justify-end">
                                        {Math.round(stravaActivity.performance.calories)}
                                        <span className="text-orange-400 text-xs">kcal</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Exercises List */}
                <div className="space-y-6">
                    {uniqueExercises.map((exercise, idx) => {
                        const isWeightedDist = isWeightedDistanceExercise(exercise.exerciseName);
                        // Cast to boolean to ensure type safety
                        const isDist = !!isDistanceBasedExercise(exercise.exerciseName);

                        return (
                            <div key={idx} className="bg-slate-800/30 rounded-2xl overflow-hidden border border-white/5">
                                <div className="p-4 bg-slate-900/30 border-b border-white/5 flex justify-between items-start">
                                    <div>
                                        <h3
                                            className={`font-bold text-lg text-white ${onSelectExercise ? 'hover:text-blue-400 cursor-pointer transition-colors' : ''}`}
                                            onClick={() => onSelectExercise?.(exercise.exerciseName)}
                                        >
                                            {exercise.exerciseName}
                                            {onSelectExercise && <span className="opacity-0 group-hover:opacity-100 text-slate-500 ml-2 text-sm">→</span>}
                                        </h3>
                                        <p className="text-xs text-slate-500">{exercise.sets.length} set • {Math.round(exercise.totalVolume || 0)} kg volym</p>
                                    </div>
                                    {exercise.isPB && (
                                        <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2 py-1 rounded-full uppercase border border-amber-500/20 flex items-center gap-1">
                                            ⭐ PB
                                        </span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5 text-[10px] text-slate-400 uppercase font-black">
                                            <tr>
                                                <th className="px-4 py-2 text-left w-16">Set</th>
                                                {isWeightedDist ? (
                                                    <>
                                                        <th className="px-4 py-2 text-right">Vikt</th>
                                                        <th className="px-4 py-2 text-right">Distans</th>
                                                        {/* Empty col for alignment or maybe remove */}
                                                        <th className="px-4 py-2 text-right text-slate-500">Not</th>
                                                    </>
                                                ) : isDist ? (
                                                    <>
                                                        <th className="px-4 py-2 text-right">Tempo</th>
                                                        <th className="px-4 py-2 text-right">Distans</th>
                                                        <th className="px-4 py-2 text-right">Tid</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="px-4 py-2 text-right">Vikt</th>
                                                        <th className="px-4 py-2 text-right">Reps</th>
                                                        <th className="px-4 py-2 text-right text-slate-500">1RM (Est)</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {(() => {
                                                // Pre-calculate 1RMs to find max
                                                const setStats = exercise.sets.map(set => {
                                                    const isBW = set.isBodyweight || set.weight === 0;
                                                    const calcWeight = isBW ? (set.extraWeight || 0) : set.weight;
                                                    const est1RM = calculate1RM(calcWeight, set.reps);
                                                    return { ...set, est1RM, isBW, calcWeight };
                                                });

                                                const maxEst1RM = Math.max(...setStats.map(s => s.est1RM));

                                                return setStats.map((set, sIdx) => {
                                                    const weightDisplay = set.isBW ? (set.extraWeight ? `+${set.extraWeight}kg` : 'KV') : `${set.weight}kg`;
                                                    const isBest1RM = set.est1RM === maxEst1RM && maxEst1RM > 0 && !isDist && !isWeightedDist;
                                                    const isPB = exercise.isPB && set.weight === exercise.topSet?.weight;

                                                    return (
                                                        <tr
                                                            key={sIdx}
                                                            className={`transition-colors border-l-2 ${isBest1RM ? 'bg-emerald-500/10 border-emerald-500' : 'border-transparent hover:bg-white/5'}`}
                                                        >
                                                            <td className={`px-4 py-2 font-mono ${isBest1RM ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                                                                #{set.setNumber || sIdx + 1}
                                                            </td>

                                                            {isWeightedDist ? (
                                                                <>
                                                                    <td className="px-4 py-2 text-right font-bold text-white">
                                                                        {weightDisplay}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-blue-400 font-mono">
                                                                        {set.distance || 0} m
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-slate-600 italic">
                                                                        -
                                                                    </td>
                                                                </>
                                                            ) : isDist ? (
                                                                <>
                                                                    <td className="px-4 py-2 text-right font-mono text-blue-300">
                                                                        {set.tempo || '-'}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-bold text-white">
                                                                        {set.distance || 0} m
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-emerald-400 font-mono">
                                                                        {set.time || '-'}
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-4 py-2 text-right">
                                                                        <span className={`font-bold ${isBest1RM ? 'text-white' : 'text-slate-200'}`}>
                                                                            {weightDisplay}
                                                                        </span>
                                                                        {isPB && (
                                                                            <span className="ml-2 text-xs" title="Nytt PB!">⭐</span>
                                                                        )}
                                                                    </td>
                                                                    <td className={`px-4 py-2 text-right font-bold ${isBest1RM ? 'text-emerald-400' : 'text-blue-400'}`}>
                                                                        {set.reps}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right">
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <span className={`font-mono text-xs ${isBest1RM ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
                                                                                {Math.round(set.est1RM)} kg
                                                                            </span>
                                                                            {isBest1RM && (
                                                                                <span className="text-emerald-500 text-[10px]" title="Bästa 1eRM i passet">⚡</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="pt-4 border-t border-white/10 flex gap-3">
                    <button
                        onClick={() => {
                            onClose();
                            navigate(`/workouts/builder?fromActivity=${workout.id}`);
                        }}
                        className="flex-1 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 font-bold py-3 rounded-xl transition-all"
                    >
                        📝 Använd som mall
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors"
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
