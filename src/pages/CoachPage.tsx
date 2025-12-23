import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useSearchParams } from 'react-router-dom';
import { CoachCalendar } from '../components/coach/CoachCalendar.tsx';
import { CoachSetup } from '../components/coach/CoachSetup.tsx';
import { CoachFeasibility } from '../components/coach/CoachFeasibility.tsx';
import { CoachInsights } from '../components/coach/CoachInsights.tsx';
import { CoachPlanSummary } from '../components/coach/CoachPlanSummary.tsx';
import './CoachPage.css';

type TabType = 'plan' | 'summary' | 'setup' | 'analysis' | 'progress';

export function CoachPage() {
    const { coachConfig, plannedActivities } = useData();
    const [searchParams, setSearchParams] = useSearchParams();

    const tabFromUrl = searchParams.get('tab') as TabType | null;
    const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl || 'plan');

    useEffect(() => {
        if (tabFromUrl && ['plan', 'summary', 'setup', 'analysis', 'progress'].includes(tabFromUrl)) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    return (
        <div className="coach-page min-h-screen bg-slate-950 text-white p-2 md:p-6">
            {/* Header Area */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tighter mb-1">
                        Smart <span className="coach-logo-italic">Coach</span> 🧠
                    </h1>
                    <p className="text-slate-400 max-w-xl text-[11px] leading-relaxed opacity-80 font-medium">
                        Din personliga, algoritmiska löpcoach. Jack Daniels VDOT, 80/20-regeln & adaptiv progression.
                    </p>
                </div>

                <div className="flex gap-1 p-1 bg-slate-900/40 rounded-xl border border-white/5 backdrop-blur-2xl shadow-2xl">
                    <button
                        onClick={() => handleTabChange('plan')}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'plan' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Plan
                    </button>
                    <button
                        onClick={() => handleTabChange('summary')}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'summary' ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        📊 Översikt
                    </button>
                    <button
                        onClick={() => handleTabChange('setup')}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'setup' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Setup
                    </button>
                    <button
                        onClick={() => handleTabChange('analysis')}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Analys
                    </button>
                    <button
                        onClick={() => handleTabChange('progress')}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'progress' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Progress
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                {!coachConfig && activeTab !== 'setup' ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-20 h-20 mb-6 bg-emerald-500/10 rounded-full flex items-center justify-center text-4xl">🔭</div>
                        <h2 className="text-xl font-black mb-3">Dags att bygga din plan</h2>
                        <p className="text-slate-400 mb-6 max-w-sm text-sm">Berätta för coachen om din nuvarande form och mål.</p>
                        <button
                            onClick={() => handleTabChange('setup')}
                            className="px-8 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-[10px]"
                        >
                            Konfigurera
                        </button>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {activeTab === 'plan' && <CoachCalendar activities={plannedActivities || []} />}
                        {activeTab === 'summary' && <CoachPlanSummary activities={plannedActivities || []} />}
                        {activeTab === 'setup' && <CoachSetup />}
                        {activeTab === 'analysis' && <CoachFeasibility />}
                        {activeTab === 'progress' && <CoachInsights />}
                    </div>
                )}
            </main>
        </div>
    );
}
