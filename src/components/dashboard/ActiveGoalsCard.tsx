import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { Target, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
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

// Sub-component for individual goal items to use hooks
const ActiveGoalItem: React.FC<{ goal: PerformanceGoal }> = ({ goal }) => {
    const progress = useGoalProgress(goal);
    const { weightEntries, unifiedActivities } = useData();

    // Calculate time stats
    const timeStats = useMemo(() => {
        if (!goal.startDate || !goal.endDate) return null;

        const start = new Date(goal.startDate).getTime();
        const end = new Date(goal.endDate).getTime();
        const now = new Date().getTime();

        const totalDuration = end - start;
        const elapsed = now - start;
        const daysTotal = Math.ceil(totalDuration / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.max(0, Math.floor(elapsed / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
        const percentTime = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

        return { daysElapsed, daysTotal, daysRemaining, percentTime, start, end };
    }, [goal]);

    // Calculate Extra Stats (Rate, Count, Forecast)
    const extraStats = useMemo(() => {
        if (!timeStats) return null;

        if (goal.type === 'weight') {
            // Filter entries since start
            const entriesSinceStart = weightEntries.filter(w => new Date(w.date).getTime() >= timeStats.start);
            const count = entriesSinceStart.length;

            // Simple rate calculation (diff / weeks elapsed)
            const weeksElapsed = Math.max(0.5, timeStats.daysElapsed / 7);

            // For weight goals, progress.current IS the amount lost/gained so far
            const val = progress ? progress.current : 0;
            const ratePerWeek = val / weeksElapsed;

            // Forecast
            const remainingDiff = progress ? (progress.target - progress.current) : 0;
            const weeksToGoal = ratePerWeek > 0 ? remainingDiff / ratePerWeek : 999;
            const daysToGoal = weeksToGoal * 7;
            const isFeasible = daysToGoal < timeStats.daysRemaining;

            return {
                type: 'weight',
                count,
                rate: ratePerWeek,
                prediction: isFeasible ? 'Hinner!' : 'Tajtare'
            };
        }

        const target = goal.targets[0];
        const isRunGoal = target?.exerciseType === 'running' || goal.type === 'milestone'; // Simplified check

        if (isRunGoal && (goal.type === 'distance' || goal.type === 'frequency' || goal.type === 'speed')) {
            // Filter activities
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
                // Add rate for TS safety
                rate: 0
            };
        }

        return null;
    }, [goal, weightEntries, unifiedActivities, timeStats, progress]);

    if (!progress) return null;

    const isAhead = progress.percentage >= (timeStats?.percentTime || 0);
    const statusColor = isAhead ? 'text-emerald-400' : 'text-amber-400';

    return (
        <div className="bg-slate-800/40 hover:bg-slate-800 p-2.5 rounded-xl border border-slate-700/50 flex items-center justify-between gap-3 transition-colors group/item h-12">
            {/* Left: Icon & Name */}
            <div className="flex items-center gap-3 min-w-[30%] overflow-hidden">
                <div className={`w-1 h-8 rounded-full ${getImageColor(goal.category)} shrink-0`} />
                <div className="truncate">
                    <div className="text-[11px] font-bold text-slate-200 truncate">{goal.name}</div>
                    <div className="text-[9px] text-slate-500 truncate flex items-center gap-1">
                        {getCategoryLabel(goal.category)}
                        {timeStats && timeStats.daysRemaining <= 7 && (
                            <span className="text-rose-400 font-bold ml-1">
                                • {timeStats.daysRemaining}d kvar
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Dense Stats Strip */}
            <div className="flex items-center justify-end gap-3 flex-1 min-w-0">

                {/* Extra Data (Rate / Count) */}
                {extraStats && (
                    <div className="hidden sm:flex items-center gap-2 text-[10px] tabular-nums border-r border-slate-700/50 pr-3 mr-1">
                        {extraStats.type === 'weight' && (
                            <>
                                <div className="flex flex-col items-end leading-none gap-0.5">
                                    <span className={`font-bold ${extraStats.rate && extraStats.rate <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {extraStats.rate && extraStats.rate > 0 ? '+' : ''}{extraStats.rate?.toFixed(1)} kg/v
                                    </span>
                                    <span className="text-slate-500">takt</span>
                                </div>
                                <div className="flex flex-col items-end leading-none gap-0.5 ml-1">
                                    <span className="text-slate-300 font-bold">{extraStats.count}</span>
                                    <span className="text-slate-500">vägn.</span>
                                </div>
                            </>
                        )}
                        {extraStats.type === 'activity' && (extraStats.totalDist || 0) > 0 && (
                            <div className="flex flex-col items-end leading-none gap-0.5">
                                <span className="text-blue-400 font-bold">{extraStats.totalDist?.toFixed(1)} km</span>
                                <span className="text-slate-500">totalt</span>
                            </div>
                        )}
                        {extraStats.type === 'activity' && (extraStats.totalDist || 0) === 0 && (
                            <div className="flex flex-col items-end leading-none gap-0.5">
                                <span className="text-slate-300 font-bold">{extraStats.count} st</span>
                                <span className="text-slate-500">pass</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Time Progress (Mini) */}
                {timeStats && (
                    <div className="hidden xs:flex flex-col items-end leading-none gap-0.5 min-w-[40px]">
                        <div className="flex items-baseline gap-1 text-[10px]">
                            <span className="text-slate-500">⏱</span>
                            <span className="text-slate-300 font-bold">{timeStats.daysElapsed}/{timeStats.daysTotal}</span>
                        </div>
                        {/* Tiny Time Bar */}
                        <div className="w-full h-0.5 bg-slate-700 rounded-full mt-0.5">
                            <div className="h-full bg-slate-500 rounded-full" style={{ width: `${timeStats.percentTime}%` }} />
                        </div>
                    </div>
                )}

                {/* Goal Progress (Main) */}
                <div className="flex flex-col items-end leading-none gap-0.5 min-w-[50px]">
                    <div className="flex items-baseline gap-1 text-[10px]">
                        <span className={`font-black ${statusColor}`}>{Math.round(progress.percentage)}%</span>
                        {progress.percentage >= 100 && <CheckCircle2 size={10} className="text-emerald-500" />}
                    </div>
                    {/* Tiny Goal Bar */}
                    <div className="w-full h-1 bg-slate-700 rounded-full mt-0.5">
                        <div className={`h-full rounded-full ${isAhead ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, progress.percentage)}%` }} />
                    </div>
                </div>

            </div>
        </div>
    );
};


export const ActiveGoalsCard: React.FC = () => {
    const { performanceGoals } = useData();
    const navigate = useNavigate();

    // Filter active goals
    const activeGoals = (performanceGoals || []).filter(g => g.status === 'active');

    if (activeGoals.length === 0) return null;

    return (
        <div
            onClick={() => navigate('/goals')}
            className="col-span-12 md:col-span-12 lg:col-span-6 w-full bg-slate-900 border border-slate-800 shadow-sm p-5 rounded-[2rem] cursor-pointer group hover:scale-[1.005] transition-transform relative overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 relative z-10 px-1">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-500/20 rounded-full text-indigo-400 ring-1 ring-white/5">
                        <Target size={14} />
                    </div>
                    <div>
                        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Pågående Mål</h3>
                        <div className="text-white text-xs font-bold leading-none">{activeGoals.length} aktiva fokus</div>
                    </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
                    <TrendingUp size={14} />
                </div>
            </div>

            {/* Goals List */}
            <div className="space-y-2 relative z-10">
                {activeGoals.slice(0, 3).map(goal => (
                    <ActiveGoalItem key={goal.id} goal={goal} />
                ))}

                {activeGoals.length > 3 && (
                    <div className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-wider pt-1">
                        + {activeGoals.length - 3} till...
                    </div>
                )}
            </div>
        </div>
    );
};
