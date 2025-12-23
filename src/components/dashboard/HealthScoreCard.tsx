import React, { useMemo } from 'react';
import { calculateHealthScore } from '../../utils/healthScore.ts';
import { ExerciseEntry, MealEntry } from '../../models/types.ts';

interface HealthScoreCardProps {
    exercises: ExerciseEntry[];
    meals: MealEntry[];
    userSettings: any; // Type this properly later
}

export function HealthScoreCard({ exercises, meals, userSettings }: HealthScoreCardProps) {
    const health = useMemo(() => calculateHealthScore(exercises, meals, userSettings), [exercises, meals, userSettings]);

    // Color logic
    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-400';
        if (score >= 70) return 'text-sky-400';
        if (score >= 50) return 'text-yellow-400';
        return 'text-rose-500';
    };

    const getRingColor = (score: number) => {
        if (score >= 90) return 'stroke-emerald-500';
        if (score >= 70) return 'stroke-sky-500';
        if (score >= 50) return 'stroke-yellow-500';
        return 'stroke-rose-500';
    };

    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - ((health.totalScore / 100) * circumference);

    return (
        <div className="content-card relative overflow-hidden">
            {/* Background Glow */}
            <div className={`absolute -top-10 -right-10 w-40 h-40 blur-[60px] rounded-full opacity-20 ${getScoreColor(health.totalScore).replace('text-', 'bg-')}`}></div>

            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="section-title">Greens Health Score™</h3>
                    <p className="text-xs text-slate-500 font-medium max-w-[200px]">
                        Din dagliga bio-metriska status baserad på träning, kost & återhämtning.
                    </p>
                </div>

                {/* Score Circle - Updated to ensure explicit size and centering */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            className="stroke-slate-800"
                            strokeWidth="6"
                            fill="transparent"
                        />
                        <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            className={`${getRingColor(health.totalScore)} transition-all duration-1000 ease-out`}
                            strokeWidth="6"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className={`text-2xl font-black ${getScoreColor(health.totalScore)}`}>{health.totalScore}</span>
                        <span className="text-[8px] uppercase font-bold text-slate-500">IDAG</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* Training Metric */}
                <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5 relative group">
                    <div className="absolute top-2 right-2 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`w-1 h-1 rounded-full ${i <= (health.training.score / 20) ? 'bg-sky-400' : 'bg-slate-800'}`}></div>
                        ))}
                    </div>
                    <div className="text-xl mb-1">💪</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Träningsbalans</div>
                    <div className="text-sm font-bold text-white mb-0.5">{health.training.status}</div>
                    <div className="text-[9px] text-slate-400 leading-tight">{health.training.details}</div>
                    <div className="mt-2 text-[9px] font-mono text-sky-400 bg-sky-400/10 inline-block px-1.5 py-0.5 rounded">TSB: {health.training.tsb > 0 ? '+' : ''}{health.training.tsb}</div>
                </div>

                {/* Nutrition Metric */}
                <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5 relative group">
                    <div className="absolute top-2 right-2 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`w-1 h-1 rounded-full ${i <= (health.nutrition.score / 20) ? 'bg-emerald-400' : 'bg-slate-800'}`}></div>
                        ))}
                    </div>
                    <div className="text-xl mb-1">🥗</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Nutrition</div>
                    <div className="text-sm font-bold text-white mb-0.5">{health.nutrition.status}</div>
                    <div className="text-[9px] text-slate-400 leading-tight">
                        {Math.abs(health.nutrition.caloriesDiff)} kcal {health.nutrition.status === 'Surplus' ? 'överskott' : 'underskott'}.
                    </div>
                    <div className="mt-2 text-[9px] font-mono text-emerald-400 bg-emerald-400/10 inline-block px-1.5 py-0.5 rounded">
                        {health.nutrition.proteinMet ? 'Protein OK ✅' : 'Lågt Protein ⚠️'}
                    </div>
                </div>

                {/* Consistency Metric */}
                <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5 relative group">
                    <div className="absolute top-2 right-2 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`w-1 h-1 rounded-full ${i <= (health.consistency.score / 20) ? 'bg-indigo-400' : 'bg-slate-800'}`}></div>
                        ))}
                    </div>
                    <div className="text-xl mb-1">🔥</div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Kontinuitet</div>
                    <div className="text-sm font-bold text-white mb-0.5">{health.consistency.status}</div>
                    <div className="text-[9px] text-slate-400 leading-tight">Streak på {health.consistency.streak} dagar.</div>
                    <div className="mt-2 text-[9px] font-mono text-indigo-400 bg-indigo-400/10 inline-block px-1.5 py-0.5 rounded">
                        {health.consistency.streak >= 4 ? 'Momentum 🚀' : 'Kom igen!'}
                    </div>
                </div>
            </div>

            {/* AI Insight / Footer */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-start gap-2 opacity-70">
                <span className="text-emerald-400 text-xs">✨</span>
                <p className="text-[10px] text-slate-400 italic">
                    "Med tanke på din höga träningsbelastning bör du öka kaloriintaget något idag för att maximera återhämtningen och behålla din streak."
                </p>
            </div>
        </div>
    );
}
