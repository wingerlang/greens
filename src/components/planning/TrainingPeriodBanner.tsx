import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { Target, Calendar, Trophy, Zap, AlertTriangle } from 'lucide-react';

export function TrainingPeriodBanner() {
    const { trainingPeriods } = useData();

    // Get active period
    const activePeriod = useMemo(() => {
        const now = new Date().toISOString().split('T')[0];
        return trainingPeriods.find(p => p.startDate <= now && p.endDate >= now);
    }, [trainingPeriods]);

    if (!activePeriod) return null;

    // Calculate progress
    const now = new Date().getTime();
    const start = new Date(activePeriod.startDate).getTime();
    const end = new Date(activePeriod.endDate).getTime();

    const progress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    return (
        <div className="w-full bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl shadow-lg mb-8 overflow-hidden relative">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat" />

            <div className="relative z-10 p-6 flex flex-col md:flex-row items-center justify-between gap-6">

                {/* Period Info */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                        <Trophy size={24} className="text-yellow-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-black uppercase tracking-tight">{activePeriod.name}</h2>
                            <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-[10px] font-black uppercase rounded-full border border-yellow-400/30">
                                {activePeriod.focusType.replace('_', ' ')}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400 font-medium max-w-md">
                            {activePeriod.description || "Fokusera på dina mål och håll dig till planen."}
                        </p>
                    </div>
                </div>

                {/* Progress Stats */}
                <div className="flex-1 w-full md:w-auto flex flex-col gap-2 min-w-[250px]">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-white">{Math.round(progress)}% ({daysLeft} dagar kvar)</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                        <span>{activePeriod.startDate}</span>
                        <span>{activePeriod.endDate}</span>
                    </div>
                </div>

                {/* Quick Stats / Goal Preview */}
                {activePeriod.nutritionGoal && (
                    <div className="hidden md:flex items-center gap-6 pl-6 border-l border-white/10">
                        <div>
                            <div className="text-[10px] text-slate-400 font-black uppercase mb-0.5">Mål Kcal</div>
                            <div className="text-lg font-bold flex items-center gap-1">
                                <Zap size={14} className="text-orange-400 fill-orange-400" />
                                {activePeriod.nutritionGoal.calories}
                            </div>
                        </div>
                        {(activePeriod.nutritionGoal.protein || 0) > 0 && (
                            <div>
                                <div className="text-[10px] text-slate-400 font-black uppercase mb-0.5">Protein</div>
                                <div className="text-lg font-bold text-white">
                                    {activePeriod.nutritionGoal.protein}g
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
