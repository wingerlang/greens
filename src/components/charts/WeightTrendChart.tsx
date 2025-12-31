import React, { useMemo } from 'react';
import { WeightEntry } from '../../models/types.ts';

interface WeightTrendChartProps {
    entries: WeightEntry[];
    currentWeight: number;
}

export function WeightTrendChart({ entries, currentWeight }: WeightTrendChartProps) {
    // No internal filtering - use parent-provided entries directly
    const sortedEntries = useMemo(() => {
        return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [entries]);

    if (sortedEntries.length < 2) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50 min-h-[160px]">
                <span className="text-4xl mb-4">📊</span>
                <p className="text-sm text-center">Minst 2 viktmätningar behövs för trenden.</p>
                <p className="text-xs text-slate-500 mt-2">Loggade: {entries.length} mätning(ar)</p>
            </div>
        );
    }

    const weights = sortedEntries.map(d => d.weight);
    const minW = Math.min(...weights) - 0.5;
    const maxW = Math.max(...weights) + 0.5;
    const chartRange = maxW - minW || 1;

    const firstWeight = weights[0];
    const weightChange = currentWeight - firstWeight;

    // Create SVG path
    const pathPoints = sortedEntries.map((d, i) => {
        const x = (i / (sortedEntries.length - 1)) * 100;
        const y = 100 - ((d.weight - minW) / chartRange) * 100;
        return `${x},${y}`;
    }).join(' L ');

    return (
        <div className="flex-1 p-4 flex flex-col h-full">
            {/* Header - NO range selector anymore */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="text-2xl font-black text-white">
                        {currentWeight.toFixed(1)} <span className="text-sm text-slate-400">kg</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-bold ${weightChange > 0 ? 'text-rose-400' : weightChange < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                        </span>
                        <span className="text-[10px] text-slate-500">
                            sedan {sortedEntries[0].date}
                        </span>
                    </div>
                </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 relative min-h-[160px] w-full">
                <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full overflow-visible"
                >
                    {/* Grid lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2" />
                    <line x1="0" y1="100" x2="100" y2="100" stroke="#334155" strokeWidth="0.5" strokeOpacity="0.5" />

                    {/* Gradient fill */}
                    <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={weightChange <= 0 ? "#10b981" : "#ef4444"} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={weightChange <= 0 ? "#10b981" : "#ef4444"} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Area */}
                    <path
                        d={`M 0,100 L ${pathPoints} L 100,100 Z`}
                        fill="url(#weightGradient)"
                    />

                    {/* Line */}
                    <path
                        d={`M ${pathPoints}`}
                        fill="none"
                        stroke={weightChange <= 0 ? "#10b981" : "#ef4444"}
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Data Points (Smaller dots) */}
                    {sortedEntries.map((d, i) => {
                        const x = (i / (sortedEntries.length - 1)) * 100;
                        const y = 100 - ((d.weight - minW) / chartRange) * 100;
                        if (sortedEntries.length > 60) return null;

                        return (
                            <circle
                                key={i}
                                cx={x}
                                cy={y}
                                r="1"
                                fill="white"
                                stroke={weightChange <= 0 ? "#10b981" : "#ef4444"}
                                strokeWidth="0.5"
                                vectorEffect="non-scaling-stroke"
                            />
                        );
                    })}
                </svg>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 -ml-6 flex flex-col justify-between text-[9px] text-slate-500 font-mono py-1 h-full pointer-events-none">
                    <span>{maxW.toFixed(0)}</span>
                    <span>{((maxW + minW) / 2).toFixed(0)}</span>
                    <span>{minW.toFixed(0)}</span>
                </div>

                {/* X-axis labels */}
                <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[9px] text-slate-500 font-medium">
                    <span>{sortedEntries[0].date}</span>
                    <span>{sortedEntries[sortedEntries.length - 1].date}</span>
                </div>
            </div>
        </div>
    );
}
