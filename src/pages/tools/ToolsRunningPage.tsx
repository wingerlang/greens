import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ToolsRacePredictorPage } from './ToolsRacePredictorPage.tsx';
import { ToolsRacePlannerPage } from './ToolsRacePlannerPage.tsx';
import { ToolsPaceConverterPage } from './ToolsPaceConverterPage.tsx';
import ToolsCooperPage from './ToolsCooperPage.tsx';
import { ToolsHeartRatePage } from './ToolsHeartRatePage.tsx';
import { Timer, Map, Gauge, Activity, HeartPulse } from 'lucide-react';

export function ToolsRunningPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab') || 'predict';

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

    const tabs = [
        { id: 'predict', label: 'Race Predictor', icon: Timer, component: ToolsRacePredictorPage },
        { id: 'planner', label: 'Race Planner', icon: Map, component: ToolsRacePlannerPage },
        { id: 'pace', label: 'Pace Converter', icon: Gauge, component: ToolsPaceConverterPage },
        { id: 'cooper', label: 'Coopers Test', icon: Activity, component: ToolsCooperPage },
        { id: 'hr', label: 'Pulszoner', icon: HeartPulse, component: ToolsHeartRatePage },
    ];

    const ActiveComponent = tabs.find(t => t.id === tabParam)?.component || ToolsRacePredictorPage;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in pb-20">
            <div className="text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200 mb-2">
                        Running Tools
                    </h1>
                    <p className="text-slate-400 max-w-2xl">
                        Ett enhetligt gränssnitt för att optimera din löpning. Planera lopp, omvandla tempo, och analysera din kapacitet.
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex overflow-x-auto custom-scrollbar pb-0 gap-2 border-b border-white/10">
                {tabs.map(tab => {
                    const isActive = tabParam === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                                isActive
                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500 rounded-t-2xl shadow-[inset_0_-2px_10px_rgba(16,185,129,0.1)]'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent rounded-t-2xl'
                            }`}
                        >
                            <Icon size={18} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="mt-4">
                <ActiveComponent />
            </div>
        </div>
    );
}

export default ToolsRunningPage;
