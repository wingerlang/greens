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
            {/* Background Glow - REMOVED for Minimalism */}

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Health Score™</h3>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">
                        Dagsform
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
                            strokeWidth="4"
                            fill="transparent"
                        />
                        <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            className={`${getRingColor(health.totalScore)} transition-all duration-1000 ease-out`}
                            strokeWidth="4"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className={`text-2xl font-black ${getScoreColor(health.totalScore)}`}>{health.totalScore}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Training Metric */}
                <div className="rounded-xl p-3 border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Träning</div>
                        <div className="text-xl">💪</div>
                    </div>
                    <div className="text-sm font-bold text-white leading-tight mb-1">{health.training.status}</div>
                    <div className="flex justify-between items-center">
                        <div className="text-[9px] text-slate-400">{health.training.details}</div>
                        <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${health.training.tsb > 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 bg-slate-800'}`}>
                            TSB {health.training.tsb > 0 ? '+' : ''}{health.training.tsb}
                        </div>
                    </div>
                </div>

                {/* Nutrition Metric */}
                <div className="rounded-xl p-3 border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-[10px] uppercase font-bold text-slate-500">KCAL</div>
                        <div className="text-xl">🥗</div>
                    </div>
                    <div className="text-sm font-bold text-white leading-tight mb-1">{health.nutrition.status}</div>
                    <div className="flex justify-between items-center">
                        <div className="text-[9px] text-slate-400">
                            {Math.abs(health.nutrition.caloriesDiff)} kcal {health.nutrition.status === 'Surplus' ? 'plus' : 'minus'}
                        </div>
                        <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${health.nutrition.proteinMet ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
                            {health.nutrition.proteinMet ? 'Protein OK' : 'Lågt Protein'}
                        </div>
                    </div>
                </div>

                {/* Consistency Metric */}
                <div className="rounded-xl p-3 border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Streak</div>
                        <div className="text-xl">🔥</div>
                    </div>
                    <div className="text-sm font-bold text-white leading-tight mb-1">{health.consistency.status}</div>
                    <div className="flex justify-between items-center">
                        <div className="text-[9px] text-slate-400">{health.consistency.streak} dagar i rad</div>
                        <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${health.consistency.streak >= 4 ? 'text-indigo-400 bg-indigo-400/10' : 'text-slate-400 bg-slate-800'}`}>
                            {health.consistency.streak >= 4 ? 'Momentum' : 'Starta nu'}
                        </div>
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
