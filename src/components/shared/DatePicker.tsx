import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getISODate } from '../../models/types.ts';

interface DatePickerProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
    label?: string;
    showLabel?: boolean;
}

export function DatePicker({
    selectedDate,
    onDateChange,
    label = 'Datum',
    showLabel = true
}: DatePickerProps) {
    const today = getISODate();
    const isToday = selectedDate === today;
    const isYesterday = selectedDate === getISODate(new Date(Date.now() - 86400000));

    const navigateDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        onDateChange(getISODate(date));
    };

    const getDisplayDate = () => {
        if (isToday) return 'Idag';
        if (isYesterday) return 'Igår';
        const d = new Date(selectedDate);
        return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    return (
        <div className="flex items-center justify-center gap-2">
            <button
                onClick={() => navigateDate(-1)}
                className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
            >
                <ChevronLeft size={18} />
            </button>

            <div className="relative flex items-center gap-2">
                {showLabel && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {label}
                    </span>
                )}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isToday
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-slate-800/50 border-slate-700 text-white'
                    }`}>
                    <Calendar size={14} className={isToday ? 'text-emerald-400' : 'text-slate-400'} />
                    <span className="text-sm font-bold">{getDisplayDate()}</span>
                    {isToday && <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">NU</span>}
                </div>
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                />
            </div>

            <button
                onClick={() => navigateDate(1)}
                className="p-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );
}
