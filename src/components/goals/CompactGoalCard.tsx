import React, { useMemo } from 'react';
import { PerformanceGoal, PerformanceGoalType, GoalPeriod } from '../../models/types';
import { useGoalProgress } from '../../hooks/useGoalProgress';
import { useData } from '../../context/DataContext';

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

const getImageColorClass = (category: string) => {
    switch (category) {
        case 'training': return 'bg-emerald-500';
        case 'nutrition': return 'bg-amber-500';
        case 'body': return 'bg-blue-500';
        case 'lifestyle': return 'bg-purple-500';
        default: return 'bg-slate-500';
    }
};

export const CompactGoalCard: React.FC<CompactGoalCardProps> = ({ goal, onEdit, onDelete, onClick }) => {
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

    // Calculate Rate
    const extraStats = useMemo(() => {
        if (!timeStats || !progress) return null;

        if (goal.type === 'weight' || goal.type === 'measurement') {
            const weeksElapsed = Math.max(0.5, timeStats.daysElapsed / 7);
            const val = progress.current;
            const ratePerWeek = val / weeksElapsed;
            const unit = goal.type === 'weight' ? 'kg' : 'cm';

            return { rate: ratePerWeek, unit };
        }
        return null;
    }, [goal, timeStats, progress]);

    const color = CATEGORY_COLORS[goal.category] || CATEGORY_COLORS.training;
    const percentGoal = progress?.percentage || 0;
    const percentTime = timeStats?.percentTime || 0;
    const isAhead = percentGoal >= percentTime;
    const isMet = percentGoal >= 100;

    return (
        <div
            onClick={onClick}
            className="group relative bg-[#1e1e24] hover:bg-[#232329] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all cursor-pointer flex flex-col gap-3 min-h-[140px] overflow-hidden"
        >
            {/* Side Accent Line */}
            <div 
                className={`absolute top-0 left-0 w-1 h-full opacity-40 group-hover:opacity-100 transition-opacity`}
                style={{ backgroundColor: color }}
            />

            {/* Header */}
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
                    <h4 className="font-bold text-white text-base truncate leading-tight group-hover:text-amber-400 transition-colors">{goal.name}</h4>
                </div>

                {/* Progress Percentage */}
                <div className="flex flex-col items-end shrink-0">
                   <div className="text-xs font-black text-white tabular-nums">{Math.round(percentGoal)}%</div>
                   <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Klar</div>
                </div>

                {/* Delete Button */}
                {onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(goal.id); }}
                        className="ml-2 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors shrink-0"
                        title="Ta bort mål"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Content Row: Values or Macros */}
            <div className="flex items-center justify-between gap-4">
                {goal.nutritionMacros ? (
                    <div className="flex-1 grid grid-cols-2 gap-2 bg-white/5 p-2 rounded-xl border border-white/5">
                        <div className="text-center">
                            <div className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Energi</div>
                            <div className="text-xs font-black text-amber-400">{goal.nutritionMacros.calories} <span className="text-[9px] opacity-70">kcal</span></div>
                        </div>
                        <div className="text-center border-l border-white/10">
                            <div className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Protein</div>
                            <div className="text-xs font-black text-emerald-400">{goal.nutritionMacros.protein} <span className="text-[9px] opacity-70">g</span></div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {goal.type === 'weight' ? `Mål: ${goal.targetWeight} kg` : 
                             goal.type === 'measurement' ? `Mål: ${goal.targetMeasurement} cm` : 
                             goal.type === 'frequency' ? `${goal.targets[0]?.count} pass / v` :
                             `Mål: ${goal.targets[0]?.value} ${goal.targets[0]?.unit}`}
                        </span>
                        <div className="flex items-center gap-2">
                             <span className="text-sm font-black text-white">
                                 {goal.type === 'weight' ? `${progress?.actualCurrentValue?.toFixed(1) || '0.0'} kg` : 
                                  goal.type === 'measurement' ? `${progress?.actualCurrentValue?.toFixed(1) || '0.0'} cm` :
                                  `${progress?.current} / ${goal.targets[0]?.value || goal.targets[0]?.count}`}
                             </span>
                             {extraStats && extraStats.rate !== 0 && (
                                 <span className={`text-[10px] font-bold ${extraStats.rate > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                     {extraStats.rate > 0 ? '+' : ''}{extraStats.rate.toFixed(2)}{extraStats.unit}/v
                                 </span>
                             )}
                        </div>
                    </div>
                )}
            </div>

            {/* Dual Progress Bars */}
            <div className="mt-auto space-y-1.5">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none">
                    <span>Framsteg</span>
                    <span className="text-white">{Math.round(percentGoal)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${isMet ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : (isAhead ? 'bg-amber-500' : 'bg-orange-500')}`} 
                        style={{ width: `${Math.min(100, percentGoal)}%` }} 
                    />
                </div>
                
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none pt-0.5">
                    <span>Tid</span>
                    <span className="text-slate-400">{Math.round(percentTime)}%</span>
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-slate-600 rounded-full transition-all duration-1000 opacity-30" 
                        style={{ width: `${percentTime}%` }} 
                    />
                </div>
            </div>
        </div>
    );
};
