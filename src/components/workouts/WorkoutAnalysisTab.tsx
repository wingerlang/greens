import React, { useMemo, useState } from 'react';
import { StrengthWorkoutExercise } from '../../models/strengthTypes.ts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface WorkoutAnalysisTabProps {
    exercises: (StrengthWorkoutExercise & { isPB?: boolean })[];
    totalSessionVolume: number;
}

type SortMetric = 'SETS' | 'REPS' | 'VOLUME';

export function WorkoutAnalysisTab({ exercises, totalSessionVolume }: WorkoutAnalysisTabProps) {
    const [sortBy, setSortBy] = useState<SortMetric>('VOLUME');

    const data = useMemo(() => {
        return exercises.map(ex => {
            const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0);
            const totalSets = ex.sets.length;
            const volume = ex.totalVolume || 0;

            return {
                name: ex.exerciseName,
                sets: totalSets,
                reps: totalReps,
                volume: volume,
                volumePct: totalSessionVolume > 0 ? (volume / totalSessionVolume) * 100 : 0
            };
        }).sort((a, b) => {
            if (sortBy === 'SETS') return b.sets - a.sets;
            if (sortBy === 'REPS') return b.reps - a.reps;
            return b.volume - a.volume;
        });
    }, [exercises, sortBy, totalSessionVolume]);

    // Formatters for the chart
    const formatValue = (value: number) => {
        if (sortBy === 'VOLUME') {
            return value > 1000 ? `${(value / 1000).toFixed(1)}t` : `${Math.round(value)}kg`;
        }
        return value;
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-xl">
                    <p className="font-bold text-white text-xs mb-1">{label}</p>
                    <p className="text-indigo-400 text-xs font-mono">
                        {sortBy === 'VOLUME' && 'Volym: '}
                        {sortBy === 'SETS' && 'Set: '}
                        {sortBy === 'REPS' && 'Reps: '}
                        <span className="text-white font-bold">{formatValue(payload[0].value)}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Controls */}
            <div className="flex justify-end gap-2">
                {[
                    { id: 'VOLUME', label: 'Volym' },
                    { id: 'SETS', label: 'Set' },
                    { id: 'REPS', label: 'Reps' }
                ].map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => setSortBy(opt.id as SortMetric)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all border ${
                            sortBy === opt.id
                                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                : 'bg-slate-800 text-slate-500 border-transparent hover:text-slate-300'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Chart */}
            <div className="h-64 w-full bg-slate-900/30 rounded-2xl p-4 border border-white/5">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={100}
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar
                            dataKey={sortBy.toLowerCase()}
                            radius={[0, 4, 4, 0]}
                            barSize={20}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#4f46e5'} opacity={1 - (index * 0.1)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-white/5 bg-slate-900/30">
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-white/5 uppercase font-black text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Övning</th>
                            <th className="px-4 py-3 text-right">Set</th>
                            <th className="px-4 py-3 text-right">Reps</th>
                            <th className="px-4 py-3 text-right">Volym</th>
                            <th className="px-4 py-3 text-right">% Tot</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.map((row, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-2.5 font-bold text-slate-300">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-600 font-mono text-[9px]">#{i + 1}</span>
                                        {row.name}
                                    </div>
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                                    {row.sets}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                                    {row.reps}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-400">
                                    {row.volume > 1000 ? `${(row.volume / 1000).toFixed(2)}t` : `${Math.round(row.volume)}kg`}
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                                    {row.volumePct.toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
