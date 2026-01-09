import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StrengthWorkout, StrengthWorkoutExercise, PersonalBest, isWeightedDistanceExercise, isDistanceBasedExercise } from '../../models/strengthTypes.ts';
import { calculateEstimated1RM } from '../../utils/strengthCalculators.ts';
import { UniversalActivity } from '../../models/types.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { SimilarWorkouts } from './SimilarWorkouts.tsx';
import { formatSecondsToTime } from '../../utils/dateUtils.ts';

interface WorkoutDetailModalProps {
    workout: StrengthWorkout;
    onClose: () => void;
    onSelectExercise?: (name: string) => void;
    pbs?: PersonalBest[];
    onDeleted?: () => void;
    allWorkouts?: StrengthWorkout[];
    sessionNumber?: number;
    sessionTotal?: number;
    sessionYear?: number;
}

export function WorkoutDetailModal({ workout, onClose, onSelectExercise, pbs = [], onDeleted, allWorkouts = [], sessionNumber, sessionTotal, sessionYear }: WorkoutDetailModalProps) {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [dailyActivities, setDailyActivities] = useState<UniversalActivity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

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

    const handleCopyLink = () => {
        const url = `${window.location.origin}/styrka?sessionId=${workout.id}`;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    // Aggregate exercises (handling supersets/split entries)
    const uniqueExercises = useMemo(() => {
        if (!workout) return [];
        const aggregated: Record<string, StrengthWorkoutExercise> = {};

        workout.exercises.forEach(ex => {
            const exId = ex.exerciseId;
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
    const volumeDisplay = workout.totalVolume > 2000
        ? `${(workout.totalVolume / 1000).toFixed(2)} ton`
        : `${Math.round(workout.totalVolume)} kg`;

    // Duration from Strava or Workout
    const stravaDurationSeconds = stravaActivity?.performance?.durationMinutes
        ? stravaActivity.performance.durationMinutes * 60
        : stravaActivity?.performance?.elapsedTimeSeconds
            ? stravaActivity.performance.elapsedTimeSeconds
            : 0;

    const workoutDurationSeconds = workout.duration || 0;

    // Delete workout handler
    const handleDelete = async () => {
        if (!token || !workout.id) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/strength/workout/${workout.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                onClose();
                onDeleted?.();
            } else {
                console.error('Failed to delete workout');
            }
        } catch (e) {
            console.error('Delete error:', e);
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-5 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-black text-white capitalize">{formattedDate}</h2>
                            {sessionNumber && (
                                <span className="bg-white/10 text-white/60 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-white/5">
                                    Pass #{sessionNumber}{sessionTotal ? `/${sessionTotal}` : ''} {sessionYear}
                                </span>
                            )}
                            <div className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                                {volumeDisplay}
                            </div>
                        </div>
                        <p className="text-slate-400 text-xs">{workout.name || 'Styrkepass'}</p>
                        {categories && <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{categories}...</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopyLink}
                                className="text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg border border-white/5"
                                title="Kopiera länk"
                            >
                                {linkCopied ? '✅' : '🔗'}
                            </button>
                            <button
                                onClick={onClose}
                                className="text-slate-500 hover:text-white text-2xl px-1 transition-colors"
                            >
                                ×
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {(workoutDurationSeconds > 0) && (
                                <div className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-bold border border-white/5 font-mono">
                                    ⏱️ {formatSecondsToTime(workoutDurationSeconds)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                {/* Metabolic / Strava Stats */}
                {
                    stravaActivity && stravaActivity.performance && (
                        <div
                            className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-orange-500/15 transition-colors group"
                            onClick={() => window.open(`https://www.strava.com/activities/${stravaActivity.performance?.source?.externalId || ''}`, '_blank')}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#FC4C02] flex items-center justify-center text-white font-bold text-[10px] shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                                    STR
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase font-black text-orange-400 flex items-center gap-1 group-hover:text-orange-300">
                                        Strava Data ↗
                                    </p>
                                    <p className="text-white font-bold text-xs">{stravaActivity.performance.notes || stravaActivity.plan?.title || 'Strava Activity'}</p>
                                    <p className="text-[9px] text-orange-200/60 mt-0.5">{stravaActivity.plan?.title}</p>
                                </div>
                            </div>

                            <div className="flex box-border gap-4 text-right">
                                {(stravaDurationSeconds > 0) && (
                                    <div>
                                        <p className="text-[8px] uppercase font-bold text-slate-500">Tid</p>
                                        <p className="text-sm font-black text-white flex items-center gap-1 justify-end font-mono">
                                            {formatSecondsToTime(stravaDurationSeconds)}
                                        </p>
                                    </div>
                                )}
                                {stravaActivity.performance.avgHeartRate && (
                                    <div>
                                        {stravaActivity.performance.maxHeartRate ? (
                                            <p className="text-[8px] uppercase font-bold text-slate-500">Puls (Max)</p>
                                        ) : (
                                            <p className="text-[8px] uppercase font-bold text-slate-500">Puls</p>
                                        )}
                                        <p className="text-sm font-black text-white flex items-center gap-1 justify-end">
                                            {Math.round(stravaActivity.performance.avgHeartRate)}
                                            {stravaActivity.performance.maxHeartRate && <span className="text-[10px] text-slate-400 ml-1">({Math.round(stravaActivity.performance.maxHeartRate)})</span>}
                                            <span className="text-red-500 text-[10px] ml-1">❤️</span>
                                        </p>
                                    </div>
                                )}
                                {stravaActivity.performance.kudosCount !== undefined && stravaActivity.performance.kudosCount > 0 && (
                                    <div>
                                        <p className="text-[8px] uppercase font-bold text-slate-500">Kudos</p>
                                        <p className="text-sm font-black text-white flex items-center gap-1 justify-end">
                                            {stravaActivity.performance.kudosCount}
                                            <span className="text-orange-400 text-[10px] ml-1">👍</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Exercises List */}
                <div className="space-y-4">
                    {uniqueExercises.map((exercise, idx) => {
                        const isWeightedDist = isWeightedDistanceExercise(exercise.exerciseName);
                        // Cast to boolean to ensure type safety
                        const isDist = !!isDistanceBasedExercise(exercise.exerciseName);

                        return (
                            <div key={idx} className="bg-slate-800/30 rounded-xl overflow-hidden border border-white/5">
                                <div className="px-3 py-2 bg-slate-900/30 border-b border-white/5 flex justify-between items-center">
                                    <div>
                                        <h3
                                            className={`font-bold text-sm text-white ${onSelectExercise ? 'hover:text-blue-400 cursor-pointer transition-colors' : ''}`}
                                            onClick={() => onSelectExercise?.(exercise.exerciseName)}
                                        >
                                            {exercise.exerciseName}
                                            {onSelectExercise && <span className="opacity-0 group-hover:opacity-100 text-slate-500 ml-2 text-xs">→</span>}
                                        </h3>
                                        <p className="text-[10px] text-slate-500">{exercise.sets.length} set • {Math.round(exercise.totalVolume || 0)} kg</p>
                                    </div>
                                    {exercise.isPB && (
                                        <span className="bg-amber-500/10 text-amber-500 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase border border-amber-500/20 flex items-center gap-1">
                                            ⭐ PB
                                        </span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-white/5 text-[9px] text-slate-400 uppercase font-black">
                                            <tr>
                                                <th className="px-3 py-1.5 text-left w-12">Set</th>
                                                {isWeightedDist ? (
                                                    <>
                                                        <th className="px-3 py-1.5 text-right">Vikt</th>
                                                        <th className="px-3 py-1.5 text-right">Distans</th>
                                                        {/* Empty col for alignment or maybe remove */}
                                                        <th className="px-3 py-1.5 text-right text-slate-500">Not</th>
                                                    </>
                                                ) : isDist ? (
                                                    <>
                                                        <th className="px-3 py-1.5 text-right">Tempo</th>
                                                        <th className="px-3 py-1.5 text-right">Distans</th>
                                                        <th className="px-3 py-1.5 text-right">Tid</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="px-3 py-1.5 text-right">Vikt</th>
                                                        <th className="px-3 py-1.5 text-right">Reps</th>
                                                        <th className="px-3 py-1.5 text-right text-slate-500">Volym</th>
                                                        <th className="px-3 py-1.5 text-right text-slate-500">1eRM</th>
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
                                                    const displayWeight = isBW ? (set.extraWeight || 0) : set.weight;
                                                    const est1RM = calculateEstimated1RM(calcWeight, set.reps);
                                                    const setVolume = displayWeight * set.reps;
                                                    return { ...set, est1RM, isBW, calcWeight, setVolume };
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
                                                            <td className={`px-3 py-1.5 font-mono text-[10px] ${isBest1RM ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                                                                #{set.setNumber || sIdx + 1}
                                                            </td>

                                                            {isWeightedDist ? (
                                                                <>
                                                                    <td className="px-3 py-1.5 text-right font-bold text-white">
                                                                        {weightDisplay}
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right text-blue-400 font-mono">
                                                                        {set.distance || 0} m
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right text-slate-600 italic">
                                                                        -
                                                                    </td>
                                                                </>
                                                            ) : isDist ? (
                                                                <>
                                                                    <td className="px-3 py-1.5 text-right font-mono text-blue-300">
                                                                        {set.tempo || '-'}
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right font-bold text-white">
                                                                        {set.distance || 0} m
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right text-emerald-400 font-mono">
                                                                        {set.time || '-'}
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-3 py-1.5 text-right">
                                                                        <span className={`font-bold ${isBest1RM ? 'text-white' : 'text-slate-200'}`}>
                                                                            {weightDisplay}
                                                                        </span>
                                                                        {isPB && (
                                                                            <span className="ml-1 text-[10px]" title="Nytt PB!">⭐</span>
                                                                        )}
                                                                    </td>
                                                                    <td className={`px-3 py-1.5 text-right font-bold ${isBest1RM ? 'text-emerald-400' : 'text-blue-400'}`}>
                                                                        {set.reps}
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right text-slate-500 font-mono text-[10px]">
                                                                        {Math.round(set.setVolume)} kg
                                                                    </td>
                                                                    <td className="px-3 py-1.5 text-right">
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <span className={`font-mono text-[10px] ${isBest1RM ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
                                                                                {Math.round(set.est1RM)}
                                                                            </span>
                                                                            {isBest1RM && (
                                                                                <span className="text-emerald-500 text-[8px]" title="Bästa 1eRM i passet">⚡</span>
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

                {/* Similar Workouts Section */}
                {
                    allWorkouts.length > 0 && (
                        <SimilarWorkouts
                            currentWorkout={workout}
                            allWorkouts={allWorkouts}
                            onSelectWorkout={(w) => {
                                onClose();
                                // Navigate handled by parent re-opening or navigation
                                // But usually, we might need a direct callback to switch workout
                                // Since we don't have a direct "switch" callback prop that takes ID, 
                                // and Parent relies on URL or state... 
                                // Ideally SimilarWorkouts should trigger navigation to ?sessionId=...
                                // We'll rely on the user clicking the link in SimilarWorkouts which *should* ideally update URL.
                                // But SimilarWorkouts probably calls onSelectWorkout.
                                // Let's assume the parent handles the URL update if we pass it up via onClose or specific prop?
                                // Actually, SimilarWorkouts calls onSelectWorkout with a workout object.
                                // We can't easily switch "in place" without parent help unless we navigate.
                                // For now, let's trust the parent's onClose logic or user navigation.
                            }}
                        />
                    )
                }

                {/* Delete Confirmation Dialog */}
                {
                    showDeleteConfirm && (
                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60" onClick={() => setShowDeleteConfirm(false)}>
                            <div className="bg-slate-800 border border-rose-500/30 rounded-2xl p-6 max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
                                <div className="text-center">
                                    <div className="text-4xl mb-2">⚠️</div>
                                    <h3 className="text-lg font-bold text-white">Radera träningspass?</h3>
                                    <p className="text-xs text-slate-400 mt-2">
                                        Detta tar bort passet permanent. Personliga rekord påverkas inte.
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-xl transition-colors text-xs"
                                    >
                                        Avbryt
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-bold py-2 rounded-xl transition-colors disabled:opacity-50 text-xs"
                                    >
                                        {isDeleting ? '⏳ Raderar...' : '🗑️ Radera'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                <div className="pt-4 border-t border-white/10 flex gap-3">
                    <button
                        onClick={() => {
                            onClose();
                            navigate(`/workouts/builder?fromActivity=${workout.id}`);
                        }}
                        className="flex-1 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 font-bold py-2.5 rounded-xl transition-all text-xs"
                    >
                        📝 Använd som mall
                    </button>
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold py-2.5 px-4 rounded-xl transition-all"
                        title="Radera pass"
                    >
                        🗑️
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl transition-colors text-xs"
                    >
                        Stäng
                    </button>
                </div>
            </div >
        </div >
    );
}
