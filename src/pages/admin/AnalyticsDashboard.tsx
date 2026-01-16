import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AnalyticsStats, PageView, InteractionEvent } from '../../models/types.ts';
import {
    BarChart3, TrendingUp, Users, MousePointer2, Search, Clock, Activity,
    ChevronDown, ChevronUp, Filter, RefreshCw, Play, Pause, SkipForward,
    SkipBack, X, Monitor, Calendar, Timer, AlertCircle
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
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
    const [activeTab, setActiveTab] = useState<'overview' | 'sessions'>('overview');

    // Overview Data
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [users, setUsers] = useState<UserActivity[]>([]);
    const [omnibox, setOmnibox] = useState<OmniboxStats | null>(null);
    const [daily, setDaily] = useState<DailyData[]>([]);

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
            } else {
                // Fetch Sessions
                const res = await fetch(`/api/usage/sessions?days=${daysBack}`);
                const data = await res.json();
                setSessions(data.sessions || []);
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
            ) : (
                // --- SESSIONS TAB ---
                <div className="space-y-6">
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
            }, 1000 / playbackSpeed); // Simple constant time between events for now (could use real timestamps)
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
                                                e._type === 'view' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                            }`}>
                                            {e.type || 'PAGEVIEW'}
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
                                    ) : currentEvent.type === 'error' ? (
                                        <>
                                            <AlertCircle size={64} className="text-red-500 mb-4 animate-pulse" />
                                            <h3 className="text-xl font-bold text-red-400">Frontend Fel</h3>
                                            <p className="text-slate-300 font-mono mt-2 text-sm">{currentEvent.label}</p>

                                            {/* Metadata Overlay */}
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

                                            {/* Metadata Overlay */}
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
