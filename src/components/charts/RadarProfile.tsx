
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface RadarProfileProps {
    data: {
        subject: string;
        A: number; // User value (normalized 0-100)
        B: number; // Avg value (normalized 0-100)
        fullMark: number;
    }[];
}

export function RadarProfile({ data }: RadarProfileProps) {
    return (
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 h-full flex flex-col justify-center items-center">
             <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-4 w-full text-left">Din Atletprofil</h3>
            <div className="h-64 w-full max-w-sm">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                        <Radar
                            name="Du"
                            dataKey="A"
                            stroke="#10b981"
                            strokeWidth={3}
                            fill="#10b981"
                            fillOpacity={0.3}
                        />
                        <Radar
                            name="Snittet"
                            dataKey="B"
                            stroke="#64748b"
                            strokeWidth={2}
                            fill="#64748b"
                            fillOpacity={0.1}
                            strokeDasharray="4 4"
                        />
                        <Tooltip
                             contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }}
                             itemStyle={{ color: '#fff' }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-4 text-xs font-bold">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500/30 border border-emerald-500 rounded-full"></div>
                    <span className="text-emerald-400">Du</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-500/30 border border-slate-500 rounded-full border-dashed"></div>
                    <span className="text-slate-400">Snittet</span>
                </div>
            </div>
        </div>
    );
}
