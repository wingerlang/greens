import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { Target, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGoalProgress } from '../../hooks/useGoalProgress.ts';
import type { PerformanceGoal } from '../../models/types.ts';

// Helper for colors
const getImageColor = (category: string) => {
    switch (category) {
        case 'training': return 'bg-blue-500';
        case 'nutrition': return 'bg-emerald-500';
        case 'body': return 'bg-purple-500';
        case 'lifestyle': return 'bg-amber-500';
        default: return 'bg-slate-500';
    }
};

const getCategoryLabel = (category: string) => {
    switch (category) {
        case 'training': return 'Träningsmål';
        case 'nutrition': return 'Kostmål';
        case 'body': return 'Kroppsmål';
        case 'lifestyle': return 'Vanamål';
        default: return 'Mål';
    }
};

const ActiveGoalItem: React.FC<{ goal: PerformanceGoal }> = ({ goal }) => {
    const progress = useGoalProgress(goal);
    const { weightEntries, bodyMeasurements, unifiedActivities } = useData();

    // Calculate time stats
    const timeStats = useMemo(() => {
        if (!goal.startDate || !goal.endDate) return null;

        const start = new Date(goal.startDate).getTime();
        const end = new Date(goal.endDate).getTime();
        const now = new Date().getTime();

        const totalDuration = end - start;
        const elapsed = now - start;
        const daysTotal = Math.ceil(totalDuration / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.min(daysTotal, Math.floor(elapsed / (1000 * 60 * 60 * 24)) + 1);
        const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        const percentTime = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        return { daysElapsed, daysTotal, daysRemaining, percentTime, start, end };
    }, [goal]);

    // Calculate Extra Stats (Rate, Count, Forecast)
    const extraStats = useMemo(() => {
        if (!timeStats) return null;

        if (goal.type === 'weight' || goal.type === 'measurement') {
            const relevantEntries = goal.type === 'weight'
                ? weightEntries.filter(w => new Date(w.date).getTime() >= timeStats.start)
                : bodyMeasurements.filter(m => new Date(m.date).getTime() >= timeStats.start);

            const count = relevantEntries.length;
            const weeksElapsed = Math.max(0.5, timeStats.daysElapsed / 7);
            const val = progress ? progress.current : 0;
            const ratePerWeek = val / weeksElapsed;

            const targetVal = goal.type === 'weight' ? (goal.targetWeight || 0) : (goal.targetMeasurement || 0);
            const absoluteRemaining = Math.abs(targetVal - (progress?.actualCurrentValue || 0));

            const weeksToGoal = ratePerWeek > 0 ? absoluteRemaining / ratePerWeek : 999;
            const daysToGoal = weeksToGoal * 7;
            const isFeasible = daysToGoal < timeStats.daysRemaining;

            return {
                type: goal.type,
                unit: goal.type === 'weight' ? 'kg' : 'cm',
                count,
                rate: ratePerWeek,
                prediction: isFeasible ? 'Hinner!' : 'Tajtare',
                isFeasible
            };
        }

        const target = goal.targets[0];
        const isRunGoal = target?.exerciseType === 'running' || goal.type === 'milestone';

        if (isRunGoal && (goal.type === 'distance' || goal.type === 'frequency' || goal.type === 'speed')) {
            const acts = unifiedActivities.filter(a => {
                const d = new Date(a.date).getTime();
                return d >= timeStats.start && d <= timeStats.end && a.type === 'running';
            });

            const count = acts.length;
            const totalDist = acts.reduce((sum, a) => sum + (a.distance || 0), 0);
            const totalTime = acts.reduce((sum, a) => sum + a.durationMinutes, 0);

            return {
                type: 'activity',
                count,
                totalDist,
                totalTime,
                avgDist: count > 0 ? totalDist / count : 0,
                rate: 0
            };
        }

        return null;
    }, [goal, weightEntries, unifiedActivities, timeStats, progress]);

    if (!progress) return null;

    const percentTime = timeStats?.percentTime || 0;
    const percentGoal = progress.percentage;
    const isAhead = percentGoal >= percentTime;
    const isWeightLoss = goal.goalDirection === 'down' || (goal.targetWeight && goal.targetWeight < (goal.milestoneProgress || 80));

    return (
        <div className="bg-slate-800/40 hover:bg-slate-800/60 p-4 rounded-3xl border border-slate-700/50 flex flex-col gap-4 transition-all group/item relative overflow-hidden h-full">
            {/* Background Accent */}
            <div className={`absolute top-0 left-0 w-1 h-full ${getImageColor(goal.category)} opacity-40 group-hover/item:opacity-100 transition-opacity`} />
            
            {/* Header info */}
            <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md bg-white/5 ${isAhead ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isAhead ? '⚡️ Framför plan' : '📉 Efter plan'}
                        </span>
                        {timeStats && (
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                {timeStats.daysRemaining} d kvar
                            </span>
                        )}
                    </div>
                    <h4 className="text-sm font-black text-white truncate leading-tight group-hover/item:text-indigo-300 transition-colors">{goal.name}</h4>
                </div>
                
                {/* Visual indicator of time vs goal */}
                <div className="flex flex-col items-end shrink-0">
                   <div className="text-[10px] font-black text-white tabular-nums">{Math.round(percentGoal)}%</div>
                   <div className="text-[8px] font-bold text-slate-500 uppercase">Av målet</div>
                </div>
            </div>

            {/* Macro info if available (The requested "protein, kcal" part) */}
            {goal.nutritionMacros && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Energi</span>
                        <span className="text-xs font-black text-indigo-400 leading-none">{goal.nutritionMacros.calories}<span className="text-[8px] font-bold ml-0.5">kcal</span></span>
                    </div>
                    <div className="flex flex-col items-center justify-center border-l border-white/10">
                        <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Protein</span>
                        <span className="text-xs font-black text-emerald-400 leading-none">{goal.nutritionMacros.protein}<span className="text-[8px] font-bold ml-0.5">g</span></span>
                    </div>
                </div>
            )}

            {/* Body goal details */}
            {(goal.type === 'weight' || goal.type === 'measurement') && (
                <div className="flex items-center justify-between px-1">
                    <div className="text-center">
                        <div className="text-[8px] font-bold text-slate-600 uppercase mb-0.5">Start</div>
                        <div className="text-[10px] font-bold text-slate-400">{(goal.milestoneProgress || 0).toFixed(1)}</div>
                    </div>
                    <div className="h-px flex-1 mx-2 bg-slate-700/50 relative">
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${isAhead ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                    </div>
                    <div className="text-center">
                        <div className="text-[8px] font-bold text-slate-600 uppercase mb-0.5">Mål</div>
                        <div className="text-[10px] font-black text-indigo-400">{(goal.targetWeight || goal.targetMeasurement || 0).toFixed(1)}</div>
                    </div>
                </div>
            )}

            {/* Progress Bars (Time vs Goal) - The requested visualization */}
            <div className="space-y-1.5 mt-auto">
                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-500">
                    <span>Målprogress</span>
                    <span className="text-slate-300">{Math.round(percentGoal)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${isAhead ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`} 
                        style={{ width: `${Math.min(100, percentGoal)}%` }} 
                    />
                </div>
                
                <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-500 pt-0.5">
                    <span>Tid passerad</span>
                    <span className="text-slate-300">{Math.round(percentTime)}%</span>
                </div>
                <div className="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-slate-600 rounded-full transition-all duration-1000 opacity-50" 
                        style={{ width: `${percentTime}%` }} 
                    />
                </div>
            </div>

            {/* Rate indicator */}
            {extraStats && extraStats.rate !== 0 && (
                <div className="absolute top-4 right-4 text-[10px] font-black opacity-0 group-hover/item:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/5">
                    {extraStats.rate > 0 ? '+' : ''}{extraStats.rate.toFixed(2)} {extraStats.unit}/v
                </div>
            )}
        </div>
    );
};


export const ActiveGoalsCard: React.FC<{ fullWidth?: boolean }> = ({ fullWidth = false }) => {
    const { performanceGoals } = useData();
    const navigate = useNavigate();

    // Filter active goals
    const activeGoals = (performanceGoals || []).filter(g => g.status === 'active');

    if (activeGoals.length === 0) return null;

    return (
        <div
            onClick={() => navigate('/goals')}
            className={`${fullWidth ? 'col-span-12' : 'col-span-12 md:col-span-12 lg:col-span-6'} w-full bg-slate-900 border border-slate-800 shadow-xl p-6 rounded-[2.5rem] cursor-pointer group hover:-translate-y-1 hover:border-slate-700/50 transition-all relative overflow-hidden`}
        >
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none" />
            
            {/* Header */}
            <div className="flex items-center justify-between mb-5 relative z-10 px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400 ring-1 ring-white/10 shadow-inner">
                        <Target size={18} />
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Målpuls</h3>
                        <div className="text-white text-base font-black tracking-tight leading-none">{activeGoals.length} aktiva fokus</div>
                    </div>
                </div>
                <div className="group-hover:translate-x-1 transition-transform text-slate-500 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:block">Visa alla</span>
                    <ChevronRight size={16} />
                </div>
            </div>

            {/* Goals List */}
            <div className={`grid grid-cols-1 ${fullWidth ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-2'} gap-3 relative z-10`}>
                {activeGoals.slice(0, 4).map(goal => (
                    <div key={goal.id} className="md:col-span-1">
                         <ActiveGoalItem goal={goal} />
                    </div>
                ))}

                {activeGoals.length > 4 && (
                    <div className="col-span-1 md:col-span-2 text-center text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] pt-2 opacity-50">
                        + {activeGoals.length - 4} ytterligare fokus
                    </div>
                )}
            </div>
        </div>
    );
};
