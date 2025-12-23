import React from 'react';

interface MacroSummaryProps {
    nutrition: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
    };
    goals: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        isAdapted?: boolean;
    };
    viewMode: 'normal' | 'compact';
}

export function MacroSummary({ nutrition, goals, viewMode }: MacroSummaryProps) {
    if (viewMode === 'compact') {
        return (
            <div className={`flex items-center justify-between gap-4 p-3 mb-4 bg-slate-800/50 border rounded-xl ${goals.isAdapted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700'}`}>
                <div className="flex items-center gap-4">
                    <span className={`text-2xl font-bold ${goals.isAdapted ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {nutrition.calories}
                        {goals.isAdapted && <span className="text-xs ml-1">⚡</span>}
                    </span>
                    <span className="text-sm text-slate-400">kcal</span>
                    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${goals.isAdapted ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min((nutrition.calories / goals.calories) * 100, 100)}%` }}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <span className="text-violet-400">{nutrition.protein}g P</span>
                    <span className="text-amber-400">{nutrition.carbs}g K</span>
                </div>
            </div>
        );
    }

    return (
        <div className="daily-summary">
            <div className={`summary-card calories-card ${goals.isAdapted ? 'adapted-glow' : ''}`}>
                <div className="summary-main">
                    <span className="summary-value">
                        {nutrition.calories}
                        {goals.isAdapted && <small className="text-emerald-400 ml-1">⚡</small>}
                    </span>
                    <span className="summary-label">kalorier</span>
                </div>
                <div className="progress-bar">
                    <div
                        className={`progress-fill ${goals.isAdapted ? 'bg-emerald-400' : ''}`}
                        style={{ width: `${Math.min((nutrition.calories / goals.calories) * 100, 100)}%` }}
                    />
                </div>
                <span className="goal-text">mål: {goals.calories} {goals.isAdapted && '(Boosted)'}</span>
            </div>
            <div className="macro-cards">
                <div className="macro-card protein">
                    <span className="macro-value">
                        {nutrition.protein}g
                        {goals.isAdapted && <span className="text-[10px] text-violet-400 ml-1">↑</span>}
                    </span>
                    <span className="macro-percent">{Math.round((nutrition.protein / goals.protein) * 100)}%</span>
                    <span className="macro-label">Protein</span>
                    <div className="macro-progress">
                        <div
                            className="macro-fill"
                            style={{ width: `${Math.min((nutrition.protein / goals.protein) * 100, 100)}%` }}
                        />
                    </div>
                </div>
                <div className="macro-card carbs">
                    <span className="macro-value">
                        {nutrition.carbs}g
                        {goals.isAdapted && <span className="text-[10px] text-amber-400 ml-1">↑</span>}
                    </span>
                    <span className="macro-percent">{Math.round((nutrition.carbs / goals.carbs) * 100)}%</span>
                    <span className="macro-label">Kolhydrater</span>
                    <div className="macro-progress">
                        <div
                            className="macro-fill"
                            style={{ width: `${Math.min((nutrition.carbs / goals.carbs) * 100, 100)}%` }}
                        />
                    </div>
                </div>
                <div className="macro-card fat">
                    <span className="macro-value">
                        {nutrition.fat}g
                        {goals.isAdapted && <span className="text-[10px] text-rose-400 ml-1">↑</span>}
                    </span>
                    <span className="macro-percent">{Math.round((nutrition.fat / goals.fat) * 100)}%</span>
                    <span className="macro-label">Fett</span>
                    <div className="macro-progress">
                        <div
                            className="macro-fill"
                            style={{ width: `${Math.min((nutrition.fat / goals.fat) * 100, 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
