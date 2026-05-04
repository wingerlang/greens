import React from 'react';
import { ClassifiedSplit, SegmentedSplits } from '../../utils/splitsSegmenter.ts';
import { getBestEffortsForActivity } from '../../utils/performanceEngine.ts';
import { UniversalActivity, ExerciseEntry } from '../../models/types.ts';
import { snapToTrack } from '../../utils/trackUtils.ts';
import { Heart } from 'lucide-react';

interface IntervalSplitsCardProps {
    activity: UniversalActivity | ExerciseEntry;
    segmented: SegmentedSplits;
    highlightRange?: { start: number; end: number };
    onToggleTrack?: (isTrack: boolean) => void;
}

function formatPaceSec(seconds: number): string {
    if (!seconds || !isFinite(seconds) || seconds <= 0) return '--:--';
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
    if (!seconds || !isFinite(seconds) || seconds <= 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function roleSwedish(role: ClassifiedSplit['role']): string {
    if (role === 'warmup') return 'Uppjogg';
    if (role === 'interval') return 'Intervall';
    if (role === 'recovery') return 'Vila';
    if (role === 'cooldown') return 'Nerjogg';
    return 'Okänd';
}

function roleClasses(role: ClassifiedSplit['role']): string {
    if (role === 'warmup') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (role === 'interval') return 'bg-amber-500/15 text-amber-200 border-amber-500/30';
    if (role === 'recovery') return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    if (role === 'cooldown') return 'bg-blue-500/15 text-blue-200 border-blue-500/30';
    return 'bg-slate-700/20 text-slate-300 border-slate-600/30';
}

function SplitBar({ pace, fastestPace, slowestPace, role }: { pace: number; fastestPace: number; slowestPace: number; role: ClassifiedSplit['role'] }) {
    const range = slowestPace - fastestPace || 1;
    const normalized = 1 - (pace - fastestPace) / range;
    const width = 35 + normalized * 65;

    const colors: Record<string, string> = {
        warmup: 'bg-emerald-500/70',
        interval: 'bg-amber-400',
        recovery: 'bg-slate-500',
        cooldown: 'bg-blue-400/70',
        unknown: 'bg-slate-700',
    };

    return (
        <div className="h-2.5 rounded-full overflow-hidden" style={{ width: `${width}%` }}>
            <div className={`h-full rounded-full ${colors[role] || colors.unknown}`} />
        </div>
    );
}

function SplitRows({ splits, fastestPace, slowestPace, highlightRange, fastestIntervalPace }: { splits: ClassifiedSplit[]; fastestPace: number; slowestPace: number; highlightRange?: { start: number; end: number }; fastestIntervalPace?: number }) {
    return (
        <div className="space-y-1.5">
            {splits.map((split, i) => {
                const pace = split.movingTime / (Math.max(split.distance, 1) / 1000);
                const isHighlighted = highlightRange && split.split >= highlightRange.start && split.split <= highlightRange.end;
                const isFastest = fastestIntervalPace && split.role === 'interval' && Math.abs(pace - fastestIntervalPace) < 0.5; // Small tolerance for float match
                const roundedMeters = Math.round(split.distance / 10) * 10;
                const isUnderKm = roundedMeters < 1000;

                return (
                    <div key={`${split.split}-${i}`} className={`flex items-center gap-1.5 py-0.5 hover:bg-white/5 transition-all rounded px-1 -mx-1 group ${isHighlighted ? 'bg-amber-500/10 border-l-2 border-amber-400' : ''}`}>
                        <div className="flex items-center gap-1.5 shrink-0 min-w-[95px]">
                            <span className="text-[10px] font-mono text-slate-500 w-4">#{split.split}</span>
                            {isUnderKm ? (
                                <span className={`text-xs font-black ${split.role === 'interval' ? 'text-amber-300' : 'text-slate-300'}`}>{roundedMeters}<span className="text-[10px] opacity-70">m</span></span>
                            ) : (
                                <span className={`text-xs font-black ${split.role === 'interval' ? 'text-amber-300' : 'text-slate-300'}`}>{(split.distance / 1000).toFixed(2)}<span className="text-[10px] opacity-70">k</span></span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">{formatDuration(split.movingTime || 0)}</span>
                        </div>
                        
                        <div className="flex-1 max-w-[100px] ml-1">
                            <SplitBar pace={pace} fastestPace={fastestPace} slowestPace={slowestPace} role={split.role} />
                        </div>

                        {isFastest && <span className="text-[10px] text-amber-300 font-black ml-1">🏆</span>}

                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                            <span className="text-xs font-black text-white font-mono leading-none">{formatPaceSec(pace)}</span>
                            <span className={`text-[7.5px] px-1 py-0.2 border border-white/5 ${roleClasses(split.role)} scale-95 origin-right font-black uppercase tracking-tighter`}>
                                {roleSwedish(split.role).slice(0, 5)}
                            </span>
                        </div>

                        {split.averageHeartrate ? (
                            <div className="flex items-center gap-0.5 w-7 justify-end shrink-0">
                                <span className="text-[11px] font-black text-rose-400 font-mono leading-none">{Math.round(split.averageHeartrate)}</span>
                            </div>
                        ) : (
                            <span className="text-[10px] text-slate-600 font-mono w-7 text-right shrink-0">-</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function SectionCard({
    title,
    subtitle,
    accentClass,
    splits,
    fastestPace,
    slowestPace,
    highlightRange,
}: {
    title: string;
    subtitle?: string;
    accentClass: string;
    splits: ClassifiedSplit[];
    fastestPace: number;
    slowestPace: number;
    highlightRange?: { start: number; end: number };
}) {
    if (splits.length === 0) return null;

    return (
        <div className="bg-slate-900/40 rounded-xl border border-white/5 overflow-hidden">
            <div className={`px-3 py-1.5 border-b border-white/5 ${accentClass}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/90">{title}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{splits.length} {splits.length === 1 ? 'lap' : 'laps'}</div>
                </div>
            </div>
            <div className="px-3 py-2">
                <SplitRows splits={splits} fastestPace={fastestPace} slowestPace={slowestPace} highlightRange={highlightRange} />
            </div>
        </div>
    );
}


// Snapping logic moved to trackUtils.ts

export function IntervalSplitsCard({ activity, segmented, highlightRange, onToggleTrack }: IntervalSplitsCardProps) {
    const isTrackMode = !!(activity as any).isTrack || !!(activity as any).performance?.isTrack;

    // Corrected data if in track mode
    const correctedSegmented = React.useMemo(() => {
        if (!isTrackMode) return segmented;

        const correctSplit = (s: ClassifiedSplit): ClassifiedSplit => {
            if (s.role !== 'interval' && s.role !== 'recovery') return s;
            const newDist = snapToTrack(s.distance);
            return { ...s, distance: newDist };
        };

        const newClassified = segmented.classified.map(correctSplit);
        const newWarmup = segmented.warmupSplits.map(correctSplit);
        const newCooldown = segmented.cooldownSplits.map(correctSplit);
        
        const newGroups = segmented.intervalGroups.map(g => {
            const newIntervals = g.intervalSplits.map(correctSplit);
            const newRecovery = g.recoverySplits.map(correctSplit);
            const totalTime = newIntervals.reduce((sum, s) => sum + s.movingTime, 0);
            const totalDist = newIntervals.reduce((sum, s) => sum + s.distance, 0);

            // New summary for recovery
            const totalRecTime = newRecovery.reduce((sum, s) => sum + s.movingTime, 0);
            const totalRecHr = newRecovery.reduce((sum, s) => sum + (s.averageHeartrate || 0) * s.movingTime, 0);
            const avgRecHR = totalRecTime > 0 ? Math.round(totalRecHr / totalRecTime) : 0;

            return {
                ...g,
                intervalSplits: newIntervals,
                recoverySplits: newRecovery,
                avgPace: totalDist > 0 ? totalTime / (totalDist / 1000) : g.avgPace,
                avgRecHR,
                totalRecTime
            };
        });

        // Recalculate summary
        const intervals = newClassified.filter(s => s.role === 'interval');
        const totalIntervalTime = intervals.reduce((sum, s) => sum + s.movingTime, 0);
        const totalIntervalDist = intervals.reduce((sum, s) => sum + s.distance, 0);

        const intervalPaces = intervals.map(sp => sp.movingTime / (Math.max(sp.distance, 1) / 1000));

        return {
            ...segmented,
            classified: newClassified,
            warmupSplits: newWarmup,
            cooldownSplits: newCooldown,
            intervalGroups: newGroups,
            summary: {
                ...segmented.summary,
                totalIntervalKm: totalIntervalDist / 1000,
                avgIntervalPace: totalIntervalDist > 0 ? totalIntervalTime / (totalIntervalDist / 1000) : segmented.summary.avgIntervalPace,
                fastestIntervalPace: intervalPaces.length > 0 ? Math.min(...intervalPaces) : 0,
                slowestIntervalPace: intervalPaces.length > 0 ? Math.max(...intervalPaces) : 0,
            }
        };
    }, [segmented, isTrackMode]);

    const { type, classified, intervalGroups, summary, warmupSplits, cooldownSplits } = correctedSegmented;
    const isSustained = type === 'sustained';

    if (!classified.length) return null;

    const allPaces = classified.map(s => s.movingTime / (Math.max(s.distance, 1) / 1000));
    const fastestPace = Math.min(...allPaces);
    const slowestPace = Math.max(...allPaces);

    // Använd förberäknade snitt-tempon från segmenteringen (viktat snitt total tid / total distans)
    const { avgWarmupPace, avgCooldownPace } = summary;

    const bestEfforts = getBestEffortsForActivity(activity as any);
    const [expandedEffort, setExpandedEffort] = React.useState<number | null>(null);

    return (
        <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
                <div className="flex flex-col gap-1">
                    <h3 className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                        {isSustained ? 'Tempoanalys (Strava laps)' : 'Intervallanalys (Strava laps)'}
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-[9px] bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/20 font-black uppercase tracking-widest">
                            {isSustained ? 'Sammanhängande' : `${intervalGroups.length} block`}
                        </span>
                    </div>
                </div>

                <button 
                    onClick={() => onToggleTrack?.(!isTrackMode)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                        isTrackMode 
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-900/20' 
                        : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800/60'
                    }`}
                >
                    <span className="text-xs">🏃‍♂️</span>
                    <span className="text-[9px] font-black uppercase tracking-wider">Banläge</span>
                    {isTrackMode && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                </button>
            </div>

            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-800">
                {classified.map((s, i) => {
                    const colors: Record<string, string> = {
                        warmup: 'bg-emerald-500',
                        interval: 'bg-amber-400',
                        recovery: 'bg-slate-600',
                        cooldown: 'bg-blue-400',
                    };
                    return <div key={i} className={`${colors[s.role] || 'bg-slate-700'}`} style={{ flex: s.distance }} />;
                })}
            </div>

            <div className={`grid grid-cols-2 ${isSustained && summary.totalRecoveryKm === 0 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 text-center`}>
                <div className="flex flex-col items-center">
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Uppjogg</div>
                    <div className="text-sm font-black text-emerald-400">{summary.warmupKm.toFixed(1)}<span className="text-[8px] text-slate-500">km</span></div>
                    {avgWarmupPace > 0 && <div className="text-[10px] text-emerald-400/60 font-mono mt-0.5">{formatPaceSec(avgWarmupPace)}/km</div>}
                </div>
                <div className="flex flex-col items-center">
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
                        {isSustained ? 'Huvuddel' : 'Intervall'}
                    </div>
                    <div className="text-sm font-black text-amber-300">{summary.totalIntervalKm.toFixed(1)}<span className="text-[8px] text-slate-500">km</span></div>
                    {summary.avgIntervalPace > 0 && <div className="text-[10px] text-amber-300/60 font-mono mt-0.5">{formatPaceSec(summary.avgIntervalPace)}/km</div>}
                </div>
                {(!isSustained || summary.totalRecoveryKm > 0) && (
                    <div className="flex flex-col items-center">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Vila</div>
                        <div className="text-sm font-black text-slate-300">{summary.totalRecoveryKm.toFixed(1)}<span className="text-[8px] text-slate-500">km</span></div>
                        {summary.avgRecoveryPace > 0 && <div className="text-[10px] text-slate-400/60 font-mono mt-0.5">{formatPaceSec(summary.avgRecoveryPace)}/km</div>}
                    </div>
                )}
                <div className="flex flex-col items-center">
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Nerjogg</div>
                    <div className="text-sm font-black text-blue-300">{summary.cooldownKm.toFixed(1)}<span className="text-[8px] text-slate-500">km</span></div>
                    {avgCooldownPace > 0 && <div className="text-[10px] text-blue-300/60 font-mono mt-0.5">{formatPaceSec(avgCooldownPace)}/km</div>}
                </div>
            </div>

            {bestEfforts.length > 0 && (
                <div className="bg-slate-900/50 rounded-2xl border border-indigo-500/20 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-indigo-500/15 bg-indigo-500/10">
                        <div className="text-xs font-black uppercase tracking-wider text-indigo-300">Bästa insatser (sammanhängande)</div>
                    </div>
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {bestEfforts.map(effort => (
                            <button 
                                key={effort.distance} 
                                onClick={() => setExpandedEffort(expandedEffort === effort.distance ? null : effort.distance)}
                                className={`bg-slate-800/50 rounded-lg p-2 text-center border transition-all flex flex-col items-center justify-center group ${expandedEffort === effort.distance ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5 hover:border-white/20'}`}
                            >
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1 group-hover:text-slate-300">
                                    {effort.distance >= 1000 ? `${effort.distance / 1000} km` : `${effort.distance} m`}
                                </div>
                                <div className="text-sm font-black text-white">{formatDuration(effort.movingTime)}</div>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="text-[10px] text-indigo-300/80 font-mono leading-none">{formatPaceSec(effort.movingTime / (effort.distance / 1000))}/km</div>
                                    {effort.avgHeartRate && (
                                        <div className="text-[9px] text-rose-400/80 font-mono font-bold leading-none flex items-center gap-0.5">
                                            <span className="opacity-30 text-white mx-0.5">|</span>
                                            <Heart size={8} fill="currentColor" /> {Math.round(effort.avgHeartRate)}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                    {expandedEffort && (
                        <div className="px-3 pb-3 border-t border-white/5 bg-black/20">
                            <div className="mt-3 space-y-1">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Varvs-detaljer för {expandedEffort >= 1000 ? `${expandedEffort / 1000} km` : `${expandedEffort} m`}
                                </div>
                                {(() => {
                                    let accTime = 0;
                                    return bestEfforts.find(e => e.distance === expandedEffort)?.segmentIndexes?.map(idx => {
                                        const source = (bestEfforts.find(e => e.distance === expandedEffort)?.source === 'laps') ? existingLaps : splits;
                                        const seg = source[idx];
                                        if (!seg) return null;
                                        const distM = isTrackMode ? snapToTrack(seg.distance) : seg.distance;
                                        const time = seg.movingTime;
                                        accTime += time;
                                        const hr = seg.averageHeartrate || seg.avgHeartRate || (seg as any).heartRateAvg;
                                        return (
                                            <div key={idx} className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-amber-500/30">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-black text-slate-600 w-4">#{idx + 1}</span>
                                                    <span className="text-[11px] font-bold text-slate-300 w-16">
                                                        {distM >= 1000 ? `${(distM / 1000).toFixed(2)} km` : `${Math.round(distM)} m`}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-white w-12">{formatDuration(time)}</span>
                                                    <span className="text-[10px] font-mono text-slate-500 w-12">{formatDuration(accTime)}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[11px] font-mono text-emerald-400 font-bold">{formatPaceSec(time / (distM / 1000))}/k</span>
                                                    {hr && (
                                                        <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1 min-w-[50px] justify-end">
                                                            <HeartPulse size={10} /> {Math.round(hr)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <SectionCard
                title="Uppjogg"
                subtitle={isSustained ? "Identifierat före huvuddelen" : "Identifierat före första intervallen"}
                accentClass="bg-emerald-500/25"
                splits={warmupSplits}
                fastestPace={fastestPace}
                slowestPace={slowestPace}
                highlightRange={highlightRange}
            />

            <div className="space-y-3 px-2 md:px-4">
                {intervalGroups.map((group) => (
                    <div key={group.number} className="bg-slate-900/40 rounded-xl border border-amber-500/10 overflow-hidden shadow-lg shadow-black/40">
                        <div className="flex items-center justify-between px-4 py-1.5 bg-amber-500/5 border-b border-white/5">
                            <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest shrink-0">
                                {isSustained ? 'Effort: Huvuddel' : `Block ${group.number}`}
                            </div>

                            <div className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-3">
                                <span className="text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded leading-none">
                                    {formatPaceSec(group.avgPace)}/km
                                </span>
                                {group.avgHR && <span className="opacity-40 font-black tracking-tighter">{Math.round(group.avgHR)} BPM</span>}
                            </div>
                        </div>
                        <div className="px-4 py-2 flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 w-full">
                                <SplitRows splits={group.intervalSplits} fastestPace={fastestPace} slowestPace={slowestPace} highlightRange={highlightRange} fastestIntervalPace={summary.fastestIntervalPace} />
                            </div>
                            
                            {group.recoverySplits.length > 0 && (
                                <div className="flex items-center gap-2 shrink-0 py-1.5 px-3 bg-white/[0.03] border border-white/5 rounded-lg md:min-w-[150px]">
                                    <div className="flex flex-col gap-1.5 w-full">
                                        <div className="flex items-center justify-between">
                                            <div className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Återhämtning</div>
                                            {((group as any).totalRecTime || 0) > 0 && (
                                                <div className="text-[8px] text-slate-500 font-mono flex items-center gap-1">
                                                    <span>{formatDuration((group as any).totalRecTime)}</span>
                                                    {(group as any).avgRecHR > 0 && <span className="text-rose-500/50">{(group as any).avgRecHR} bpm</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {group.recoverySplits.map(s => {
                                                const finalDist = isTrackMode ? snapToTrack(s.distance) : s.distance;
                                                const roundedMeters = Math.round(finalDist / 10) * 10;
                                                const isUnderKm = roundedMeters < 1000;
                                                return (
                                                    <div key={s.split} className="flex items-center justify-between gap-3 text-[10px] text-slate-400 font-mono">
                                                        <span className="font-bold text-slate-300">{isUnderKm ? `${roundedMeters}m` : `${(finalDist / 1000).toFixed(2)}k`}</span>
                                                        <span className="text-amber-500/50">{formatPaceSec(s.movingTime / (Math.max(finalDist, 1) / 1000))}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <SectionCard
                title="Nerjogg"
                subtitle="Identifierat efter sista intervallen"
                accentClass="bg-blue-500/25"
                splits={cooldownSplits}
                fastestPace={fastestPace}
                slowestPace={slowestPace}
                highlightRange={highlightRange}
            />

            <p className="text-[10px] text-slate-600 italic text-center">
                Auto-segmenterat från laps och tempoförändringar.
            </p>
        </div>
    );
}