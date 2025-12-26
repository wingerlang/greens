import React, { useState, useEffect } from 'react';
import { TrainingOverview } from '../../components/training/TrainingOverview.tsx';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { StyrkaView } from './StyrkaView.tsx';
import { KonditionView } from './KonditionView.tsx';

interface TrainingViewProps {
    exerciseEntries: ExerciseEntry[];
    days: number;
    universalActivities: UniversalActivity[];
    initialTab?: 'overview' | 'strength' | 'cardio';
}

export function TrainingView({ exerciseEntries, days, universalActivities, initialTab = 'overview' }: TrainingViewProps) {
    const [subTab, setSubTab] = useState<'overview' | 'strength' | 'cardio'>(initialTab);

    // Sync if initialTab changes (e.g. navigation from parent)
    useEffect(() => {
        if (initialTab) setSubTab(initialTab);
    }, [initialTab]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    Total Träningsanalys
                </h2>

                {/* Sub-Navigation Pills */}
                <div className="flex p-1 bg-slate-900 border border-white/5 rounded-xl self-start">
                    <button
                        onClick={() => setSubTab('overview')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'overview' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Översikt
                    </button>
                    <button
                        onClick={() => setSubTab('strength')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'strength' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Styrka
                    </button>
                    <button
                        onClick={() => setSubTab('cardio')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'cardio' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Kondition
                    </button>
                </div>
            </header>

            <div className="min-h-[500px]">
                {subTab === 'overview' && (
                    <TrainingOverview exercises={exerciseEntries} />
                )}
                {subTab === 'strength' && (
                    <StyrkaView days={days} />
                )}
                {subTab === 'cardio' && (
                    <KonditionView
                        days={days}
                        exerciseEntries={exerciseEntries}
                        universalActivities={universalActivities}
                    />
                )}
            </div>
        </div>
    );
}
