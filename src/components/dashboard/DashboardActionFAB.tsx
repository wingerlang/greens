import React, { useState } from 'react';
import { Plus, Ruler, Dumbbell } from 'lucide-react';

interface DashboardActionFABProps {
    onLogMeasurements: () => void;
    onImportWorkout: () => void;
}

export function DashboardActionFAB({ onLogMeasurements, onImportWorkout }: DashboardActionFABProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            {/* Secondary Actions */}
            <div className={`flex flex-col gap-3 transition-all duration-300 ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>

                {/* Import Workout */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onImportWorkout();
                        setIsOpen(false);
                    }}
                    className="flex items-center gap-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-full shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group border border-slate-200 dark:border-slate-700"
                >
                    <span className="text-xs font-bold uppercase tracking-wider">Importera Pass</span>
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                        <Dumbbell size={16} />
                    </div>
                </button>

                {/* Log Measurements */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onLogMeasurements();
                        setIsOpen(false);
                    }}
                    className="flex items-center gap-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-4 py-2 rounded-full shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group border border-slate-200 dark:border-slate-700"
                >
                    <span className="text-xs font-bold uppercase tracking-wider">Logga Mått</span>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <Ruler size={16} />
                    </div>
                </button>
            </div>

            {/* Main FAB */}
            <button
                className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 ${isOpen ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rotate-45' : 'bg-emerald-500 hover:bg-emerald-400 rotate-0'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Plus size={28} strokeWidth={2.5} />
            </button>
        </div>
    );
}
