import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine
} from 'recharts';
import { WeightEntry } from '../../models/types.ts';

interface WeightTrendChartProps {
    entries: WeightEntry[];
    currentWeight: number;
    onEntryClick?: (entry: WeightEntry) => void;
}

const TREND_COLORS = {
    loss: '#10b981',   // Emerald green
    gain: '#ef4444',   // Red
    stable: '#3b82f6', // Blue
};

export function WeightTrendChart({ entries, currentWeight, onEntryClick }: WeightTrendChartProps) {
    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [entries]);

    const chartData = useMemo(() => {
        return sortedEntries.map((e) => ({
            ...e,
            displayDate: e.date.slice(5), // MM-DD
        }));
    }, [sortedEntries]);

    if (sortedEntries.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center p-6 opacity-50 h-full">
                <span className="text-3xl mb-3">📊</span>
                <p className="text-xs text-center text-slate-400">Minst 2 viktmätningar behövs för trenden.</p>
            </div>
        );
    }

    const weights = sortedEntries.map(d => d.weight);
    const minW = Math.floor(Math.min(...weights) - 1);
    const maxW = Math.ceil(Math.max(...weights) + 1);
    const weightChange = currentWeight - weights[0];

    // Determine overall trend color
    let trendColor = TREND_COLORS.stable;
    if (weightChange < -0.5) trendColor = TREND_COLORS.loss;
    else if (weightChange > 0.5) trendColor = TREND_COLORS.gain;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 px-1">
                <div>
                    <div className="text-2xl font-black text-white">
                        {currentWeight.toFixed(1)} <span className="text-xs text-slate-500 font-bold">kg</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                                backgroundColor: `${trendColor}20`,
                                color: trendColor
                            }}
                        >
                            {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                        </span>
                        <span className="text-[9px] uppercase text-slate-500 tracking-wide">
                            sedan {sortedEntries[0].date}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3 text-[8px] uppercase font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ner
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Upp
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> Stabil
                    </span>
                </div>
            </div>

            {/* Chart */}
            <div style={{ width: '100%', height: 'calc(100% - 60px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 15, left: 5, bottom: 5 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.05)"
                            vertical={false}
                        />

                        <XAxis
                            dataKey="displayDate"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            dy={5}
                        />

                        <YAxis
                            domain={[minW, maxW]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            width={30}
                            tickFormatter={(v) => `${v}`}
                        />

                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-slate-900/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl backdrop-blur">
                                            <div className="text-lg font-bold text-white">
                                                {data.weight.toFixed(1)} kg
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {data.date}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />

                        <Line
                            type="monotone"
                            dataKey="weight"
                            stroke={trendColor}
                            strokeWidth={2.5}
                            dot={{
                                fill: trendColor,
                                strokeWidth: 0,
                                r: 3,
                                cursor: 'pointer'
                            }}
                            activeDot={{
                                r: 5,
                                stroke: '#fff',
                                strokeWidth: 2,
                                fill: trendColor
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
