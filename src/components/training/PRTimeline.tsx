import React, { useMemo } from 'react';
import { StrengthWorkout, StrengthSet, normalizeExerciseName, calculateEstimated1RM } from '../../models/strengthTypes.ts';

interface PRTimelineProps {
    workouts: StrengthWorkout[];
    exerciseName: string;
}

interface TimelineNode {
    id: string;
    date: string;
    value: number; // weight or e1rm
    reps: number;
    weight: number;
    workoutId: string;
    workoutName: string;
    isBodyweight: boolean;
    extraWeight?: number;

    // Stats leading up to this PB (since previous PB)
    gapStats?: {
        days: number;
        sessions: number;
        sets: number;
        reps: number;
        volume: number;
    };
}

export function PRTimeline({ workouts, exerciseName }: PRTimelineProps) {
    const normName = normalizeExerciseName(exerciseName);

    // 1. Extract all sessions for this exercise, sorted chronologically
    const sessions = useMemo(() => {
        const list: {
            date: string;
            workout: StrengthWorkout;
            sets: StrengthSet[];
            maxWeight: number;
            maxE1RM: number;
            maxE1RMSet: StrengthSet;
            maxWeightSet: StrengthSet;
        }[] = [];

        workouts.forEach(w => {
            const exerciseEntries = w.exercises.filter(e => normalizeExerciseName(e.exerciseName) === normName);
            if (exerciseEntries.length === 0) return;

            const allSets = exerciseEntries.flatMap(e => e.sets);
            if (allSets.length === 0) return;

            // Calculate session maxes
            let maxWeight = 0;
            let maxWeightSet = allSets[0];
            let maxE1RM = 0;
            let maxE1RMSet = allSets[0];

            allSets.forEach(s => {
                // Max Weight logic
                if (s.weight > maxWeight) {
                    maxWeight = s.weight;
                    maxWeightSet = s;
                }

                // Max e1RM logic
                const isBW = s.isBodyweight || s.weight === 0;
                const load = isBW ? (s.extraWeight || 0) : s.weight;
                const e1rm = calculateEstimated1RM(load, s.reps);
                if (e1rm > maxE1RM) {
                    maxE1RM = e1rm;
                    maxE1RMSet = s;
                }
            });

            list.push({
                date: w.date,
                workout: w,
                sets: allSets,
                maxWeight,
                maxE1RM,
                maxE1RMSet,
                maxWeightSet
            });
        });

        return list.sort((a, b) => a.date.localeCompare(b.date));
    }, [workouts, normName]);

    // 2. Generate Chains
    const { weightChain, e1rmChain } = useMemo(() => {
        const wChain: TimelineNode[] = [];
        const eChain: TimelineNode[] = [];

        let currentMaxWeight = 0;
        let currentMaxE1RM = 0;

        sessions.forEach((session, idx) => {
            // Check for Weight PB
            if (session.maxWeight > currentMaxWeight) {
                // Calculate gap stats from previous PB date (exclusive) to now (inclusive)
                const prevDate = wChain.length > 0 ? wChain[wChain.length - 1].date : null;
                const gapStats = calculateGapStats(sessions, prevDate, session.date);

                wChain.push({
                    id: `w-pb-${session.workout.id}`,
                    date: session.date,
                    value: session.maxWeight,
                    reps: session.maxWeightSet.reps,
                    weight: session.maxWeightSet.weight,
                    workoutId: session.workout.id,
                    workoutName: session.workout.name,
                    isBodyweight: !!session.maxWeightSet.isBodyweight,
                    extraWeight: session.maxWeightSet.extraWeight,
                    gapStats: prevDate ? gapStats : undefined
                });
                currentMaxWeight = session.maxWeight;
            }

            // Check for e1RM PB
            if (session.maxE1RM > currentMaxE1RM) {
                const prevDate = eChain.length > 0 ? eChain[eChain.length - 1].date : null;
                const gapStats = calculateGapStats(sessions, prevDate, session.date);

                eChain.push({
                    id: `e-pb-${session.workout.id}`,
                    date: session.date,
                    value: Math.round(session.maxE1RM),
                    reps: session.maxE1RMSet.reps,
                    weight: session.maxE1RMSet.weight,
                    workoutId: session.workout.id,
                    workoutName: session.workout.name,
                    isBodyweight: !!session.maxE1RMSet.isBodyweight,
                    extraWeight: session.maxE1RMSet.extraWeight,
                    gapStats: prevDate ? gapStats : undefined
                });
                currentMaxE1RM = session.maxE1RM;
            }
        });

        // Reverse to show newest first
        return {
            weightChain: wChain.reverse(),
            e1rmChain: eChain.reverse()
        };
    }, [sessions]);

    // Helper to calculate training volume between dates
    function calculateGapStats(
        allSessions: typeof sessions,
        startDate: string | null, // Exclusive
        endDate: string // Inclusive
    ) {
        let count = 0;
        let sets = 0;
        let reps = 0;
        let volume = 0;

        // Find range
        const startIndex = startDate
            ? allSessions.findIndex(s => s.date > startDate)
            : 0; // If no start date, count from beginning? Usually "gap" implies between two points.
                 // But for the first PB, there is no "gap stats" shown usually.
                 // However, the function is called with prevDate. If prevDate is null, we might not render gap stats.
                 // But if we wanted to show "Training leading to First PB", we could.
                 // Let's stick to: Gap is strictly BETWEEN PBs.

        // If startDate is provided, we filter strictly > startDate.
        // If startDate is null, we filter <= endDate (so everything up to first PB).

        const relevantSessions = allSessions.filter(s => {
            if (startDate && s.date <= startDate) return false;
            if (s.date > endDate) return false;
            return true;
        });

        relevantSessions.forEach(s => {
            count++;
            s.sets.forEach(set => {
                sets++;
                reps += set.reps;
                const load = (set.isBodyweight || set.weight === 0) ? (set.extraWeight || 0) : set.weight;
                volume += (load * set.reps);
            });
        });

        const days = startDate
            ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        return { sessions: count, sets, reps, volume, days };
    }

    const renderNode = (node: TimelineNode, type: 'weight' | 'e1rm', isLast: boolean) => (
        <div key={node.id} className="relative flex flex-col items-center">
            {/* The Node Card */}
            <div className={`z-10 w-full p-4 rounded-2xl border backdrop-blur-md shadow-xl transition-all hover:scale-[1.02] ${
                type === 'weight'
                    ? 'bg-slate-900/80 border-emerald-500/30 hover:border-emerald-500/60'
                    : 'bg-slate-900/80 border-amber-500/30 hover:border-amber-500/60'
            }`}>
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-mono text-slate-500">{node.date}</span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        type === 'weight' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                        {type === 'weight' ? 'TYNGST' : 'BÄST'}
                    </span>
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                    <span className={`text-3xl font-black ${
                        type === 'weight' ? 'text-white' : 'text-white'
                    }`}>
                        {node.value}
                        <span className="text-sm font-normal text-slate-500 ml-1">{type === 'weight' ? 'kg' : 'kg (e1rm)'}</span>
                    </span>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                    {node.reps} reps @ {node.weight}kg
                </div>

                <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-500 truncate">
                    {node.workoutName}
                </div>
            </div>

            {/* The Connector Line & Stats (Only if NOT last) */}
            {!isLast && node.gapStats && (
                <div className="flex flex-col items-center h-32 w-full relative">
                    {/* Vertical Line */}
                    <div className={`absolute top-0 bottom-0 w-0.5 ${
                         type === 'weight' ? 'bg-gradient-to-b from-emerald-500/30 to-emerald-500/10' : 'bg-gradient-to-b from-amber-500/30 to-amber-500/10'
                    }`} />

                    {/* Stats Badge */}
                    <div className="z-20 my-auto bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-center shadow-lg max-w-[90%]">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">
                            {node.gapStats.days} dagar mellan
                        </div>
                        <div className="flex gap-3 justify-center text-[10px] font-mono text-slate-300">
                            <span title="Pass">🏋️ {node.gapStats.sessions}</span>
                            <span title="Set">📊 {node.gapStats.sets}</span>
                            <span title="Volym">⚖️ {(node.gapStats.volume / 1000).toFixed(1)}t</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-12 py-12">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                    Timeline of Strength
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                    Vägen till toppen • Historik och träning mellan rekorden
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 relative">
                {/* Center Divider (Desktop) */}
                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />

                {/* Left Column: Weight */}
                <div className="space-y-4">
                    <div className="text-center mb-8 sticky top-0 bg-slate-950/95 py-4 z-30 backdrop-blur border-b border-white/5">
                        <h3 className="text-emerald-500 font-black uppercase tracking-widest text-sm">Tyngsta Lyft</h3>
                        <p className="text-[10px] text-slate-600 font-bold">Absolut vikt (kg)</p>
                    </div>

                    <div className="px-4 pb-20">
                        {weightChain.map((node, idx) => renderNode(node, 'weight', idx === weightChain.length - 1))}
                        {weightChain.length === 0 && <p className="text-center text-slate-600 text-xs">Inga vikt-rekord hittades.</p>}
                    </div>
                </div>

                {/* Right Column: e1RM */}
                <div className="space-y-4">
                    <div className="text-center mb-8 sticky top-0 bg-slate-950/95 py-4 z-30 backdrop-blur border-b border-white/5">
                        <h3 className="text-amber-500 font-black uppercase tracking-widest text-sm">Prestation (1eRM)</h3>
                        <p className="text-[10px] text-slate-600 font-bold">Estimerat Max (kg)</p>
                    </div>

                    <div className="px-4 pb-20">
                        {e1rmChain.map((node, idx) => renderNode(node, 'e1rm', idx === e1rmChain.length - 1))}
                        {e1rmChain.length === 0 && <p className="text-center text-slate-600 text-xs">Inga e1RM-rekord hittades.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
