import React, { useRef, useState } from 'react';
import { SummaryStats } from '../../hooks/useTrainingSummary.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatSwedishDate } from '../../utils/dateUtils.ts';

interface SummaryCardProps {
    stats: SummaryStats;
    startDate: string;
    endDate: string;
    id?: string;
}

const COLORS = {
    running: '#10b981', // emerald-500
    cycling: '#06b6d4', // cyan-500
    strength: '#8b5cf6', // violet-500
    walking: '#f59e0b', // amber-500
    other: '#64748b'    // slate-500
};

export const SummaryCard: React.FC<SummaryCardProps> = ({ stats, startDate, endDate, id }) => {
    const { user } = useAuth();
    const [aspectRatio, setAspectRatio] = useState<'portrait' | 'square'>('portrait');

    const formattedStartDate = new Date(startDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    const formattedEndDate = new Date(endDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div
            id={id}
            className={`relative bg-slate-950 text-white overflow-hidden flex flex-col justify-between p-8 border border-white/5 shadow-2xl ${
                aspectRatio === 'portrait' ? 'w-[400px] h-[711px]' : 'w-[500px] h-[500px]'
            }`}
        >
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            {/* Header */}
            <div className="relative z-10 flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Sammanfattning
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                        {formattedStartDate} - {formattedEndDate}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-white">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">GREENS</p>
                </div>
            </div>

            {/* Big Stats Grid */}
            <div className="relative z-10 grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Total Distans</p>
                    <p className="text-2xl font-black text-white">
                        {Math.round(stats.totalDist).toLocaleString()} <span className="text-sm text-emerald-400">km</span>
                    </p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Total Tid</p>
                    <p className="text-2xl font-black text-white">
                        {Math.round(stats.totalTime / 60).toLocaleString()} <span className="text-sm text-cyan-400">h</span>
                    </p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Muskelvolym</p>
                    <p className="text-2xl font-black text-white">
                        {Math.round(stats.totalTonnage / 1000).toLocaleString()} <span className="text-sm text-purple-400">ton</span>
                    </p>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Antal Pass</p>
                    <p className="text-2xl font-black text-white">
                        {stats.totalSessions} <span className="text-sm text-indigo-400">st</span>
                    </p>
                </div>
            </div>

            {/* Highlights / Distribution */}
            <div className="relative z-10 flex-1 min-h-0 flex gap-4">
                 {/* Top Lift & Run */}
                 <div className="flex-1 space-y-3">
                    {stats.topLifts[0] && (
                        <div className="bg-slate-900/30 p-3 rounded-xl border border-purple-500/20">
                            <p className="text-purple-400 text-[9px] font-bold uppercase mb-1">Tyngsta Lyft</p>
                            <p className="font-bold text-sm truncate">{stats.topLifts[0].exercise}</p>
                            <p className="text-xl font-black">{stats.topLifts[0].weight} <span className="text-xs text-slate-500">kg</span></p>
                        </div>
                    )}
                    {stats.longestRuns[0] && (
                        <div className="bg-slate-900/30 p-3 rounded-xl border border-emerald-500/20">
                            <p className="text-emerald-400 text-[9px] font-bold uppercase mb-1">Längsta Löpning</p>
                             <p className="font-bold text-sm truncate">{formatSwedishDate(stats.longestRuns[0].date)}</p>
                            <p className="text-xl font-black">{stats.longestRuns[0].performance?.distanceKm?.toFixed(1)} <span className="text-xs text-slate-500">km</span></p>
                        </div>
                    )}
                 </div>

                 {/* Chart */}
                 <div className="w-1/2 bg-slate-900/30 rounded-xl border border-white/5 flex flex-col items-center justify-center p-2">
                     <PieChart width={120} height={120}>
                        <Pie
                            data={stats.types}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={50}
                            paddingAngle={2}
                        >
                            {stats.types.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name.toLowerCase()] || COLORS.other} />
                            ))}
                        </Pie>
                     </PieChart>
                     <div className="mt-2 space-y-1 w-full px-2">
                         {stats.types.sort((a,b) => b.count - a.count).slice(0,3).map(t => (
                             <div key={t.name} className="flex justify-between text-[9px]">
                                 <span className="capitalize text-slate-400">{t.name}</span>
                                 <span className="font-bold">{t.count}</span>
                             </div>
                         ))}
                     </div>
                 </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex justify-between items-end">
                 <div>
                     <p className="text-[10px] text-slate-500 uppercase font-bold">Resultat & Framsteg</p>
                     <div className="flex gap-2 mt-1">
                         <span className="text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded-md">{stats.totalPRs} PRs</span>
                         <span className="text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded-md">{stats.activeDays} Aktiva Dagar</span>
                     </div>
                 </div>
                 <div className="text-2xl">🔥</div>
            </div>
        </div>
    );
};
