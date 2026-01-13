import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AnalyticsStats } from '../../models/types.ts';
import { BarChart3, TrendingUp, Users, MousePointer2 } from 'lucide-react';

export function AnalyticsDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/stats')
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load stats", err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-8 text-slate-500">Laddar statistik...</div>;
    }

    if (!stats) {
        return <div className="p-8 text-red-500">Kunde inte hämta statistik. Se konsolen.</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <BarChart3 className="text-blue-500" size={32} />
                    Användarstatistik
                </h1>
                <p className="text-slate-500 font-medium">Insikter från de senaste 30 dagarna</p>
            </header>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    icon={<Users className="text-emerald-500" />}
                    label="Aktiva Användare (24h)"
                    value={stats.activeUsers24h}
                    trend="Just nu"
                />
                <StatCard
                    icon={<TrendingUp className="text-blue-500" />}
                    label="Sidvisningar (Total)"
                    value={stats.totalPageViews}
                    trend="Senaste 30 dagarna"
                />
                <StatCard
                    icon={<MousePointer2 className="text-purple-500" />}
                    label="Interaktioner"
                    value={stats.totalEvents}
                    trend="Klick & Actions"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Popular Pages */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-black mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-amber-500" />
                        Populära Sidor
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Sida</th>
                                    <th className="px-4 py-3 text-right">Visningar</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">Snitt Tid</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stats.popularPages.map((page, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={page.path}>
                                            {page.path}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                            {page.count}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500">
                                            {formatDuration(page.avgTime)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Interactions */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-black mb-4 flex items-center gap-2">
                        <MousePointer2 size={20} className="text-purple-500" />
                        Vanliga Klick
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Label / Knapp</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">Antal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {stats.popularInteractions.map((event, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                            {event.label}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                            {event.count}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, trend }: { icon: any, label: string, value: number, trend: string }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex items-start justify-between group hover:border-blue-500/30 transition-colors">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                    {value.toLocaleString()}
                </div>
                <p className="text-xs font-semibold text-slate-500">{trend}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform">
                {icon}
            </div>
        </div>
    );
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}
