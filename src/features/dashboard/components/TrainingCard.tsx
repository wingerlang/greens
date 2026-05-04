import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, X, ChevronRight, Zap, HeartPulse, Activity, Bike, FastForward, Waves, Footprints, Flower2, Calendar as CalendarIcon } from 'lucide-react';
import { DashboardCardWrapper } from '../../../components/dashboard/DashboardCardWrapper.tsx';
import { EXERCISE_TYPES } from '../../../components/training/ExerciseModal.tsx';
import { ExerciseEntry, PlannedActivity, ExerciseType, UserSettings } from '../../../models/types.ts';
import { formatPace } from '../../../utils/dateUtils.ts';

export type DashboardTrainingCategory = 'running' | 'strength' | 'cardio' | 'all';

interface TrainingCardProps {
    isDone: boolean;
    onToggle: (id: string, e: React.MouseEvent) => void;
    density: string;
    completedTraining: ExerciseEntry[];
    todaysPlans: PlannedActivity[];
    deleteExercise: (id: string) => void;
    isHoveringTraining: boolean;
    settings: UserSettings;
    latestWeightVal: number;
    reconciliation: {
        reconcileActivity: (planId: string, activityId: string) => void;
    };
    category?: DashboardTrainingCategory;
    className?: string;
}

const getCategoryForType = (type: string): DashboardTrainingCategory => {
    const t = type.toUpperCase();
    if (t === 'RUN' || t === 'RUNNING') return 'running';
    if (['STRENGTH', 'HYROX', 'HYBRID'].includes(t)) return 'strength';
    return 'cardio';
};

