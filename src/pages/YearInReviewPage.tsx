import React from 'react';
import { YearInReviewView } from '../components/training/YearInReviewView.tsx';
import { TrainingTabs } from '../components/training/TrainingTabs.tsx';

export function YearInReviewPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-white pb-8 animate-in fade-in duration-700">
            <TrainingTabs currentTab="analys" />
            <div className="p-4 md:p-8 pt-4">
                <YearInReviewView />
            </div>
        </div>
    );
}
