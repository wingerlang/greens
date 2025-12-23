import React, { useState, useMemo } from 'react';
import { TrainingLoadData, PerformanceTrend, AICoachTip, generateId } from '../../models/types.ts';

interface AnalyticsDashboardProps {
    trainingData: TrainingLoadData[];
    performanceTrends: PerformanceTrend[];
    tips?: AICoachTip[];
    onDismissTip?: (tipId: string) => void;
}

// Mock data generator
function generateMockData(days: number = 30): TrainingLoadData[] {
    const data: TrainingLoadData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const isRestDay = Math.random() > 0.7;
        const distance = isRestDay ? 0 : 5 + Math.random() * 15;
        const tss = isRestDay ? 0 : 30 + Math.random() * 100;

        // Calculate CTL and ATL using exponential weighted averages
        const prevCtl = data.length > 0 ? data[data.length - 1].ctl : 40;
        const prevAtl = data.length > 0 ? data[data.length - 1].atl : 30;
        const ctl = prevCtl + (tss - prevCtl) / 42;
        const atl = prevAtl + (tss - prevAtl) / 7;
        const tsb = ctl - atl;

        data.push({
            date: date.toISOString().split('T')[0],
            trimp: Math.round(tss * 0.8),
            tss: Math.round(tss),
            ctl: Math.round(ctl),
            atl: Math.round(atl),
            tsb: Math.round(tsb),
            distanceKm: Math.round(distance * 10) / 10,
            durationMinutes: Math.round(distance * 6),
            avgHeartRate: isRestDay ? undefined : 140 + Math.floor(Math.random() * 20)
        });
    }
    return data;
}

const SAMPLE_TIPS: AICoachTip[] = [
    { id: '1', type: 'insight', category: 'volume', title: 'Volymuppgång', message: 'Du har ökat din veckovolym med 15% jämfört med förra månaden. Bra progressionstakt!', priority: 2, createdAt: new Date().toISOString() },
    { id: '2', type: 'warning', category: 'recovery', title: 'Låg TSB', message: 'Din träningsbalans är negativ (-15). Överväg en lättare dag snart.', priority: 1, createdAt: new Date().toISOString() },
    { id: '3', type: 'celebration', category: 'form', title: 'Ny PR-vecka!', message: 'Grattis! Du har loggat din mest aktiva vecka någonsin med 72 km.', priority: 3, createdAt: new Date().toISOString() }
];

