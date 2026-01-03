import React from 'react';
import { PerformanceGoal, PerformanceGoalType, GoalPeriod } from '../../models/types';
import { useGoalProgress } from '../../hooks/useGoalProgress';

interface CompactGoalCardProps {
    goal: PerformanceGoal;
    onEdit?: (goal: PerformanceGoal) => void;
    onDelete?: (id: string) => void;
    onClick?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
    training: '#10b981', // Emerald
    nutrition: '#f59e0b', // Amber
    body: '#3b82f6', // Blue
    lifestyle: '#8b5cf6', // Violet
};

const TYPE_ICONS: Record<string, string> = {
    frequency: '🔢',
    distance: '📏',
    tonnage: '🏋️',
    calories: '🔥',
    streak: '🔥',
    milestone: '🏆',
    weight: '⚖️',
    measurement: '📐',
    nutrition: '🥗',
};

export const CompactGoalCard: React.FC<CompactGoalCardProps> = ({ goal, onEdit, onDelete, onClick }) => {
    const progress = useGoalProgress(goal);
    const color = CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.training;
    const percentage = Math.min(100, Math.max(0, progress?.percentage || 0));

    // Helper to format values compactly
    const formatValue = (val: number, unit?: string) => {
        if (val >= 1000 && unit !== 'kcal') return `${(val / 1000).toFixed(1)}k`;
        return val.toString();
    };

    const targetText = (() => {
        const t = goal.targets[0];
        if (goal.type === 'weight') return `${goal.targetWeight} kg`;
        if (!t) return '';
        if (goal.type === 'frequency') return `${t.count}x/${goal.period === 'weekly' ? 'v' : 'p'}`;
        return `${formatValue(t.value || 0)} ${t.unit}`;
    })();

    const progressText = (() => {
        if (goal.type === 'weight') return `${progress?.current.toFixed(1)} kg`;
        return formatValue(Math.round(progress?.current || 0));
    })();

    return (
        <div
            onClick={onClick}
            className="group relative bg-[#1e1e24] hover:bg-[#25252b] border border-white/5 rounded-lg p-3 transition-all cursor-pointer flex items-center gap-3 overflow-hidden"
        >
            {/* Progress Bar Background */}
            <div
                className="absolute bottom-0 left-0 h-0.5 bg-white/10 w-full"
            >
                <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                />
            </div>

            {/* Icon */}
            <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-lg shrink-0"
                style={{ backgroundColor: `${color}15`, color: color }}
            >
                {TYPE_ICONS[goal.type] || '🎯'}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <h4 className="font-bold text-white text-sm truncate pr-2">{goal.name}</h4>
                    <span className="text-[10px] font-mono text-white/50 shrink-0">
                        {progressText} / {targetText}
                    </span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[10px] text-white/40 uppercase tracking-wide truncate">
                        {goal.period === 'once' ? 'Slutmål' : goal.period}
                    </span>
                    {percentage >= 100 && (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                            Klart <span className="text-xs">✓</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Hover Actions (Desktop) */}
            <div className="hidden group-hover:flex items-center gap-1 absolute right-2 bg-[#25252b] pl-2 shadow-[-10px_0_10px_-5px_rgba(37,37,43,1)]">
                {onEdit && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(goal); }}
                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded"
                    >
                        ✏️
                    </button>
                )}
            </div>
        </div>
    );
};
