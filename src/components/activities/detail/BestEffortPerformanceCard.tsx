import React from 'react';
import { Trophy, HeartPulse } from 'lucide-react';
import { UniversalActivity } from '../../../models/types.ts';
import { getBestEffortsForActivity, getFastestSince } from '../../../utils/performanceEngine.ts';
import { formatPace, formatSecondsToTime, getRelativeTime, formatDuration } from '../../../utils/dateUtils.ts';
import { snapToTrack } from '../../../utils/trackUtils.ts';
import { isTempoInterval } from '../../../utils/activityUtils.ts';

export const BestEffortPerformanceCard = React.memo(({
    activity,
    allActivities,
    onSelectActivity,
    onExtract
}: {
    activity: UniversalActivity;
    allActivities: UniversalActivity[];
    onSelectActivity?: (id: string | null) => void;
    onExtract?: (effort: { startKm: number; durationSeconds: number; title: string; distance: number }) => void;
}) => {
    const efforts = getBestEffortsForActivity(activity);
    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    const isTrackMode = !!activity.performance?.isTrack;
    const laps = activity.performance?.laps || (activity as any).laps || [];
    const splits = activity.performance?.splits || (activity as any).splits || [];

    if (!efforts || efforts.length === 0) return null;

    // Filter to common distances for a cleaner view
    const relevantEfforts = efforts
        .filter(e =>
            [0.4, 0.8, 1, 1.5, 1.6, 2, 3, 5, 10, 21.1, 42.2].some(d => Math.abs(e.distance / 1000 - d) < 0.05) &&
            !e.name.toLowerCase().includes('mile')
        )
        .reduce((acc, current) => {
            // Ensure unique distance categories (e.g., only one 1k effort)
            // Use bucket-based deduplication with 50m tolerance for common distances
            const dKm = current.distance / 1000;
            const buckets = [0.4, 0.8, 1, 1.5, 1.6, 2, 3, 5, 10, 21.1, 42.2];
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
                    const isInterval = isTempoInterval(activity);
                    const isPB = !isInterval && result === 'PB';

                    return (
                        <div 
                            key={idx} 
                            onClick={() => setExpandedId(expandedId === effort.name ? null : effort.name)}
                            className={`bg-slate-800/40 rounded-xl p-2 sm:p-2.5 border transition-all cursor-pointer group hover:bg-slate-800/60 ${expandedId === effort.name ? 'border-indigo-500/30' : 'border-white/5'}`}
                        >
                            <div className={`flex flex-col ${expandedId === effort.name ? 'lg:flex-row' : ''} gap-3 sm:gap-4`}>
                                {expandedId === effort.name && (
                                    <div className="flex-1 min-w-0 order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-white/10 pt-4 lg:pt-0 lg:pr-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
                                            VARVS-DETALJER ({effort.source.toUpperCase()})
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="flex items-center justify-between px-2 pb-1 text-[8px] font-black text-slate-600 uppercase tracking-tighter border-b border-white/5 mb-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-4">#</span>
                                                    <span className="w-14">Distans</span>
                                                    <span className="w-12">Tid</span>
                                                    <span className="w-14">Ack. Dist</span>
                                                    <span className="w-12">Ack. Tid</span>
                                                    <span className="w-14">Ack. Tempo</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="w-12 text-right">Tempo</span>
                                                    <span className="w-[40px] text-right">Puls</span>
                                                </div>
                                            </div>
                                            {(() => {
                                                let accTime = 0;
                                                let accDist = 0;
                                                let hrSum = 0;
                                                let hrTime = 0;
                                                
                                                const rows = (effort.detailedSegments || effort.segmentIndexes?.map((idx: number) => ({ index: idx })))?.map((segDetail: any) => {
                                                    const sIdx = segDetail.index;
                                                    const source = effort.source === 'laps' ? laps : splits;
                                                    const seg = source[sIdx];
                                                    if (!seg) return null;
                                                    
                                                    const isPartial = segDetail.isPartial;
                                                    const isStartOffset = segDetail.isStartOffset;
                                                    const rawDist = segDetail.usedDistance || seg.distance;
                                                    const distM = segDetail.usedDistance ? segDetail.usedDistance : (isTrackMode ? snapToTrack(rawDist) : rawDist);
                                                    const time = segDetail.usedTime || seg.movingTime;
                                                    
                                                    accTime += time;
                                                    accDist += distM;
                                                    
                                                    const hr = seg.averageHeartrate || seg.avgHeartRate || (seg as any).heartRateAvg;
                                                    if (hr) {
                                                        hrSum += hr * time;
                                                        hrTime += time;
                                                    }

                                                    return (
                                                        <div key={`${sIdx}-${isPartial ? 'partial' : 'full'}`} className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/10 transition-colors border-l-2 border-transparent hover:border-indigo-500/30 bg-black/5">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[9px] font-black text-slate-600 w-4">
                                                                    {isPartial ? (isStartOffset ? `~${sIdx + 1}` : `${sIdx + 1}~`) : `#${sIdx + 1}`}
                                                                </span>
                                                                <span className="text-[11px] font-bold text-slate-200 w-14">
                                                                    {distM >= 1000 ? `${(distM / 1000).toFixed(2)} km` : `${Math.round(distM)} m`}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-slate-300 w-12">{formatSecondsToTime(time)}</span>
                                                                <span className="text-[9px] font-bold text-slate-500 w-14">
                                                                    {(accDist / 1000).toFixed(2)} km
                                                                </span>
                                                                <span className="text-[10px] font-mono text-indigo-300/60 w-12">{formatSecondsToTime(accTime)}</span>
                                                                <span className="text-[9px] font-mono text-slate-400 w-14">
                                                                    {formatPace(accTime / (accDist / 1000)).replace('/km', '')}
                                                                </span>

                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-[11px] font-mono text-indigo-400 font-bold w-12 text-right">{formatPace(time / (distM / 1000)).replace('/km', '')}</span>
                                                                {hr && (
                                                                    <span className="text-[9px] font-mono text-rose-400 flex items-center gap-1 min-w-[40px] justify-end">
                                                                        <HeartPulse size={10} /> {Math.round(hr)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                });

                                                const avgHR = hrTime > 0 ? Math.round(hrSum / hrTime) : null;

                                                return (
                                                    <>
                                                        {rows}
                                                        {/* Summary Row */}
                                                        <div className="flex items-center justify-between py-2 px-2 rounded-lg bg-indigo-500/10 border-t border-indigo-500/20 mt-2">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[9px] font-black text-indigo-400 w-4">Σ</span>
                                                                <span className="text-[11px] font-black text-white w-14">TOTALT</span>
                                                                <span className="text-[10px] font-black text-indigo-300 w-12 font-mono">{formatSecondsToTime(accTime)}</span>
                                                                <span className="text-[10px] font-black text-white w-14">{(accDist / 1000).toFixed(2)} km</span>
                                                                <span className="w-12" /> {/* Placeholder for Ack Tid */}
                                                                <span className="text-[10px] font-black text-indigo-300 w-14 font-mono">{formatPace(accTime / (accDist / 1000)).replace('/km', '')}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="w-12" />
                                                                {avgHR && (
                                                                    <span className="text-[10px] font-black text-rose-400 flex items-center gap-1 min-w-[40px] justify-end">
                                                                        <HeartPulse size={12} /> {avgHR}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 order-1 lg:order-2 ${expandedId === effort.name ? 'lg:w-[350px] lg:shrink-0' : 'w-full'}`}>
                                    <div className="flex items-center gap-3 min-w-[100px]">
                                        <div className="flex flex-col">
                                            <span className="text-xs sm:text-sm font-black text-white italic tracking-tight uppercase leading-none">
                                                {effort.name.toUpperCase()}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-mono font-bold leading-none mt-1">
                                                {effort.startKm !== undefined && effort.endKm !== undefined ? (
                                                    isTrackMode && effort.isSnapped ? (
                                                        `Km ${effort.startKm.toFixed(1)}-${(effort.startKm + effort.distance / 1000).toFixed(1)}`
                                                    ) : (
                                                        `Km ${effort.startKm.toFixed(1)}-${effort.endKm.toFixed(1)}`
                                                    )
                                                ) : ''}
                                            </span>
                                        </div>

                                        {isPB && (
                                            <div className="bg-amber-500/20 text-amber-400 text-[7px] font-black px-1 py-0.5 rounded border border-amber-500/20 flex items-center gap-0.5 uppercase">
                                                PB
                                            </div>
                                        )}
                                        {isInterval && result === 'PB' && (
                                            <div className="bg-slate-500/10 text-slate-500 text-[7px] font-black px-1 py-0.5 rounded border border-slate-500/10 flex items-center gap-0.5 uppercase cursor-help" title="Intervaller (med vila) räknas ej som PB. Extrahera segmentet manuellt för att logga det som en prestation.">
                                                Ej PB (Intervall)
                                            </div>
                                        )}
                                        {effort.isSnapped && (
                                            <div className="bg-emerald-500/20 text-emerald-400 text-[7px] font-black px-1 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5 uppercase ml-1">
                                                Ban-snappat
                                            </div>
                                        )}
                                    </div>

                                    {/* Center: Time, Pace, HR */}
                                    <div className={`flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 ${expandedId === effort.name ? 'flex-col sm:flex-row' : ''}`}>
                                        <div className="flex flex-col min-w-[60px]">
                                            <div className="text-lg font-black text-indigo-300 font-mono leading-none">
                                                {formatSecondsToTime(effort.movingTime)}
                                            </div>
                                            <div className="text-[8px] text-slate-500 font-black tracking-widest mt-0.5 uppercase opacity-60">TOTALTID</div>
                                        </div>

                                        <div className="flex flex-col border-l border-white/10 pl-3 sm:pl-4 min-w-[60px]">
                                            <div className="text-sm font-black text-slate-200 font-mono leading-none">
                                                {formatPace(effort.movingTime / (Math.max(effort.distance, 1) / 1000)).replace('/km', '')}
                                            </div>
                                            <div className="text-[8px] text-slate-500 font-black tracking-widest mt-0.5 uppercase opacity-60">SNITT-TEMPO</div>
                                        </div>

                                        {effort.avgHeartRate && (
                                            <div className="flex flex-col border-l border-white/10 pl-3 sm:pl-4 min-w-[60px]">
                                                <div className="text-sm font-black text-rose-400 font-mono leading-none flex items-center gap-1">
                                                    <HeartPulse size={12} className="opacity-80" /> {effort.avgHeartRate}
                                                </div>
                                                <div className="text-[8px] text-slate-500 font-black tracking-widest mt-0.5 uppercase opacity-60">SNITTPULS</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Comparison & Extraction */}
                                    <div className="flex-1 sm:text-right border-t sm:border-t-0 sm:border-l border-white/5 pt-2 sm:pt-0 sm:pl-3 min-w-0 flex flex-col justify-center">
                                        {!isPB && result && typeof result === 'object' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectActivity?.(result.id);
                                                }}
                                                className="flex flex-col items-start sm:items-end group/link hover:opacity-80 transition-all text-left w-full sm:mb-0"
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
                                                <span className="text-[9px] font-bold text-slate-600 italic uppercase">Längesedan sist</span>
                                            </div>
                                        )}
                                        {isPB && (
                                            <div className="flex flex-col items-start sm:items-end">
                                                <span className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest mb-0.5">NYTT PERSONBÄSTA!</span>
                                                <span className="text-[9px] font-bold text-slate-400 italic">Grymt jobbat idag!</span>
                                            </div>
                                        )}

                                        {onExtract && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onExtract({
                                                        startKm: effort.startKm || 0,
                                                        durationSeconds: effort.movingTime,
                                                        title: effort.name,
                                                        distance: effort.distance / 1000
                                                    });
                                                }}
                                                className="mt-1 self-start sm:self-end px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/5"
                                            >
                                                ✂️ Extrahera som mätning
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});