export function AnalyticsDashboard({ trainingData = generateMockData(30), performanceTrends = [], tips = SAMPLE_TIPS, onDismissTip }: AnalyticsDashboardProps) {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
    const [chartView, setChartView] = useState<'load' | 'volume' | 'tsb'>('load');

    const filteredData = useMemo(() => {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        return trainingData.slice(-days);
    }, [trainingData, timeRange]);

    const stats = useMemo(() => {
        if (filteredData.length === 0) return null;
        const totalVolume = filteredData.reduce((sum, d) => sum + d.distanceKm, 0);
        const totalTss = filteredData.reduce((sum, d) => sum + d.tss, 0);
        const avgCtl = filteredData.reduce((sum, d) => sum + d.ctl, 0) / filteredData.length;
        const latestTsb = filteredData[filteredData.length - 1]?.tsb || 0;
        const activeDays = filteredData.filter(d => d.distanceKm > 0).length;
        return { totalVolume, totalTss, avgCtl, latestTsb, activeDays };
    }, [filteredData]);

    const maxTss = Math.max(...filteredData.map(d => d.tss), 100);
    const maxDistance = Math.max(...filteredData.map(d => d.distanceKm), 20);

    const getTipIcon = (type: AICoachTip['type']) => {
        if (type === 'insight') return '💡';
        if (type === 'warning') return '⚠️';
        if (type === 'celebration') return '🎉';
        return '💬';
    };

    const getTipColor = (type: AICoachTip['type']) => {
        if (type === 'insight') return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
        if (type === 'warning') return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
        if (type === 'celebration') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    };

    return (
        <div className="analytics-dashboard text-white space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">📊 Analys & Insikter</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">CTL/ATL/TSB • Volym • Prestanda</p>
                </div>
                <div className="flex gap-1 bg-slate-900 rounded-xl p-1">
                    {(['7d', '30d', '90d'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${timeRange === range ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Coach Tips */}
            {tips.filter(t => !t.dismissed).length > 0 && (
                <div className="space-y-2">
                    {tips.filter(t => !t.dismissed).sort((a, b) => a.priority - b.priority).slice(0, 3).map(tip => (
                        <div key={tip.id} className={`p-3 rounded-xl border flex items-start gap-3 ${getTipColor(tip.type)}`}>
                            <span className="text-xl mt-0.5">{getTipIcon(tip.type)}</span>
                            <div className="flex-1">
                                <div className="text-[10px] font-black uppercase tracking-widest">{tip.title}</div>
                                <p className="text-xs text-slate-300 mt-1">{tip.message}</p>
                            </div>
                            {onDismissTip && (
                                <button onClick={() => onDismissTip(tip.id)} className="text-slate-600 hover:text-white text-xs">✕</button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Key Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                        <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Total Volym</div>
                        <div className="text-2xl font-black text-emerald-400">{Math.round(stats.totalVolume)}<span className="text-xs text-slate-500 ml-1">km</span></div>
                    </div>
                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                        <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Total TSS</div>
                        <div className="text-2xl font-black text-amber-400">{Math.round(stats.totalTss)}</div>
                    </div>
                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                        <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Fitness (CTL)</div>
                        <div className="text-2xl font-black text-indigo-400">{Math.round(stats.avgCtl)}</div>
                    </div>
                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                        <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Form (TSB)</div>
                        <div className={`text-2xl font-black ${stats.latestTsb > 0 ? 'text-emerald-400' : stats.latestTsb > -10 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {stats.latestTsb > 0 ? '+' : ''}{stats.latestTsb}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                        <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Aktiva Dagar</div>
                        <div className="text-2xl font-black text-white">{stats.activeDays}<span className="text-xs text-slate-500 ml-1">/{filteredData.length}</span></div>
                    </div>
                </div>
            )}

            {/* Chart View Selector */}
            <div className="flex gap-2">
                {(['load', 'volume', 'tsb'] as const).map(v => (
                    <button
                        key={v}
                        onClick={() => setChartView(v)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${chartView === v ? 'bg-indigo-500 text-white' : 'bg-slate-900 text-slate-500 hover:text-white border border-white/5'}`}
                    >
                        {v === 'load' ? '📈 Träningsbelastning' : v === 'volume' ? '📊 Volym' : '⚖️ TSB (Form)'}
                    </button>
                ))}
            </div>

            {/* Chart Area */}
            <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5">
                <div className="h-48 flex items-end gap-0.5">
                    {filteredData.map((d, i) => {
                        const heightPct = chartView === 'load'
                            ? (d.tss / maxTss) * 100
                            : chartView === 'volume'
                                ? (d.distanceKm / maxDistance) * 100
                                : ((d.tsb + 30) / 60) * 100; // TSB normalized

                        const barColor = chartView === 'tsb'
                            ? d.tsb > 0 ? 'bg-emerald-500' : d.tsb > -10 ? 'bg-amber-500' : 'bg-rose-500'
                            : d.tss > 80 ? 'bg-rose-500' : d.tss > 50 ? 'bg-amber-500' : 'bg-emerald-500';

                        return (
                            <div
                                key={i}
                                className="flex-1 group relative"
                                title={`${d.date}: ${chartView === 'load' ? `TSS: ${d.tss}` : chartView === 'volume' ? `${d.distanceKm} km` : `TSB: ${d.tsb}`}`}
                            >
                                <div
                                    className={`w-full ${barColor} rounded-t transition-all hover:opacity-80`}
                                    style={{ height: `${Math.max(2, heightPct)}%` }}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 px-2 py-1 rounded text-[9px] font-bold whitespace-nowrap z-10 pointer-events-none">
                                    {d.date.slice(5)}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-[9px] text-slate-600">
                    <span>{filteredData[0]?.date}</span>
                    <span>{filteredData[filteredData.length - 1]?.date}</span>
                </div>
            </div>

            {/* CTL/ATL/TSB Legend */}
            <div className="p-4 bg-slate-900/40 rounded-2xl border border-white/5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Träningsvetenskap 101</div>
                <div className="grid grid-cols-3 gap-4 text-[10px]">
                    <div>
                        <span className="font-bold text-indigo-400">CTL (Fitness)</span>
                        <p className="text-slate-500">42-dagars snitt av träningsbelastning. Högre = bättre kondition.</p>
                    </div>
                    <div>
                        <span className="font-bold text-rose-400">ATL (Fatigue)</span>
                        <p className="text-slate-500">7-dagars snitt. Visar akut trötthet från nylig träning.</p>
                    </div>
                    <div>
                        <span className="font-bold text-emerald-400">TSB (Form)</span>
                        <p className="text-slate-500">CTL - ATL. Positiv = pigg och redo, negativ = trött men bygger fitness.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
