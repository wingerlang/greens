import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getISODate } from '../../models/types.ts';

interface DatePickerProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
    /** Size variant: 'sm' for compact use, 'lg' for header style like dashboard */
    size?: 'sm' | 'lg';
}

/**
 * DatePicker component matching the Dashboard header style.
 * Shows "Idag" / "Igår" + full date below with navigation arrows.
 */
export function DatePicker({
    selectedDate,
    onDateChange,
    size = 'lg'
}: DatePickerProps) {
    const today = getISODate();
    const yesterday = getISODate(new Date(Date.now() - 86400000));
    const isToday = selectedDate === today;
    const isYesterday = selectedDate === yesterday;

    const navigateDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        onDateChange(getISODate(date));
    };

    const getDisplayDate = () => {
        if (isToday) return 'Idag';
        if (isYesterday) return 'Igår';
        return selectedDate;
    };

    const getFullDate = () => {
        return new Date(selectedDate).toLocaleDateString('sv-SE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    };

    if (size === 'sm') {
        // Compact style for inline use
        return (
            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigateDate(-1)}
                    className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                >
                    <ChevronLeft size={14} />
                </button>
                <div className="relative flex items-center gap-2">
                    <span className={`text-sm font-bold ${isToday ? 'text-emerald-400' : 'text-white'}`}>
                        {getDisplayDate()}
                    </span>
                    {isToday && <span className="text-[8px] font-black bg-emerald-500 text-white px-1 py-0.5 rounded">NU</span>}
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => onDateChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
                <button
                    onClick={() => navigateDate(1)}
                    className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        );
    }

    // Large style matching dashboard header
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigateDate(-1)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="group relative">
                    <h1
                        className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => onDateChange(today)}
                    >
                        {getDisplayDate()}
                    </h1>
                    {!isToday && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                            Klicka för att återgå till Idag
                        </div>
                    )}
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => onDateChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>

                <button
                    onClick={() => navigateDate(1)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                    <ChevronRight size={24} />
                </button>
            </div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider opacity-60">
                {getFullDate()}
            </div>
        </div>
    );
}
