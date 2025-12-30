import React, { useMemo, useState } from 'react';
import { StrengthWorkout, StrengthWorkoutExercise, normalizeExerciseName } from '../../models/strengthTypes.ts';
import { MUSCLE_MAP } from '../../data/muscleMap.ts';

interface MuscleVolumeData {
    muscle: string;
    currentWeek: number;
    avg4Week: number;
    trend: 'up' | 'down' | 'stable';
    color: string;
}

interface MuscleVolumeChartProps {
    workouts: StrengthWorkout[];
}

// Muscle group colors for visualization
const MUSCLE_COLORS: Record<string, string> = {
    'Chest': 'bg-rose-500',
    'Back': 'bg-blue-500',
    'Shoulders': 'bg-amber-500',
    'Biceps': 'bg-purple-500',
    'Triceps': 'bg-indigo-500',
    'Quads': 'bg-emerald-500',
    'Hamstrings': 'bg-teal-500',
    'Glutes': 'bg-pink-500',
    'Core': 'bg-orange-500',
    'Abs': 'bg-yellow-500',
    'Lats': 'bg-cyan-500',
    'Traps': 'bg-lime-500',
    'Calves': 'bg-violet-500',
    'Forearms': 'bg-fuchsia-500',
    'Full Body': 'bg-gradient-to-r from-blue-500 to-purple-500',
    'Cardio': 'bg-red-500',
    'Posterior Chain': 'bg-slate-500'
};

// Map exercise name to primary muscle
function getExerciseMuscle(exerciseName: string): string {
    const normalized = exerciseName.toLowerCase().trim();

    // Check MUSCLE_MAP first
    for (const [key, value] of Object.entries(MUSCLE_MAP)) {
        if (normalizeExerciseName(key) === normalizeExerciseName(exerciseName)) {
            return value.primary;
        }
    }

    // Fallback heuristics
    if (normalized.includes('bench') || normalized.includes('push up') || normalized.includes('push-up') || normalized.includes('chest')) return 'Chest';
    if (normalized.includes('row') || normalized.includes('pull up') || normalized.includes('pull-up') || normalized.includes('lat')) return 'Back';
    if (normalized.includes('squat') || normalized.includes('leg press') || normalized.includes('lunge')) return 'Quads';
    if (normalized.includes('deadlift') || normalized.includes('rdl') || normalized.includes('romanian')) return 'Posterior Chain';
    if (normalized.includes('curl') && normalized.includes('hammer')) return 'Biceps';
    if (normalized.includes('curl')) return 'Biceps';
    if (normalized.includes('tricep') || normalized.includes('extension') || normalized.includes('dip')) return 'Triceps';
    if (normalized.includes('shoulder') || normalized.includes('press') || normalized.includes('raise')) return 'Shoulders';
    if (normalized.includes('shrug') || normalized.includes('trap')) return 'Traps';
    if (normalized.includes('crunch') || normalized.includes('plank') || normalized.includes('ab')) return 'Core';
    if (normalized.includes('calf') || normalized.includes('calves')) return 'Calves';
    if (normalized.includes('glute') || normalized.includes('hip thrust')) return 'Glutes';
    if (normalized.includes('hamstring') || normalized.includes('leg curl')) return 'Hamstrings';

    return 'Other';
}

export function MuscleVolumeChart({ workouts }: MuscleVolumeChartProps) {
    const [showAll, setShowAll] = useState(false);

    const muscleData = useMemo(() => {
        if (workouts.length === 0) return [];

        const now = new Date();
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        const fourWeeksAgo = new Date(now);
        fourWeeksAgo.setDate(now.getDate() - 28);

        const currentWeekVolume: Record<string, number> = {};
        const last4WeeksVolume: Record<string, number> = {};

        workouts.forEach(w => {
            const workoutDate = new Date(w.date);

            w.exercises.forEach((ex: StrengthWorkoutExercise) => {
                const muscle = getExerciseMuscle(ex.exerciseName);
                const volume = ex.totalVolume || 0;

                if (workoutDate >= oneWeekAgo) {
                    currentWeekVolume[muscle] = (currentWeekVolume[muscle] || 0) + volume;
                }
                if (workoutDate >= fourWeeksAgo) {
                    last4WeeksVolume[muscle] = (last4WeeksVolume[muscle] || 0) + volume;
                }
            });
        });

        // Calculate averages and trends
        const muscles = new Set([...Object.keys(currentWeekVolume), ...Object.keys(last4WeeksVolume)]);
        const result: MuscleVolumeData[] = [];

        muscles.forEach(muscle => {
            if (muscle === 'Other') return;

            const current = currentWeekVolume[muscle] || 0;
            const avg4 = (last4WeeksVolume[muscle] || 0) / 4;

            let trend: 'up' | 'down' | 'stable' = 'stable';
            if (current > avg4 * 1.1) trend = 'up';
            else if (current < avg4 * 0.9) trend = 'down';

            result.push({
                muscle,
                currentWeek: current,
                avg4Week: avg4,
                trend,
                color: MUSCLE_COLORS[muscle] || 'bg-slate-500'
            });
        });

        return result.sort((a, b) => b.currentWeek - a.currentWeek);
    }, [workouts]);

    if (muscleData.length === 0) {
        return (
            <div className="text-center text-slate-500 py-8">
                <p className="text-2xl mb-2">📊</p>
                <p className="text-sm">Inte nog med data för muskelanalys.</p>
            </div>
        );
    }

    const maxVolume = Math.max(...muscleData.map(d => Math.max(d.currentWeek, d.avg4Week)), 1);
    const displayData = showAll ? muscleData : muscleData.slice(0, 6);

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                {displayData.map(({ muscle, currentWeek, avg4Week, trend, color }) => {
                    const currentPct = (currentWeek / maxVolume) * 100;
                    const avgPct = (avg4Week / maxVolume) * 100;

                    return (
                        <div key={muscle} className="group">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${color}`} />
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">{muscle}</span>
                                    {trend === 'up' && <span className="text-[10px] text-emerald-400">↑</span>}
                                    {trend === 'down' && <span className="text-[10px] text-rose-400">↓</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-slate-400">
                                        {(currentWeek / 1000).toFixed(1)}t
                                    </span>
                                    <span className="text-[10px] text-slate-600">
                                        (snitt: {(avg4Week / 1000).toFixed(1)}t)
                                    </span>
                                </div>
                            </div>
                            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                                {/* Average line marker */}
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-blue-400/50 z-10"
                                    style={{ left: `${avgPct}%` }}
                                />
                                {/* Current week bar */}
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                                    style={{ width: `${currentPct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {muscleData.length > 6 && (
                <button
                    onClick={() => setShowAll(!showAll)}
                    className="w-full text-[10px] text-slate-500 hover:text-slate-400 font-bold uppercase tracking-wider py-2 border-t border-white/5"
                >
                    {showAll ? '↑ Visa färre' : `↓ Visa alla (${muscleData.length})`}
                </button>
            )}

            <div className="flex items-center justify-between text-[9px] text-slate-600 pt-2 border-t border-white/5">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-1.5 rounded bg-slate-600" />
                        Denna vecka
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-0.5 h-3 bg-blue-400/50" />
                        Snitt (4v)
                    </span>
                </div>
            </div>
        </div>
    );
}
