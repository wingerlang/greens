import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, X, ChevronRight, Zap, HeartPulse, Activity, Bike, FastForward, Waves, Footprints, Flower2 } from 'lucide-react';
import { DashboardCardWrapper } from '../../../components/dashboard/DashboardCardWrapper.tsx';
import { EXERCISE_TYPES } from '../../../components/training/ExerciseModal.tsx';
import { ExerciseEntry, PlannedActivity, ExerciseType, UserSettings } from '../../../models/types.ts';

export type DashboardTrainingCategory = 'running' | 'strength' | 'cardio' | 'all';

interface TrainingCardProps {
    isDone: boolean;
    onToggle: (id: string, e: React.MouseEvent) => void;
    density: string;
    completedTraining: ExerciseEntry[];
    todaysPlan?: PlannedActivity;
    deleteExercise: (id: string) => void;
    isHoveringTraining: boolean;
    settings: UserSettings;
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
    todaysPlan: allPlans,
    deleteExercise,
    isHoveringTraining,
    settings,
    category = 'all',
    className
}) => {
    const navigate = useNavigate();

    // Filter based on category
    const completedTraining = allCompleted.filter(act => 
        category === 'all' || getCategoryForType(act.type) === category
    );

    const todaysPlan = allPlans && (category === 'all' || getCategoryForType(allPlans.type) === category)
        ? allPlans
        : undefined;

    const totalCalories = completedTraining.reduce((sum, act) => sum + act.caloriesBurned, 0);

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
        const restingHr = settings.restingHr || 50;
        const reserve = maxHr - restingHr;
        const intensity = (avgHr - restingHr) / reserve;

        if (intensity >= 0.90) return { zone: 'Z5', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' };
        if (intensity >= 0.80) return { zone: 'Z4', color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20' };
        if (intensity >= 0.70) return { zone: 'Z3', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' };
        if (intensity >= 0.60) return { zone: 'Z2', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' };
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
    if (completedTraining.length > 0) {
        const totalDuration = completedTraining.reduce((sum, act) => sum + act.durationMinutes, 0);
        const totalDistance = completedTraining.reduce((sum, act) => sum + (act.distance || 0), 0);
        const totalTonnage = completedTraining.reduce((sum, act) => sum + (act.tonnage || 0), 0);
        const totalSessions = completedTraining.length;
        const totalSets = completedTraining.reduce((sum, act) => sum + (act.totalSets || 0), 0);
        const totalReps = completedTraining.reduce((sum, act) => sum + (act.totalReps || 0), 0);
        const goalMet = totalDuration >= (settings.dailyTrainingGoal || 60);

        trainingContent = (
            <div className={`flex flex-col ${density === 'compact' ? 'gap-0.5 w-full p-0.5' : density === 'slim' ? 'gap-1.5 w-full p-1' : 'gap-2 w-full p-1.5'} rounded-2xl transition-colors ${goalMet ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-0.5 px-0.5">
                    <div className="text-[9px] font-bold uppercase text-slate-400">Totalt</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">{Math.round(totalDuration)} min</span>
                        <span className="opacity-20 text-slate-300 hidden md:inline">|</span>
                        <span className="whitespace-nowrap">{totalSessions} {totalSessions === 1 ? 'pass' : 'pass'}</span>
                        {totalDistance > 0 && (
                            <>
                                <span className="opacity-20 text-slate-300 hidden md:inline">|</span>
                                <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">{totalDistance.toFixed(1)} km</span>
                            </>
                        )}
                        {totalSets > 0 && (
                            <>
                                <span className="opacity-20 text-slate-300 hidden md:inline">|</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">{totalSets} set</span>
                            </>
                        )}
                        {totalReps > 0 && (
                            <>
                                <span className="opacity-20 text-slate-300 hidden md:inline">|</span>
                                <span className="text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">{totalReps} reps</span>
                            </>
                        )}
                        {totalTonnage > 0 && (
                            <>
                                <span className="opacity-20 text-slate-300 hidden md:inline">|</span>
                                <span className="text-purple-600 dark:text-purple-400 font-bold whitespace-nowrap">{(totalTonnage / 1000).toFixed(1)} ton</span>
                            </>
                        )}
                    </div>
                </div>

                {completedTraining.map((act) => {
                    const typeDef = EXERCISE_TYPES.find(t => t.type === act.type);

                    const metricParts = [];
                    metricParts.push(`${Math.round(act.durationMinutes)} min`);

                    if (act.caloriesBurned > 0) {
                        metricParts.push(`<span class="text-rose-500 font-bold">${act.caloriesBurned} kcal</span>`);
                    }

                    if (act.distance) {
                        if (act.type === 'running') {
                            const pace = act.durationMinutes / act.distance;
                            const paceMin = Math.floor(pace);
                            const paceSec = Math.round((pace - paceMin) * 60);
                            const paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
                            metricParts.push(`${act.distance} km (${paceStr}/km)`);
                        } else {
                            metricParts.push(`${act.distance} km`);
                        }
                    }

                    if (act.totalSets) metricParts.push(`${act.totalSets} set`);
                    if (act.totalReps) metricParts.push(`${act.totalReps} reps`);
                    if (act.tonnage) {
                        metricParts.push(`${(act.tonnage / 1000).toFixed(1)} ton`);
                    }
                    if (act.averageWatts) {
                        metricParts.push(`<span class="text-amber-500 font-bold">${Math.round(act.averageWatts)}W</span>`);
                    }

                    let hrString = '';
                    let hrZone = null;
                    if (act.heartRateAvg) {
                        hrString = `HR ${act.heartRateAvg}`;
                        hrZone = getHrZone(act.heartRateAvg);
                        if (act.heartRateMax) hrString += `/${act.heartRateMax}`;
                    }

                    return (
                        <div
                            key={act.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/logg?activityId=${act.id}`);
                            }}
                            className={`flex flex-col sm:flex-row items-stretch sm:items-center ${density === 'compact' ? 'gap-2 p-2 rounded-lg' : 'gap-3 p-2.5 rounded-xl'} group/item cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all border ${isHoveringTraining ? 'border-emerald-500 bg-emerald-500/5 shadow-md -translate-y-[1px]' : 'border-transparent'} hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-sm relative bg-white/40 dark:bg-slate-900/40`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 shrink-0 flex items-center justify-center min-w-[28px] sm:min-w-[36px]`}>
                                    {getExerciseIcon(act.type)}
                                </div>
                                <div className="sm:hidden flex-1 font-bold text-slate-900 dark:text-white capitalize truncate">
                                    {typeDef?.label || act.type}
                                    {hrString && <span className="ml-2 text-[8px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded tracking-wide align-middle">{hrString}</span>}
                                    {hrZone && <span className={`ml-1 text-[8px] font-black ${hrZone.color} px-1 py-0.5 rounded tracking-wide align-middle`}>{hrZone.zone}</span>}
                                </div>
                                <div className="sm:hidden flex items-center gap-1 opacity-100">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Ta bort aktivitet?')) {
                                                deleteExercise(act.id);
                                            }
                                        }}
                                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 md:ml-0 ml-10 -mt-2 sm:mt-0">
                                <div className="hidden sm:flex font-bold text-slate-900 dark:text-white leading-tight capitalize items-center gap-1.5 truncate">
                                    {typeDef?.label || act.type}
                                    {hrString && <span className="text-[8px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded tracking-wide">{hrString}</span>}
                                    {hrZone && <span className={`text-[8px] font-black ${hrZone.color} px-1 py-0.5 rounded tracking-wide`}>{hrZone.zone}</span>}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium flex flex-wrap gap-x-1 items-center">
                                    {metricParts.map((part, i) => (
                                        <React.Fragment key={i}>
                                            <span dangerouslySetInnerHTML={{ __html: part }} />
                                            {i < metricParts.length - 1 && <span className="opacity-30">•</span>}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Ta bort aktivitet?')) {
                                            deleteExercise(act.id);
                                        }
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                                >
                                    <X size={14} />
                                </button>
                                <ChevronRight size={14} className="text-slate-300" />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    } else if (todaysPlan) {
        let icon = '📅';
        let label = todaysPlan.type as string;

        if (todaysPlan.type === 'RUN' || (todaysPlan.type as string) === 'running') {
            const runDef = EXERCISE_TYPES.find(t => t.type === 'running');
            icon = runDef?.icon || '🏃';
            label = 'Löpning';
        }

        trainingContent = (
            <div className="flex items-center gap-4 opacity-75">
                <div className="text-2xl grayscale">{icon}</div>
                <div>
                    <div className="font-bold text-slate-900 dark:text-white leading-tight">Planerat: {label}</div>
                    <div className="text-xs text-slate-500 font-medium italic">
                        {todaysPlan.estimatedDistance ? `${todaysPlan.estimatedDistance} km` : 'Dagens pass'}
                        {todaysPlan.category ? ` • ${todaysPlan.category}` : ''}
                    </div>
                </div>
            </div>
        );
    } else {
        trainingContent = (
            <div>
                <div className="font-bold text-slate-900 dark:text-white">Vila</div>
                <div className="text-xs text-slate-500">Ingen {category !== 'all' ? config.label.toLowerCase() : 'planerad träning'}</div>
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

                <div className={`${density === 'compact' ? 'w-8 h-8' : 'w-12 h-12'} ${config.iconBg} rounded-full flex items-center justify-center ${config.color} group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-slate-800 transition-colors shrink-0 z-10`}>
                    <CategoryIcon className={density === 'compact' ? 'w-4 h-4' : 'w-6 h-6'} />
                </div>
                <div className="flex-1 min-w-0 text-left z-10">
                    <div className={`${density === 'compact' ? 'text-[10px]' : 'text-sm'} text-slate-500 dark:text-slate-400 font-semibold mb-1 flex items-center justify-between`}>
                        <span>{config.label}</span>
                        {totalCalories > 0 && (
                            <span className="text-rose-500 font-black animate-in fade-in slide-in-from-right-2">
                                -{totalCalories} kcal
                            </span>
                        )}
                    </div>
                    <div className="w-full">{trainingContent}</div>
                </div>
            </div>
        </DashboardCardWrapper>
    );
};

