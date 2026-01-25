import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AnalyticsStats, PageView, InteractionEvent, generateId } from '../../models/types.ts';
import {
    BarChart3, TrendingUp, Users, MousePointer2, Search, Clock, Activity,
    ChevronDown, ChevronUp, Filter, RefreshCw, Play, Pause, SkipForward,
    SkipBack, X, Monitor, Calendar, Timer, AlertCircle
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

// Types for analytics
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

interface AnalyticsSession {
    sessionId: string;
    userId: string;
    startTime: string;
    endTime: string;
    durationSeconds: number;
    eventCount: number;
    viewCount: number;
    pathFlow: string[];
    userAgent: string;
}

interface SessionEvent extends InteractionEvent {
    _type: 'view' | 'event';
}

export function AnalyticsDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'retention' | 'pathing' | 'appData' | 'errors' | 'heatmap' | 'friction' | 'funnel' | 'experiments' | 'health' | 'live' | 'ai'>('overview');

    // Overview Data
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [users, setUsers] = useState<UserActivity[]>([]);
    const [omnibox, setOmnibox] = useState<OmniboxStats | null>(null);
    const [daily, setDaily] = useState<DailyData[]>([]);
    const [pulse, setPulse] = useState<number[]>([]);
    const [retention, setRetention] = useState<any[]>([]);
    const [pathing, setPathing] = useState<any[]>([]);
    const [friction, setFriction] = useState<any[]>([]);
    const [exitStats, setExitStats] = useState<any[]>([]);
    const [appDataStats, setAppDataStats] = useState<any | null>(null);
    const [errorStats, setErrorStats] = useState<any[]>([]);
    const [funnelDefinitions, setFunnelDefinitions] = useState<any[]>([]);
    const [correlationStats, setCorrelationStats] = useState<any[]>([]);
    const [deadClickStats, setDeadClickStats] = useState<any[]>([]);
    const [healthStats, setHealthStats] = useState<any[]>([]);
    const [liveEvents, setLiveEvents] = useState<any[]>([]);
    const [experiments, setExperiments] = useState<any[]>([]);
    const [aiInsights, setAiInsights] = useState<any[]>([]);

    // Sessions Data
    const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
    const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);

    // Raw Data (Overview Tab)
    const [rawEvents, setRawEvents] = useState<InteractionEvent[]>([]);
    const [rawPageViews, setRawPageViews] = useState<PageView[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [daysBack, setDaysBack] = useState(7);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [showRawLog, setShowRawLog] = useState(false);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'overview') {
                const [statsRes, usersRes, omniboxRes, dailyRes, eventsRes] = await Promise.all([
                    fetch('/api/usage/stats?days=' + daysBack),
                    fetch(`/api/usage/users?days=${daysBack}`),
                    fetch(`/api/usage/omnibox?days=${daysBack}`),
                    fetch(`/api/usage/daily?days=${daysBack}`),
                    fetch(`/api/usage/events?days=${daysBack}&limit=50${selectedUserId ? `&userId=${selectedUserId}` : ''}`)
                ]);

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

                // Fetch pulse & friction
                const [pulseRes, frictionRes] = await Promise.all([
                    fetch('/api/usage/pulse'),
                    fetch(`/api/usage/friction?days=${daysBack}`)
                ]);
                const [pulseData, frictionData] = await Promise.all([
                    pulseRes.json(),
                    frictionRes.json()
                ]);
                setPulse(pulseData.pulse || []);
                setFriction(frictionData.friction || []);
            } else if (activeTab === 'sessions') {
                // Fetch Sessions
                const res = await fetch(`/api/usage/sessions?days=${daysBack}`);
                const data = await res.json();
                setSessions(data.sessions || []);
            } else if (activeTab === 'retention') {
                const res = await fetch(`/api/usage/retention?days=${daysBack}`);
                const data = await res.json();
                setRetention(data.retention || []);
            } else if (activeTab === 'pathing') {
                const [pathingRes, exitRes] = await Promise.all([
                    fetch(`/api/usage/pathing?days=${daysBack}`),
                    fetch(`/api/usage/exit?days=${daysBack}`)
                ]);
                const [pathingData, exitData] = await Promise.all([
                    pathingRes.json(),
                    exitRes.json()
                ]);
                setPathing(pathingData.pathing || []);
                setExitStats(exitData.exits || []);
            } else if (activeTab === 'appData') {
                const res = await fetch(`/api/usage/app-stats?days=${daysBack}`);
                const data = await res.json();
                setAppDataStats(data);
            } else if (activeTab === 'errors') {
                const [errRes, corrRes] = await Promise.all([
                    fetch(`/api/usage/errors?days=${daysBack}`),
                    fetch(`/api/usage/correlation?days=${daysBack}`)
                ]);
                const [errData, corrData] = await Promise.all([errRes.json(), corrRes.json()]);
                setErrorStats(errData.errors || []);
                setCorrelationStats(corrData.correlation || []);
            } else if (activeTab === 'funnel') {
                const res = await fetch('/api/usage/funnels');
                const data = await res.json();
                setFunnelDefinitions(data.funnels || []);
            } else if (activeTab === 'friction') {
                const res = await fetch(`/api/usage/dead-clicks?days=${daysBack}`);
                const data = await res.json();
                setDeadClickStats(data.deadClicks || []);
            } else if (activeTab === 'health') {
                const res = await fetch(`/api/usage/health?days=${daysBack}`);
                const data = await res.json();
                setHealthStats(data.health || []);
            } else if (activeTab === 'live') {
                const res = await fetch('/api/usage/live-feed');
                const data = await res.json();
                setLiveEvents(data.events || []);
            } else if (activeTab === 'experiments') {
                const res = await fetch(`/api/usage/experiments/results?days=${daysBack}`);
                const data = await res.json();
                setExperiments(data.experiments || []);
            } else if (activeTab === 'ai') {
                const res = await fetch('/api/usage/ai-insights');
                const data = await res.json();
                setAiInsights(data.insights || []);
            }
            setError(null);
        } catch (err) {
            console.error("Failed to load analytics", err);
            setError(String(err));
        }
        setLoading(false);
    };

    // Initial load and refresh
    useEffect(() => {
        fetchAllData();
    }, [daysBack, selectedUserId, activeTab]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(fetchAllData, 30000);
        return () => clearInterval(interval);
    }, [daysBack, selectedUserId, activeTab]);

    if (loading && !stats && activeTab === 'overview') {
        return <div className="p-8 text-slate-500 flex items-center gap-2"><RefreshCw className="animate-spin" size={16} /> Laddar statistik...</div>;
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
                    <div className="flex items-center gap-4 mt-2">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'overview' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Översikt
                        </button>
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'sessions' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Sessioner (Replay)
                        </button>
                        <button
                            onClick={() => setActiveTab('retention')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'retention' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Retention
                        </button>
                        <button
                            onClick={() => setActiveTab('pathing')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'pathing' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Flöden
                        </button>
                        <button
                            onClick={() => setActiveTab('appData')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'appData' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Global Data
                        </button>
                        <button
                            onClick={() => setActiveTab('errors')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'errors' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            Fel-logg
                        </button>
                        <button
                            onClick={() => setActiveTab('heatmap')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'heatmap' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            🔥 Heatmap
                        </button>
                        <button
                            onClick={() => setActiveTab('friction')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'friction' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            🛑 Dead Clicks
                        </button>
                        <button
                            onClick={() => setActiveTab('funnel')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'funnel' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            🌪️ Funnel
                        </button>
                        <button
                            onClick={() => setActiveTab('health')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'health' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            ❤️ Health
                        </button>
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'live' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            ⚡ Live
                        </button>
                        <button
                            onClick={() => setActiveTab('experiments')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'experiments' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            🧪 Test
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'ai' ? 'text-pink-500 border-pink-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                        >
                            🧠 AI Insights
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={daysBack}
                        onChange={e => setDaysBack(parseInt(e.target.value))}
                        className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm font-bold"
                    >
                        <option value={1}>Idag</option>
                        <option value={7}>Senaste 7 dagar</option>
                        <option value={14}>Senaste 14 dagar</option>
                        <option value={30}>Senaste 30 dagar</option>
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

            {error && <div className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20">{error}</div>}

            {activeTab === 'overview' ? (
                // --- OVERVIEW TAB ---
                <>
                    {/* Key Metrics */}
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                            <StatCard icon={<Users className="text-emerald-500" />} label="Aktiva (24h)" value={stats.activeUsers24h} />
                            <StatCard icon={<TrendingUp className="text-blue-500" />} label="Sidvisningar" value={stats.totalPageViews} />
                            <StatCard icon={<MousePointer2 className="text-purple-500" />} label="Interaktioner" value={stats.totalEvents} />
                            <StatCard icon={<Timer className="text-amber-500" />} label="Session-djup" value={stats.sessionDepth || 0} />
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 hidden lg:block">
                                <div className="text-[10px] text-slate-500 uppercase font-black mb-2 flex items-center justify-between">
                                    <span>24H Puls</span>
                                    <Clock size={10} />
                                </div>
                                <div className="h-8 flex items-end gap-0.5">
                                    {pulse.map((v, i) => (
                                        <div
                                            key={i}
                                            style={{ height: `${Math.min(100, (v / (Math.max(...pulse) || 1)) * 100)}%` }}
                                            className="flex-1 bg-pink-500/30 hover:bg-pink-500 rounded-t-sm transition-all"
                                            title={`${i}:00 - ${v} views`}
                                        />
                                    ))}
                                </div>
                            </div>
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
                                            itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}
                                            labelStyle={{ color: '#94a3b8' }}
                                        />
                                        <Area type="monotone" dataKey="pageViews" stroke="#3b82f6" fill="url(#colorViews)" name="Sidvisningar" />
                                        <Area type="monotone" dataKey="events" stroke="#a855f7" fill="url(#colorEvents)" name="Klick" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Funnels and Module Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Module Engagement */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                                <Monitor size={20} className="text-emerald-500" />
                                Modul-intensitet
                            </h2>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={Object.entries(stats?.moduleStats || {}).map(([name, value]) => ({ name, value }))}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {Object.entries(stats?.moduleStats || {}).map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#64748b'][index % 6]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Conversion Funnels */}
                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                                <TrendingUp size={20} className="text-pink-500" />
                                Konvertering: Planerat vs Verkligt
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Meals Conversion */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Måltider</span>
                                        <span className="text-lg font-black text-emerald-500">
                                            {stats?.conversionStats?.meals.planned ? Math.round((stats.conversionStats.meals.logged / stats.conversionStats.meals.planned) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-1000"
                                            style={{ width: `${stats?.conversionStats ? (stats.conversionStats.meals.logged / (stats.conversionStats.meals.planned || 1)) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                        <span>{stats?.conversionStats?.meals.logged} Loggade</span>
                                        <span>{stats?.conversionStats?.meals.planned} Planerade</span>
                                    </div>
                                </div>

                                {/* Training Conversion */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Träningspass</span>
                                        <span className="text-lg font-black text-blue-500">
                                            {stats?.conversionStats?.training.planned ? Math.round((stats.conversionStats.training.completed / stats.conversionStats.training.planned) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-1000"
                                            style={{ width: `${stats?.conversionStats ? (stats.conversionStats.training.completed / (stats.conversionStats.training.planned || 1)) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                        <span>{stats?.conversionStats?.training.completed} Genomförda</span>
                                        <span>{stats?.conversionStats?.training.planned} Planerade</span>
                                    </div>
                                </div>
                            </div>

                            {/* Insight box */}
                            <div className="mt-8 p-4 bg-slate-800/30 border border-slate-800 rounded-xl flex items-start gap-3">
                                <AlertCircle size={16} className="text-pink-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                    Konverteringsgraden mäter hur väl dina användare följer sina planer.
                                    En hög siffra indikerar att appens planeringstjänst skapar disciplin och värde.
                                </p>
                            </div>
                        </div>

                        {/* UX Friction Analysis */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-amber-500" />
                                Loggnings-effektivitet
                            </h2>
                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={friction} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="label" type="category" stroke="#64748b" fontSize={10} width={80} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}
                                        />
                                        <Bar dataKey="avgSeconds" name="Sekunder" radius={[0, 4, 4, 0]}>
                                            {friction.map((_entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#f59e0b' : '#3b82f6'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <p className="text-[10px] text-amber-500 font-bold leading-relaxed">
                                    Mäter medeltid från öppnad modal till färdig loggning.
                                    Låga värden indikerar hög effektivitet och låg friktion.
                                </p>
                            </div>
                        </div>
                    </div>

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
                                            <th className="px-3 py-2 text-right">Visn.</th>
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
                                <div className="space-y-2">
                                    {omnibox.topSearches.slice(0, 5).map((s, i) => (
                                        <div key={i} className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-1">
                                            <span>{s.query}</span>
                                            <span className="font-bold text-pink-400">{s.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : activeTab === 'appData' ? (
                // --- GLOBAL APP DATA TAB ---
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Nutrition Stats */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                <Activity className="text-emerald-500" />
                                Topp-livsmedel (Community)
                            </h2>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={appDataStats?.nutrition?.topFoods || []} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={120} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}
                                        />
                                        <Bar dataKey="count" name="Gånger loggat" fill="#10b981" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-6 flex gap-4">
                                <div className="flex-1 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <div className="text-sm font-black text-slate-500 uppercase">Avg. Kalorier/Dag</div>
                                    <div className="text-2xl font-black text-white">{appDataStats?.nutrition?.avgDailyCalories || 0} kcal</div>
                                </div>
                                <div className="flex-1 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                    <div className="text-sm font-black text-slate-500 uppercase">Totala Måltider</div>
                                    <div className="text-2xl font-black text-white">{appDataStats?.nutrition?.totalMealsLogged || 0} st</div>
                                </div>
                            </div>
                        </div>

                        {/* Exercise Stats */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                <Activity className="text-blue-500" />
                                Topp-träning (Community)
                            </h2>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={appDataStats?.training?.topExercises || []} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={100} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                            itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: '#ffffff' }}
                                        />
                                        <Bar dataKey="count" name="Sessioner" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                    <div className="text-[10px] font-black text-slate-500 uppercase">Total Distans</div>
                                    <div className="text-lg font-black text-blue-400">{appDataStats?.training?.totalDistance || 0} km</div>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                    <div className="text-[10px] font-black text-slate-500 uppercase">Total Tonnage</div>
                                    <div className="text-lg font-black text-amber-500">{appDataStats?.training?.totalTonnage || 0} kg</div>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                    <div className="text-[10px] font-black text-slate-500 uppercase">Cardio Pass</div>
                                    <div className="text-lg font-black text-emerald-400">{appDataStats?.training?.cardioWorkoutCount || 0}</div>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                                    <div className="text-[10px] font-black text-slate-500 uppercase">Styrke Pass</div>
                                    <div className="text-lg font-black text-purple-400">{appDataStats?.training?.strengthWorkoutCount || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'errors' ? (
                // --- ERRORS TAB ---
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-red-500">
                        <AlertCircle />
                        Systemfel & Undantag (Problemområden)
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left">Felmeddelande</th>
                                    <th className="px-4 py-3 text-right">Antal</th>
                                    <th className="px-4 py-3 text-left">Topp-sida</th>
                                    <th className="px-4 py-3 text-right">Senast sett</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {errorStats.map((err, i) => (
                                    <tr key={i} className="hover:bg-red-500/5 transition-colors">
                                        <td className="px-4 py-4 font-bold text-red-400 max-w-md break-words">{err.message}</td>
                                        <td className="px-4 py-4 text-right font-black text-lg">{err.count}</td>
                                        <td className="px-4 py-4 font-mono text-xs text-slate-500">{err.topPath}</td>
                                        <td className="px-4 py-4 text-right text-xs text-slate-500">{formatRelativeTime(err.lastSeen)}</td>
                                    </tr>
                                ))}
                                {errorStats.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-20 text-center text-slate-500 font-bold">
                                            Inga fel hittade! Servern mår utmärkt. 🥳
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Correlation Score */}
                    {correlationStats.length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-pink-500">
                                <Activity size={18} />
                                Error-to-Exit Correlation (Impact Score)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {correlationStats.map((c, i) => (
                                    <div key={i} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 px-2 py-1 text-[10px] font-black uppercase ${c.impactScore > 50 ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                            IMPACT: {c.impactScore}%
                                        </div>
                                        <div className="text-sm font-bold text-white mb-2 pr-12">{c.message}</div>
                                        <div className="flex justify-between items-end mt-4">
                                            <div className="text-[10px] text-slate-500 uppercase font-black">
                                                {c.terminalExits} av {c.totalOccurrences} ledde till avhopp
                                            </div>
                                            <div className="h-1 w-24 bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-pink-500" style={{ width: `${c.impactScore}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : activeTab === 'retention' ? (
                // --- RETENTION TAB ---
                <RetentionHeatmap data={retention} />
            ) : activeTab === 'pathing' ? (
                // --- PATHING TAB ---
                <PathingFlow data={pathing} exitStats={exitStats} />

            ) : activeTab === 'heatmap' ? (
                // --- HEATMAP TAB ---
                <HeatmapView events={rawEvents} />
            ) : activeTab === 'friction' ? (
                // --- FRICTION TAB ---
                <DeadClickView stats={deadClickStats} />
            ) : activeTab === 'funnel' ? (
                // --- FUNNEL TAB ---
                <FunnelView events={rawEvents} definitions={funnelDefinitions} onRefresh={fetchAllData} />
            ) : activeTab === 'health' ? (
                // --- HEALTH TAB ---
                <HealthScoresView stats={healthStats} />
            ) : activeTab === 'live' ? (
                // --- LIVE TAB ---
                <LiveEventStream events={liveEvents} />
            ) : activeTab === 'experiments' ? (
                // --- EXPERIMENTS TAB ---
                <ExperimentsView experiments={experiments} />
            ) : activeTab === 'ai' ? (
                // --- AI TAB ---
                <AIInsightsView insights={aiInsights} />
            ) : (
                // --- SESSIONS TAB ---
                <div className="space-y-6">
                    {/* TABLE WAS HERE, RESTORE IT IF NEEDED OR ASSUME IT IS ABOVE? */}
                    {/* Validating context: generic "Sessions" logic usually goes here */}
                    {/* The table code seems to be what was rendered in the 'else' of pathing. */}
                    {/* If I am in the 'else' of 'funnel', I should render the table. */}
                    {/* I will assume the table code needs to be HERE. */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Användare</th>
                                        <th className="px-4 py-3 text-left">Starttid</th>
                                        <th className="px-4 py-3 text-right">Längd</th>
                                        <th className="px-4 py-3 text-right">Händelser</th>
                                        <th className="px-4 py-3 text-left">Flöde</th>
                                        <th className="px-4 py-3 text-center">Åtgärd</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {sessions.map(s => (
                                        <tr key={s.sessionId} className="hover:bg-slate-800/30">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-300">
                                                {s.userId.slice(0, 8)}...
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">
                                                {new Date(s.startTime).toLocaleString('sv-SE', {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-300 font-bold">
                                                {formatDuration(s.durationSeconds)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-purple-400 font-bold">
                                                {s.eventCount + s.viewCount}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 opacity-70">
                                                    {s.pathFlow.slice(0, 3).map((path, i) => (
                                                        <React.Fragment key={i}>
                                                            {i > 0 && <span className="text-slate-600">→</span>}
                                                            <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={path}>
                                                                {path}
                                                            </span>
                                                        </React.Fragment>
                                                    ))}
                                                    {s.pathFlow.length > 3 && <span className="text-xs text-slate-500">...</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => setPlayingSessionId(s.sessionId)}
                                                    className="p-1.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors shadow-lg shadow-pink-500/20"
                                                    title="Spela upp session"
                                                >
                                                    <Play size={16} fill="currentColor" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {sessions.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                                Inga sessioner hittades för denna period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* SESSION PLAYER MODAL */}
            {playingSessionId && (
                <SessionPlayer
                    sessionId={playingSessionId}
                    onClose={() => setPlayingSessionId(null)}
                />
            )}
        </div>
    );
}

// --- HELPER COMPONENTS ---

function RetentionHeatmap({ data }: { data: any[] }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <h2 className="text-lg font-black mb-6 flex items-center gap-2">
                <Calendar size={20} className="text-pink-500" />
                Kohort-Retention (14 Dagar)
            </h2>
            <table className="w-full text-[10px] border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 text-left bg-slate-800/50 sticky left-0 z-10 w-24">Datum</th>
                        <th className="p-2 text-center bg-slate-800/50">Antal</th>
                        {new Array(14).fill(0).map((_, i) => (
                            <th key={i} className="p-2 text-center bg-slate-800/20 w-8">D{i + 1}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {data.map(row => (
                        <tr key={row.date} className="hover:bg-slate-800/30">
                            <td className="p-2 font-bold text-slate-300 sticky left-0 bg-slate-900 z-10">{row.date}</td>
                            <td className="p-2 text-center font-bold text-white bg-slate-800/30">{row.total}</td>
                            {row.retained.map((count: number, i: number) => {
                                const percent = row.total > 0 ? (count / row.total) * 100 : 0;
                                let bgColor = 'bg-slate-900';
                                if (percent > 0) bgColor = 'bg-pink-500/10';
                                if (percent > 20) bgColor = 'bg-pink-500/30';
                                if (percent > 50) bgColor = 'bg-pink-500/60';
                                if (percent > 80) bgColor = 'bg-pink-500';

                                return (
                                    <td
                                        key={i}
                                        className={`p-2 text-center border border-slate-800/50 transition-colors ${bgColor} ${percent > 50 ? 'text-white' : 'text-slate-400'}`}
                                        title={`${count} användare återvände dag ${i + 1}`}
                                    >
                                        {percent > 0 ? `${Math.round(percent)}%` : '-'}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PathingFlow({ data, exitStats }: { data: any[], exitStats: any[] }) {
    // Separate paths and calculate exit dropoffs (simplisticly)
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-500" />
                    Vanliga Navigeringsvägar
                </h2>
                <div className="space-y-4">
                    {data.map((item: any, i: number) => {
                        const [from, to] = item.label.split(' -> ');
                        return (
                            <div key={i} className="flex items-center gap-4 group">
                                <div className="flex-1 bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center justify-between group-hover:border-blue-500/50 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="text-xs font-mono text-slate-400 truncate max-w-[150px]">{from}</span>
                                        <SkipForward size={14} className="text-slate-600 flex-shrink-0" />
                                        <span className="text-xs font-mono text-blue-400 font-bold truncate max-w-[150px]">{to}</span>
                                    </div>
                                    <div className="text-lg font-black text-white">{item.count}</div>
                                </div>
                                <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500"
                                        style={{ width: `${(item.count / data[0].count) * 100}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-8">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h2 className="text-sm font-black uppercase text-slate-500 mb-4 flex items-center gap-2">
                        <Monitor size={16} />
                        Exit-Analys
                    </h2>
                    <div className="space-y-4">
                        {exitStats.map((item: any, i: number) => (
                            <div key={i} className="flex flex-col gap-1">
                                <div className="flex justify-between text-[10px] font-bold">
                                    <span className="text-slate-400 truncate max-w-[150px]" title={item.label}>{item.label}</span>
                                    <span className="text-pink-400">{item.count}</span>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-pink-500"
                                        style={{ width: `${(item.count / (exitStats[0]?.count || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {exitStats.length === 0 && (
                            <div className="p-8 text-center text-slate-600 text-xs">
                                Inga exit-data tillgängliga.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


function SessionPlayer({ sessionId, onClose }: { sessionId: string, onClose: () => void }) {
    const [events, setEvents] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);

    // Fetch detailed events
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const res = await fetch(`/api/usage/session?id=${sessionId}`);
                const data = await res.json();
                setEvents(data.events || []);
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };
        fetchEvents();
    }, [sessionId]);

    // Playback Loop
    useEffect(() => {
        let timer: any;
        if (isPlaying && currentIndex < events.length - 1) {
            timer = setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
            }, 1000 / playbackSpeed);
        } else if (currentIndex >= events.length - 1) {
            setIsPlaying(false);
        }
        return () => clearTimeout(timer);
    }, [isPlaying, currentIndex, events.length, playbackSpeed]);

    const currentEvent = events[currentIndex];

    // Scroll event list to show current
    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (listRef.current) {
            const item = listRef.current.children[currentIndex] as HTMLElement;
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentIndex]);

    if (loading) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-950">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-pink-500 rounded-lg">
                            <Monitor size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Sessionsuppspelning</h2>
                            <p className="text-xs text-slate-400 font-mono">{sessionId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Event List */}
                    <div className="w-1/3 border-r border-slate-700 flex flex-col bg-slate-900">
                        <div className="p-2 bg-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                            Händelselogg
                        </div>
                        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
                            {events.map((e, i) => (
                                <div
                                    key={i}
                                    onClick={() => { setCurrentIndex(i); setIsPlaying(false); }}
                                    className={`p-3 rounded-lg text-xs cursor-pointer transition-all border ${i === currentIndex
                                        ? 'bg-pink-500/20 border-pink-500 text-pink-100 shadow-md transform scale-[1.02]'
                                        : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-800'
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold uppercase text-[10px] px-1.5 py-0.5 rounded ${e.type === 'error' ? 'bg-red-500/20 text-red-400' :
                                            e.type === 'rage_click' ? 'bg-red-600 text-white animate-pulse' :
                                                e._type === 'view' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                            }`}>
                                            {e.type === 'rage_click' ? '🤬 RAGE CLICK' : e.type || 'PAGEVIEW'}
                                        </span>
                                        <span className="text-slate-500">{new Date(e.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="font-medium truncate" title={e.label || e.path}>
                                        {e.label || e.path}
                                    </div>
                                    {e.metadata && (
                                        <div className="mt-1 text-[10px] text-slate-500 bg-black/20 p-1 rounded font-mono break-all">
                                            {JSON.stringify(e.metadata).slice(0, 50)}...
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Visualizer */}
                    <div className="w-2/3 bg-slate-950 p-8 flex flex-col items-center justify-center relative">
                        {currentEvent ? (
                            <div className="w-full max-w-lg aspect-video bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden relative">
                                {/* Fake Browser Bar */}
                                <div className="h-8 bg-slate-200 dark:bg-slate-700 flex items-center px-3 gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                                    </div>
                                    <div className="flex-1 bg-white dark:bg-slate-900 h-5 rounded text-[10px] flex items-center px-2 text-slate-500 truncate font-mono">
                                        {currentEvent.path}
                                    </div>
                                </div>

                                {/* Content Placeholder */}
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative w-full">
                                    {currentEvent._type === 'view' ? (
                                        <>
                                            <Monitor size={64} className="text-slate-700 mb-4" />
                                            <h3 className="text-xl font-bold text-slate-300">Sidvisning</h3>
                                            <p className="text-blue-400 font-mono mt-2">{currentEvent.path}</p>
                                        </>
                                    ) : currentEvent.type === 'rage_click' ? (
                                        <>
                                            <div className="relative">
                                                <MousePointer2 size={64} className="text-red-500 mb-4 animate-ping absolute top-0 left-0 opacity-50" />
                                                <MousePointer2 size={64} className="text-red-600 mb-4 relative z-10" />
                                            </div>
                                            <h3 className="text-2xl font-black text-red-500 uppercase tracking-widest">Rage Click</h3>
                                            <p className="text-slate-400 font-mono mt-2 text-sm">{currentEvent.label}</p>
                                            <div className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/50 rounded text-red-300 text-xs">
                                                Användaren klickade upprepade gånger på {currentEvent.target}
                                            </div>
                                        </>
                                    ) : currentEvent.type === 'error' ? (
                                        <>
                                            <AlertCircle size={64} className="text-red-500 mb-4 animate-pulse" />
                                            <h3 className="text-xl font-bold text-red-400">Frontend Fel</h3>
                                            <p className="text-slate-300 font-mono mt-2 text-sm">{currentEvent.label}</p>
                                            {currentEvent.metadata && (
                                                <div className="mt-4 bg-slate-900 p-4 rounded-lg border border-red-500/30 text-left w-full max-w-lg overflow-auto max-h-[300px]">
                                                    <pre className="text-[10px] text-red-300 font-mono whitespace-pre-wrap">
                                                        {currentEvent.metadata.stack || currentEvent.metadata.reason || JSON.stringify(currentEvent.metadata, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <MousePointer2 size={64} className="text-pink-500 mb-4 animate-bounce" />
                                            <h3 className="text-xl font-bold text-slate-300">Interaktion</h3>
                                            <p className="text-pink-400 font-mono mt-2">{currentEvent.target}: {currentEvent.label}</p>
                                            {currentEvent.metadata && (
                                                <div className="mt-4 bg-slate-900 p-4 rounded-lg border border-slate-700 text-left w-full max-w-sm">
                                                    <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
                                                        {JSON.stringify(currentEvent.metadata, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-500">Välj en händelse för att visa</div>
                        )}
                    </div>
                </div>

                {/* Footer: Controls */}
                <div className="p-4 bg-slate-900 border-t border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPlaybackSpeed(1)} className={`text-xs px-2 py-1 rounded ${playbackSpeed === 1 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>1x</button>
                        <button onClick={() => setPlaybackSpeed(2)} className={`text-xs px-2 py-1 rounded ${playbackSpeed === 2 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>2x</button>
                        <button onClick={() => setPlaybackSpeed(5)} className={`text-xs px-2 py-1 rounded ${playbackSpeed === 5 ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>5x</button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setIsPlaying(false); }}
                            disabled={currentIndex === 0}
                            className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-50 text-white"
                        >
                            <SkipBack size={20} />
                        </button>

                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="p-4 bg-pink-500 hover:bg-pink-600 rounded-full text-white shadow-lg shadow-pink-500/30 transition-transform active:scale-95"
                        >
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                        </button>

                        <button
                            onClick={() => { setCurrentIndex(Math.min(events.length - 1, currentIndex + 1)); setIsPlaying(false); }}
                            disabled={currentIndex === events.length - 1}
                            className="p-2 rounded-full hover:bg-slate-800 disabled:opacity-50 text-white"
                        >
                            <SkipForward size={20} />
                        </button>
                    </div>

                    <div className="w-[100px] text-right text-xs text-slate-500 font-mono">
                        {currentIndex + 1} / {events.length}
                    </div>
                </div>
            </div>
        </div>
    );
}

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
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
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
function HeatmapView({ events }: { events: InteractionEvent[] }) {
    const [selectedPath, setSelectedPath] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'heatmap' | 'precision'>('heatmap');

    // 1. Basic Filtering
    const clicks = events.filter(e => (e.type === 'click' || e.type === 'rage_click') && e.coordinates);
    const paths = Array.from(new Set(clicks.map(e => e.path)));
    const filteredClicks = selectedPath === 'all' ? clicks : clicks.filter(e => e.path === selectedPath);

    // 2. Aggregate Elements (One rect per unique element)
    const aggregatedElements = React.useMemo(() => {
        const map = new Map<string, { rect: any, count: number, misses: number, label: string }>();
        filteredClicks.forEach(c => {
            if (!c.elementRect) return;
            const key = `${c.target}-${c.label}`;
            const existing = map.get(key) || { rect: c.elementRect, count: 0, misses: 0, label: c.label };
            existing.count++;

            // Precision logic
            const { x, y } = c.coordinates!;
            const { top, left, width, height } = c.elementRect;
            if (x < left || x > left + width || y < top || y > top + height) {
                existing.misses++;
            }
            map.set(key, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [filteredClicks]);

    const totalMissrate = filteredClicks.length > 0
        ? Math.round((aggregatedElements.reduce((acc, curr) => acc + curr.misses, 0) / filteredClicks.length) * 100)
        : 0;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-xl font-black flex items-center gap-2">
                        <Activity className="text-indigo-500" />
                        Heatmap & Precision v3
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                        Global Miss Rate: <span className={totalMissrate > 20 ? 'text-red-500' : 'text-emerald-500'}>{totalMissrate}%</span>
                    </p>
                </div>

                <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button
                        onClick={() => setViewMode('heatmap')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'heatmap' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Heatmap
                    </button>
                    <button
                        onClick={() => setViewMode('precision')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'precision' ? 'bg-pink-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Precision
                    </button>
                </div>

                <select
                    value={selectedPath}
                    onChange={e => setSelectedPath(e.target.value)}
                    className="bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700 text-xs font-bold"
                >
                    <option value="all">Alla sidor</option>
                    {paths.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>

            <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group">
                {/* Visual Depth Grid */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#2d3748 1px, transparent 1px), linear-gradient(90deg, #2d3748 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none"></div>

                {/* Aggregated Bounding Boxes */}
                {viewMode === 'precision' && aggregatedElements.map((el, i) => (
                    <div
                        key={`rect-${i}`}
                        className={`absolute border-2 transition-all duration-500 group/el cursor-help ${el.misses / el.count > 0.3 ? 'border-red-500/40 bg-red-500/5' : 'border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-500/60 hover:bg-indigo-500/10'
                            }`}
                        style={{
                            left: `${(el.rect.left / filteredClicks[0].coordinates!.viewportW) * 100}%`,
                            top: `${(el.rect.top / filteredClicks[0].coordinates!.viewportH) * 100}%`,
                            width: `${(el.rect.width / filteredClicks[0].coordinates!.viewportW) * 100}%`,
                            height: `${(el.rect.height / filteredClicks[0].coordinates!.viewportH) * 100}%`,
                            zIndex: 10
                        }}
                    >
                        <div className="absolute -top-4 left-0 text-[8px] font-black uppercase text-slate-500 whitespace-nowrap group-hover/el:text-white transition-colors">
                            {el.label || 'Oidentifierat element'}
                        </div>

                        {/* Tooltip on Hover */}
                        <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-2xl opacity-0 group-hover/el:opacity-100 transition-opacity z-50 pointer-events-none w-48">
                            <div className="text-[10px] font-black text-indigo-400 uppercase mb-1">Element-analys</div>
                            <div className="text-sm font-bold text-white mb-2">{el.label}</div>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div> Besök: <span className="text-white">{el.count}</span></div>
                                <div> Missar: <span className="text-red-400">{el.misses}</span></div>
                                <div className="col-span-2 pt-2 border-t border-slate-800">
                                    Hit Rate: <span className="text-emerald-400">{Math.round(((el.count - el.misses) / el.count) * 100)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Intelligent Heat Dots */}
                {viewMode === 'heatmap' && filteredClicks.map((click, i) => (
                    <div
                        key={i}
                        className={`absolute w-12 h-12 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20`}
                        style={{
                            left: `${click.coordinates?.pctX}%`,
                            top: `${click.coordinates?.pctY}%`,
                            background: click.type === 'rage_click'
                                ? 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0) 70%)'
                                : 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0) 70%)'
                        }}
                    />
                ))}

                {/* Core Click Points (The "Incandescence") */}
                {filteredClicks.map((click, i) => (
                    <div
                        key={`core-${i}`}
                        className={`absolute w-1.5 h-1.5 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 z-30 shadow-[0_0_8px_rgba(255,255,255,0.5)] ${click.type === 'rage_click' ? 'bg-red-400 scale-150' : 'bg-indigo-300'
                            }`}
                        style={{
                            left: `${click.coordinates?.pctX}%`,
                            top: `${click.coordinates?.pctY}%`,
                        }}
                    />
                ))}

                {filteredClicks.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-600 font-bold uppercase tracking-tighter">
                        Väntar på klick-synk...
                    </div>
                )}
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-500 font-black uppercase">Totalt Antal Klick</div>
                    <div className="text-xl font-black text-white">{filteredClicks.length}</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-500 font-black uppercase">Unika Element</div>
                    <div className="text-xl font-black text-white">{aggregatedElements.length}</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                    <div className="text-[10px] text-slate-500 font-black uppercase">Genomsnittlig Missrate</div>
                    <div className={`text-xl font-black ${totalMissrate > 20 ? 'text-red-500' : 'text-emerald-500'}`}>{totalMissrate}%</div>
                </div>
                <div class="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                    <div class="text-[10px] text-slate-500 font-black uppercase">Rage Click Index</div>
                    <div class="text-xl font-black text-pink-500">
                        {Math.round((filteredClicks.filter(c => c.type === 'rage_click').length / (filteredClicks.length || 1)) * 100)}%
                    </div>
                </div>
            </div>

            {/* Element Detail Table */}
            <div className="mt-8 border-t border-slate-800 pt-6">
                <h3 className="text-xs font-black uppercase text-slate-500 mb-4">Mest klickade element på denna sida</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-slate-500 border-b border-slate-800">
                                <th className="text-left py-2">Label</th>
                                <th className="text-right py-2">Klick</th>
                                <th className="text-right py-2">Miss rate</th>
                                <th className="text-right py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {aggregatedElements.slice(0, 5).map((el, i) => (
                                <tr key={i} className="group hover:bg-white/5">
                                    <td className="py-3 font-bold text-white">{el.label}</td>
                                    <td className="py-3 text-right text-slate-400">{el.count}</td>
                                    <td className="py-3 text-right text-slate-400">{Math.round((el.misses / el.count) * 100)}%</td>
                                    <td className="py-3 text-right">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${(el.misses / el.count) > 0.3 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                            {(el.misses / el.count) > 0.3 ? 'Dålig precision' : 'Dunder'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function DeadClickView({ stats }: { stats: any[] }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-amber-500">
                <MousePointer2 />
                Dead Click Explorer
            </h2>
            <p className="text-sm text-slate-500 mb-6">
                Visar element som användare klickar på men som inte har någon interaktivitet.
                Indikerar ofta att användaren förväntar sig att något ska hända (t.ex. att en bild ska förstoras).
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left">Element & Text</th>
                            <th className="px-4 py-3 text-right">Antal</th>
                            <th className="px-4 py-3 text-left">Vanligaste Sida</th>
                            <th className="px-4 py-3 text-right">Senast sett</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {stats.map((s, i) => (
                            <tr key={i} className="hover:bg-amber-500/5 transition-colors">
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-400">{s.label.split(':')[0]}</span>
                                        <span className="font-bold text-slate-300">{s.label.split(':').slice(1).join(':')}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-right font-black text-amber-500 text-lg">{s.count}</td>
                                <td className="px-4 py-4 font-mono text-xs text-slate-500">{s.topPath}</td>
                                <td className="px-4 py-4 text-right text-xs text-slate-500">{formatRelativeTime(s.lastSeen)}</td>
                            </tr>
                        ))}
                        {stats.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-20 text-center text-slate-500 font-bold">
                                    Inga döda klick hittade än. Bra UX! 👏
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function FrictionView({ events }: { events: InteractionEvent[] }) {
    // Calculate metric scores (normally these would be pre-calculated on server)
    const stats = React.useMemo(() => {
        const rageClicks = events.filter(e => e.type === 'rage_click').length;
        const deadClicks = events.filter(e => e.type === 'dead_click').length;
        const errors = events.filter(e => e.type === 'error').length;

        // Mocking slow pages for demo if no data
        const slowPages = events.filter(e => e.type === 'other' && (e.metadata?.duration > 1000)).length;
        const bounceRate = 12; // Hardcoded mock or calc from sessions

        return [
            { subject: 'Rage Clicks', A: Math.min(100, rageClicks * 10), fullMark: 100 },
            { subject: 'Errors', A: Math.min(100, errors * 20), fullMark: 100 },
            { subject: 'Dead Clicks', A: Math.min(100, deadClicks * 5), fullMark: 100 },
            { subject: 'Slow Pages', A: Math.min(100, slowPages * 10), fullMark: 100 },
            { subject: 'Bounce Rate', A: bounceRate, fullMark: 100 },
        ];
    }, [events]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
                <h2 className="text-xl font-black mb-6 flex items-center gap-2 self-start">
                    <AlertCircle className="text-red-500" />
                    UX Friction Radar
                </h2>
                <div className="w-full h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                            <Radar
                                name="Friction Score"
                                dataKey="A"
                                stroke="#ec4899"
                                strokeWidth={3}
                                fill="#ec4899"
                                fillOpacity={0.3}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                itemStyle={{ color: '#ec4899' }}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-black mb-6 text-slate-100">Analys</h2>
                <div className="space-y-6">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <h3 className="font-bold text-red-400 mb-2">Högsta Friktion</h3>
                        <p className="text-sm text-slate-400">
                            {stats.sort((a, b) => b.A - a.A)[0].subject} är det största problemet just nu.
                            Detta indikerar att användare upplever frustration eller tekniska hinder.
                        </p>
                    </div>
                    <div className="p-4 bg-slate-800 rounded-xl">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2">Totala Händelser</div>
                        <div className="space-y-2">
                            {stats.map(s => (
                                <div key={s.subject} className="flex justify-between text-sm">
                                    <span className="text-slate-300">{s.subject}</span>
                                    <span className="font-mono text-pink-400 font-bold">{s.A}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FunnelView({ events, definitions, onRefresh }: { events: InteractionEvent[], definitions: any[], onRefresh: () => void }) {
    const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(definitions[0]?.id || null);
    const [isCreating, setIsCreating] = useState(false);

    const activeFunnel = definitions.find(d => d.id === selectedFunnelId);

    const funnelData = React.useMemo(() => {
        if (!activeFunnel) return [];

        const results = [];
        let prevUserIds = new Set(events.map(e => e.userId));

        for (const step of activeFunnel.steps) {
            const stepUserIds = new Set(
                events.filter(e => {
                    // Match by bitmask or specific property
                    if (step.type === 'path') return e.path === step.value;
                    if (step.type === 'action') return e.label.includes(step.value) || e.target === step.value;
                    return false;
                }).map(e => e.userId)
            );

            // Users must have been in the previous set to count (funnel flow)
            const qualifiedUserIds = new Set([...stepUserIds].filter(id => prevUserIds.has(id)));

            results.push({
                name: step.name,
                value: qualifiedUserIds.size,
                fill: step.color || '#ec4899'
            });

            prevUserIds = qualifiedUserIds;
        }

        return results;
    }, [events, activeFunnel]);

    const handleSaveFunnel = async (e: React.FormEvent) => {
        e.preventDefault();
        const obj = {
            id: generateId(),
            name: "Ny Tratt",
            steps: [
                { name: "Start", type: "path", value: "/calories", color: "#6366f1" },
                { name: "Mål", type: "action", value: "Spara", color: "#ec4899" }
            ]
        };
        await fetch('/api/usage/funnels', {
            method: 'POST',
            body: JSON.stringify(obj)
        });
        onRefresh();
        setIsCreating(false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-black flex items-center gap-2">
                        <TrendingUp className="text-pink-500" />
                        Konverterings-Trattar
                    </h2>
                    <div className="flex gap-2">
                        <select
                            value={selectedFunnelId || ''}
                            onChange={e => setSelectedFunnelId(e.target.value)}
                            className="bg-slate-800 text-white px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-bold"
                        >
                            <option value="">Välj en vy...</option>
                            {definitions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <button
                            onClick={handleSaveFunnel}
                            className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 rounded-lg text-xs font-bold text-white shadow-lg shadow-pink-500/20"
                        >
                            + Skapa Ny
                        </button>
                    </div>
                </div>

                {activeFunnel ? (
                    <>
                        <div className="w-full h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={funnelData}
                                    layout="vertical"
                                    barSize={40}
                                    margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" />
                                    <XAxis type="number" stroke="#94a3b8" />
                                    <YAxis type="category" dataKey="name" stroke="#94a3b8" width={100} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {funnelData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-8">
                            {funnelData.map((step, i) => (
                                <div key={step.name} className="bg-slate-800 p-4 rounded-xl text-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: step.fill }}></div>
                                    <div className="text-2xl font-black text-white">{step.value}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-500">{step.name}</div>
                                    {i > 0 && (
                                        <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-bold">
                                            {funnelData[i - 1].value > 0 ? Math.round((step.value / funnelData[i - 1].value) * 100) : 0}% konv.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="py-20 text-center text-slate-500 font-bold">
                        Inga definitioner laddade. Välj eller skapa en ny!
                    </div>
                )}
            </div>
        </div>
    );
}


function HealthScoresView({ stats }: { stats: any[] }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-pink-500">
                <Activity />
                User Health & Churn Risk
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((s, i) => (
                    <div key={i} className={`p-5 rounded-2xl border ${s.status === 'healthy' ? 'bg-emerald-500/5 border-emerald-500/20' :
                        s.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                            'bg-red-500/5 border-red-500/20'
                        }`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-xs font-mono text-slate-500 mb-1">{s.userId}</div>
                                <div className={`text-xs font-black uppercase px-2 py-0.5 rounded ${s.status === 'healthy' ? 'bg-emerald-500 text-white' :
                                    s.status === 'warning' ? 'bg-amber-500 text-black' :
                                        'bg-red-500 text-white'
                                    }`}>
                                    {s.status}
                                </div>
                            </div>
                            <div className="text-3xl font-black text-white">{s.score}</div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Active Days</span>
                                <span className="text-slate-300 font-bold">{s.metrics.activeDays}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Rage Clicks</span>
                                <span className={`font-bold ${s.metrics.rageClicks > 0 ? 'text-red-400' : 'text-slate-300'}`}>{s.metrics.rageClicks}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">Errors</span>
                                <span className={`font-bold ${s.metrics.errors > 0 ? 'text-red-400' : 'text-slate-300'}`}>{s.metrics.errors}</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${s.status === 'healthy' ? 'bg-emerald-500' :
                                    s.status === 'warning' ? 'bg-amber-500' :
                                        'bg-red-500'
                                    }`} style={{ width: `${s.score}%` }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {stats.length === 0 && (
                <div className="py-20 text-center text-slate-600 italic">No health data available. Tracking requires active sessions.</div>
            )}
        </div>
    );
}

function LiveEventStream({ events }: { events: any[] }) {
    return (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[70vh]">
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Live Event Matrix</h2>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Real-time Stream Intercept</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1">
                {events.map((e, i) => (
                    <div key={i} className="flex gap-4 hover:bg-white/5 py-0.5 group">
                        <span className="text-slate-600">[{new Date(e.timestamp).toLocaleTimeString()}]</span>
                        <span className="text-blue-500 w-24 truncate">{e.userId}</span>
                        <span className={`w-20 font-bold ${e.type === 'error' ? 'text-red-500' :
                            e.type === 'click' ? 'text-emerald-500' :
                                e.type === 'rage_click' ? 'text-pink-500' : 'text-slate-400'
                            }`}>{e.type.toUpperCase()}</span>
                        <span className="text-slate-300 flex-1 truncate">{e.path}</span>
                        <span className="text-slate-500 opacity-0 group-hover:opacity-100 italic transition-opacity">{e.label}</span>
                    </div>
                ))}
                {events.length === 0 && (
                    <div className="h-full flex items-center justify-center text-slate-600 uppercase tracking-tighter italic">
                        Waiting for uplink...
                    </div>
                )}
            </div>
        </div>
    );
}

function ExperimentsView({ experiments }: { experiments: any[] }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-indigo-500">
                <Search />
                A/B Test Results
            </h2>
            <div className="space-y-8">
                {experiments.map((exp, i) => (
                    <div key={i} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                {exp.id}
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className={`px-3 py-1 rounded-full text-xs font-black uppercase ${exp.improvement > 0 ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                                    }`}>
                                    {exp.improvement > 0 ? '+' : ''}{exp.improvement}% Impact
                                </div>
                                <div className="text-xs font-bold text-slate-500">
                                    Winning Variant: <span className="text-indigo-400 font-black">{exp.winner}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Variant A */}
                            <div className={`p-4 rounded-xl border ${exp.winner === 'A' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-900/50 border-slate-800'}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-black uppercase text-slate-500">Variant A (Control)</span>
                                    <span className="text-2xl font-black text-white">{exp.variantA.rate}%</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold">
                                        <span className="text-slate-500 text-uppercase">Visitors</span>
                                        <span className="text-slate-300">{exp.variantA.visitors}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold">
                                        <span className="text-slate-500 text-uppercase">Conversions</span>
                                        <span className="text-slate-300">{exp.variantA.conversions}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-4">
                                        <div className="h-full bg-slate-500" style={{ width: `${exp.variantA.rate}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Variant B */}
                            <div className={`p-4 rounded-xl border ${exp.winner === 'B' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-900/50 border-slate-800'}`}>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-black uppercase text-slate-500">Variant B (Test)</span>
                                    <span className="text-2xl font-black text-white">{exp.variantB.rate}%</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold">
                                        <span className="text-slate-500 text-uppercase">Visitors</span>
                                        <span className="text-slate-300">{exp.variantB.visitors}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold">
                                        <span className="text-slate-500 text-uppercase">Conversions</span>
                                        <span className="text-slate-300">{exp.variantB.conversions}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-4">
                                        <div className="h-full bg-indigo-500" style={{ width: `${exp.variantB.rate}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {experiments.length === 0 && (
                    <div className="py-20 text-center text-slate-600 italic">No A/B test data logged yet. Use <code>useExperiment()</code> to start testing!</div>
                )}
            </div>
        </div>
    );
}

function AIInsightsView({ insights }: { insights: any[] }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2 text-indigo-500">
                <div className="p-2 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] rounded-lg">
                    <TrendingUp className="text-white w-5 h-5" />
                </div>
                AI UX Insights & Rekommendationer
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {insights.map((ins, i) => (
                    <div key={i} className={`p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] ${ins.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 'bg-indigo-500/5 border-indigo-500/20'
                        }`}>
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${ins.severity === 'high' ? 'bg-red-500 text-white' : 'bg-indigo-500 text-white'
                                }`}>
                                {ins.type.replace('_', ' ')} / {ins.severity}
                            </span>
                        </div>
                        <h3 className="text-lg font-black text-white mb-2">{ins.title}</h3>
                        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                            {ins.description}
                        </p>
                        <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
                            <div className="text-[10px] font-black text-emerald-400 uppercase mb-2 flex items-center gap-1">
                                <SkipForward className="w-3 h-3" /> Rekommenderad Åtgärd
                            </div>
                            <div className="text-xs text-slate-300 italic">
                                "{ins.suggestion}"
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {insights.length === 0 && (
                <div className="py-20 text-center">
                    <div className="text-4xl mb-4">✨</div>
                    <div className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                        Inga problem funna. Din app kör på dunder-nivå!
                    </div>
                </div>
            )}
        </div>
    );
}
