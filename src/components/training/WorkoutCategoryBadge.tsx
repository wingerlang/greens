/**
 * Workout Category Badge Component
 * Displays a minimal text badge for workout categories (Push/Pull/Legs/Mixed)
 */

import React from 'react';
import { type WorkoutCategory } from '../../models/strengthTypes.ts';
import { WORKOUT_CATEGORY_INFO } from '../../utils/workoutClassifier.ts';

interface WorkoutCategoryBadgeProps {
    category: WorkoutCategory;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

// Minimal text-only colors for clean badges
const BADGE_STYLES: Record<WorkoutCategory, { text: string; border: string; bg: string }> = {
    push: { text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
    pull: { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
    legs: { text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
    mixed: { text: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10' },
    other: { text: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-500/10' }
};

// Short uppercase labels
const BADGE_LABELS: Record<WorkoutCategory, string> = {
    push: 'PUSH',
    pull: 'PULL',
    legs: 'BEN',
    mixed: 'MIX',
    other: 'ÖVR'
};

export function WorkoutCategoryBadge({
    category,
    size = 'sm',
    showLabel = true,
    className = ''
}: WorkoutCategoryBadgeProps) {
    const style = BADGE_STYLES[category];
    const label = BADGE_LABELS[category];

    const sizeClasses = {
        sm: 'text-[8px] px-1.5 py-0.5',
        md: 'text-[9px] px-2 py-0.5',
        lg: 'text-[10px] px-2.5 py-1'
    };

    return (
        <span
            className={`
                inline-flex items-center rounded border font-black uppercase tracking-wider
                ${style.text} ${style.border} ${style.bg}
                ${sizeClasses[size]}
                ${className}
            `}
            title={`${category} workout`}
        >
            {label}
        </span>
    );
}


interface CategoryFilterProps {
    selectedCategory: WorkoutCategory | 'all';
    onChange: (category: WorkoutCategory | 'all') => void;
    stats?: Record<WorkoutCategory, number>;
    className?: string;
}

const FILTER_ORDER: (WorkoutCategory | 'all')[] = ['all', 'push', 'pull', 'legs', 'mixed', 'other'];

export function WorkoutCategoryFilter({
    selectedCategory,
    onChange,
    stats,
    className = ''
}: CategoryFilterProps) {
    return (
        <div className={`flex flex-wrap gap-1.5 ${className}`}>
            {FILTER_ORDER.map(cat => {
                const isAll = cat === 'all';
                const info = isAll ? null : WORKOUT_CATEGORY_INFO[cat];
                const count = isAll
                    ? (stats ? Object.values(stats).reduce((a, b) => a + b, 0) : undefined)
                    : stats?.[cat];
                const isActive = selectedCategory === cat;

                return (
                    <button
                        key={cat}
                        onClick={() => onChange(cat)}
                        className={`
                            px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all
                            ${isActive
                                ? (info ? `${info.color} ${info.bgColor} ring-1 ring-white/20` : 'text-white bg-slate-700 ring-1 ring-white/20')
                                : 'text-slate-500 bg-slate-800/50 hover:bg-slate-800 hover:text-slate-300'
                            }
                        `}
                    >
                        {info && <span className="mr-1">{info.icon}</span>}
                        {isAll ? 'Alla' : info?.labelSe}
                        {count !== undefined && count > 0 && (
                            <span className="ml-1 text-[8px] opacity-70">({count})</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
