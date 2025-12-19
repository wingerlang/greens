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
    };
    viewMode: 'normal' | 'compact';
}

export function MacroSummary({ nutrition, goals, viewMode }: MacroSummaryProps) {
    if (viewMode === 'compact') {
        return (
            <div className="flex items-center justify-between gap-4 p-3 mb-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-emerald-400">{nutrition.calories}</span>
                    <span className="text-sm text-slate-400">kcal</span>
                    <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min((nutrition.calories / goals.calories) * 100, 100)}%` }}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-violet-400">{nutrition.protein}g P</span>
                    <span className="text-amber-400">{nutrition.carbs}g K</span>
                    <span className="text-rose-400">{nutrition.fat}g F</span>
                </div>
            </div>
        );
    }

    return (
        <div className="daily-summary">
            <div className="summary-card calories-card">
                <div className="summary-main">
                    <span className="summary-value">{nutrition.calories}</span>
                    <span className="summary-label">kalorier</span>
                </div>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${Math.min((nutrition.calories / goals.calories) * 100, 100)}%` }}
                    />
                </div>
                <span className="goal-text">mål: {goals.calories}</span>
            </div>
            <div className="macro-cards">
                <div className="macro-card protein">
                    <span className="macro-value">{nutrition.protein}g</span>
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
                    <span className="macro-value">{nutrition.carbs}g</span>
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
                    <span className="macro-value">{nutrition.fat}g</span>
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
