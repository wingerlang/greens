import React from 'react';
import { HeartPulse } from 'lucide-react';
import { formatPace } from '../../../utils/dateUtils.ts';

export const IntervalMiniSummary = React.memo(({ segmentedSplits }: { segmentedSplits: any }) => {
    if (!segmentedSplits) return null;
    const { classified, summary, type } = segmentedSplits;
    const isSustained = type === 'sustained';

    const colors: Record<string, string> = {
        warmup: 'bg-emerald-500',
        interval: 'bg-amber-400',
        recovery: 'bg-slate-600',
        cooldown: 'bg-blue-400',
    };

    return (
        <div className="bg-violet-500/5 border border-violet-500/10 rounded-2xl p-4 mt-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                    {isSustained ? 'Analys: Sammanhängande försök' : 'Intervallsammanfattning'}
                </h4>

                <div className="text-[10px] font-bold text-slate-400">
                    {summary.totalIntervalKm.toFixed(1)}km
                </div>
            </div>

            {/* Colored Ribbon */}
            <div className="flex gap-0.5 h-3 rounded-full overflow-hidden bg-slate-800 mb-4 shadow-inner">
                {classified.map((s: any, i: number) => (
                    <div
                        key={i}
                        className={`${colors[s.role] || 'bg-slate-700'} hover:brightness-125 transition-all cursor-help`}
                        style={{ flex: s.distance }}
                        title={`${s.role}: ${s.distance.toFixed(0)}m`}
                    />
                ))}
            </div>

            {/* Phase stats */}
            <div className={`grid ${isSustained && summary.totalRecoveryKm === 0 ? 'grid-cols-3' : 'grid-cols-4'} gap-2`}>
                <div className="text-center group">
                    <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-emerald-500 transition-colors">Uppjogg</div>
                    <div className="text-[11px] font-black text-emerald-400">{summary.warmupKm.toFixed(1)}k</div>
                </div>
                <div className="text-center group flex flex-col items-center">
                    <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-amber-400 transition-colors">
                        {isSustained ? 'Huvuddel' : 'Intervaller'}
                    </div>
                    <div className="text-[11px] font-black text-amber-300">{summary.totalIntervalKm.toFixed(1)}k</div>
                    <div className="flex gap-2 items-center mt-0.5">
                        {summary.avgIntervalPace > 0 && (
                            <div className="text-[9px] text-amber-400/80 font-mono italic">{formatPace(summary.avgIntervalPace).replace('/km', '')}/km</div>
                        )}
                        {summary.avgIntervalHR && (
                            <div className="text-[9px] text-rose-400 font-mono flex items-center gap-0.5">
                                <HeartPulse size={8} /> {summary.avgIntervalHR}
                            </div>
                        )}
                    </div>
                </div>
                {(!isSustained || summary.totalRecoveryKm > 0) && (
                    <div className="text-center group">
                        <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-white transition-colors">Vila</div>
                        <div className="text-[11px] font-black text-slate-300">{summary.totalRecoveryKm.toFixed(1)}k</div>
                    </div>
                )}
                <div className="text-center group">
                    <div className="text-[7px] text-slate-500 uppercase font-black mb-1 group-hover:text-blue-400 transition-colors">Nerjogg</div>
                    <div className="text-[11px] font-black text-blue-300">{summary.cooldownKm.toFixed(1)}k</div>
                </div>
            </div>
        </div>
    );
});
