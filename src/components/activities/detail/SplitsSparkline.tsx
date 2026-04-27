import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

export const SplitsSparkline = React.memo(({ splits, highlightRange }: { splits: any[], highlightRange?: { start: number; end: number } }) => {
    if (!splits || splits.length < 2) return null;

    const data = splits.map((s, i) => ({
        index: i + 1,
        pace: s.movingTime / (Math.max(s.distance, 1) / 1000),
        hr: (s.averageHeartrate && s.averageHeartrate > 0) ? s.averageHeartrate : null,
    }));

    // Find min/max for better scaling
    const validHrs = data.filter(d => d.hr > 0).map(d => d.hr);
    const minHr = validHrs.length > 0 ? Math.min(...validHrs) - 5 : 40;
    const maxHr = validHrs.length > 0 ? Math.max(...validHrs) + 5 : 200;

    return (
        <div className="h-24 w-full mt-4 bg-black/20 rounded-xl p-2 border border-white/5">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorPace" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#fb7185" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="index" hide />

                    {highlightRange && (
                        <ReferenceArea
                            x1={highlightRange.start + 1}
                            x2={highlightRange.end}
                            fill="#f59e0b"
                            fillOpacity={0.3}
                        />
                    )}

                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: any, name: string) => [
                            name === 'pace' ? `${Math.floor(value / 60)}:${(Math.round(value % 60)).toString().padStart(2, '0')} /km` : `${Math.round(value)} bpm`,
                            name === 'pace' ? 'Tempo' : 'Puls'
                        ]}
                    />

                    <Area
                        type="monotone"
                        dataKey="pace"
                        name="pace"
                        stroke="#fb7185"
                        strokeWidth={2}
                        fill="url(#colorPace)"
                        yAxisId="pace"
                        connectNulls
                    />
                    <Area
                        type="monotone"
                        dataKey="hr"
                        name="hr"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        fill="url(#colorHr)"
                        yAxisId="hr"
                        connectNulls
                    />
                    <YAxis yAxisId="pace" hide domain={['auto', 'auto']} reversed />
                    <YAxis yAxisId="hr" hide domain={[minHr, maxHr]} />
                </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-between px-2 text-[8px] font-black uppercase tracking-widest text-slate-500 mt-1">
                <span>Start</span>
                <div className="flex gap-4">
                    <span className="text-rose-400">Tempo</span>
                    <span className="text-indigo-400">Puls</span>
                </div>
                <span>Mål</span>
            </div>
        </div>
    );
});
