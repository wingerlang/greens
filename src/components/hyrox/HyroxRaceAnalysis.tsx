import React, { useMemo } from 'react';
import { HyroxSessionSummary } from '../../models/types.ts';
import { analyzeHyroxRace } from '../../utils/hyroxAnalysisEngine.ts';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell
} from 'recharts';

interface HyroxRaceAnalysisProps {
    session: HyroxSessionSummary;
}

export function HyroxRaceAnalysis({ session }: HyroxRaceAnalysisProps) {
    const analysis = useMemo(() => analyzeHyroxRace(session), [session]);

    // Data for Pacing Chart
    const pacingData = useMemo(() => {
        const validRuns = (session.runSplits || []).filter((r: number) => r > 0);
        if (validRuns.length === 0) return [];

        const avg = validRuns.reduce((a: number, b: number) => a + b, 0) / validRuns.length;

        return (session.runSplits || []).map((time: number, i: number) => ({
            name: `R${i + 1}`,
            time: time > 0 ? Math.round(time) : null,
            avg: avg
        })).filter((d: { time: number | null }) => d.time !== null);
    }, [session.runSplits]);

    // Data for Station Delta Chart
    const stationData = Object.entries(session.splits || {})
        .filter(([id, time]) => id !== 'run_1km' && time && time > 0)
        .map(([id, time]) => ({
            station: id.replace(/_/g, ' ').toUpperCase(),
            time: time,
            score: Math.max(0, 100 - (time! / 600 * 100)) // Arbitrary "Score" 0-100 for radar
        }));

    const fmtSec = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.round(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // Calculate additional metrics
    const totalRunTime = pacingData.reduce((acc, d) => acc + (d.time || 0), 0);
    const totalStationTime = stationData.reduce((acc, d) => acc + (d.time || 0), 0);
    const avgPace = pacingData.length > 0 ? totalRunTime / pacingData.length : 0;
    const estimatedRoxzone = session.totalDuration ? (session.totalDuration * 60) - totalRunTime - totalStationTime : 0;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Summary Grid - Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Fatigue Index</span>
                    <span className={`text-2xl font-black ${analysis.fatigueIndex > 15 ? 'text-rose-500' : 'text-emerald-400'}`}>
                        {Math.round(analysis.fatigueIndex)}%
                    </span>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Pacing Decay</span>
                    <span className={`text-2xl font-black ${analysis.pacingDecay > 10 ? 'text-amber-500' : 'text-emerald-400'}`}>
                        {Math.round(analysis.pacingDecay)}%
                    </span>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Bästa Gren</span>
                    <span className="text-xl font-black text-white text-center leading-tight">
                        {analysis.bestStation.label}
                    </span>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Sämsta Gren</span>
                    <span className="text-xl font-black text-rose-500 text-center leading-tight">
                        {analysis.worstStation.label}
                    </span>
                </div>
            </div>

            {/* Summary Grid - Row 2 (Detailed Times) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-sky-500/10 p-4 rounded-2xl border border-sky-500/20 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-sky-400 font-bold uppercase mb-1">Total Löptid</span>
                    <span className="text-2xl font-black text-white font-mono">{fmtSec(totalRunTime)}</span>
                    <span className="text-[8px] text-slate-500 mt-1">{pacingData.length} rundor</span>
                </div>
                <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-amber-400 font-bold uppercase mb-1">Total Stationstid</span>
                    <span className="text-2xl font-black text-white font-mono">{fmtSec(totalStationTime)}</span>
                    <span className="text-[8px] text-slate-500 mt-1">{stationData.length} stationer</span>
                </div>
                <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Snittempo/km</span>
                    <span className="text-2xl font-black text-white font-mono">{avgPace > 0 ? fmtSec(avgPace) : '-'}</span>
                    <span className="text-[8px] text-slate-500 mt-1">min/km</span>
                </div>
                <div className="bg-violet-500/10 p-4 rounded-2xl border border-violet-500/20 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-violet-400 font-bold uppercase mb-1">Roxzone (Est.)</span>
                    <span className="text-2xl font-black text-white font-mono">{estimatedRoxzone > 0 ? fmtSec(estimatedRoxzone) : '-'}</span>
                    <span className="text-[8px] text-slate-500 mt-1">övergångar</span>
                </div>
            </div>

            {/* Narrative & Insights */}
            <div className="bg-slate-950/40 p-6 rounded-3xl border border-white/5 space-y-4">
                <p className="text-slate-200 text-sm leading-relaxed font-medium italic">
                    "{analysis.narrative}"
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Styrkor</h5>
                        <ul className="space-y-1">
                            {analysis.strengths.map((s, i) => (
                                <li key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                    <span className="text-emerald-500">✦</span> {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Svagheter / Utveckling</h5>
                        <ul className="space-y-1">
                            {analysis.weaknesses.map((w, i) => (
                                <li key={i} className="text-xs text-slate-300 flex items-center gap-2">
                                    <span className="text-rose-500">⚠</span> {w}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pacing Chart */}
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 h-64">
                    <h5 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Löptempo (Pacing)</h5>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pacingData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#475569"
                                fontSize={10}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                hide
                                domain={['dataMin - 10', 'dataMax + 10']}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                labelStyle={{ fontWeight: 'black', color: '#f43f5e' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => [fmtSec(value), 'Tid']}
                            />
                            <Line
                                type="monotone"
                                dataKey="time"
                                stroke="#f43f5e"
                                strokeWidth={4}
                                dot={{ fill: '#f43f5e', r: 4 }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Station Efficiency */}
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 h-64">
                    <h5 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Stationsprofil</h5>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stationData} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="station"
                                stroke="#475569"
                                fontSize={8}
                                width={80}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => [`${Math.round(value)}`, 'Relativ Effektivitet']}
                            />
                            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                {stationData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.score > 70 ? '#10b981' : entry.score > 40 ? '#f59e0b' : '#f43f5e'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Projection Footer */}
            {analysis.projectedFullRaceTime && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-rose-500 text-black p-3 rounded-2xl text-2xl">🏃</div>
                        <div>
                            <h6 className="text-white font-black text-sm uppercase">Estimerad Tävlingstid</h6>
                            <p className="text-rose-500 text-[10px] font-bold uppercase tracking-tight">Baserat på nuvarande simulation & splits</p>
                        </div>
                    </div>
                    <div className="text-4xl font-black text-white font-mono">
                        {fmtSec(analysis.projectedFullRaceTime)}
                    </div>
                </div>
            )}
        </div>
    );
}
