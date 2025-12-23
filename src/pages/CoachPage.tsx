import React, { useState } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { CoachCalendar } from '../components/coach/CoachCalendar.tsx';
import { CoachSetup } from '../components/coach/CoachSetup.tsx';
import { CoachFeasibility } from '../components/coach/CoachFeasibility.tsx';
import { CoachInsights } from '../components/coach/CoachInsights.tsx';
import './CoachPage.css';

export function CoachPage() {
    const { coachConfig, plannedActivities } = useData();
    const [activeTab, setActiveTab] = useState<'plan' | 'setup' | 'analysis' | 'progress'>('plan');

    return (
        <div className="coach-page min-h-screen bg-slate-950 text-white p-4 md:p-8">
            {/* Header Area */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-12 max-w-7xl mx-auto">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter mb-2">
                        Smart <span className="coach-logo-italic">Coach</span> 🧠
                    </h1>
                    <p className="text-slate-400 max-w-xl text-sm leading-relaxed opacity-80 font-medium">
                        Din personliga, algoritmiska löpcoach. Baserad på Jack Daniels VDOT, 80/20-regeln och adaptiv progression.
                    </p>
                </div>

                <div className="flex gap-2 p-1 bg-slate-900/40 rounded-2xl border border-white/5 backdrop-blur-2xl shadow-2xl">
                    <button
                        onClick={() => setActiveTab('plan')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'plan' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Träningsplan
                    </button>
                    <button
                        onClick={() => setActiveTab('setup')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'setup' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Inställningar
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Bedömning
                    </button>
                    <button
                        onClick={() => setActiveTab('progress')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'progress' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        Progress
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                {!coachConfig ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-24 h-24 mb-8 bg-emerald-500/10 rounded-full flex items-center justify-center text-5xl">🔭</div>
                        <h2 className="text-2xl font-black mb-4">Dags att bygga din plan</h2>
                        <p className="text-slate-400 mb-8 max-w-sm">Berätta för coachen om din nuvarande form och dina mål för att generera ditt program.</p>
                        <button
                            onClick={() => setActiveTab('setup')}
                            className="px-12 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl hover:bg-emerald-400 transition-all shadow-2xl shadow-emerald-500/20 uppercase tracking-widest"
                        >
                            Konfigurera Coachen
                        </button>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {activeTab === 'plan' && <CoachCalendar activities={plannedActivities || []} />}
                        {activeTab === 'setup' && <CoachSetup />}
                        {activeTab === 'analysis' && <CoachFeasibility />}
                        {activeTab === 'progress' && <CoachInsights />}
                    </div>
                )}
            </main>
        </div>
    );
}
