import React from 'react';
import { RoadmapModule } from '../components/admin/RoadmapModule.tsx';

export function RoadmapPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header>
                <h1 className="text-3xl font-black tracking-tight text-white mb-2">🚀 Roadmap</h1>
                <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold opacity-50">
                    Planerade funktioner och framtida utveckling
                </p>
            </header>

            <RoadmapModule />
        </div>
    );
}
