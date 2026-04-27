import React, { useState, useMemo } from 'react';
import { TrainingTabs } from '../../components/training/TrainingTabs.tsx';
import { SummaryView } from '../../components/summary/SummaryView.tsx';
import { DataAnalysisView } from './DataAnalysisView.tsx';
import { YearInReviewView } from '../../components/training/YearInReviewView.tsx';
import { useData } from '../../context/DataContext.tsx';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Search, Calendar, FileText } from 'lucide-react';

type AnalysisTab = 'summary' | 'data' | 'review';

export function AnalysisHubPage() {
    const { unifiedActivities = [], universalActivities = [] } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const currentSubTab = useMemo(() => {
        const t = searchParams.get('tab');
        return (t === 'data' || t === 'review') ? t as AnalysisTab : 'summary';
    }, [searchParams]);

    const setSubTab = (tab: AnalysisTab) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('tab', tab);
        setSearchParams(newParams, { replace: true });
    };

    const tabs = [
        { id: 'summary', label: 'Summering', icon: <FileText size={16} /> },
        { id: 'data', label: 'Analys & Kontroll', icon: <Search size={16} /> },
        { id: 'review', label: 'Årsöversikt', icon: <Calendar size={16} /> }
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-white pb-20 animate-in fade-in duration-700">
            <TrainingTabs currentTab="analys" />
            
            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
                {/* Sub-tab Navigation */}
                <div className="flex flex-wrap items-center gap-2 mb-8 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id as AnalysisTab)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                                currentSubTab === tab.id 
                                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105' 
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {currentSubTab === 'summary' && <SummaryView />}
                    {currentSubTab === 'data' && (
                        <DataAnalysisView 
                            exerciseEntries={unifiedActivities} 
                            universalActivities={universalActivities}
                            setSelectedActivityId={(id) => {
                                // For now, we could use a global modal or redirect
                                console.log('Selected activity:', id);
                            }}
                        />
                    )}
                    {currentSubTab === 'review' && <YearInReviewView />}
                </div>
            </div>
        </div>
    );
}
