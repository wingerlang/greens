import React from 'react';
import { Medal } from 'lucide-react';

interface RaceDashboardStatsProps {
    stats: {
        count: number;
        podiumCount: number;
        goldCount: number;
        silverCount: number;
        bronzeCount: number;
        top10Count: number;
        top33Count: number;
        avgPercent: number;
    };
}

export function RaceDashboardStats({ stats }: RaceDashboardStatsProps) {
    return (
        <div className="flex-1">
            <h3 className="text-3xl font-black text-white flex items-center gap-3 mb-4"><Medal className="text-amber-500" size={32} /> Historik & Resultat</h3>
            <div className="flex flex-wrap gap-8 items-center">
                <div className="flex flex-wrap gap-6 text-sm">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Totalt</span>
                        <span className="text-xl font-black text-white">{stats.count} <span className="text-slate-500 font-bold text-xs uppercase">Lopp</span></span>
                    </div>
                    
                    <div className="flex flex-col border-l border-white/10 pl-6">
                        <span className="text-[10px] uppercase font-black text-amber-500 tracking-widest">Podiums</span>
                        <div className="flex items-end gap-3">
                            <span className="text-2xl font-black text-amber-500 leading-none">{stats.podiumCount}</span>
                            <div className="flex gap-1.5 mb-0.5">
                                <span className="flex items-center gap-0.5 text-xs font-bold text-amber-400">🥇{stats.goldCount}</span>
                                <span className="flex items-center gap-0.5 text-xs font-bold text-slate-300">🥈{stats.silverCount}</span>
                                <span className="flex items-center gap-0.5 text-xs font-bold text-amber-700">🥉{stats.bronzeCount}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col border-l border-white/10 pl-6">
                        <span className="text-[10px] uppercase font-black text-emerald-500 tracking-widest">Top 10%</span>
                        <span className="text-xl font-black text-white">{stats.top10Count} <span className="text-slate-500 font-bold text-xs uppercase">Gånger</span></span>
                    </div>

                    <div className="flex flex-col border-l border-white/10 pl-6">
                        <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest">Top 33%</span>
                        <span className="text-xl font-black text-white">{stats.top33Count} <span className="text-slate-500 font-bold text-xs uppercase">Gånger</span></span>
                    </div>
                    
                    <div className="flex flex-col border-l border-white/10 pl-6">
                        <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Avg Ranking</span>
                        <span className="text-xl font-black text-white">{stats.avgPercent.toFixed(1)}%</span>
                    </div>
                </div>

                {/* VISUAL BREAKDOWN */}
                {stats.podiumCount > 0 && (
                    <div className="flex-1 max-w-[200px] h-2 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                        <div style={{ width: `${(stats.goldCount / stats.podiumCount) * 100}%` }} className="h-full bg-gradient-to-r from-amber-400 to-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
                        <div style={{ width: `${(stats.silverCount / stats.podiumCount) * 100}%` }} className="h-full bg-gradient-to-r from-slate-200 to-slate-400" />
                        <div style={{ width: `${(stats.bronzeCount / stats.podiumCount) * 100}%` }} className="h-full bg-gradient-to-r from-amber-700 to-amber-800" />
                    </div>
                )}
            </div>
        </div>
    );
}
