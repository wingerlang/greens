import React from 'react';
import { useData } from '../../context/DataContext.tsx';
import { CoachConfig, getISODate, StravaActivity } from '../../models/types.ts';
import { PlannedActivityCard } from './PlannedActivityCard.tsx';
import { Link } from 'react-router-dom';
import { calculateVDOT, assessGoalFeasibility } from '../../utils/runningCalculator.ts';
import './SmartCoachDashboard.css';

interface SmartCoachDashboardProps {
    stravaHistory: StravaActivity[];
}

export function SmartCoachDashboard({ stravaHistory }: SmartCoachDashboardProps) {
    const { coachConfig, plannedActivities, generateCoachPlan } = useData();

    const handleGenerate = () => {
        generateCoachPlan(stravaHistory);
    };

    if (!coachConfig) {
        return (
            <div className="smart-coach-dashboard p-6 rounded-3xl bg-slate-900 border border-white/5 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">🧠</span>
                    <h3 className="font-black text-white uppercase tracking-widest text-sm">Smart Coach</h3>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                    Konfigurera din coach för att få en personlig träningsplan baserad på din fysiologi.
                </p>
                <Link
                    to="/coach"
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-2xl transition-all text-center block text-xs uppercase tracking-widest"
                >
                    Konfigurera Nu
                </Link>
            </div>
        );
    }

    const probability = React.useMemo(() => {
        if (!coachConfig) return null;
        const currentVdot = coachConfig.userProfile.recentRaceTime ? calculateVDOT(coachConfig.userProfile.recentRaceTime.distance, coachConfig.userProfile.recentRaceTime.timeSeconds) : 35;
        const dist = coachConfig.goal.type === 'MARATHON' ? 42.195 : coachConfig.goal.type === 'HALF_MARATHON' ? 21.097 : coachConfig.goal.type === '10K' ? 10 : 5;
        const targetVdot = calculateVDOT(dist, coachConfig.goal.targetTimeSeconds || 3000);
        const weeks = Math.ceil((new Date(coachConfig.goal.targetDate).getTime() - new Date().getTime()) / (7 * 24 * 60 * 60 * 1000));
        return assessGoalFeasibility(currentVdot, targetVdot, weeks).probability;
    }, [coachConfig]);

    const nextActivity = plannedActivities.length > 0 ? plannedActivities[0] : null;

    return (
        <div className="smart-coach-dashboard p-6 rounded-3xl bg-slate-900 border border-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🧠</span>
                    <h3 className="font-black text-white uppercase tracking-widest text-sm">Smart Coach</h3>
                </div>
                <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter">
                    Active
                </div>
            </div>

            {plannedActivities.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-slate-400 text-xs mb-4">Ingen träningsplan genererad än.</p>
                    <button
                        onClick={handleGenerate}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-8 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 text-xs uppercase tracking-widest"
                    >
                        Generera Plan 🚀
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {nextActivity && (
                        <div className="next-session">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-2">Nästa Pass</span>
                            <PlannedActivityCard activity={nextActivity} />
                        </div>
                    )}

                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Status</span>
                            {probability !== null && (
                                <span className={`text-sm font-black ${probability > 0.8 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {Math.round(probability * 100)}% Match
                                </span>
                            )}
                        </div>
                        <Link
                            to="/coach"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] rounded-xl transition-all uppercase tracking-wider"
                        >
                            Visa Allt →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
