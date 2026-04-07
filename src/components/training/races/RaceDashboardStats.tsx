import { Medal } from 'lucide-react';

interface RaceDashboardStatsProps {
    stats: {
        count: number;
        podiumCount: number;
        goldCount: number;
        top10Count: number;
        avgPercent: number;
    };
}

export function RaceDashboardStats({ stats }: RaceDashboardStatsProps) {
    return (
        <div className="flex-1">
            <h3 className="text-3xl font-black text-white flex items-center gap-3 mb-4"><Medal className="text-amber-500" size={32} /> Historik & Resultat</h3>
            <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Totalt</span>
                    <span className="text-xl font-black text-white">{stats.count} <span className="text-slate-500 font-bold text-xs uppercase">Lopp</span></span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-6">
                    <span className="text-[10px] uppercase font-black text-amber-500 tracking-widest">Podiums</span>
                    <span className="text-xl font-black text-amber-500">{stats.podiumCount} <span className="text-slate-500 font-bold text-xs uppercase">({stats.goldCount}🥇)</span></span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-6">
                    <span className="text-[10px] uppercase font-black text-emerald-500 tracking-widest">Top 10%</span>
                    <span className="text-xl font-black text-white">{stats.top10Count} <span className="text-slate-500 font-bold text-xs uppercase">Gånger</span></span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-6">
                    <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Avg Ranking</span>
                    <span className="text-xl font-black text-white">{stats.avgPercent.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}
