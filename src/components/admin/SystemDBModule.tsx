import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type Tab = 'overview' | 'users' | 'explorer';

export const SystemDBModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    return (
        <div className="space-y-6">
            <div className="flex gap-4 border-b border-slate-800 pb-2 overflow-x-auto">
                {(['overview', 'users', 'explorer'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === tab
                            ? 'bg-slate-800 text-white'
                            : 'text-gray-500 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        {tab === 'overview' && '📊 Översikt'}
                        {tab === 'users' && '👥 Användardata'}
                        {tab === 'explorer' && '📂 Utforskare'}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'explorer' && <ExplorerTab />}
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
        return Object.entries(data.stats.byPrefix).map(([name, val]: [string, any]) => ({
            name,
            value: val.size,
            count: val.count
        })).sort((a, b) => b.value - a.value);
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Totala Nycklar</div>
                    <div className="text-4xl font-black text-white">{totalKeys.toLocaleString()}</div>
                    <div className="text-emerald-400 text-xs mt-2 font-mono flex items-center gap-1">
                        <span>↑</span> +{data.history?.length > 1 ? (totalKeys - data.history[data.history.length - 2].stats.totalKeys) : 0} sen igår
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Storlek (Est.)</div>
                    <div className="text-4xl font-black text-white">{(totalSize / 1024).toFixed(1)} <span className="text-lg text-gray-500">KB</span></div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Snapshots</div>
                    <div className="text-4xl font-black text-blue-400">{data.history?.length || 0}</div>
                    <div className="text-gray-500 text-xs mt-2 font-mono">Dagar spårad historik</div>
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
                                    formatter={(value: number) => [(value / 1024).toFixed(1) + ' KB', 'Size']}
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
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => (v / 1024).toFixed(0) + 'KB'} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
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
                                            <td className="p-3 text-right font-mono text-red-200">{o.size} B</td>
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
                                const topPrefix = Object.entries(u.prefixes).sort(([,a]: any, [,b]: any) => b - a)[0];
                                return (
                                    <tr key={u.userId} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div className="font-bold text-white text-base">{u.username}</div>
                                            <div className="font-mono text-xs opacity-50">{u.userId}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-white">{u.keyCount}</td>
                                        <td className="p-4 text-right font-mono text-emerald-400 font-bold">
                                            {(u.totalSize / 1024).toFixed(2)} KB
                                        </td>
                                        <td className="p-4">
                                            {topPrefix ? (
                                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-xs font-mono border border-slate-700">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    {topPrefix[0]} ({(Number(topPrefix[1]) / 1024).toFixed(1)} KB)
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

const ExplorerTab: React.FC = () => {
    const [path, setPath] = useState<string[]>([]);
    const [data, setData] = useState<{ subPrefixes: string[], keys: any[] } | null>(null);
    const [loading, setLoading] = useState(false);
    const [viewingValue, setViewingValue] = useState<{ key: any, value: any } | null>(null);

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
    };

    const handleBreadcrumbClick = (index: number) => {
        setPath(path.slice(0, index + 1));
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

    return (
        <div className="flex gap-6 h-[600px] animate-in fade-in duration-300">
            {/* Explorer Column */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
                {/* Breadcrumbs */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-2 text-sm overflow-x-auto">
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

                {/* Content List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Laddar...</div>
                    ) : (
                        <div className="space-y-1">
                            {/* Directories */}
                            {data?.subPrefixes.map((prefix) => (
                                <div
                                    key={prefix}
                                    onClick={() => handleNavigate(prefix)}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 cursor-pointer group transition-colors"
                                >
                                    <span className="text-xl text-amber-400 group-hover:scale-110 transition-transform">📁</span>
                                    <span className="font-mono text-sm text-gray-300 group-hover:text-white font-bold">{prefix}</span>
                                </div>
                            ))}

                            {/* Files */}
                            {data?.keys.map((item, i) => (
                                <div
                                    key={i}
                                    onClick={() => handleViewValue(item.key)}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/50 cursor-pointer group transition-colors"
                                >
                                    <span className="text-xl text-blue-400 group-hover:scale-110 transition-transform">📄</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono text-sm text-gray-300 group-hover:text-white truncate">
                                            {String(item.key[item.key.length - 1])}
                                        </div>
                                        <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                                            Full Key: {JSON.stringify(item.key)}
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500">{item.size} B</span>
                                </div>
                            ))}

                            {data?.subPrefixes.length === 0 && data?.keys.length === 0 && (
                                <div className="text-center p-8 text-gray-500 italic">
                                    Tom mapp.
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
                    <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
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
