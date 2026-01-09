import React from 'react';
import { Wine } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface AlcoholCardProps {
    vitals: { alcohol?: number };
    editing: string | null;
    tempValue: string;
    setTempValue: (val: string) => void;
    handleSave: (field: string) => void;
    handleKeyDown: (e: React.KeyboardEvent, field: string) => void;
    handleCardClick: (cardId: string, value: any) => void;
    density: 'compact' | 'slim' | 'normal';
}

export const AlcoholCard: React.FC<AlcoholCardProps> = ({
    vitals,
    editing,
    tempValue,
    setTempValue,
    handleSave,
    handleKeyDown,
    handleCardClick,
    density
}) => {
    const { settings } = useSettings();
    const dayOfWeek = (new Date()).getDay();
    const isWeekendLimit = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    const alcLimit = settings.dailyAlcoholLimitWeekend !== undefined && settings.dailyAlcoholLimitWeekday !== undefined
        ? (isWeekendLimit ? settings.dailyAlcoholLimitWeekend : settings.dailyAlcoholLimitWeekday)
        : undefined;
    const alc = vitals?.alcohol || 0;
    const isAlcHigh = alcLimit !== undefined && alc > alcLimit;
    const isAlcWarning = alcLimit !== undefined && !isAlcHigh && alc > 0 && alc === alcLimit;

    return (
        <div
            onClick={() => handleCardClick('alcohol', alc)}
            className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden h-full ${isAlcHigh
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
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Alk</span>
                </div>
                {density !== 'compact' && alcLimit !== undefined && alcLimit > 0 && (
                    <div className="text-[8px] font-bold text-slate-400 tracking-tighter">Max: {alcLimit}</div>
                )}
            </div>
            <div className="flex-1">
                {editing === 'alcohol' ? (
                    <div className="flex gap-1 items-baseline" onClick={e => e.stopPropagation()}>
                        <input
                            autoFocus
                            type="number"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            onBlur={() => handleSave('alcohol')}
                            onKeyDown={(e) => handleKeyDown(e, 'alcohol')}
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
                        {density !== 'compact' && (
                            <div className="mt-1 text-[8px] font-black uppercase tracking-tight opacity-60">
                                {isAlcHigh ? 'Över gräns' : isAlcWarning ? 'På gränsen' : 'Inom gräns'}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
