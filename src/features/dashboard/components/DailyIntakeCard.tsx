import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, ChevronRight, X } from 'lucide-react';
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
    onHoverTraining
}) => {
    const navigate = useNavigate();
    const [showDetails, setShowDetails] = useState(false);
    const [isHoveringTraining, setIsHoveringTraining] = useState(false);

    return (
        <DashboardCardWrapper
            id="intake"
            isDone={isDone}
            onToggle={onToggle}
            className="md:col-span-12 xl:col-span-6 h-full flex"
        >
            <div
                onClick={() => navigate(`/calories?date=${selectedDate}`)}
                className={`flex-1 flex flex-col md:flex-row items-center md:items-start ${density === 'compact' ? 'gap-2 p-3' : 'gap-4 p-4'} border rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800 h-full relative cursor-pointer hover:scale-[1.01] transition-transform`}>
                <div className="shrink-0">
                    <DoubleCircularProgress
                        value={consumed}
                        max={target}
                        innerValue={proteinCurrent}
                        innerMax={proteinTarget}
                        displayValue={Math.round(target - consumed)}
                        label="Kvar"
                    />
                </div>
                <div className="flex-1 w-full md:w-auto md:ml-4 mt-2 md:mt-0 min-w-0 pb-2 md:pb-6 text-center md:text-left">
                    <div className={`font-black text-slate-900 dark:text-white uppercase tracking-tighter ${density === 'compact' ? 'text-[10px] mb-2' : 'text-sm mb-4'}`}>Dagens Intag</div>
                    <div className="grid grid-cols-2 lg:grid-cols-2 gap-x-4 gap-y-4">
                        {/* Protein */}
                        <div>
                            <div className={`flex justify-center md:justify-between items-baseline mb-1`}>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protein</span>
                                    {latestWeightVal > 0 && (
                                        <div className="group relative">
                                            <Info size={10} className="text-slate-300 hover:text-emerald-500 cursor-help transition-colors" />
                                            <div className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 text-[10px] text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all group-hover:translate-y-[-4px] pointer-events-none shadow-2xl border border-white/10 z-[100] leading-tight text-center">
                                                <div className="flex justify-between items-center mb-2 px-1">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] uppercase opacity-50 font-bold">Nuvarande</span>
                                                        <span className={`text-sm font-black ${proteinRatio >= targetProteinRatio ? 'text-emerald-400' : 'text-white'}`}>{proteinRatio.toFixed(1)}</span>
                                                    </div>
                                                    <div className="h-4 w-[1px] bg-white/10" />
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] uppercase opacity-50 font-bold">Mål</span>
                                                        <span className="text-sm font-black text-blue-400">{targetProteinRatio.toFixed(1)}</span>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] mb-1 opacity-70">Gram protein per kg kroppsvikt</p>
                                                {trainingGoal === 'deff' && proteinRatio < 2.0 ? (
                                                    <p className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400/90 italic border border-amber-500/20">Vid deff bör du ligga på drygt 2.0g/kg för att behålla muskelmassa.</p>
                                                ) : proteinRatio >= targetProteinRatio ? (
                                                    <p className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400/90 font-bold border border-emerald-500/20">Snyggt! Du når ditt proteinmål.</p>
                                                ) : (
                                                    <p className="opacity-70">Baserat på din senaste vikt ({latestWeightVal}kg).</p>
                                                )}
                                                {/* Arrow */}
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col md:flex-row items-center md:items-baseline justify-center md:justify-start gap-1">
                                <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-slate-900 dark:text-white`}>
                                    {Math.round(proteinCurrent)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">/ {proteinTarget}g</span>
                            </div>
                            <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((proteinCurrent / proteinTarget) * 100, 100)}%` }}></div>
                            </div>
                        </div>

                        {/* Carbs */}
                        <div>
                            <div className={`flex justify-center md:justify-between items-baseline mb-1`}>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kolh.</span>
                            </div>
                            <div className="flex flex-col md:flex-row items-center md:items-baseline justify-center md:justify-start gap-1">
                                <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-slate-900 dark:text-white`}>
                                    {Math.round(carbsCurrent)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">/ {carbsTarget}g</span>
                            </div>
                            <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((carbsCurrent / carbsTarget) * 100, 100)}%` }}></div>
                            </div>
                        </div>

                        {/* Fat */}
                        <div>
                            <div className={`flex justify-center md:justify-between items-baseline mb-1`}>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fett</span>
                            </div>
                            <div className="flex flex-col md:flex-row items-center md:items-baseline justify-center md:justify-start gap-1">
                                <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-slate-900 dark:text-white`}>
                                    {Math.round(fatCurrent)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">/ {fatTarget}g</span>
                            </div>
                            <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((fatCurrent / fatTarget) * 100, 100)}%` }}></div>
                            </div>
                        </div>

                        {/* Calories */}
                        <div>
                            <div className={`flex justify-center md:justify-between items-baseline mb-1`}>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kcal</span>
                            </div>
                            <div className="flex flex-col md:flex-row items-center md:items-baseline justify-center md:justify-start gap-1">
                                <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} ${consumed > target ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                                    {Math.round(consumed)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">/ {target}</span>
                            </div>
                            <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div className={`h-full rounded-full ${consumed > target ? 'bg-rose-500' : 'bg-slate-900 dark:bg-white'}`} style={{ width: `${Math.min((consumed / target) * 100, 100)}%` }}></div>
                            </div>
                        </div>

                        {/* Training/Burned Calories - Hidden unless active or expanded */}
                        {(showDetails || burned > 0) && (
                            <div
                                onMouseEnter={() => { setIsHoveringTraining(true); onHoverTraining?.(true); }}
                                onMouseLeave={() => { setIsHoveringTraining(false); onHoverTraining?.(false); }}
                                className={`transition-all rounded-lg p-1 -m-1 ${isHoveringTraining ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20' : ''}`}
                            >
                                <div className={`flex justify-center md:justify-between items-baseline mb-1`}>
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Träning</span>
                                </div>
                                <div className="flex flex-col md:flex-row items-center md:items-baseline justify-center md:justify-start gap-1">
                                    <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-emerald-500`}>
                                        -{Math.round(burned)}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold">kcal</span>
                                </div>
                                <div className="h-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden mt-1">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${burned > 0 ? Math.min((burned / 500) * 100, 100) : 0}%` }}></div>
                                </div>
                            </div>
                        )}

                        {/* Net Calories - Hidden unless expanded */}
                        {showDetails && (
                            <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                                <div className={`flex justify-between items-baseline mb-1`}>
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Netto</span>
                                    <span className={`text-[9px] font-bold ${(consumed - burned) > baseTarget ? 'text-rose-500' : (consumed - burned) < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                        {(consumed - burned) <= baseTarget ? '✓ Under mål' : '⚠ Över mål'}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} ${(consumed - burned) > baseTarget ? 'text-rose-500' : 'text-indigo-500'}`}>
                                        {Math.round(consumed - burned)}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold">/ {baseTarget} kcal</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                    <div className={`h-full rounded-full ${(consumed - burned) > baseTarget ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(Math.max(0, ((consumed - burned) / baseTarget) * 100), 100)}%` }}></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Expand Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                        className="absolute bottom-2 right-4 p-1 text-slate-300 hover:text-slate-600 dark:hover:text-slate-100 transition-colors"
                    >
                        {showDetails ? <X size={14} /> : <div className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">Mer <ChevronRight size={10} className="rotate-90" /></div>}
                    </button>
                </div>
            </div>
        </DashboardCardWrapper>
    );
};
