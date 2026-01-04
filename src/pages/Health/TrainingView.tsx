import { useState, useEffect } from 'react';
import { TrainingOverview } from '../../components/training/TrainingOverview.tsx';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { StyrkaView } from './StyrkaView.tsx';
import { KonditionView } from './KonditionView.tsx';
import { RaceList } from '../../components/training/RaceList.tsx';
import { HyroxDashboard } from '../../components/hyrox/HyroxDashboard.tsx';

interface TrainingViewProps {
    exerciseEntries: ExerciseEntry[];
    days: number;
    universalActivities: UniversalActivity[];
    initialTab?: 'overview' | 'strength' | 'cardio' | 'races' | 'hyrox';
}

export function TrainingView({ exerciseEntries, days, universalActivities, initialTab = 'overview' }: TrainingViewProps) {
    const [subTab, setSubTab] = useState<'overview' | 'strength' | 'cardio' | 'races' | 'hyrox'>(initialTab);

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
                    <button
                        onClick={() => setSubTab('races')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'races' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Tävlingar
                    </button>
                    <button
                        onClick={() => setSubTab('hyrox')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'hyrox' ? 'bg-slate-100 text-slate-900 shadow-lg' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        🏴 Hyrox
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
                {subTab === 'races' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RaceList exerciseEntries={exerciseEntries} universalActivities={universalActivities} />
                    </div>
                )}
                {subTab === 'hyrox' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <HyroxDashboard />
                    </div>
                )}
            </div>
        </div>
    );
}
