import React from 'react';
import { Trophy, HeartPulse } from 'lucide-react';
import { UniversalActivity } from '../../../models/types.ts';
import { getBestEffortsForActivity, getFastestSince } from '../../../utils/performanceEngine.ts';
import { formatPace, formatSecondsToTime, getRelativeTime } from '../../../utils/dateUtils.ts';

export const BestEffortPerformanceCard = React.memo(({
    activity,
    allActivities,
    onSelectActivity
}: {
    activity: UniversalActivity;
    allActivities: UniversalActivity[];
    onSelectActivity?: (id: string | null) => void;
}) => {
    const efforts = getBestEffortsForActivity(activity);
    if (!efforts || efforts.length === 0) return null;

    // Filter to common distances for a cleaner view
    const relevantEfforts = efforts
        .filter(e =>
            [0.4, 0.8, 1, 2, 3, 5, 10, 21.1, 42.2].some(d => Math.abs(e.distance / 1000 - d) < 0.05) &&
            !e.name.toLowerCase().includes('mile')
        )
        .reduce((acc, current) => {
            // Ensure unique distance categories (e.g., only one 1k effort)
            // Use bucket-based deduplication with 50m tolerance for common distances
            const dKm = current.distance / 1000;
            const buckets = [0.4, 0.8, 1, 2, 3, 5, 10, 21.1, 42.2];
            const matchingBucket = buckets.find(b => Math.abs(dKm - b) < 0.05);
            const dKey = matchingBucket !== undefined ? matchingBucket : Math.round(dKm * 10) / 10;

            const existing = acc.find(a => {
                const aKm = a.distance / 1000;
                const aBucket = buckets.find(b => Math.abs(aKm - b) < 0.05);
                const aKey = aBucket !== undefined ? aBucket : Math.round(aKm * 10) / 10;
                return aKey === dKey;
            });

            if (!existing) {
                acc.push(current);
            } else if (current.movingTime < existing.movingTime) {
                const idx = acc.indexOf(existing);
                acc[idx] = current;
            }
            return acc;
        }, [] as any[])
        .sort((a, b) => b.distance - a.distance);

    if (relevantEfforts.length === 0) return null;

    return (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-4 shadow-xl shadow-indigo-500/5 mt-4">
            <div className="flex items-center justify-between mb-1">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <Trophy size={14} className="text-amber-400" /> BÄSTA TIDER I PASSET
                </h4>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full uppercase">
                        Jämfört med historik
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
                {relevantEfforts.map((effort, idx) => {
                    const result = getFastestSince(activity, effort.distance, effort.movingTime, allActivities);
                    const isPB = result === 'PB';

                    return (
                        <div key={idx} className="bg-slate-800/40 rounded-xl p-3 border border-white/5 flex flex-col gap-2 group hover:bg-slate-800/60 transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                {/* Left: Distance & Km range */}
                                <div className="flex items-center gap-4 min-w-[120px]">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-white italic tracking-tight uppercase">
                                            {effort.name.toUpperCase()
                                                .replace('1K', '1K')
                                                .replace('1KM', '1K')
                                                .replace('800M', '800M')
                                                .replace('5K', '5K')
                                                .replace('10K', '10K')
                                            }
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                            {(effort as any).startKm ? `Km ${(effort as any).startKm}-${Math.floor(((effort as any).startKm) + Math.round(effort.distance / 1000))}` : ''}
                                        </span>
                                    </div>

                                    {isPB && (
                                        <div className="bg-amber-500/20 text-amber-400 text-[7px] font-black px-1 py-0.5 rounded border border-amber-500/20 flex items-center gap-0.5 uppercase">
                                            PB
                                        </div>
                                    )}
                                </div>

                                {/* Center: Time, Pace, HR */}
                                <div className="flex-initial flex flex-wrap items-center gap-x-6 gap-y-1">
                                    <div className="flex flex-col min-w-[70px]">
                                        <div className="text-base font-black text-indigo-300 font-mono leading-none">
                                            {formatSecondsToTime(effort.movingTime)}
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-mono tracking-tighter mt-0.5 uppercase">Totaltid</div>
                                    </div>

                                    <div className="flex flex-col border-l border-white/5 pl-4 min-w-[70px]">
                                        <div className="text-[14px] font-black text-slate-200 font-mono leading-none">
                                            {formatPace(effort.movingTime / (Math.max(effort.distance, 1) / 1000)).replace('/km', '')}
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-mono tracking-tighter mt-0.5 uppercase">Snitt-tempo</div>
                                    </div>

                                    {effort.avgHeartRate && (
                                        <div className="flex flex-col border-l border-white/5 pl-4">
                                            <div className="text-[14px] font-black text-rose-400 font-mono leading-none flex items-center gap-1">
                                                <HeartPulse size={12} className="opacity-80" /> {effort.avgHeartRate}
                                            </div>
                                            <div className="text-[9px] text-slate-500 font-mono tracking-tighter mt-0.5 uppercase">Snittpuls</div>
                                        </div>
                                    )}
                                </div>

                                {/* Right: Comparison */}
                                <div className="flex-1 sm:text-right border-t sm:border-t-0 sm:border-l border-white/5 pt-2 sm:pt-0 sm:pl-4 min-w-0">
                                    {!isPB && result && typeof result === 'object' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectActivity?.(result.id);
                                            }}
                                            className="flex flex-col items-start sm:items-end group/link hover:opacity-80 transition-all text-left w-full"
                                        >
                                            <div className="flex flex-col items-start sm:items-end flex-1 min-w-0">
                                                <span className="text-[10px] font-black text-indigo-400 group-hover/link:underline truncate w-full sm:text-right">
                                                    {result.title}
                                                </span>
                                                <div className="flex items-center gap-1 mt-0.5 ml-auto">
                                                    <span className="text-[8px] font-mono text-slate-500 bg-white/5 px-1.5 rounded-full uppercase">
                                                        {getRelativeTime(result.date).toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    )}
                                    {!isPB && !result && (
                                        <div className="flex flex-col items-start sm:items-end">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Historik</span>
                                            <span className="text-[10px] font-bold text-slate-600 italic uppercase">Längesedan sist</span>
                                        </div>
                                    )}
                                    {isPB && (
                                        <div className="flex flex-col items-start sm:items-end">
                                            <span className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest mb-0.5">NYTT PERSONBÄSTA!</span>
                                            <span className="text-[10px] font-bold text-slate-400 italic">Grymt jobbat idag!</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
