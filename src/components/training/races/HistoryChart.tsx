import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface HistoryChartProps {
    chartData: { date: string, count: number, projected: number }[];
}

export function HistoryChart({ chartData }: HistoryChartProps) {
    if (chartData.length === 0) return null;

    return (
        <div className="mb-8 p-6 bg-slate-950/30 rounded-2xl border border-white/5 flex gap-8 items-center h-44">
            <div className="flex-1 h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="count" name="Genomförda" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} barSize={20} />
                        <Bar dataKey="projected" name="Planerade" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="text-right shrink-0">
                <div className="text-4xl font-black text-white">{chartData[chartData.length - 1]?.date}</div>
                <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Senaste säsongen</div>
            </div>
        </div>
    );
}
