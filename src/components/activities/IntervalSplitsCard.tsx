import { ClassifiedSplit, SegmentedSplits } from '../../utils/splitsSegmenter.ts';
import { getBestEffortsForActivity } from '../../utils/performanceEngine.ts';
import { UniversalActivity } from '../../models/types.ts';

interface IntervalSplitsCardProps {
    activity: UniversalActivity;
    segmented: SegmentedSplits;
    highlightRange?: { start: number; end: number };
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
        <div className="bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">
            <div className={`px-4 py-2.5 border-b border-white/10 ${accentClass}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-black uppercase tracking-wider text-white">{title}</div>
                    <div className="text-[10px] text-slate-200/80 font-semibold">{splits.length} lap(s)</div>
                </div>
                {subtitle && <div className="text-[10px] text-slate-200/70 mt-0.5">{subtitle}</div>}
            </div>
            <div className="px-4 py-2.5">
                <SplitRows splits={splits} fastestPace={fastestPace} slowestPace={slowestPace} highlightRange={highlightRange} />
            </div>
        </div>
    );
}


export function IntervalSplitsCard({ activity, segmented, highlightRange }: IntervalSplitsCardProps) {
    const { type, classified, intervalGroups, summary, warmupSplits, cooldownSplits } = segmented;
    const isSustained = type === 'sustained';

    if (!classified.length) return null;

    const allPaces = classified.map(s => s.movingTime / (Math.max(s.distance, 1) / 1000));
    const fastestPace = Math.min(...allPaces);
    const slowestPace = Math.max(...allPaces);

    // Dynamisk pace-uträkning ifall backenden saknar det
    const avgWarmupPace = warmupSplits.length > 0
        ? warmupSplits.reduce((acc, s) => acc + s.movingTime / (Math.max(s.distance, 1) / 1000), 0) / warmupSplits.length
        : 0;

    const avgCooldownPace = cooldownSplits.length > 0
        ? cooldownSplits.reduce((acc, s) => acc + s.movingTime / (Math.max(s.distance, 1) / 1000), 0) / cooldownSplits.length
        : 0;

    const bestEfforts = getBestEffortsForActivity(activity);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black text-violet-400 uppercase tracking-widest">
                    {isSustained ? 'Tempoanalys (Strava laps)' : 'Intervallanalys (Strava laps)'}
                </h3>
                <span className="text-[9px] bg-violet-500/10 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/20 font-black uppercase tracking-widest">
                    {isSustained ? 'Sammanhängande' : `${intervalGroups.length} block`}
                </span>

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
                    <div className="p-3 grid grid-cols-3 md:grid-cols-6 gap-2">
                        {bestEfforts.map(effort => (
                            <div key={effort.distance} className="bg-slate-800/50 rounded-lg p-2 text-center border border-white/5">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                    {effort.distance >= 1000 ? `${effort.distance / 1000} km` : `${effort.distance} m`}
                                </div>
                                <div className="text-sm font-black text-white">{formatDuration(effort.movingTime)}</div>
                                <div className="text-[10px] text-indigo-300/80 font-mono mt-0.5">{formatPaceSec(effort.movingTime / (effort.distance / 1000))}/km</div>
                            </div>
                        ))}
                    </div>
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

            <div className="space-y-3">
                {intervalGroups.map((group) => (
                    <div key={group.number} className="bg-slate-900/50 rounded-2xl border border-amber-500/20 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/15">
                            <div className="text-xs font-black text-amber-300 uppercase tracking-wider">
                                {isSustained ? 'Effort: Huvuddel' : `Intervallblock ${group.number}`}
                            </div>

                            <div className="text-[10px] font-semibold text-slate-200">
                                {formatPaceSec(group.avgPace)}/km
                                {group.avgHR ? ` • ${Math.round(group.avgHR)} bpm` : ''}
                            </div>
                        </div>
                        <div className="px-4 py-2.5 flex flex-col md:flex-row gap-4 md:items-start">
                            <div className="flex-1">
                                <SplitRows splits={group.intervalSplits} fastestPace={fastestPace} slowestPace={slowestPace} highlightRange={highlightRange} fastestIntervalPace={summary.fastestIntervalPace} />
                            </div>
                            {group.recoverySplits.length > 0 && (
                                <div className="border-t md:border-t-0 md:border-l border-white/5 pt-2 md:pt-0 md:pl-3 mt-2 md:mt-0 flex items-center gap-2 max-w-sm">
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider shrink-0">VILA</div>
                                    <div className="flex flex-wrap gap-1">
                                        {group.recoverySplits.map(s => {
                                            const pace = s.movingTime / (Math.max(s.distance, 1) / 1000);
                                            const roundedMeters = Math.round(s.distance / 10) * 10;
                                            const isUnderKm = roundedMeters < 1000;
                                            return (
                                                <div key={s.split} className="flex items-center gap-1 py-0.5 text-[10px] text-slate-300 px-1.5 bg-white/10 hover:bg-white/20 transition-all rounded border border-white/5">
                                                    <span className="text-slate-500 font-mono">#{s.split}</span>
                                                    {isUnderKm ? (
                                                        <span className="font-bold text-white">{roundedMeters}m</span>
                                                    ) : (
                                                        <span className="font-bold text-white">{(s.distance / 1000).toFixed(2)}k</span>
                                                    )}
                                                    <span className="text-amber-400 font-mono font-bold">{formatPaceSec(pace)}</span>
                                                    {s.averageHeartrate && <span className="text-rose-400 font-black ml-0.5">{Math.round(s.averageHeartrate)}</span>}
                                                </div>
                                            );
                                        })}
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