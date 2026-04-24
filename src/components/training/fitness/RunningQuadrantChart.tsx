import React, { useMemo } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
    ReferenceLine,
    Cell
} from 'recharts';
import { ExerciseEntry } from '../../../models/types.ts';
import { LayoutGrid, Info, Activity, Zap, Footprints, Timer } from 'lucide-react';

interface RunningQuadrantChartProps {
    allRuns: ExerciseEntry[];
    onOpenActivity?: (id: string) => void;
}

const formatPace = (secs: number) => {
    if (!secs) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

function CustomTooltip({ active, payload, onOpenActivity }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div 
                className="bg-slate-900 border border-white/10 p-4 rounded-2xl shadow-2xl space-y-2 backdrop-blur-xl pointer-events-none"
            >
                <div className="flex justify-between items-start gap-4">
                    <p className="font-black text-white text-sm leading-tight">{data.title || 'Löprunda'}</p>
                    <p className="text-[10px] text-slate-500 font-bold whitespace-nowrap">{data.date}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Distans</p>
                        <p className="text-xs text-white font-mono font-black">{data.distance.toFixed(2)} km</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tempo</p>
                        <p className="text-xs text-emerald-400 font-mono font-black">{formatPace(data.paceSecs)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Puls</p>
                        <p className="text-xs text-rose-400 font-mono font-black">{data.hr || '-'} bpm</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tid</p>
                        <p className="text-xs text-sky-400 font-mono font-black">{Math.floor(data.duration)} min</p>
                    </div>
                </div>
            </div>
        );
    }
    return null;
}

