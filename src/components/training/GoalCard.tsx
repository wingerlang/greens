import React from 'react';
import { PerformanceGoal, ExerciseType } from '../../models/types.ts';

const EXERCISE_ICONS: Record<ExerciseType, string> = {
    running: '🏃',
    cycling: '🚴',
    strength: '🏋️',
    walking: '🚶',
    swimming: '🏊',
    yoga: '🧘',
    other: '✨'
};

interface GoalCardProps {
    goal: PerformanceGoal;
    progress: { current: number; target: number; percentage: number };
    onEdit: () => void;
    onDelete: () => void;
}

export function GoalCard({ goal, progress, onEdit, onDelete }: GoalCardProps) {
    const primaryTarget = goal.targets[0];
    const icon = primaryTarget?.exerciseType ? EXERCISE_ICONS[primaryTarget.exerciseType] : '🎯';
    const isComplete = progress.percentage >= 100;

    return (
        <div className={`relative p-4 rounded-2xl border transition-all ${isComplete
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-slate-900/50 border-white/5 hover:border-white/10'
            }`}>
            {/* Status Indicator */}
            {isComplete && (
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-xs font-black text-slate-950">✓</span>
                </div>
            )}

            <div className="flex items-start gap-3">
                <div className="text-2xl">{icon}</div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white truncate">{goal.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-[8px] font-bold text-slate-500 uppercase">
                            {goal.period === 'weekly' ? '/vecka' : '/dag'}
                        </span>
                    </div>

                    {/* Target Description */}
                    <div className="text-[10px] text-slate-400 mb-2">
                        {goal.targets.map((t, i) => (
                            <span key={i}>
                                {i > 0 && ' + '}
                                {t.count && `${t.count}x `}
                                {t.exerciseType && (EXERCISE_ICONS[t.exerciseType] || t.exerciseType)}
                                {t.value && ` ${t.value}${t.unit || ''}`}
                            </span>
                        ))}
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-sky-500 to-emerald-500'
                                }`}
                            style={{ width: `${(progress.percentage && !isNaN(progress.percentage)) ? Math.min(100, progress.percentage) : 0}%` }}
                        />
                    </div>

                    {/* Progress Text */}
                    <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-500">
                            {progress.current} / {progress.target}
                        </span>
                        <span className={`text-[10px] font-bold ${isComplete ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {(progress.percentage && !isNaN(progress.percentage)) ? Math.round(progress.percentage) : 0}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                <button
                    onClick={onEdit}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 uppercase transition-all"
                >
                    Ändra
                </button>
                <button
                    onClick={onDelete}
                    className="px-3 py-1.5 rounded-lg hover:bg-rose-500/10 text-[10px] font-bold text-rose-400 uppercase transition-all"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
