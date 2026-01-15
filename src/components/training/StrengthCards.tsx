/**
 * Reusable components extracted from StrengthPage for better modularity and testability.
 */
import React from 'react';
import { StrengthWorkout, PersonalBest } from '../../models/strengthTypes.ts';
import { WorkoutCategoryBadge } from './WorkoutCategoryBadge.tsx';
import { classifyWorkout } from '../../utils/workoutClassifier.ts';

// ============================================
// Stat Card
// ============================================

interface StatCardProps {
    label: string;
    value: string | number;
}

export function StatCard({ label, value }: StatCardProps) {
    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-xs text-slate-500 uppercase">{label}</p>
        </div>
    );
}

// ============================================
// Workout Card
// ============================================

interface WorkoutCardProps {
    workout: StrengthWorkout;
    isAnnualBest?: boolean;
    isPR?: boolean;
    onClick: () => void;
}

export function WorkoutCard({ workout, isAnnualBest, isPR, onClick }: WorkoutCardProps) {
    const topExercises = workout.exercises.slice(0, 3).map(e => e.exerciseName).join(', ');
    const category = workout.workoutCategory || classifyWorkout(workout);

    return (
        <div
            className={`bg-slate-900/50 border transition-all cursor-pointer relative overflow-hidden rounded-xl p-4 ${isPR
                ? 'border-amber-500/40 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                : isAnnualBest
                    ? 'border-yellow-500/20 bg-yellow-500/5'
                    : 'border-white/5 hover:bg-slate-800/50'
                }`}
            onClick={onClick}
        >
            {isPR && (
                <div className="absolute -right-6 -top-6 w-16 h-16 bg-amber-500/20 blur-2xl rounded-full pointer-events-none"></div>
            )}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    {/* Category Badge */}
                    <WorkoutCategoryBadge category={category} size="sm" showLabel={true} />
                    {isPR && (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-[10px] uppercase tracking-wider bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30">
                            ⭐ All-Time PR
                        </span>
                    )}
                    {isAnnualBest && (
                        <span className="inline-flex items-center gap-1 text-yellow-400 font-bold text-[10px] uppercase tracking-wider bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
                            🏆 Årsbästa
                        </span>
                    )}
                    <div>
                        <p className="text-white font-bold">{workout.name}</p>
                        <p className="text-xs text-slate-500">{workout.date} • {workout.uniqueExercises} övningar • {workout.totalSets} set</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-emerald-400 font-bold">{Math.round(workout.totalVolume / 1000)}t volym</p>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{topExercises}</p>
                </div>
            </div>
        </div>
    );
}

// ============================================
// Record Trend Line
// ============================================

interface RecordTrendLineProps {
    pbs: PersonalBest[];
}

export function RecordTrendLine({ pbs }: RecordTrendLineProps) {
    if (pbs.length < 2) return null;

    const sortedPbs = [...pbs].sort((a, b) => a.date.localeCompare(b.date));
    const exerciseBests: Record<string, number> = {};
    const timelineSlots: { date: string; value: number }[] = [];
    const dates = Array.from(new Set(sortedPbs.map(p => p.date))).sort();

    dates.forEach(date => {
        sortedPbs.filter(p => p.date === date).forEach(p => {
            exerciseBests[p.exerciseName] = p.value;
        });
        const currentSum = Object.values(exerciseBests).reduce((a, b) => a + b, 0);
        timelineSlots.push({ date, value: currentSum });
    });

    const displaySlots = timelineSlots.slice(-40);
    const maxVal = Math.max(...displaySlots.map(s => s.value), 1);
    const minVal = Math.min(...displaySlots.map(s => s.value), 0);
    const valRange = (maxVal - minVal) || 1;

    const width = 1000;
    const height = 100;
    const padding = 10;

    const points = displaySlots.map((s, i) => {
        const x = (i / (displaySlots.length - 1)) * width;
        const y = height - ((s.value - minVal) / valRange) * (height - padding * 2) - padding;
        return `${x},${y}`;
    }).join(' ');

    const lastSlot = displaySlots[displaySlots.length - 1];
    const firstSlot = displaySlots[0];

    return (
        <div className="relative w-full h-full flex items-center pr-12">
            {/* Y-Axis Labels */}
            <div className="absolute -left-2 top-0 bottom-0 flex flex-col justify-between text-[8px] text-slate-600 font-mono z-10 py-1">
                <span className="opacity-80 font-bold">{Math.round(maxVal)}</span>
                <span className="opacity-40">{Math.round(minVal)}</span>
            </div>

            <div className="w-full h-full relative group/chart">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="trendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgba(245, 158, 11, 0)" />
                            <stop offset="20%" stopColor="rgba(245, 158, 11, 0.5)" />
                            <stop offset="100%" stopColor="rgba(245, 158, 11, 1)" />
                        </linearGradient>
                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(245, 158, 11, 0.1)" />
                            <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
                        </linearGradient>
                    </defs>

                    {/* Area under curve */}
                    <path
                        d={`M 0,${height} ${points} L ${width},${height} Z`}
                        fill="url(#areaGradient)"
                    />

                    {/* Grid line at current value */}
                    <line
                        x1="0" y1={height - ((lastSlot.value - minVal) / valRange) * (height - padding * 2) - padding}
                        x2={width} y2={height - ((lastSlot.value - minVal) / valRange) * (height - padding * 2) - padding}
                        stroke="rgba(245,158,11,0.1)"
                        strokeDasharray="4 4"
                    />

                    <polyline
                        fill="none"
                        stroke="url(#trendGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                    />

                    {/* End point dot */}
                    <circle
                        cx={width}
                        cy={height - ((lastSlot.value - minVal) / valRange) * (height - padding * 2) - padding}
                        r="4"
                        fill="#f59e0b"
                        className="animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"
                    />
                </svg>

                {/* X-Axis Labels */}
                <div className="absolute -bottom-1 left-0 right-0 flex justify-between text-[7px] text-slate-700 font-mono uppercase tracking-tighter">
                    <span>{firstSlot.date}</span>
                    <span>{lastSlot.date}</span>
                </div>
            </div>

            {/* Current Value Pill */}
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-amber-500 text-slate-950 px-2 py-1 rounded-lg text-[10px] font-black shadow-[0_0_15px_rgba(245,158,11,0.4)] border border-amber-400">
                {Math.round(lastSlot.value)}
            </div>
        </div>
    );
}
