import React, { useMemo } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { HyroxStation } from '../../models/types.ts';
import { parseHyroxStats, HYROX_STATIONS_ORDER } from '../../utils/hyroxParser.ts';
import { HYROX_ENCYCLOPEDIA } from '../../utils/hyroxEncyclopedia.ts';
import {
    HYROX_STATION_BENCHMARKS,
    HYROX_RACE_BENCHMARKS,
    HYROX_LEVEL_LABELS,
    HYROX_LEVEL_COLORS,
    getHyroxLevelIndex,
    getHyroxPercentile
} from '../../pages/tools/data/hyroxBenchmarks.ts';

const fmtSec = (s: number) => {
    if (!s) return "-";
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

interface HyroxStandardsSectionProps {
    gender: 'male' | 'female';
}

export function HyroxStandardsSection({ gender }: HyroxStandardsSectionProps) {
    const { exerciseEntries, strengthSessions, exercises } = useData();

    // Parse all Hyrox stats
    const hyroxStats = useMemo(
        () => parseHyroxStats(exerciseEntries, strengthSessions, exercises),
        [exerciseEntries, strengthSessions, exercises]
    );

    // Get best times from history
    const stationPBs = useMemo(() => {
        const pbs: Partial<Record<HyroxStation, number>> = {};

        HYROX_STATIONS_ORDER.forEach(station => {
            const stats = hyroxStats[station];
            if (stats && stats.times.length > 0) {
                pbs[station] = Math.min(...stats.times);
            }
        });

        return pbs;
    }, [hyroxStats]);

    // Calculate overall race estimate based on station PBs
    const estimatedRaceTime = useMemo(() => {
        const stationSum = Object.values(stationPBs).reduce((acc, t) => acc + (t || 0), 0);
        if (stationSum === 0) return null;

        // Add estimated run time (8x avg of ~4:30)
        const avgRunTime = 270; // 4:30 per km average estimate
        const runTotal = avgRunTime * 8;
        const roxzone = 180; // 3 min transitions

        return stationSum + runTotal + roxzone;
    }, [stationPBs]);

    const benchmarks = HYROX_RACE_BENCHMARKS[gender];
    const overallLevel = estimatedRaceTime ? getHyroxLevelIndex(estimatedRaceTime, benchmarks) : 0;
    const overallPercentile = estimatedRaceTime ? getHyroxPercentile(estimatedRaceTime, benchmarks) : 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center md:text-left">
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-2">
                    Hyrox Standards
                </h2>
                <p className="text-slate-400 max-w-2xl text-sm">
                    Jämför dina bästa tider mot globala standarder – från nybörjare till proffs.
                </p>
            </div>

            {/* Overall Score Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/40 to-orange-950/40 border border-amber-500/20 rounded-3xl p-6 md:p-8">
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <div className="text-center md:text-left">
                        <div className="text-xs text-amber-400/70 font-bold uppercase tracking-widest mb-1">Estimerad Nivå</div>
                        <div className={`text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r ${HYROX_LEVEL_COLORS[overallLevel] || 'from-slate-500 to-slate-400'}`}>
                            {HYROX_LEVEL_LABELS[overallLevel] || 'Otränad'}
                        </div>
                        {estimatedRaceTime && (
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-2xl font-mono font-bold text-white">{fmtSec(estimatedRaceTime)}</span>
                                <span className="text-xs text-slate-400">estimerat lopp</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-950/50 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center min-w-[180px]">
                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Snabbare än</div>
                        <div className="text-4xl font-black text-amber-400">{overallPercentile}%</div>
                        <div className="text-[10px] text-slate-500">av alla deltagare</div>
                    </div>
                </div>

                {/* Race benchmarks row */}
                <div className="mt-6 pt-4 border-t border-white/5">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Tidsreferenser ({gender === 'male' ? 'Herr' : 'Dam'})</div>
                    <div className="flex flex-wrap gap-2">
                        {HYROX_RACE_BENCHMARKS[gender].map((time, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${HYROX_LEVEL_COLORS[i]}`}></span>
                                <span className="text-[10px] text-slate-400">{HYROX_LEVEL_LABELS[i]}:</span>
                                <span className="text-[10px] text-white font-mono font-bold">{fmtSec(time)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Station Breakdown */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Stationsanalys</h3>

                <div className="grid gap-3">
                    {HYROX_STATIONS_ORDER.filter(s => s !== 'run_1km').map(station => {
                        const stationBenchmarks = HYROX_STATION_BENCHMARKS[station][gender];
                        const pb = stationPBs[station];
                        const levelIdx = pb ? getHyroxLevelIndex(pb, stationBenchmarks) : 0;
                        const percentile = pb ? getHyroxPercentile(pb, stationBenchmarks) : 0;
                        const info = HYROX_ENCYCLOPEDIA[station];

                        // Calculate position on bar (best possible = 100%, worst = 0%)
                        const worstTime = stationBenchmarks[0] * 1.2;
                        const bestTime = stationBenchmarks[stationBenchmarks.length - 1];
                        const barPosition = pb ? Math.max(0, Math.min(100, ((worstTime - pb) / (worstTime - bestTime)) * 100)) : 0;

                        return (
                            <div key={station} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{info?.icon || '🏋️'}</span>
                                        <div>
                                            <div className="text-sm font-bold text-white">{info?.title || station}</div>
                                            <div className="text-[10px] text-slate-500">{info?.standards?.men || '-'}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {pb ? (
                                            <>
                                                <div className="text-right">
                                                    <div className="text-lg font-mono font-bold text-white">{fmtSec(pb)}</div>
                                                    <div className="text-[10px] text-slate-500">Bästa tid</div>
                                                </div>
                                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase bg-gradient-to-r ${HYROX_LEVEL_COLORS[levelIdx]} text-white/90`}>
                                                    {HYROX_LEVEL_LABELS[levelIdx]}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-xs text-slate-500 italic">Ingen data</span>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="relative h-4 bg-slate-800 rounded-full w-full overflow-hidden">
                                    {/* Level segments */}
                                    {HYROX_LEVEL_COLORS.map((color, i) => {
                                        const segmentWidth = 100 / HYROX_LEVEL_COLORS.length;
                                        return (
                                            <div
                                                key={i}
                                                className={`absolute top-0 bottom-0 bg-gradient-to-r ${color} opacity-30`}
                                                style={{
                                                    left: `${i * segmentWidth}%`,
                                                    width: `${segmentWidth}%`,
                                                    borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.3)' : 'none'
                                                }}
                                            />
                                        );
                                    })}

                                    {/* User marker */}
                                    {pb && (
                                        <div
                                            className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] rounded-full z-10"
                                            style={{ left: `${barPosition}%` }}
                                        />
                                    )}
                                </div>

                                {/* Benchmark labels */}
                                <div className="flex justify-between mt-1.5 text-[9px] text-slate-600 font-mono">
                                    <span>{fmtSec(worstTime)}</span>
                                    <span className="text-amber-500">Snabbare än {percentile}%</span>
                                    <span>{fmtSec(bestTime)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="bg-slate-950/30 rounded-2xl p-4 border border-white/5">
                <div className="text-[10px] text-slate-500 font-bold uppercase mb-3">Nivåer & Tidsreferenser</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {HYROX_LEVEL_LABELS.map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${HYROX_LEVEL_COLORS[i]}`}></div>
                            <span className="text-xs text-slate-300 font-medium">{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
