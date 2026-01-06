import React, { useState, useEffect } from 'react';
import { MetricFocusView } from './MetricFocusView.tsx';
import { BodyMeasurementsModule } from '../../components/health/BodyMeasurementsModule.tsx';
import { DaySnapshot, HealthStats } from '../../utils/healthAggregator.ts';


interface BodyViewProps {
    snapshots: DaySnapshot[];
    stats: HealthStats;
    days: number;
    initialTab?: 'weight' | 'sleep' | 'measurements' | string;
}
export function BodyView({ snapshots, stats, days, initialTab = 'weight' }: BodyViewProps) {
    const [subTab, setSubTab] = useState<string>(initialTab);

    useEffect(() => {
        if (initialTab) setSubTab(initialTab);
    }, [initialTab]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <span className="text-2xl">🧬</span>
                    Kropp & Balans
                </h2>

                {/* Sub-Navigation Pills */}
                <div className="flex p-1 bg-slate-900 border border-white/5 rounded-xl self-start">
                    <button
                        onClick={() => setSubTab('weight')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'weight' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Vikt
                    </button>
                    <button
                        onClick={() => setSubTab('sleep')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'sleep' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Sömn
                    </button>
                    <button
                        onClick={() => setSubTab('measurements')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${subTab === 'measurements' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        Mått
                    </button>
                </div>
            </header>

            <div className="min-h-[500px]">
                {subTab === 'weight' && (
                    <MetricFocusView type="weight" snapshots={snapshots} stats={stats} days={days} />
                )}
                {subTab === 'sleep' && (
                    <MetricFocusView type="sleep" snapshots={snapshots} stats={stats} days={days} />
                )}
                {subTab === 'measurements' && <BodyMeasurementsModule />}
                {subTab !== 'weight' && subTab !== 'sleep' && subTab !== 'measurements' && (
                    <MetricFocusView type={subTab as any} snapshots={snapshots} stats={stats} days={days} />
                )}
            </div>
        </div>
    );
}
