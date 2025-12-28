import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getISODate } from '../../models/types.ts';

type DensityMode = 'compact' | 'slim' | 'cozy';

interface DashboardHeaderProps {
    selectedDate: string;
    today: string;
    density: DensityMode;
    onChangeDate: (days: number) => void;
    onResetToToday: () => void;
    onDensityChange: (mode: DensityMode) => void;
}

/**
 * Dashboard header with date navigation and density mode selector.
 * Shows the current date with < > arrows for navigation.
 */
export const DashboardHeader = ({
    selectedDate,
    today,
    density,
    onChangeDate,
    onResetToToday,
    onDensityChange
}: DashboardHeaderProps) => {
    const getDateLabel = () => {
        if (selectedDate === today) return 'Idag';
        if (selectedDate === getISODate(new Date(Date.now() - 86400000))) return 'Igår';
        return selectedDate;
    };

    const getFullDateString = () => {
        return new Date(selectedDate).toLocaleDateString('sv-SE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    };

    return (
        <header className={`${density === 'compact' ? 'mb-4' : 'mb-10'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => onChangeDate(-1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        aria-label="Previous day"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="group relative">
                        <h1
                            className={`${density === 'compact' ? 'text-2xl' : 'text-4xl md:text-5xl'} font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer`}
                            onClick={onResetToToday}
                        >
                            {getDateLabel()}
                        </h1>
                        {selectedDate !== today && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                                Klicka för att återgå till Idag
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => onChangeDate(1)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        aria-label="Next day"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wider opacity-60 px-10">
                    {getFullDateString()}
                </div>
            </div>

            {/* Density Mode Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                {(['compact', 'slim', 'cozy'] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => onDensityChange(m)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${density === m
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            }`}
                    >
                        {m === 'compact' ? 'Tiny' : m === 'slim' ? 'Slim' : 'Cozy'}
                    </button>
                ))}
            </div>
        </header>
    );
};
