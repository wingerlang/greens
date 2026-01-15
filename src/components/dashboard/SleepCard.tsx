import React from 'react';
import { Moon } from 'lucide-react';
import { analyzeSleep } from '../../utils/vitalsUtils.ts';

interface SleepCardProps {
    density: string;
    sleepHours: number;
    isEditing: boolean;
    tempValue: string;
    onCardClick: () => void;
    onValueChange: (val: string) => void;
    onSave: (val: number) => void;
    onClear: () => void;
    onCancel: () => void; // Used implicitly by clicking outside or not capturing click? Actually just for consistency if needed.
    // Dashboard handles click outside for closing edit mode.
}

export const SleepCard = ({
    density,
    sleepHours,
    isEditing,
    tempValue,
    onCardClick,
    onValueChange,
    onSave,
    onClear
}: SleepCardProps) => {

    const sleepInfo = analyzeSleep(sleepHours);
    const sleepColorMap: Record<string, { text: string, accent: string }> = {
        rose: { text: 'text-rose-500', accent: 'accent-rose-500' },
        amber: { text: 'text-amber-500', accent: 'accent-amber-500' },
        emerald: { text: 'text-emerald-500', accent: 'accent-emerald-500' },
        slate: { text: 'text-slate-900 dark:text-white', accent: 'accent-slate-500' }
    };
    const sleepClasses = sleepHours > 0 ? (sleepColorMap[sleepInfo.color] || sleepColorMap.slate) : sleepColorMap.slate;
    const sleepColorClass = sleepClasses.text;

    return (
        <div
            data-editing-card={isEditing ? true : undefined}
            onClick={onCardClick}
            className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 hover:scale-[1.01] transition-transform cursor-pointer group relative overflow-hidden ${sleepHours > 0 && sleepHours < 5
                ? 'bg-rose-50 dark:bg-rose-900/10'
                : sleepHours >= 5 && sleepHours < 7
                    ? 'bg-amber-50 dark:bg-amber-900/10'
                    : sleepHours >= 7 && sleepHours <= 10
                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                        : 'bg-white dark:bg-slate-900'
                }`}
        >
            <Moon className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-500/5 dark:text-indigo-400/10 pointer-events-none transform -rotate-12 transition-all group-hover:scale-110" />
            <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'} relative z-10`}>
                <div className={`p-1.5 rounded-full ${sleepHours > 0 && sleepHours < 5
                    ? 'bg-rose-100 text-rose-600'
                    : sleepHours >= 5 && sleepHours < 7
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                    <Moon className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Sömn</span>
            </div>
            <div className="flex-1">
                {isEditing ? (
                    <div className="flex flex-col gap-2 pt-1" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                            <span className={`text-xs font-black ${sleepColorClass}`}>{parseFloat(tempValue).toFixed(1)}h</span>
                            {parseFloat(tempValue) > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClear();
                                    }}
                                    className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-200 dark:hover:bg-rose-800/50 text-xs font-bold transition-colors"
                                    title="Rensa sömnvärde"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <input
                            autoFocus
                            type="range"
                            min="0"
                            max="12"
                            step="0.5"
                            value={tempValue}
                            onChange={(e) => {
                                onValueChange(e.target.value);
                                const num = parseFloat(e.target.value);
                                if (!isNaN(num)) {
                                    onSave(num);
                                }
                            }}
                            className={`w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer ${sleepClasses.accent} transition-all`}
                        />
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline gap-1">
                            <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${sleepColorClass}`}>{sleepHours}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">H</span>
                        </div>
                        {density !== 'compact' && sleepHours > 0 && (
                            <div className="mt-1 text-[8px] font-black uppercase tracking-tight opacity-60">
                                {sleepInfo.status}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
