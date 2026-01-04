import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PersonalBest } from '../../models/strengthTypes.ts';
import { PBHoverCard } from './PBHoverCard.tsx';

interface ComparisonBarProps {
    title: string;
    unit: string;
    userValue: number;
    avgValue: number;
    maxValue: number;
    color?: string;
    explanation?: string; // Optional explanation text for hover info
    pbDetails?: PersonalBest | null; // Optional PB details for hover card
    rmMode?: '1rm' | '1erm';
}

export function ComparisonBar({
    title,
    unit,
    userValue,
    avgValue,
    maxValue,
    color = "#10b981",
    explanation,
    pbDetails,
    rmMode = '1erm'
}: ComparisonBarProps) {
    // Ensure values are valid numbers (guard against undefined/NaN)
    const safeUserValue = (typeof userValue === 'number' && !isNaN(userValue)) ? userValue : 0;
    const safeAvgValue = (typeof avgValue === 'number' && !isNaN(avgValue)) ? avgValue : 0;
    const safeMaxValue = (typeof maxValue === 'number' && !isNaN(maxValue)) ? maxValue : 0;

    // Only show user vs average - maxValue is used for chart scaling only
    const data = [
        { name: 'Du', value: safeUserValue, fill: color },
        { name: 'Snitt', value: safeAvgValue, fill: '#64748b' }, // slate-500
    ];

    // Determine the chart domain max for proper scaling
    const chartMax = Math.max(safeMaxValue, safeUserValue, safeAvgValue, 1); // Min 1 to avoid 0-0 domain

    return (
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">{title}</h3>
                {explanation && (
                    <div className="relative group">
                        <span className="text-gray-500 cursor-help hover:text-gray-300 transition-colors">ℹ️</span>
                        <div className="absolute left-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none group-hover:pointer-events-auto">
                            <div className="text-xs text-gray-500 uppercase font-bold mb-2">Beräkning</div>
                            <div className="text-sm text-gray-300 whitespace-pre-line">{explanation}</div>
                        </div>
                    </div>
                )}
            </div>
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40 }}>
                        <XAxis type="number" domain={[0, chartMax]} hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={50}
                            tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => [`${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`, 'Resultat']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {/* Show numeric comparison below the chart */}
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-800">
                <div className="text-center flex-1 relative group/pb">
                    <div className={`text-2xl font-black ${pbDetails ? 'cursor-help' : ''}`} style={{ color }}>
                        {safeUserValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">Du</div>
                    {pbDetails && (
                        <PBHoverCard pb={pbDetails} rmMode={rmMode} />
                    )}
                </div>
                <div className="text-center">
                    {(() => {
                        if (safeAvgValue === 0) return <div className="text-gray-600 text-lg font-bold">vs</div>;
                        const diff = ((safeUserValue - safeAvgValue) / safeAvgValue) * 100;
                        const isPositive = diff > 0;
                        return (
                            <div className="flex flex-col items-center">
                                <div className={`text-sm font-black ${isPositive ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                    {isPositive ? '+' : ''}{diff.toFixed(0)}%
                                </div>
                                <div className="text-gray-600 text-xs">vs snitt</div>
                            </div>
                        );
                    })()}
                </div>
                <div className="text-center flex-1">
                    <div className="text-2xl font-black text-slate-400">{safeAvgValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                    <div className="text-xs text-gray-500 uppercase">Snitt</div>
                </div>
            </div>
        </div>
    );
}