export function RunningQuadrantChart({ allRuns, onOpenActivity }: RunningQuadrantChartProps) {
    const data = useMemo(() => {
        return allRuns.map(run => ({
            activityId: run.id,
            date: run.date.split('T')[0],
            distance: run.distance || 0,
            duration: run.durationMinutes || 0,
            paceSecs: (run.durationMinutes * 60) / (run.distance || 1),
            hr: run.heartRateAvg,
            intensity: run.intensity,
            title: run.title || run.notes?.substring(0, 40)
        })).filter(d => d.distance > 0 && d.paceSecs < 600); // Filter out outliers
    }, [allRuns]);

    const { distBuckets, totalRuns, medians } = useMemo(() => {
        const thresholds = [0, 5, 10, 15, 21.1, 42.2, 50, 80.5];
        const labels = ['0-5k', '5-10k', '10-15k', '15-21.1k', '21.1-42.2k', 'Maraton-50k', '50k-50m', 'Ultra+'];
        
        const buckets = labels.map((label, i) => {
            const min = thresholds[i];
            const max = thresholds[i+1] || Infinity;
            const runs = data.filter(d => d.distance >= min && d.distance < max);
            const avgPace = runs.length > 0 ? runs.reduce((sum, r) => sum + r.paceSecs, 0) / runs.length : 0;
            return { label, min, max, count: runs.length, avgPace };
        });

        const sortedDist = [...data].sort((a, b) => a.distance - b.distance);
        const sortedPace = [...data].sort((a, b) => a.paceSecs - b.paceSecs);
        
        const calculatedMedians = {
            dist: data.length > 0 ? sortedDist[Math.floor(data.length / 2)].distance : 10,
            pace: data.length > 0 ? sortedPace[Math.floor(data.length / 2)].paceSecs : 300
        };

        return { distBuckets: buckets, totalRuns: data.length, medians: calculatedMedians };
    }, [data]);

    if (data.length === 0) return null;

    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 md:p-6 shadow-2xl space-y-6 overflow-hidden relative">
            {/* Background Gradients for Quadrants */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-[0.03] pointer-events-none">
                <div className="bg-amber-500" /> {/* Top Left: Speed */}
                <div className="bg-emerald-500" /> {/* Top Right: Quality */}
                <div className="bg-sky-500" />    {/* Bottom Left: Recovery */}
                <div className="bg-indigo-500" /> {/* Bottom Right: Base */}
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <LayoutGrid size={20} className="text-indigo-400" /> Träningsprofil & Passfördelning
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Visualisering av alla löppass baserat på distans och tempo. Kvadranterna utgår från dina personliga medianvärden.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">⚡️ Speed / Sprints</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Korta och snabba pass. Intervaller och fartlek.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">🏁 Quality / Race</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Längre pass med högt tempo. Tröskel och tävling.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1">🍃 Recovery / Easy</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Korta återhämtningspass i lugnt tempo.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">🏔️ Base / Long</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Långpass och mängdträning i lugnt tempo.</p>
                </div>
            </div>

            <div className="h-[450px] w-full relative z-10 group">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 40, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={true} />
                        
                        {/* X-Axis: Distance */}
                        <XAxis 
                            type="number" 
                            dataKey="distance" 
                            name="Distans" 
                            unit=" km" 
                            stroke="#ffffff30"
                            tick={{ fill: '#ffffff50', fontSize: 10, fontWeight: 'bold' }}
                            label={{ value: 'Distans (km)', position: 'bottom', fill: '#ffffff30', fontSize: 10, fontWeight: 'black', offset: 0 }}
                            domain={[0, 'dataMax + 2']}
                        />

                        {/* Y-Axis: Pace (Inverted) */}
                        <YAxis 
                            type="number" 
                            dataKey="paceSecs" 
                            name="Tempo" 
                            reversed 
                            stroke="#ffffff30"
                            tick={{ fill: '#ffffff50', fontSize: 10, fontWeight: 'bold' }}
                            tickFormatter={formatPace}
                            label={{ value: 'Tempo (min/km)', angle: -90, position: 'insideLeft', fill: '#ffffff30', fontSize: 10, fontWeight: 'black' }}
                            domain={['dataMin - 15', 'dataMax + 15']}
                        />

                        <ZAxis type="number" dataKey="hr" range={[50, 400]} />

                        <Tooltip 
                            content={<CustomTooltip onOpenActivity={onOpenActivity} />} 
                            cursor={{ strokeDasharray: '3 3', stroke: '#ffffff20' }} 
                        />

                        {/* Quadrant Dividers */}
                        <ReferenceLine x={medians.dist} stroke="#ffffff10" strokeDasharray="5 5" />
                        <ReferenceLine y={medians.pace} stroke="#ffffff10" strokeDasharray="5 5" />

                        {/* Distance Reference Lines */}
                        {[5, 10, 15, 21.1, 42.2, 50, 80.5].map(dist => {
                            const bucket = distBuckets.find(b => b.max === dist) || distBuckets.find(b => b.min === dist);
                            const count = distBuckets.find(b => b.min === dist)?.count || 0;
                            return (
                                <ReferenceLine 
                                    key={dist} 
                                    x={dist} 
                                    stroke="#ffffff15" 
                                    label={{ 
                                        position: 'insideBottomRight', 
                                        value: dist === 80.5 ? '50m' : `${dist}k`, 
                                        fill: '#ffffff20', 
                                        fontSize: 9,
                                        fontWeight: 'black',
                                        offset: 10
                                    }} 
                                />
                            );
                        })}

                        <Scatter name="Löppass" data={data}>
                            {data.map((entry, index) => {
                                // Determine color based on quadrant
                                const isFast = entry.paceSecs < medians.pace;
                                const isLong = entry.distance > medians.dist;
                                
                                let color = "#94a3b8"; // Default
                                if (isFast && !isLong) color = "#fbbe24"; // Speed (Amber)
                                if (isFast && isLong) color = "#10b981";  // Quality (Emerald)
                                if (!isFast && !isLong) color = "#0ea5e9"; // Recovery (Sky)
                                if (!isFast && isLong) color = "#6366f1";  // Base (Indigo)

                                // Intensity can also affect opacity
                                const opacity = entry.intensity === 'high' ? 0.9 : entry.intensity === 'moderate' ? 0.6 : 0.4;

                                return (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={color} 
                                        fillOpacity={opacity}
                                        stroke={color}
                                        strokeWidth={1}
                                        className="transition-all duration-300 cursor-pointer"
                                        onClick={() => onOpenActivity?.(entry.activityId)}
                                    />
                                );
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>

                {/* Quadrant Labels inside the chart area */}
                <div className="absolute top-8 left-16 pointer-events-none opacity-20">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Speed</p>
                </div>
                <div className="absolute top-8 right-8 pointer-events-none opacity-20 text-right">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Quality</p>
                </div>
                <div className="absolute bottom-12 left-16 pointer-events-none opacity-20">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">Recovery</p>
                </div>
                <div className="absolute bottom-12 right-8 pointer-events-none opacity-20 text-right">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Base</p>
                </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-4 relative z-10">
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Fart / Intervaller</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Kvalitet / Tävling</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-sky-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Återhämtning</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Långpass / Bas</span>
                    </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Footprints size={12} /> Fördelning per distansintervall
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        {distBuckets.map((b, i) => (
                            <div key={i} className="space-y-1 group/bucket">
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-bold text-slate-400 group-hover/bucket:text-white transition-colors">{b.label}</p>
                                    <p className="text-[9px] font-black text-indigo-400">{((b.count / totalRuns) * 100).toFixed(0)}%</p>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 transition-all duration-500" 
                                        style={{ width: `${(b.count / totalRuns) * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[9px]">
                                    <span className="text-slate-500 font-bold">{b.count} st</span>
                                    <span className="text-slate-600 font-mono italic">{b.count > 0 ? formatPace(b.avgPace) : '-'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
