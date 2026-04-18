import React from 'react';
import { Flame, Calendar, Target, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReadinessStreakCardProps {
    density: string;
    streakDays: number;
    weeklyStreak: number;
    calorieStreak: number;
}

export const ReadinessStreakCard: React.FC<ReadinessStreakCardProps> = ({
    density,
    streakDays,
    weeklyStreak,
    calorieStreak
}) => {
    const navigate = useNavigate();

    return (
        <div className={`h-full ${density === 'compact' ? 'p-3 rounded-2xl' : 'p-5 rounded-[2rem]'} bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-500`}>
            {/* Primary Streak */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-full text-rose-500 ring-2 ring-rose-500/5">
                        <Flame className={density === 'compact' ? 'w-4 h-4' : 'w-5 h-5'} />
                    </div>
                    <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Loggningsstreak</span>
                        <div className={`${density === 'compact' ? 'text-xl' : 'text-2xl'} font-black text-slate-900 dark:text-white tracking-tighter`}>
                            {streakDays} Dagar
                        </div>
                    </div>
                </div>
                
                {/* Streak Progress Dots */}
                <div className="flex gap-1 mt-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div 
                            key={i} 
                            className={`h-1.5 flex-1 rounded-full transition-all ${i < streakDays % 10 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'bg-slate-100 dark:bg-slate-800'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 gap-2 mt-auto">
                <div 
                    className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-between group"
                    onClick={() => navigate('/planera')}
                >
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-indigo-500" />
                        <div>
                            <span className="text-[8px] font-bold uppercase text-slate-400 block">Planera</span>
                            <span className="text-sm font-black text-indigo-500 dark:text-indigo-400">+ Pass</span>
                        </div>
                    </div>
                    <Check size={12} className="text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <Calendar size={10} className="text-emerald-500" />
                            <span className="text-[8px] font-bold uppercase text-slate-400">Veckor</span>
                        </div>
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                            {weeklyStreak} <span className="text-[9px] text-slate-400">st</span>
                        </div>
                    </div>
                    <div className="flex-1 p-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100/50 dark:border-rose-900/20">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <Target size={10} className="text-rose-500" />
                            <span className="text-[8px] font-bold uppercase text-slate-400">Mål</span>
                        </div>
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                            {calorieStreak} <span className="text-[9px] text-slate-400">dag</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Motivational Tag */}
            <div className="mt-2 text-center">
                <p className="text-[9px] font-medium text-slate-400 italic">"Consistency is the playground of excellence."</p>
            </div>
        </div>
    );
};
