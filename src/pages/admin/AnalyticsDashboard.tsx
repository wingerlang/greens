import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AnalyticsStats, PageView, InteractionEvent } from '../../models/types.ts';
import { BarChart3, TrendingUp, Users, MousePointer2, Search, Clock, Activity, ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';

// Types for new endpoints
interface UserActivity {
    userId: string;
    pageViews: number;
    events: number;
    lastActive: string;
    topPage: string;
}

interface OmniboxStats {
    totalSearches: number;
    totalLogs: number;
    topSearches: Array<{ query: string; count: number }>;
    topLoggedFoods: Array<{ food: string; count: number }>;
    hourlyDistribution: number[];
}

interface DailyData {
    date: string;
    pageViews: number;
    events: number;
}

export function AnalyticsDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [users, setUsers] = useState<UserActivity[]>([]);
    const [omnibox, setOmnibox] = useState<OmniboxStats | null>(null);
    const [daily, setDaily] = useState<DailyData[]>([]);
    const [rawEvents, setRawEvents] = useState<InteractionEvent[]>([]);
    const [rawPageViews, setRawPageViews] = useState<PageView[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [daysBack, setDaysBack] = useState(7);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [showRawLog, setShowRawLog] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAllData = async () => {
        try {
            const [statsRes, usersRes, omniboxRes, dailyRes, eventsRes] = await Promise.all([
                fetch('/api/usage/stats'),
                fetch(`/api/usage/users?days=${daysBack}`),
                fetch(`/api/usage/omnibox?days=${daysBack}`),
                fetch(`/api/usage/daily?days=${daysBack}`),
                fetch(`/api/usage/events?days=${daysBack}&limit=50${selectedUserId ? `&userId=${selectedUserId}` : ''}`)
            ]);

            // Check for errors
            if (!statsRes.ok) throw new Error(`Stats: ${statsRes.status}`);

            const [statsData, usersData, omniboxData, dailyData, eventsData] = await Promise.all([
                statsRes.json(),
                usersRes.json(),
                omniboxRes.json(),
                dailyRes.json(),
                eventsRes.json()
            ]);

            setStats(statsData);
            setUsers(usersData.users || []);
            setOmnibox(omniboxData);
            setDaily(dailyData.daily || []);
            setRawEvents(eventsData.events || []);
            setRawPageViews(eventsData.pageViews || []);
            setError(null);
        } catch (err) {
            console.error("Failed to load analytics", err);
            setError(String(err));
        }
        setLoading(false);
    };

    // Initial load and refresh on filter change
    useEffect(() => {
        setLoading(true);
        fetchAllData();
    }, [daysBack, selectedUserId]);

    // Auto-refresh every 10 seconds
    useEffect(() => {
        const interval = setInterval(fetchAllData, 10000);
        return () => clearInterval(interval);
    }, [daysBack, selectedUserId]);

    if (loading && !stats) {
        return <div className="p-8 text-slate-500 flex items-center gap-2"><RefreshCw className="animate-spin" size={16} /> Laddar statistik...</div>;
    }

    if (error && !stats) {
        return <div className="p-8 text-red-500">Fel: {error}</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <BarChart3 className="text-pink-500" size={32} />
                        Användarstatistik
                    </h1>
                    <p className="text-slate-500 font-medium">Granulär insikt i användaraktivitet</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={daysBack}
                        onChange={e => setDaysBack(parseInt(e.target.value))}
                        className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm font-bold"
                    >
                        <option value={7}>Senaste 7 dagar</option>
                        <option value={14}>Senaste 14 dagar</option>
                        <option value={30}>Senaste 30 dagar</option>
                        <option value={90}>Senaste 90 dagar</option>
                    </select>
                    <button
                        onClick={fetchAllData}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Uppdatera"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin text-pink-500' : 'text-slate-400'} />
                    </button>
                </div>
            </header>

            {/* Key Metrics */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={<Users className="text-emerald-500" />} label="Aktiva (24h)" value={stats.activeUsers24h} />
                    <StatCard icon={<TrendingUp className="text-blue-500" />} label="Sidvisningar" value={stats.totalPageViews} />
                    <StatCard icon={<MousePointer2 className="text-purple-500" />} label="Interaktioner" value={stats.totalEvents} />
                    <StatCard icon={<Search className="text-pink-500" />} label="Omnibox Sök" value={omnibox?.totalSearches || 0} />
                </div>
            )}

            {/* Activity Timeline */}
            {daily.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                        <Activity size={20} className="text-blue-500" />
                        Aktivitets-Tidslinje
                    </h2>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={daily}>
                                <defs>
                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                                <YAxis stroke="#64748b" fontSize={10} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                    labelStyle={{ color: '#94a3b8' }}
                                />
                                <Area type="monotone" dataKey="pageViews" stroke="#3b82f6" fill="url(#colorViews)" name="Sidvisningar" />
                                <Area type="monotone" dataKey="events" stroke="#a855f7" fill="url(#colorEvents)" name="Klick" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* User Activity */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                        <Users size={20} className="text-emerald-500" />
                        Användare
                        {selectedUserId && (
                            <button
                                onClick={() => setSelectedUserId(null)}
                                className="ml-auto text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 hover:bg-slate-600"
                            >
                                Rensa filter
                            </button>
                        )}
                    </h2>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left">Användare</th>
                                    <th className="px-3 py-2 text-right">Visningar</th>
                                    <th className="px-3 py-2 text-right">Klick</th>
                                    <th className="px-3 py-2 text-right">Senast</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {users.map(u => (
                                    <tr
                                        key={u.userId}
                                        onClick={() => setSelectedUserId(u.userId === selectedUserId ? null : u.userId)}
                                        className={`cursor-pointer transition-colors ${u.userId === selectedUserId ? 'bg-pink-500/10' : 'hover:bg-slate-800/50'}`}
                                    >
                                        <td className="px-3 py-2 font-mono text-xs text-slate-300 truncate max-w-[120px]" title={u.userId}>
                                            {u.userId.slice(0, 8)}...
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-blue-400">{u.pageViews}</td>
                                        <td className="px-3 py-2 text-right font-bold text-purple-400">{u.events}</td>
                                        <td className="px-3 py-2 text-right text-slate-500 text-xs">
                                            {formatRelativeTime(u.lastActive)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Omnibox Analytics */}
                {omnibox && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                            <Search size={20} className="text-pink-500" />
                            Omnibox-Användning
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-slate-800/50 rounded-xl p-3">
                                <div className="text-2xl font-black text-pink-400">{omnibox.totalSearches}</div>
                                <div className="text-xs text-slate-500 uppercase">Sökningar</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-3">
                                <div className="text-2xl font-black text-emerald-400">{omnibox.totalLogs}</div>
                                <div className="text-xs text-slate-500 uppercase">Loggat Mat</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {omnibox.topSearches.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Vanligaste Sökningar</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {omnibox.topSearches.slice(0, 8).map((s, i) => (
                                            <span key={i} className="px-2 py-1 bg-pink-500/10 border border-pink-500/20 rounded text-xs text-pink-300">
                                                {s.query} <span className="text-pink-500 font-bold">{s.count}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {omnibox.topLoggedFoods.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Mest Loggade Mat</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {omnibox.topLoggedFoods.slice(0, 8).map((f, i) => (
                                            <span key={i} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-300">
                                                {f.food} <span className="text-emerald-500 font-bold">{f.count}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Hourly Distribution Mini Chart */}
                        {omnibox.hourlyDistribution.some(h => h > 0) && (
                            <div className="mt-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Aktivitet per Timme</h3>
                                <div className="h-[60px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={omnibox.hourlyDistribution.map((count, hour) => ({ hour: `${hour}`, count }))}>
                                            <Bar dataKey="count" fill="#ec4899" radius={[2, 2, 0, 0]}>
                                                {omnibox.hourlyDistribution.map((_, i) => (
                                                    <Cell key={i} fill={i >= 6 && i <= 22 ? '#ec4899' : '#334155'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between text-[10px] text-slate-500 px-1">
                                    <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Raw Event Log */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                    onClick={() => setShowRawLog(!showRawLog)}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                >
                    <h2 className="text-lg font-black flex items-center gap-2">
                        <Clock size={20} className="text-amber-500" />
                        Rå Händelselogg
                        <span className="text-xs font-normal text-slate-500">({rawEvents.length + rawPageViews.length} händelser)</span>
                    </h2>
                    {showRawLog ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {showRawLog && (
                    <div className="border-t border-slate-800 max-h-[400px] overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="text-slate-400 uppercase bg-slate-800/50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left">Tid</th>
                                    <th className="px-3 py-2 text-left">Typ</th>
                                    <th className="px-3 py-2 text-left">Label</th>
                                    <th className="px-3 py-2 text-left">Sida</th>
                                    <th className="px-3 py-2 text-left">User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {/* Combine and sort events */}
                                {[
                                    ...rawEvents.map(e => ({ ...e, _type: 'event' as const })),
                                    ...rawPageViews.map(p => ({ ...p, type: 'pageview', label: p.path, target: '', _type: 'view' as const }))
                                ]
                                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                    .slice(0, 100)
                                    .map((item, i) => (
                                        <tr key={i} className="hover:bg-slate-800/30">
                                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                                {new Date(item.timestamp).toLocaleString('sv-SE', {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${item.type === 'pageview' ? 'bg-blue-500/20 text-blue-400' :
                                                    item.type === 'click' ? 'bg-purple-500/20 text-purple-400' :
                                                        item.type === 'omnibox_search' ? 'bg-pink-500/20 text-pink-400' :
                                                            item.type === 'omnibox_log' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                'bg-slate-500/20 text-slate-400'
                                                    }`}>
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-white truncate max-w-[200px]" title={item.label}>
                                                {item.label}
                                            </td>
                                            <td className="px-3 py-2 text-slate-400 truncate max-w-[150px]" title={item.path}>
                                                {item.path}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-slate-500 truncate max-w-[80px]">
                                                {item.userId?.slice(0, 6)}...
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Popular Pages & Interactions from original */}
            {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-amber-500" />
                            Populära Sidor
                        </h2>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                            {stats.popularPages.slice(0, 15).map((page, i) => (
                                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-800/50">
                                    <span className="text-sm text-slate-300 truncate max-w-[200px]" title={page.path}>
                                        {page.path}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-slate-500">{formatDuration(page.avgTime)}</span>
                                        <span className="font-bold text-blue-400">{page.count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                            <MousePointer2 size={20} className="text-purple-500" />
                            Vanligaste Klick
                        </h2>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                            {stats.popularInteractions.slice(0, 15).map((event, i) => (
                                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-800/50">
                                    <span className="text-sm text-slate-300 truncate max-w-[250px]" title={event.label}>
                                        {event.label}
                                    </span>
                                    <span className="font-bold text-purple-400">{event.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Components
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
            <div>
                <div className="text-2xl font-black text-white">{value.toLocaleString()}</div>
                <div className="text-xs text-slate-500 uppercase font-bold">{label}</div>
            </div>
        </div>
    );
}

function formatDuration(seconds: number): string {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function formatRelativeTime(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just nu';
    if (mins < 60) return `${mins}m sedan`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h sedan`;
    const days = Math.floor(hours / 24);
    return `${days}d sedan`;
}
