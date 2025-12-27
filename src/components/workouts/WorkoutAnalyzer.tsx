import React, { useMemo } from 'react';
import { WorkoutDefinition } from '../../models/workout.ts';
import { MUSCLE_MAP } from '../../data/muscleMap.ts';

interface Props {
    workout: WorkoutDefinition;
}

export function WorkoutAnalyzer({ workout }: Props) {

    // ANALYZE: Muscles
    const muscleStats = useMemo(() => {
        const stats: Record<string, number> = {};
        let totalExercises = 0;

        workout.exercises?.forEach(section => {
            section.exercises.forEach(ex => {
                totalExercises++;
                // Find mapping
                // Try exact match or partial match
                let map = MUSCLE_MAP[ex.name];
                if (!map) {
                    // Try to find partial match
                    const key = Object.keys(MUSCLE_MAP).find(k => ex.name.includes(k));
                    if (key) map = MUSCLE_MAP[key];
                }

                if (map) {
                    stats[map.primary] = (stats[map.primary] || 0) + 1;
                    map.secondary.forEach(m => {
                        stats[m] = (stats[m] || 0) + 0.5;
                    });
                }
            });
        });

        // Convert to array
        return Object.entries(stats)
            .sort((a, b) => b[1] - a[1]) // Sort by count
            .map(([muscle, score]) => ({ muscle, score, pct: (score / totalExercises) * 100 }));
    }, [workout]);

    // ANALYZE: Coach Tips
    const coachTips = useMemo(() => {
        const tips: string[] = [];

        const hasWarmup = workout.exercises?.some(s => s.title.toLowerCase().includes('warm') || s.title.toLowerCase().includes('uppvärmning'));
        if (!hasWarmup) tips.push("⚠️ Missing Warmup: Consider adding a 5-10 min warmup section.");

        const pushes = (muscleStats.find(s => s.muscle === 'Chest')?.score || 0) + (muscleStats.find(s => s.muscle === 'Shoulders')?.score || 0) + (muscleStats.find(s => s.muscle === 'Quads')?.score || 0);
        const pulls = (muscleStats.find(s => s.muscle === 'Back')?.score || 0) + (muscleStats.find(s => s.muscle === 'Hamstrings')?.score || 0);

        if (pushes > pulls + 2) tips.push("ℹ️ Push Dominant: Consider adding more pulling movements (Rows, Pullups, RDLs) for balance.");
        if (pulls > pushes + 2) tips.push("ℹ️ Pull Dominant: A heavy pulling session detected.");

        if (workout.durationMin > 90) tips.push("⏱️ Long Session: Ensure you have intra-workout nutrition for sessions over 90 mins.");

        return tips;
    }, [workout, muscleStats]);

    return (
        <div className="space-y-6 p-4">

            {/* HEATMAP REPLACEMENT: BARS */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-widest">Target Zones</h4>

                {muscleStats.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic text-center py-4">Add exercises to see analysis</div>
                ) : (
                    <div className="space-y-3">
                        {muscleStats.slice(0, 6).map(stat => (
                            <div key={stat.muscle} className="space-y-1">
                                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                                    <span>{stat.muscle}</span>
                                    <span>{stat.score.toFixed(1)} pts</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                        style={{ width: `${Math.min(100, (stat.score / 5) * 100)}%` }} // Normalized to ~5 exercises
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* COACH TIPS */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                <h4 className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-widest">Coach AI Insights</h4>
                {coachTips.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic">Looking good! No specific warnings.</div>
                ) : (
                    <ul className="space-y-2 text-xs text-slate-300">
                        {coachTips.map((tip, i) => (
                            <li key={i}>{tip}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
