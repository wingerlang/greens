import React from 'react';
import { SummaryView } from '../components/summary/SummaryView.tsx';
import { TrainingTabs } from '../components/training/TrainingTabs.tsx';

export function SummaryPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white pb-8 animate-in fade-in duration-700">
            <TrainingTabs currentTab="summary" />
            <div className="p-4 md:p-8 pt-4">
                <SummaryView />
            </div>
        </div>
    );
}
