
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

interface ComparisonBarProps {
    title: string;
    unit: string;
    userValue: number;
    avgValue: number;
    maxValue: number;
    color?: string;
}

export function ComparisonBar({ title, unit, userValue, avgValue, maxValue, color = "#10b981" }: ComparisonBarProps) {
    const data = [
        { name: 'Du', value: userValue, fill: color },
        { name: 'Snitt', value: avgValue, fill: '#64748b' }, // slate-500
        { name: 'Bäst', value: maxValue, fill: '#f59e0b' }   // amber-500
    ];

    return (
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-4">{title}</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40 }}>
                        <XAxis type="number" hide />
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
                            formatter={(value: number) => [`${value} ${unit}`, 'Resultat']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
