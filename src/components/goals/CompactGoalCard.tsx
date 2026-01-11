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
    const percentage = (progress?.percentage && !isNaN(progress.percentage))
        ? Math.min(100, Math.max(0, progress.percentage))
        : 0;

    // Helper to format values compactly
    const formatValue = (val: number, unit?: string) => {
        if (val >= 1000 && unit !== 'kcal') return `${(val / 1000).toFixed(1)}k`;
        return val.toString();
    };

    const friendlyTargetText = (() => {
        const t = goal.targets[0];
        if (goal.type === 'weight') {
            if (goal.targetWeight === undefined) return 'Mål: Stabil vikt';
            const isLoss = (progress?.current || 0) > goal.targetWeight;
            return isLoss ? `Gå ner till ${goal.targetWeight} kg` : `Gå upp till ${goal.targetWeight} kg`;
        }
        if (goal.type === 'frequency') {
            const periodText = goal.period === 'weekly' ? 'i veckan' : 'totalt';
            return `Träna ${t.count} gånger ${periodText}`;
        }
        if (goal.type === 'streak') return `Håll i ${t.count} dagars streak`;
        if (!t) return 'Mål';
        return `Mål: ${formatValue(t.value || 0)} ${t.unit}`;
    })();

    const friendlyProgressText = (() => {
        if (goal.type === 'weight') {
            return `Just nu: ${progress?.current.toFixed(1)} kg`;
        }
        if (goal.type === 'frequency') {
            // "2 av 4 pass avklarade"
            return `${progress?.current} av ${goal.targets[0]?.count} pass klara`;
        }
        if (goal.type === 'streak') {
            return `${progress?.current} dagar i rad`;
        }
        // Generic: "45 / 100 km"
        return `${formatValue(Math.round(progress?.current || 0))} / ${formatValue(goal.targets[0]?.value || 0)} ${goal.targets[0]?.unit}`;
    })();

    return (
        <div
            onClick={onClick}
            className="group relative bg-[#1e1e24] border border-white/5 rounded-xl p-4 transition-all cursor-pointer flex items-center gap-4 hover:border-white/10 hover:bg-[#232329]"
        >
            {/* Progress Bar Background (Integrated at bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                />
            </div>

            {/* Icon */}
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm"
                style={{ backgroundColor: `${color}15`, color: color }}
            >
                {TYPE_ICONS[goal.type] || '🎯'}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-start">
                    <h4 className="font-bold text-white text-base truncate pr-8">{goal.name}</h4>
                    {/* Delete X Button - Always visible but subtle */}
                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(goal.id); }}
                            className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors"
                            title="Ta bort mål"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="flex flex-col gap-0.5 mt-1">
                    <span className="text-xs text-slate-400 font-medium">{friendlyTargetText}</span>
                    <span className={`text-xs font-bold ${percentage >= 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {friendlyProgressText}
                    </span>
                </div>
            </div>

            {/* Percentage Badge (if meaningful space allows, maybe keep it clean) */}
            {/* Keeping it clean as requested "less ugly boxes" */}
        </div>
    );
};
