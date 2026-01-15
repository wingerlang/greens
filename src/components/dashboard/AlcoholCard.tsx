import React from 'react';
import { Wine } from 'lucide-react';

interface AlcoholCardProps {
    density: string;
    alcoholCount: number;
    alcoholLimit?: number;
    isEditing: boolean;
    tempValue: string;
    onCardClick: () => void;
    onValueChange: (val: string) => void;
    onSave: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onAlcoholClick: (count: number) => void;
}

export const AlcoholCard = ({
    density,
    alcoholCount,
    alcoholLimit,
    isEditing,
    tempValue,
    onCardClick,
    onValueChange,
    onSave,
    onKeyDown,
    onAlcoholClick
}: AlcoholCardProps) => {

    const alc = alcoholCount;
    const isAlcHigh = alcoholLimit !== undefined && alc > alcoholLimit;
    const isAlcWarning = alcoholLimit !== undefined && !isAlcHigh && alc > 0 && alc === alcoholLimit;

    return (
        <div
            onClick={onCardClick}
            className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden ${isAlcHigh
                ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'
                : isAlcWarning
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
        >
            <Wine className="absolute -bottom-4 -right-4 w-24 h-24 text-rose-500/5 dark:text-rose-400/10 pointer-events-none transform rotate-12 transition-all group-hover:scale-110" />
            <div className={`flex items-center justify-between ${density === 'compact' ? 'mb-1' : 'mb-2'} relative z-10`}>
                <div className="flex items-center gap-1.5">
                    <div className={`p-1.5 rounded-full ${isAlcHigh ? 'bg-rose-100 text-rose-600' : isAlcWarning ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <Wine className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Alkohol</span>
                </div>
                {density !== 'compact' && alcoholLimit !== undefined && alcoholLimit > 0 && (
                    <div className="text-[8px] font-bold text-slate-400 tracking-tighter">Max: {alcoholLimit}</div>
                )}
            </div>
            <div className="flex-1">
                {isEditing ? (
                    <div className="flex gap-1 items-baseline" onClick={e => e.stopPropagation()}>
                        <input
                            autoFocus
                            type="number"
                            value={tempValue}
                            onChange={(e) => onValueChange(e.target.value)}
                            onBlur={onSave}
                            onKeyDown={onKeyDown}
                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-lg font-bold text-slate-900 dark:text-white p-1 w-16 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="text-[9px] font-bold text-slate-400 uppercase">E</span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline gap-1">
                            <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${isAlcHigh ? 'text-rose-600' : isAlcWarning ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{alc}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">E</span>
                        </div>
                        <div className={`flex gap-0.5 mt-2 ${density === 'compact' ? 'h-1' : 'h-2'}`}>
                            {Array.from({ length: Math.max(alc, 4) }).map((_, i) => (
                                <div
                                    key={i}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAlcoholClick(i + 1);
                                    }}
                                    className={`flex-1 rounded-full cursor-pointer transition-colors ${i < alc ? (isAlcHigh ? 'bg-rose-500' : 'bg-amber-400 shadow-sm') : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'} `}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
