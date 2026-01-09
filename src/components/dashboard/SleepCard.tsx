import React, { useState } from 'react';
import { Moon } from 'lucide-react';

interface SleepCardProps {
    vitals: { sleep?: number };
    editing: string | null;
    tempValue: string;
    setTempValue: (val: string) => void;
    setVitals: React.Dispatch<React.SetStateAction<any>>;
    updateVitals: (date: string, updates: any) => void;
    selectedDate: string;
    debouncedSave: (field: string, value: any) => void;
    handleCardClick: (cardId: string, value: any) => void;
    density: 'compact' | 'slim' | 'normal';
}

export const SleepCard: React.FC<SleepCardProps> = ({
    vitals,
    editing,
    tempValue,
    setTempValue,
    setVitals,
    updateVitals,
    selectedDate,
    debouncedSave,
    handleCardClick,
    density
}) => {
    const sleepVal = vitals?.sleep || 0;

    // Calculate sleep status/info locally or pass it in if complex logic relies on other state
    // For now, simple logic based on value
    const getSleepStatus = (hours: number) => {
        if (hours < 5) return { status: 'Dålig sömn', color: 'text-rose-500' };
        if (hours < 7) return { status: 'Ok sömn', color: 'text-amber-500' };
        if (hours <= 10) return { status: 'Bra sömn', color: 'text-emerald-500' };
        return { status: 'Lång sömn', color: 'text-blue-500' };
    };

    const sleepInfo = getSleepStatus(sleepVal);

    const sleepClasses = {
        bg: sleepVal > 0 && sleepVal < 5 ? 'bg-rose-50 dark:bg-rose-900/10' :
            sleepVal >= 5 && sleepVal < 7 ? 'bg-amber-50 dark:bg-amber-900/10' :
                sleepVal >= 7 && sleepVal <= 10 ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                    'bg-white dark:bg-slate-900',
        text: sleepVal > 0 && sleepVal < 5 ? 'text-rose-600' :
            sleepVal >= 5 && sleepVal < 7 ? 'text-amber-600' :
                sleepVal >= 7 && sleepVal <= 10 ? 'text-emerald-600' :
                    'text-slate-900 dark:text-white',
        accent: sleepVal > 0 && sleepVal < 5 ? 'accent-rose-500' :
            sleepVal >= 5 && sleepVal < 7 ? 'accent-amber-500' :
                'accent-emerald-500'
    };

    return (
        <div
            data-editing-card={editing === 'sleep' ? true : undefined}
            onClick={() => handleCardClick('sleep', sleepVal)}
            className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:scale-[1.01] transition-transform cursor-pointer group relative overflow-hidden h-full ${sleepClasses.bg}`}
        >
            <Moon className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-500/5 dark:text-indigo-400/10 pointer-events-none transform -rotate-12 transition-all group-hover:scale-110" />
            <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'} relative z-10`}>
                <div className={`p-1.5 rounded-full ${sleepVal > 0 && sleepVal < 5
                    ? 'bg-rose-100 text-rose-600'
                    : sleepVal >= 5 && sleepVal < 7
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                    <Moon className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Sömn</span>
            </div>
            <div className="flex-1">
                {editing === 'sleep' ? (
                    <div className="flex flex-col gap-2 pt-1" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                            <span className={`text-xs font-black ${sleepClasses.text}`}>{parseFloat(tempValue).toFixed(1)}h</span>
                            {parseFloat(tempValue) > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setTempValue('0');
                                        setVitals(prev => ({ ...prev, sleep: 0 }));
                                        updateVitals(selectedDate, { sleep: 0 });
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
                                const val = e.target.value;
                                setTempValue(val);
                                const num = parseFloat(val);
                                if (!isNaN(num)) {
                                    setVitals(prev => ({ ...prev, sleep: num }));
                                    debouncedSave('sleep', num);
                                }
                            }}
                            className={`w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer ${sleepClasses.accent} transition-all`}
                        />
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline gap-1">
                            <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${sleepClasses.text}`}>{sleepVal}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">H</span>
                        </div>
                        {density !== 'compact' && sleepVal > 0 && (
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
