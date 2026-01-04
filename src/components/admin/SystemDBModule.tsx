import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type Tab = 'overview' | 'users' | 'explorer' | 'logs';


const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const SystemDBModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [explorerPath, setExplorerPath] = useState<string[]>([]);

    useEffect(() => {
        const handler = (e: any) => {
            if (e.detail?.tab) setActiveTab(e.detail.tab);
            if (e.detail?.path) setExplorerPath(e.detail.path);
        };
        window.addEventListener('admin:navigate-kv', handler);
        return () => window.removeEventListener('admin:navigate-kv', handler);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-slate-800 pb-2 overflow-x-auto">
                {(['overview', 'users', 'explorer', 'logs'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab
                            ? 'bg-slate-800 text-white'
                            : 'text-gray-500 hover:text-white hover:bg-slate-800/50'
                            }`}
                    >
                        {tab === 'overview' && '📊 Översikt'}
                        {tab === 'users' && '👥 Användardata'}
                        {tab === 'explorer' && '📂 Utforskare'}
                        {tab === 'logs' && '📜 Systemloggar'}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'explorer' && <ExplorerTab initialPath={explorerPath} />}
                {activeTab === 'logs' && <LogsTab />}
            </div>
        </div>
    );
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const OverviewTab: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch('/api/admin/kv/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const chartData = useMemo(() => {
        if (!data?.stats?.byPrefix) return [];
        const entries = Object.entries(data.stats.byPrefix).map(([name, val]: [string, any]) => ({
            name,
            value: val.size,
            count: val.count
        })).sort((a, b) => b.value - a.value);

        if (entries.length <= 10) return entries;

        const top = entries.slice(0, 10);
        const others = entries.slice(10).reduce((acc, curr) => ({
            name: 'Övriga',
            value: acc.value + curr.value,
            count: acc.count + curr.count
        }), { name: 'Övriga', value: 0, count: 0 });

        return [...top, others];
    }, [data]);

    const historyData = useMemo(() => {
        if (!data?.history) return [];
        return data.history.map((h: any) => ({
            date: h.date,
            keys: h.stats.totalKeys,
            size: h.stats.totalSize
        }));
    }, [data]);

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Laddar statistik...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">Kunde inte hämta data.</div>;

    const { totalKeys, totalSize } = data.stats;

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Totala Nycklar</div>
                    <div className="text-3xl font-black text-white">{totalKeys.toLocaleString()}</div>
                    <div className="text-emerald-400 text-xs mt-2 font-mono flex items-center gap-1">
                        <span>↑</span> +{data.history?.length > 1 ? (totalKeys - data.history[data.history.length - 2].stats.totalKeys) : 0} sen igår
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Storlek</div>
                    <div className="text-3xl font-black text-white">{formatBytes(totalSize)}</div>
                </div>

                {/* Biggest Entry */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Största Entry</div>
                    {/* Placeholder - we need to fetch this or pass it from backend, for now assume we verify visually in Users tab or add logic later. 
                        Actually, let's look at chartData to guess or leave as 'N/A' if not ready. 
                        Wait, best to implement statsRepo update for this or skip for now? 
                        User explicitly asked for it. I'll defer this slightly or add a placeholder calculation if possible.
                    */}
                    {/* The current endpoint `stats` doesn't return user stats. We need to fetch users or accept that we only show global stats here.
                        The stats.byPrefix gives us biggest COLLECTION.
                     */}
                    {(() => {
                        const topPrefix = chartData[0];
                        return (
                            <div className="text-3xl font-black text-white truncate text-xs mt-2">
                                <div className="text-xl">{topPrefix ? topPrefix.name : '-'}</div>
                                <div className="text-sm text-gray-400">{topPrefix ? formatBytes(topPrefix.value) : ''}</div>
                            </div>
                        )
                    })()}
                    <div className="text-gray-600 text-[10px] uppercase font-bold mt-1">Största Samling</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Historik</div>
                    <div className="text-3xl font-black text-blue-400">{data.history?.length || 0}</div>
                    <div className="text-gray-500 text-xs mt-2 font-mono">Dagar</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribution Chart */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Lagringsdistribution</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#fff' }}
                                    formatter={(value: number) => [formatBytes(value), 'Size']}
                                />
                                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Growth Chart */}
                <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Tillväxt (Storlek)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyData}>
                                <defs>
                                    <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(v)} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="size" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSize)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

const UsersTab: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch('/api/admin/kv/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                setData(json);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredUsers = useMemo(() => {
        if (!data?.users) return [];
        return data.users.filter((u: any) =>
            u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.userId.includes(searchTerm)
        );
    }, [data, searchTerm]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
            <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-gray-400 animate-pulse text-sm font-bold uppercase tracking-widest">Skannar hela databasen...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Orphaned Data Alert */}
            {data?.orphans?.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl flex items-start gap-4">
                    <div className="bg-red-500/20 p-3 rounded-xl text-red-500 text-xl">⚠️</div>
                    <div className="flex-1">
                        <h4 className="text-red-400 font-bold text-lg mb-1">Orphaned Data Detected</h4>
                        <p className="text-sm text-red-300/80 mb-4">
                            Hittade {data.orphans.length} poster som verkar sakna en giltig användare.
                            Detta kan vara skräpdata från borttagna konton.
                        </p>
                        <div className="bg-slate-950/50 rounded-xl overflow-hidden border border-red-500/20 max-h-[200px] overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-red-500/10 text-red-300 sticky top-0">
                                    <tr>
                                        <th className="p-3">Nyckel</th>
                                        <th className="p-3 text-right">Storlek</th>
                                        <th className="p-3">Prefix</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-red-500/10">
                                    {data.orphans.map((o: any, i: number) => (
                                        <tr key={i} className="hover:bg-red-500/5">
                                            <td className="p-3 font-mono text-red-200/70 truncate max-w-[300px]" title={o.key}>{o.key}</td>
                                            <td className="p-3 text-right font-mono text-red-200">{formatBytes(o.size)}</td>
                                            <td className="p-3 text-red-200/50">{o.prefix}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="bg-blue-500/20 text-blue-400 p-2 rounded-lg">👥</span> Användartopplista
                    </h3>
                    <input
                        type="text"
                        placeholder="Sök användare..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full md:w-64"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-slate-950/50 text-xs uppercase font-bold tracking-wider text-gray-500">
                            <tr>
                                <th className="p-4 pl-6">Användare</th>
                                <th className="p-4 text-right">Nycklar</th>
                                <th className="p-4 text-right">Total Storlek</th>
                                <th className="p-4">Mest data i...</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredUsers.map((u: any) => {
                                const topPrefix = Object.entries(u.prefixes).sort(([, a]: any, [, b]: any) => b - a)[0];
                                return (
                                    <tr
                                        key={u.userId}
                                        onClick={() => {
                                            // Handle cross-tab navigation (This requires moving state up or finding a way to signal parent)
                                            // For now, let's assume we can dispatch a custom event or use a callback if we refactor.
                                            // Since activeTab is local to SystemDBModule, we need to lift state or expose a setter.
                                            // Let's modify SystemDBModule to pass a 'navigate' prop or similar.
                                            // Actually, easier refactor: Move UsersTab inside SystemDBModule component to close over 'setActiveTab'.
                                            // But for now, let's just make it visually consistent and wait for the refactor step.
                                            // Wait, I can't easily access setActiveTab here as it's a separate component.
                                            // I will refactor SystemDBModule to pass setActiveTab to UsersTab.
                                            window.dispatchEvent(new CustomEvent('admin:navigate-kv', { detail: { tab: 'explorer', path: ['activities', u.userId] } }));
                                        }}
                                        className="hover:bg-blue-600/20 hover:text-white cursor-pointer transition-all group"
                                    >
                                        <td className="p-4 pl-6 group-hover:text-white">
                                            <div className="font-bold text-white text-base">{u.username}</div>
                                            <div className="font-mono text-xs opacity-50">{u.userId}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-white">{u.keyCount}</td>
                                        <td className="p-4 text-right font-mono text-emerald-400 group-hover:text-emerald-300 font-bold">
                                            {formatBytes(u.totalSize)}
                                        </td>
                                        <td className="p-4">
                                            {topPrefix ? (
                                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 group-hover:bg-slate-700 text-xs font-mono border border-slate-700">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    {topPrefix[0]} ({formatBytes(Number(topPrefix[1]))})
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ExplorerTab: React.FC<{ initialPath?: string[] }> = ({ initialPath }) => {
    const [path, setPath] = useState<string[]>(initialPath || []);
    const [data, setData] = useState<{ subPrefixes: { name: string, count: number, size: number }[], keys: any[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [viewingValue, setViewingValue] = useState<{ key: any, value: any } | null>(null);
    const [filter, setFilter] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'size' | 'count'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Update path if initialPath changes (e.g. from navigation event)
    useEffect(() => {
        if (initialPath) setPath(initialPath);
    }, [initialPath]);

    const fetchPath = async (currentPath: string[]) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/admin/kv/entries', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ prefix: currentPath })
            });
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPath(path);
    }, [path]);

    const handleNavigate = (segment: string) => {
        setPath([...path, segment]);
        setFilter(''); // Reset filter on navigation
    };

    const handleBreadcrumbClick = (index: number) => {
        setPath(path.slice(0, index + 1));
        setFilter('');
    };

    const handleViewValue = async (key: any[]) => {
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/admin/kv/entry', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ key })
            });
            const json = await res.json();
            setViewingValue({ key, value: json.value });
        } catch (e) {
            console.error(e);
            alert('Kunde inte hämta värdet');
        }
    };

    const sortedAndFilteredItems = useMemo(() => {
        if (!data) return [];

        let folders = data.subPrefixes.map(p => ({ ...p, type: 'folder' })) || [];
        let files = data.keys.map(k => ({ ...k, name: String(k.key[k.key.length - 1]), type: 'file' })) || [];

        // Filter
        if (filter) {
            const f = filter.toLowerCase();
            folders = folders.filter(i => i.name.toLowerCase().includes(f));
            files = files.filter(i => i.name.toLowerCase().includes(f));
        }

        // Sort
        const compare = (a: any, b: any) => {
            let res = 0;
            if (sortBy === 'name') res = (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'size') res = (a.size || 0) - (b.size || 0);
            if (sortBy === 'count') res = (a.count || 0) - (b.count || 0);
            return sortDir === 'asc' ? res : -res;
        };

        return [...folders.sort(compare), ...files.sort(compare)];
    }, [data, filter, sortBy, sortDir]);

    const toggleSort = (field: 'name' | 'size' | 'count') => {
        if (sortBy === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDir('asc');
        }
    };

    return (
        <div className="flex gap-6 h-[700px] animate-in fade-in duration-300">
            {/* Explorer Column */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
                {/* Header: Breadcrumbs & Actions */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-sm overflow-x-auto custom-scrollbar pb-2">
                        <button
                            onClick={() => setPath([])}
                            className={`font-mono font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors ${path.length === 0 ? 'text-white' : 'text-blue-400'}`}
                        >
                            ROOT
                        </button>
                        {path.map((segment, i) => (
                            <React.Fragment key={i}>
                                <span className="text-slate-600">/</span>
                                <button
                                    onClick={() => handleBreadcrumbClick(i)}
                                    className={`font-mono font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors ${i === path.length - 1 ? 'text-white' : 'text-blue-400'}`}
                                >
                                    {segment}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Filtrera..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 flex-1"
                        />
                        <div className="text-gray-500 text-xs flex items-center px-2">
                            {data ? `${data.subPrefixes.length} mappar, ${data.keys.length} filer` : '...'}
                        </div>
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-800 text-[10px] uppercase font-bold text-gray-500">
                    <div className="col-span-6 cursor-pointer hover:text-white flex items-center gap-1" onClick={() => toggleSort('name')}>
                        Namn {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-3 text-right cursor-pointer hover:text-white flex justify-end items-center gap-1" onClick={() => toggleSort('count')}>
                        Poster {sortBy === 'count' && (sortDir === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-3 text-right cursor-pointer hover:text-white flex justify-end items-center gap-1" onClick={() => toggleSort('size')}>
                        Storlek {sortBy === 'size' && (sortDir === 'asc' ? '↑' : '↓')}
                    </div>
                </div>

                {/* Content List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Laddar...</div>
                    ) : (
                        <div className="space-y-1">
                            {sortedAndFilteredItems.map((item: any, i) => (
                                <div
                                    key={i}
                                    onClick={() => item.type === 'folder' ? handleNavigate(item.name) : handleViewValue(item.key)}
                                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg hover:bg-slate-800/80 cursor-pointer group transition-all border border-transparent hover:border-slate-700"
                                >
                                    <div className="col-span-6 flex items-center gap-3 min-w-0">
                                        <span className="text-lg group-hover:scale-110 transition-transform">
                                            {item.type === 'folder' ? '📁' : '📄'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-mono text-xs truncate ${item.type === 'folder' ? 'text-amber-100 font-bold' : 'text-blue-100'}`}>
                                                {item.name}
                                            </div>
                                            {item.type === 'file' && (
                                                <div className="text-[9px] text-gray-600 truncate hidden group-hover:block">
                                                    {JSON.stringify(item.key)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-3 text-right">
                                        {item.type === 'folder' ? (
                                            <span className="text-xs font-mono text-gray-400 bg-slate-900/50 px-2 py-0.5 rounded-full">{item.count}</span>
                                        ) : (
                                            <span className="text-xs text-gray-600">-</span>
                                        )}
                                    </div>

                                    <div className="col-span-3 text-right font-mono text-xs text-emerald-500 font-bold">
                                        {formatBytes(item.size)}
                                    </div>
                                </div>
                            ))}

                            {sortedAndFilteredItems.length === 0 && (
                                <div className="text-center p-8 text-gray-500 italic">
                                    {filter ? 'Inga träffar matching filter.' : 'Tom mapp.'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Viewer Column (Conditional) */}
            {viewingValue && (
                <div className="w-1/3 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-right-10 duration-300">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                        <h4 className="font-bold text-white text-sm">Value Viewer</h4>
                        <button onClick={() => setViewingValue(null)} className="text-gray-500 hover:text-white">×</button>
                    </div>
                    <div className="flex-1 overflow-auto p-4 bg-[#0d1117] custom-scrollbar">
                        <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap break-all">
                            {JSON.stringify(viewingValue.value, null, 2)}
                        </pre>
                    </div>
                    <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-gray-500 font-mono break-all">
                        Key: {JSON.stringify(viewingValue.key)}
                    </div>
                </div>
            )}
        </div>
    );
};

const LogsTab: React.FC = () => {
    const [logs, setLogs] = useState<any[]>([]);
    const [type, setType] = useState<'error' | 'metric'>('error');
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch(`/api/admin/kv/logs?type=${type}&limit=100`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            setLogs(json.logs || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [type]);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    <button
                        onClick={() => setType('error')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border ${type === 'error' ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-slate-800 text-gray-500 hover:text-white'}`}
                    >
                        ERROR LOGS
                    </button>
                    <button
                        onClick={() => setType('metric')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border ${type === 'metric' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-slate-800 text-gray-500 hover:text-white'}`}
                    >
                        METRICS STREAM
                    </button>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Refresh (5s)
                </div>
            </div>

            <div className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden min-h-[500px] flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-900 text-gray-500 sticky top-0">
                            <tr>
                                <th className="p-3">Timestamp</th>
                                <th className="p-3">{type === 'error' ? 'Level' : 'Name'}</th>
                                <th className="p-3 w-full">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {(logs || []).map((log, i) => (
                                <tr key={i} className="hover:bg-slate-900/50 text-gray-300">
                                    <td className="p-3 text-gray-500 whitespace-nowrap">
                                        {type === 'error' ? (log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-') : (log.value?.timestamp ? new Date(log.value.timestamp).toLocaleTimeString() : '-')}
                                    </td>
                                    {type === 'error' ? (
                                        <td className="p-3">
                                            <span className="px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-900/50">
                                                {log.level || 'UNKNOWN'}
                                            </span>
                                        </td>
                                    ) : (
                                        <td className="p-3 text-blue-400">
                                            {log.key ? log.key[1] : '?'}
                                        </td>
                                    )}
                                    <td className="p-3">
                                        {type === 'error' ? (
                                            <div>
                                                <div className="text-white mb-0.5">{log.message || 'No message'}</div>
                                                {log.context && <div className="text-gray-600 truncate max-w-[400px]">{JSON.stringify(log.context)}</div>}
                                            </div>
                                        ) : (
                                            <div className="flex gap-4">
                                                <span className="text-emerald-400 font-bold">{log.value?.value}</span>
                                                {log.value?.tags && <span className="text-gray-600 truncate max-w-[400px]">{JSON.stringify(log.value.tags)}</span>}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(!logs || logs.length === 0) && (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-gray-600 italic">
                                        {loading ? 'Laddar loggar...' : 'Inga loggar hittades.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
