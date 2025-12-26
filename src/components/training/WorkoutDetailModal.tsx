import React, { useMemo, useEffect } from 'react';
import { StrengthWorkout, StrengthWorkoutExercise, PersonalBest, calculate1RM } from '../../models/strengthTypes.ts';

interface WorkoutDetailModalProps {
    workout: StrengthWorkout;
    onClose: () => void;
    onSelectExercise?: (name: string) => void;
    pbs?: PersonalBest[];
}

export function WorkoutDetailModal({ workout, onClose, onSelectExercise, pbs = [] }: WorkoutDetailModalProps) {
    // ESC key to close
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

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

                {/* Exercises List */}
                <div className="space-y-4">
                    {uniqueExercises.map((exercise, idx) => (
                        <div key={idx} className="bg-slate-800/30 rounded-2xl p-4 border border-white/5">
                            <div className="flex justify-between items-start mb-3">
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
                                    <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2 py-1 rounded uppercase border border-amber-500/20">
                                        Nytt PB! 🏆
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {exercise.sets.map((set, sIdx) => {
                                    const isBW = set.isBodyweight || set.weight === 0;
                                    const weightDisplay = isBW ? (set.extraWeight ? `+${set.extraWeight}kg` : 'KV') : `${set.weight}kg`;

                                    // Calculate 1RM estimate
                                    const calcWeight = isBW ? (set.extraWeight || 0) : set.weight;
                                    const est1RM = calculate1RM(calcWeight, set.reps);

                                    return (
                                        <div key={sIdx} className="bg-slate-900/50 rounded-lg p-2 flex justify-between items-center text-sm border border-white/5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-600 font-mono text-xs w-4">#{set.setNumber || sIdx + 1}</span>
                                                <span className="font-bold text-white">{weightDisplay}</span>
                                                <span className="text-slate-400">× {set.reps}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-600 font-mono">
                                                1RM: {Math.round(est1RM)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="pt-4 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors"
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