export const TrainingCard: React.FC<TrainingCardProps> = ({
    isDone,
    onToggle,
    density,
    completedTraining: allCompleted,
    todaysPlans: allPlans,
    deleteExercise,
    isHoveringTraining,
    settings,
    latestWeightVal,
    reconciliation,
    category = 'all',
    className
}) => {
    const navigate = useNavigate();

    // Filter based on category
    const completedTraining = allCompleted.filter(act => 
        category === 'all' || getCategoryForType(act.type) === category
    );

    const filteredPlans = allPlans.filter(plan => 
        category === 'all' || getCategoryForType(plan.type) === category
    );

    const totalCalories = completedTraining.reduce((sum, act) => sum + act.caloriesBurned, 0);

    // Estimate calories for a planned activity
    const estimatePlannedCalories = (plan: PlannedActivity) => {
        // Quick local implementation of calorie calc to avoid context dependency issues
        const typeWeight: Record<string, number> = {
            'RUN': 8,
            'BIKE': 6,
            'STRENGTH': 4,
            'CARDIO': 7,
            'OTHER': 4.5
        };
        const intensity = plan.category === 'RACE' || plan.category === 'INTERVALS' ? 1.3 : 1.0;
        const duration = plan.durationMinutes || (plan.estimatedDistance ? plan.estimatedDistance * 6 : 45);
        const weight = latestWeightVal || 80;
        const met = typeWeight[plan.type] || 4.5;
        
        return Math.round(met * weight * (duration / 60) * intensity);
    };

    const plannedCaloriesRemaining = filteredPlans.reduce((sum, plan) => sum + estimatePlannedCalories(plan), 0);
    const totalDayTarget = totalCalories + plannedCaloriesRemaining;

    const getCategoryConfig = () => {
        switch (category) {
            case 'running':
                return {
                    icon: Zap,
                    label: 'Löpning',
                    color: 'text-blue-500',
                    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
                    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
                    hoverColor: 'group-hover:bg-blue-600'
                };
            case 'cycling':
                return {
                    icon: Bike,
                    label: 'Cykling',
                    color: 'text-amber-500',
                    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
                    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
                    hoverColor: 'group-hover:bg-amber-600'
                };
            case 'strength':
                return {
                    icon: Dumbbell,
                    label: 'Styrka',
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-50 dark:bg-emerald-900/10',
                    iconBg: 'bg-[#DCFCE7] dark:bg-emerald-900/30',
                    hoverColor: 'group-hover:bg-emerald-600'
                };
            case 'cardio':
                return {
                    icon: Activity,
                    label: 'Cardio',
                    color: 'text-rose-500',
                    bgColor: 'bg-rose-50 dark:bg-rose-900/10',
                    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
                    hoverColor: 'group-hover:bg-rose-600'
                };
            default:
                return {
                    icon: Dumbbell,
                    label: 'Träning',
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-50 dark:bg-emerald-900/10',
                    iconBg: 'bg-[#DCFCE7] dark:bg-emerald-900/30',
                    hoverColor: 'group-hover:bg-emerald-600'
                };
        }
    };

    const getHrZone = (avgHr: number) => {
        const maxHr = settings.maxHr || 190;
        const hrPct = (avgHr / maxHr) * 100;

        if (hrPct >= 90) return { zone: 'Z5', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' };
        if (hrPct >= 80) return { zone: 'Z4', color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' };
        if (hrPct >= 70) return { zone: 'Z3', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' };
        if (hrPct >= 60) return { zone: 'Z2', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' };
        return { zone: 'Z1', color: 'text-slate-500 bg-slate-50 dark:bg-slate-900/20' };
    };

    const getExerciseIcon = (type: ExerciseType) => {
        const size = density === 'compact' ? 14 : 18;
        switch (type) {
            case 'running': return <FastForward size={size} className="text-blue-500" />;
            case 'cycling': return <Bike size={size} className="text-amber-500" />;
            case 'strength': return <Dumbbell size={size} className="text-emerald-500" />;
            case 'walking': return <Footprints size={size} className="text-slate-500" />;
            case 'swimming': return <Waves size={size} className="text-cyan-500" />;
            case 'yoga': return <Flower2 size={size} className="text-indigo-500" />;
            case 'cardio': return <HeartPulse size={size} className="text-rose-500" />;
            default: return <Activity size={size} className="text-slate-400" />;
        }
    };

    const config = getCategoryConfig();
    const CategoryIcon = config.icon;

    // Determine content
    let trainingContent;
    
    if (completedTraining.length > 0 || filteredPlans.length > 0) {
        const totalDuration = completedTraining.reduce((sum, act) => sum + act.durationMinutes, 0);
        const totalDistance = completedTraining.reduce((sum, act) => sum + (act.distance || 0), 0);
        const totalSessions = completedTraining.length;
        const goalMet = totalDuration >= (settings.dailyTrainingGoal || 60);

        trainingContent = (
            <div className={`flex flex-col ${density === 'compact' ? 'gap-0.5' : 'gap-1.5'} w-full`}>
                {/* Header Summary for Completed */}
                {completedTraining.length > 0 && (
                    <div className="flex justify-between items-center px-0.5 mb-1">
                        <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Utförda Pass</div>
                        <div className="text-[10px] font-bold text-emerald-500">
                            {Math.round(totalDuration)} min {totalDistance > 0 ? `• ${totalDistance.toFixed(1)} km` : ''}
                        </div>
                    </div>
                )}
                
                {/* Completed Activities */}
                {completedTraining.map((act) => {
                    const typeDef = EXERCISE_TYPES.find(t => t.type === act.type);
                    const hrZone = act.heartRateAvg ? getHrZone(act.heartRateAvg) : null;
                    const matchedPlan = allPlans.find(plan => plan.externalId === act.id);
                    
                    return (
                        <div
                            key={act.id}
                            onClick={(e) => { e.stopPropagation(); navigate(`/logg?activityId=${act.id}`); }}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${isHoveringTraining ? 'border-emerald-500 bg-emerald-500/5' : 'border-transparent bg-slate-50 dark:bg-slate-800/40'} hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer group/item`}
                        >
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
                                {getExerciseIcon(act.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{typeDef?.label || act.type}</span>
                                    {act.heartRateAvg && (
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${hrZone?.color}`}>
                                            <span className="opacity-70">{hrZone?.zone}</span>
                                            <span>{Math.round(act.heartRateAvg)} bpm</span>
                                        </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                                    <span className="text-slate-900 dark:text-slate-200">{Math.round(act.durationMinutes)} min</span>
                                    {act.distance && (
                                        <>
                                            <span className="opacity-20">•</span>
                                            <span className="text-blue-500">{act.distance.toFixed(1)} km</span>
                                            {act.type === 'running' && (
                                                <span className="text-slate-400 font-medium"> 
                                                    ({formatPace((act.durationMinutes / act.distance) * 60)})
                                                </span>
                                            )}
                                        </>
                                    )}
                                    {act.caloriesBurned > 0 && (
                                        <>
                                            <span className="opacity-20">•</span>
                                            <span className="text-rose-500 font-black">{act.caloriesBurned} kcal</span>
                                            {matchedPlan && (
                                                <div className="flex flex-col ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                                                    <span className="text-slate-400 text-[8px] font-black uppercase">Jämfört med plan:</span>
                                                    <div className="flex gap-2">
                                                        {matchedPlan.estimatedDistance > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-[9px] font-bold ${(act.distance || 0) > matchedPlan.estimatedDistance + 0.1 ? 'text-emerald-500' : Math.abs((act.distance || 0) - matchedPlan.estimatedDistance) > 0.1 ? 'text-blue-500' : 'text-slate-400'}`}>
                                                                    Dist: {(act.distance || 0).toFixed(1)} <span className="opacity-50 font-medium">(mål {matchedPlan.estimatedDistance})</span>
                                                                </span>
                                                                {(act.distance || 0) > matchedPlan.estimatedDistance + 0.1 && (
                                                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-600 px-1 rounded font-black uppercase tracking-tighter animate-bounce-slow">Bonus!</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {matchedPlan.durationMinutes && (
                                                            <span className={`text-[9px] font-bold ${act.durationMinutes > matchedPlan.durationMinutes + 2 ? 'text-emerald-500' : Math.abs(act.durationMinutes - matchedPlan.durationMinutes) > 2 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                                Tid: {Math.round(act.durationMinutes)} <span className="opacity-50 font-medium">(mål {matchedPlan.durationMinutes})</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <ChevronRight size={14} className="text-slate-300 group-hover/item:text-slate-500 transition-colors" />
                        </div>
                    );
                })}

                {/* Planned Activities */}
                {filteredPlans.length > 0 && (
                    <div className="mt-3">
                        <div className="flex justify-between items-center px-0.5 mb-2">
                            <div className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Planerat</div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {filteredPlans.map(plan => {
                                const pace = plan.targetPace || (plan.estimatedDistance && plan.durationMinutes ? formatPace((plan.durationMinutes / plan.estimatedDistance) * 60) : null);
                                
                                // Find un-matched completed activities for the dashboard category
                                const unmatchedActivities = completedTraining.filter(act => 
                                    !allPlans.some(p => p.externalId === act.id)
                                );

                                const bestCandidateId = plan.reconciliation?.bestCandidateId;
                                const bestCandidate = bestCandidateId ? unmatchedActivities.find(a => a.id === bestCandidateId) : null;

                                return (
                                    <div key={plan.id} className="flex flex-col gap-2 p-2.5 rounded-xl border border-dashed border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all group/plan cursor-pointer">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg shrink-0 text-indigo-500">
                                                <CalendarIcon size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0 text-left" onClick={() => navigate('/planera')}>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{plan.title || plan.category || 'Pass'}</span>
                                                    {plan.startTime && <span className="text-[8px] font-black bg-white dark:bg-slate-900 text-slate-500 px-1.5 py-0.5 rounded">{plan.startTime}</span>}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-bold flex items-center gap-2">
                                                    {plan.durationMinutes && <span>{Math.round(plan.durationMinutes)} min</span>}
                                                    {plan.estimatedDistance && (
                                                        <>
                                                            <span className="opacity-20">•</span>
                                                            <span className="text-indigo-400">{plan.estimatedDistance} km</span>
                                                        </>
                                                    )}
                                                    <span className="opacity-20">•</span>
                                                    <span className="text-rose-400/80 font-black">-{estimatePlannedCalories(plan)} kcal</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={14} className="text-indigo-300 opacity-0 group-hover/plan:opacity-100 transition-all" />
                                        </div>

                                        {unmatchedActivities.length > 0 && (
                                            <div className="pt-2 border-t border-indigo-500/10 flex flex-col gap-1.5 ">
                                                <div className="text-[8px] font-black uppercase text-indigo-400/60 tracking-wider">Pass genomfört? Matcha för att dölja:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {unmatchedActivities.map(act => {
                                                        const isBest = act.id === bestCandidateId;
                                                        return (
                                                            <button 
                                                                key={act.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    reconciliation.reconcileActivity(plan.id, act.id);
                                                                }}
                                                                className={`px-2 py-1 rounded text-[9px] font-bold transition-all border ${isBest ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-500'}`}
                                                            >
                                                                {isBest ? '✨ Matcha förslag: ' : ''}{act.title || act.type} ({Math.round(act.durationMinutes)} min)
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    } else {
        trainingContent = (
            <div className="py-4 text-center">
                <div className="text-2xl mb-1 opacity-20">🍃</div>
                <div className="font-bold text-xs text-slate-400">Vila</div>
                <div className="text-[10px] text-slate-500">Ingen {category !== 'all' ? config.label.toLowerCase() : 'planerad träning'}</div>
            </div>
        );
    }

    return (
        <DashboardCardWrapper
            id={`training-${category}`}
            isDone={isDone}
            onToggle={onToggle}
            className={className || `md:col-span-12 ${category === 'all' ? 'xl:col-span-6' : 'xl:col-span-4'} h-full`}
        >
            <div
                onClick={() => navigate('/planera')}
                className={`w-full ${density === 'compact' ? 'p-1.5 gap-2 rounded-xl' : density === 'slim' ? 'p-2.5 gap-3 rounded-2xl' : 'p-4 gap-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex items-start hover:scale-[1.01] transition-transform cursor-pointer group bg-white dark:bg-slate-900 h-full relative overflow-hidden`}
            >
                <CategoryIcon className={`absolute -bottom-4 -right-4 w-24 h-24 ${config.color} opacity-[0.03] dark:opacity-[0.07] pointer-events-none transform -rotate-12 transition-all group-hover:scale-110`} />

                <div className="flex-1 min-w-0 text-left z-10 w-full">
                    <div className={`${density === 'compact' ? 'text-[10px]' : 'text-sm'} text-slate-500 dark:text-slate-400 font-semibold mb-1 flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                            <div className={`${density === 'compact' ? 'w-6 h-6' : 'w-8 h-8'} ${config.iconBg} rounded-full flex items-center justify-center ${config.color} shrink-0`}>
                                <CategoryIcon size={density === 'compact' ? 12 : 16} />
                            </div>
                            <span>{config.label}</span>
                        </div>
                        {totalDayTarget > 0 && (
                            <div className="flex flex-col items-end">
                                <span className="text-rose-500 font-black animate-in fade-in slide-in-from-right-2">
                                    {totalDayTarget > totalCalories ? `-${totalCalories} / -${totalDayTarget}` : `-${totalCalories}`}
                                    <span className="text-[10px] ml-1 opacity-50 font-bold uppercase tracking-tighter italic">kcal</span>
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="w-full mt-2">{trainingContent}</div>
                </div>
            </div>
        </DashboardCardWrapper>
    );
};

