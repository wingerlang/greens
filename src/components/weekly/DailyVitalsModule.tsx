import React from 'react';
import { DailyVitals as DailyVitalsType } from '../../models/types.ts';

interface DailyVitalsProps {
    vitals: DailyVitalsType;
    onUpdate: (updates: Partial<DailyVitalsType>) => void;
}

export function DailyVitalsModule({ vitals, onUpdate }: DailyVitalsProps) {
    // Water logic
    const handleWaterClick = (count: number) => {
        // If clicking the current value, reset to one less or 0? 
        // Better: just set to that value. If clicking current, maybe toggle?
        if (vitals.water === count) {
            onUpdate({ water: count - 1 });
        } else {
            onUpdate({ water: count });
        }
    };

    // Sleep logic
    const handleSleepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ sleep: parseFloat(e.target.value) || 0 });
    };

    return (
        <div className="daily-vitals-module mt-6 pt-4 border-t border-white/5 space-y-5">
            {/* Water Tracking */}
            <div className="water-tracker group">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <span className="text-sm">💧</span> Vatten
                    </span>
                    <span className="text-[10px] font-bold text-sky-400/40 bg-sky-500/5 px-2 py-0.5 rounded-full border border-sky-500/10">
                        {vitals.water} GLAS
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <button
                            key={i}
                            onClick={() => handleWaterClick(i)}
                            className={`w-7 h-7 rounded-lg transition-all duration-300 flex items-center justify-center text-[10px] font-bold border ${vitals.water >= i
                                    ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.3)] scale-105 z-10'
                                    : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:border-white/10 hover:text-slate-300'
                                }`}
                        >
                            {i}
                        </button>
                    ))}
                    {vitals.water > 8 && (
                        <div className="flex items-center px-2 py-1 bg-sky-500/20 rounded-lg border border-sky-500/20 animate-pulse">
                            <span className="text-[10px] font-black text-sky-400">+{vitals.water - 8}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Sleep Tracking */}
            <div className="sleep-tracker group">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <span className="text-sm">💤</span> Sömn
                    </span>
                    <span className="text-[10px] font-bold text-indigo-400/40 bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/10">
                        {vitals.sleep.toFixed(1)}H
                    </span>
                </div>
                <div className="relative group/slider">
                    <input
                        type="range"
                        min="0"
                        max="12"
                        step="0.5"
                        value={vitals.sleep}
                        onChange={handleSleepChange}
                        className="w-full h-1.5 bg-slate-800/50 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                    />
                    <div className="flex justify-between mt-2 px-1">
                        {[0, 4, 8, 12].map(h => (
                            <span key={h} className="text-[8px] font-bold text-slate-600 tracking-tighter">{h}h</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
