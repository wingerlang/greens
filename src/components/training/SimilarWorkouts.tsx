/**
 * Similar Workouts Component
 * Shows historical workouts that match the current workout's exercise pattern.
 */
import React, { useMemo, useState } from 'react';
import { StrengthWorkout } from '../../models/strengthTypes.ts';
import { formatDateShort } from '../../utils/formatters.ts';

interface SimilarWorkoutsProps {
    currentWorkout: StrengthWorkout;
    allWorkouts: StrengthWorkout[];
    onSelectWorkout?: (workout: StrengthWorkout) => void;
}

interface SimilarMatch {
    workout: StrengthWorkout;
    overlapCount: number;
    overlapPercent: number;
    volumeDiff: number;  // positive = current is higher
}

export function SimilarWorkouts({ currentWorkout, allWorkouts, onSelectWorkout }: SimilarWorkoutsProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const similarWorkouts = useMemo(() => {
        // Get exercise names from current workout
        const currentExercises = new Set(
            currentWorkout.exercises.map(e => e.exerciseName.toLowerCase())
        );

        if (currentExercises.size === 0) return [];

        const matches: SimilarMatch[] = [];

        for (const workout of allWorkouts) {
            // Skip the current workout itself
            if (workout.id === currentWorkout.id) continue;

            // Limit to last 6 months
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (new Date(workout.date) < sixMonthsAgo) continue;

            // Calculate exercise overlap
            const workoutExercises = new Set(
                workout.exercises.map(e => e.exerciseName.toLowerCase())
            );

            let overlapCount = 0;
            for (const ex of currentExercises) {
                if (workoutExercises.has(ex)) overlapCount++;
            }

            // Require at least 50% overlap
            const overlapPercent = (overlapCount / currentExercises.size) * 100;
            if (overlapPercent < 50) continue;

            // Calculate volume difference
            const volumeDiff = currentWorkout.totalVolume - workout.totalVolume;

            matches.push({
                workout,
                overlapCount,
                overlapPercent,
                volumeDiff
            });
        }

        // Sort by overlap (highest first), then by date (most recent first)
        return matches
            .sort((a, b) => {
                if (b.overlapPercent !== a.overlapPercent) {
                    return b.overlapPercent - a.overlapPercent;
                }
                return b.workout.date.localeCompare(a.workout.date);
            })
            .slice(0, 5); // Max 5 similar workouts
    }, [currentWorkout, allWorkouts]);

    if (similarWorkouts.length === 0) return null;

    const displayedWorkouts = isExpanded ? similarWorkouts : similarWorkouts.slice(0, 2);

    return (
        <div className="mt-6 pt-4 border-t border-white/10">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between w-full text-left mb-3"
            >
                <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                        Liknande pass ({similarWorkouts.length})
                    </h3>
                </div>
                <span className="text-slate-500 text-xs">
                    {isExpanded ? '▲ Minimera' : '▼ Visa fler'}
                </span>
            </button>

            <div className="space-y-2">
                {displayedWorkouts.map(match => {
                    const isVolumeUp = match.volumeDiff > 0;
                    const volumeDiffPercent = match.workout.totalVolume > 0
                        ? Math.round((match.volumeDiff / match.workout.totalVolume) * 100)
                        : 0;

                    return (
                        <div
                            key={match.workout.id}
                            onClick={() => onSelectWorkout?.(match.workout)}
                            className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-medium text-sm">
                                        {match.workout.name || 'Styrkepass'}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 bg-sky-500/20 text-sky-400 rounded font-bold">
                                        {Math.round(match.overlapPercent)}% match
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {formatDateShort(match.workout.date)} • {match.overlapCount} gemensamma övningar
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-slate-300">
                                    {Math.round(match.workout.totalVolume / 1000)}t
                                </div>
                                {volumeDiffPercent !== 0 && (
                                    <div className={`text-[10px] font-bold ${isVolumeUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isVolumeUp ? '+' : ''}{volumeDiffPercent}% nu
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {!isExpanded && similarWorkouts.length > 2 && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-300 py-2 transition-colors"
                >
                    Visa {similarWorkouts.length - 2} fler...
                </button>
            )}
        </div>
    );
}
