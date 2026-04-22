import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, ChevronRight, X, Target, Flame, Check } from 'lucide-react';
import { DashboardCardWrapper } from '../../../components/dashboard/DashboardCardWrapper.tsx';
import { DoubleCircularProgress } from '../../../components/dashboard/DoubleCircularProgress.tsx';

interface DailyIntakeCardProps {
    isDone: boolean;
    onToggle: (id: string, e: React.MouseEvent) => void;
    density: string;
    selectedDate: string;
    consumed: number;
    target: number;
    proteinCurrent: number;
    proteinTarget: number;
    carbsCurrent: number;
    carbsTarget: number;
    fatCurrent: number;
    fatTarget: number;
    burned: number;
    baseTarget: number;
    trainingGoal?: string; // from settings.trainingGoal
    latestWeightVal: number;
    proteinRatio: number;
    targetProteinRatio: number;
    onHoverTraining?: (isHovering: boolean) => void;
    maintenance?: number;
    explanation?: string;
    className?: string;
    exerciseCalorieMultiplier?: number;
}

export const DailyIntakeCard: React.FC<DailyIntakeCardProps> = ({
    isDone,
    onToggle,
    density,
    selectedDate,
    consumed,
    target,
    proteinCurrent,
    proteinTarget,
    carbsCurrent,
    carbsTarget,
    fatCurrent,
    fatTarget,
    burned,
    baseTarget,
    trainingGoal,
    latestWeightVal,
    proteinRatio,
    targetProteinRatio,
    onHoverTraining,
    maintenance,
    explanation,
    className,
    exerciseCalorieMultiplier = 1.0
}) => {
    const navigate = useNavigate();
    const [isHoveringTraining, setIsHoveringTraining] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const trainingBonus = Math.round(burned * exerciseCalorieMultiplier);

    return (
        <DashboardCardWrapper
            id="intake"
            isDone={isDone}
            onToggle={onToggle}
            className={className || "md:col-span-12 xl:col-span-6 h-full flex"}
        >
            <div
                onClick={() => navigate(`/calories?date=${selectedDate}`)}
                className={`flex-1 flex flex-col items-center md:items-start ${density === 'compact' ? 'gap-2 p-3' : 'gap-4 p-4'} border rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800 h-full relative cursor-pointer hover:scale-[1.01] transition-transform`}>
                
                <div className={`flex-1 w-full flex flex-col ${density === 'compact' ? 'gap-3' : 'gap-5'} p-2 md:p-4`}>
                    {/* --- SIMPLIFIED BUDGET FLOW --- */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                        {/* 1. KCAL (TOTAL BUDGET) */}
                        <div className="bg-slate-900 dark:bg-white/10 rounded-xl py-3 px-2 border border-transparent flex flex-col items-center justify-center text-center">
                            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">Kcal</span>
                            <span className="text-lg font-black text-white font-mono leading-none">{Math.round(target)}</span>
                        </div>

                        {/* 2. ÄTIT */}
                        <div className={`rounded-xl py-3 px-2 border flex flex-col items-center justify-center text-center transition-all ${consumed > target ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'}`}>
                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${consumed > target ? 'text-rose-500' : 'text-slate-400'}`}>ätit</span>
                            <span className={`text-lg font-black font-mono leading-none ${consumed > target ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{Math.round(consumed)}</span>
                        </div>

                        {/* 3. TRÄNAT */}
                        <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-xl py-3 px-2 border border-amber-500/20 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <div className="absolute -right-2 -top-2 opacity-10">
                                <Flame size={24} className="text-amber-500" />
                            </div>
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">tränat</span>
                            <span className="text-lg font-black text-amber-500 font-mono leading-none">+{Math.round(burned * exerciseCalorieMultiplier)}</span>
                        </div>

                        {/* 4. KVAR */}
                        <div className={`border rounded-xl py-3 px-2 flex flex-col items-center justify-center text-center transition-all ${consumed > target ? 'bg-rose-500/10 border-rose-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                            <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${consumed > target ? 'text-rose-500' : 'text-indigo-400'}`}>kvar</span>
                            <span className={`text-lg font-black font-mono leading-none ${consumed > target ? 'text-rose-500' : 'text-indigo-400'}`}>{Math.round(target - consumed)}</span>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 mt-2">
                        {/* Left Column: Visual Progress */}
                        <div className="flex flex-col items-center p-2">
                             <DoubleCircularProgress
                                value={consumed}
                                max={target}
                                innerValue={proteinCurrent}
                                innerMax={proteinTarget}
                                displayValue={Math.round(target - consumed)}
                                label="Kvar"
                                size={140}
                            />
                        </div>

                        {/* Right Column: Detailed Breakdown (Macros) */}
                        <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Protein */}
                                <div>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protein</span>
                                        <span className="text-[10px] font-black text-slate-900 dark:text-white font-mono">
                                            {Math.round(proteinCurrent)}<span className="opacity-40 font-normal"> / {proteinTarget}g</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${Math.min((proteinCurrent / (proteinTarget || 1)) * 100, 100)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[8px] font-bold text-slate-400">({Math.round((proteinCurrent / (proteinTarget || 1)) * 100)}%)</span>
                                        <span className={`text-[8px] font-black ${proteinCurrent >= proteinTarget ? 'text-emerald-500' : 'text-slate-400'}`}>
                                            {proteinCurrent >= proteinTarget ? 'Mål nått' : `${Math.round(proteinTarget - proteinCurrent)}g kvar`}
                                        </span>
                                    </div>
                                </div>

                                {/* Kohydrater */}
                                <div>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kolh.</span>
                                        <span className="text-[10px] font-black text-slate-900 dark:text-white font-mono">
                                            {Math.round(carbsCurrent)}<span className="opacity-40 font-normal"> / {carbsTarget}g</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]" style={{ width: `${Math.min((carbsCurrent / (carbsTarget || 1)) * 100, 100)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[8px] font-bold text-slate-400">({Math.round((carbsCurrent / (carbsTarget || 1)) * 100)}%)</span>
                                        <span className={`text-[8px] font-black ${carbsCurrent > carbsTarget ? 'text-rose-500 font-black' : 'text-slate-400'}`}>
                                            {carbsCurrent > carbsTarget ? 'Överskott' : `${Math.round(carbsTarget - carbsCurrent)}g kvar`}
                                        </span>
                                    </div>
                                </div>

                                {/* Fett */}
                                <div>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fett</span>
                                        <span className="text-[10px] font-black text-slate-900 dark:text-white font-mono">
                                            {Math.round(fatCurrent)}<span className="opacity-40 font-normal"> / {fatTarget}g</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.3)]" style={{ width: `${Math.min((fatCurrent / (fatTarget || 1)) * 100, 100)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[8px] font-bold text-slate-400">({Math.round((fatCurrent / (fatTarget || 1)) * 100)}%)</span>
                                        <span className={`text-[8px] font-black ${fatCurrent > fatTarget ? 'text-rose-500' : 'text-slate-400'}`}>
                                            {fatCurrent > fatTarget ? 'Överskott' : `${Math.round(fatTarget - fatCurrent)}g kvar`}
                                        </span>
                                    </div>
                                </div>

                                {/* Energi/Kcal */}
                                <div>
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Energi</span>
                                        <span className="text-[10px] font-black text-slate-900 dark:text-white font-mono">
                                            {Math.round(consumed)}<span className="opacity-40 font-normal"> / {Math.round(target)} kcal</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full shadow-sm ${consumed > target ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]' : 'bg-slate-900 dark:bg-white'}`} style={{ width: `${Math.min((consumed / (target || 1)) * 100, 100)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[8px] font-bold text-slate-400">({Math.round((consumed / (target || 1)) * 100)}%)</span>
                                        <div className="flex items-center gap-1">
                                            <div className={`w-1.5 h-1.5 rounded-full ${consumed > target ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                            <span className={`text-[8px] font-black ${consumed > target ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {consumed > target ? `${Math.round(consumed - target)} kcal över` : `${Math.round(target - consumed)} kcal kvar`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detaljerad summering */}
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                                <div className="flex justify-center">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                                        className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1.5"
                                    >
                                        {showDetails ? 'Dölj Summering' : 'Visa Detaljerad Summering'}
                                        <Info size={12} />
                                    </button>
                                </div>

                                {showDetails && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Bas</span>
                                            <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{Math.round(baseTarget)}</span>
                                            <span className="text-[7px] text-slate-400 mt-0.5 uppercase font-bold">Grundbudget</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center border-x border-slate-200 dark:border-white/10 px-2">
                                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">Återätning</span>
                                            <span className="text-sm font-black text-amber-500 font-mono">+{Math.round(burned * exerciseCalorieMultiplier)}</span>
                                            <span className="text-[7px] text-slate-400 mt-0.5 uppercase font-bold">({Math.round(exerciseCalorieMultiplier * 100)}% bonus)</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Budget (Tot)</span>
                                            <span className="text-sm font-black text-indigo-400 font-mono">{Math.round(target)}</span>
                                            <span className="text-[7px] text-slate-400 mt-0.5 uppercase font-bold">Justerat mål</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center border-t border-slate-200 dark:border-white/10 pt-2">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Basförbränning</span>
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">{Math.round((maintenance || 0) - burned)}</span>
                                            <span className="text-[7px] text-slate-400 mt-0.5 uppercase font-bold">Vila + PAL</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center border-t border-x border-slate-200 dark:border-white/10 pt-2 px-2">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Träning (100%)</span>
                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">+{Math.round(burned)}</span>
                                            <span className="text-[7px] text-slate-400 mt-0.5 uppercase font-bold">Brända kcal</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center border-t border-slate-200 dark:border-white/10 pt-2">
                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Faktiskt Netto</span>
                                            <span className="text-sm font-black text-emerald-500 font-mono">{Math.round((maintenance || 0) - consumed)}</span>
                                            <span className="text-[7px] text-slate-400 mt-0.5 uppercase font-bold">Verkligt underskott</span>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </DashboardCardWrapper>
);
};
