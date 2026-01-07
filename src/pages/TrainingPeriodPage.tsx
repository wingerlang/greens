import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ChevronLeft, Calendar, Target, TrendingUp, Trophy } from 'lucide-react';
import { GoalCard } from '../components/training/GoalCard';
import { useGoalProgress } from '../hooks/useGoalProgress';
import type { PerformanceGoal } from '../models/types';

// Helper to render GoalCard with calculated progress
const GoalCardWrapper: React.FC<{ goal: PerformanceGoal; onEdit: (g: PerformanceGoal) => void; onDelete: (id: string) => void }> = ({ goal, onEdit, onDelete }) => {
    const progress = useGoalProgress(goal);
    return (
        <GoalCard
            goal={goal}
            progress={progress ? { current: progress.current || 0, target: progress.target || 0, percentage: (!isNaN(progress.percentage) ? progress.percentage : 0) } : { current: 0, target: 0, percentage: 0 }}
            onEdit={() => onEdit(goal)}
            onDelete={() => onDelete(goal.id)}
        />
    );
};

export const TrainingPeriodPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { trainingPeriods, performanceGoals, deleteTrainingPeriod, deleteGoal } = useData();

    // Find period (if ID provided, otherwise active/latest)
    const period = useMemo(() => {
        if (id) return trainingPeriods.find(p => p.id === id);
        // Find active one (today within range)
        const today = new Date().toISOString().split('T')[0];
        return trainingPeriods.find(p => p.startDate <= today && p.endDate >= today) || trainingPeriods[0];
    }, [id, trainingPeriods]);

    const periodGoals = useMemo(() => {
        if (!period) return [];
        return performanceGoals.filter(g => g.periodId === period.id);
    }, [period, performanceGoals]);

    // Progress Calculation
    const timeProgress = useMemo(() => {
        if (!period) return 0;
        const start = new Date(period.startDate).getTime();
        const end = new Date(period.endDate).getTime();
        const now = new Date().getTime();
        const total = end - start;
        const elapsed = now - start;
        if (total <= 0) return 100;
        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    }, [period]);

    if (!period) {
        return (
            <div className="min-h-screen bg-[#141419] text-white p-6 flex flex-col items-center justify-center">
                <div className="text-white/50 mb-4">Ingen aktiv period hittades.</div>
                <button onClick={() => navigate('/mal')} className="text-emerald-400 hover:text-emerald-300">
                    Tillbaka till Mål
                </button>
            </div>
        );
    }

    const daysLeft = Math.ceil((new Date(period.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return (
        <div className="min-h-screen bg-[#141419] text-white pb-20">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#141419]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button onClick={() => navigate('/mal')} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold">{period.name}</h1>
                        <div className="text-xs text-white/50 flex items-center gap-2">
                            <Calendar size={12} />
                            {period.startDate} — {period.endDate} ({daysLeft} dagar kvar)
                        </div>
                    </div>
                    {/* Actions (Edit/Delete could go here) */}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

                {/* Time Progress */}
                <div className="bg-gradient-to-br from-emerald-900/20 to-black border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
                    <div className="flex justify-between items-end mb-4 relative z-10">
                        <div>
                            <div className="text-emerald-400 font-bold uppercase text-xs tracking-wider mb-1">Period Progress</div>
                            <div className="text-3xl font-black text-white">{Math.round(timeProgress)}%</div>
                            <div className="text-sm text-white/50">avklarat av tidsramen</div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-white">{periodGoals.length}</div>
                            <div className="text-xs text-white/50 uppercase tracking-wider">Aktiva Mål</div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-4 bg-black/50 rounded-full overflow-hidden relative z-10 border border-white/5">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out relative"
                            style={{ width: `${timeProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse-slow" />
                        </div>
                    </div>

                    {/* Background Deco */}
                    <Target className="absolute -right-4 -bottom-4 text-emerald-500/5 rotate-12" size={150} />
                </div>

                {/* Goals Grid */}
                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Trophy className="text-amber-400" size={20} />
                        Mål & Delmål
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {periodGoals.length > 0 ? (
                            periodGoals.map(goal => (
                                <GoalCardWrapper
                                    key={goal.id}
                                    goal={goal}
                                    onEdit={(g) => navigate(`/mal?goal=${g.id}`)} // Redirect to Goals page for full edit context
                                    onDelete={(id) => {
                                        if (confirm('Ta bort detta mål?')) deleteGoal(id);
                                    }}
                                />
                            ))
                        ) : (
                            <div className="col-span-full p-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                                <div className="text-white/30 mb-2">Inga mål kopplade än</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Insight/Stats Section (Future) */}
                <div className="p-6 bg-[#1e1e24] rounded-2xl border border-white/5">
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-400" />
                        Analys
                    </h3>
                    <p className="text-sm text-white/50">
                        Fortsätt logga dina aktiviteter för att se hur du ligger till mot din planering för {period.focusType}-fokus.
                    </p>
                </div>

                <button
                    onClick={async () => {
                        if (confirm('Är du säker på att du vill avsluta och ta bort denna period? Målen kommer ligga kvar men utan period-koppling.')) {
                            await deleteTrainingPeriod(period.id);
                            navigate('/mal');
                        }
                    }}
                    className="w-full py-4 text-red-400/50 hover:text-red-400 text-sm hover:bg-red-500/5 rounded-xl transition-colors"
                >
                    Avsluta/Radera Period
                </button>

            </div>
        </div>
    );
};
