import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface CoverageRow {
    file: string;
    branch: string;
    function: string;
    line: string;
}

interface CoverageData {
    total: { branch: string; function: string; line: string };
    files: CoverageRow[];
    raw: string;
}

interface HistoryEntry {
    date: string;
    branch: number;
    function: number;
    line: number;
}

export function DeveloperCoverage() {
    const { token } = useAuth();
    const [data, setData] = useState<CoverageData | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/developer/coverage/history', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const json = await res.ok ? await res.json() : { history: [] };
            if (json.history) {
                setHistory(json.history);
            }
        } catch (e) {
            console.error("Failed to fetch coverage history:", e);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const runCoverage = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/developer/coverage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to run coverage');
            setData(json);
            await fetchHistory();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const getCoverageColor = (percentStr: string | number) => {
        const p = typeof percentStr === 'number' ? percentStr : parseFloat(percentStr);
        if (isNaN(p)) return 'text-slate-400';
        if (p >= 80) return 'text-emerald-400';
        if (p >= 50) return 'text-amber-400';
        return 'text-rose-400';
    };

    const formatLocalTime = (isoString: string) => {
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }) + ' ' +
                   d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return isoString;
        }
    };

    // Prepare history data for the line chart
    const chartData = history.map(h => ({
        ...h,
        formattedDate: formatLocalTime(h.date)
    }));

    // Detect active stats to show in summary cards (on-demand loaded data, or latest from history)
    const latestHistoryEntry = history.length > 0 ? history[history.length - 1] : null;
    const activeTotal = data ? data.total : (latestHistoryEntry ? {
        line: latestHistoryEntry.line.toString(),
        branch: latestHistoryEntry.branch.toString(),
        function: latestHistoryEntry.function.toString()
    } : null);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Code Coverage</h1>
                    <p className="text-slate-400 text-sm">Kör testsviten och analysera kodtäckning för hjälputiliteter och funktioner.</p>
                </div>
                <button
                    onClick={runCoverage}
                    disabled={loading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/10"
                >
                    {loading ? (
                        <>
                            <span className="animate-spin inline-block">⏳</span> Kör tester...
                        </>
                    ) : (
                        <>
                            <span>🚀</span> Run Analysis
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 whitespace-pre-wrap font-mono text-xs">
                    {error}
                </div>
            )}

            {/* Summary Cards */}
            {activeTotal && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Line Coverage</span>
                        <div className={`text-3xl font-black ${getCoverageColor(activeTotal.line)}`}>
                            {parseFloat(activeTotal.line).toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Branch Coverage</span>
                        <div className={`text-3xl font-black ${getCoverageColor(activeTotal.branch)}`}>
                            {parseFloat(activeTotal.branch).toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute top-0 left-0 w-1 h-full bg-violet-500"></div>
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Function Coverage</span>
                        <div className={`text-3xl font-black ${getCoverageColor(activeTotal.function)}`}>
                            {parseFloat(activeTotal.function).toFixed(1)}%
                        </div>
                    </div>
                </div>
            )}

            {/* Coverage Trend Chart */}
            {history.length > 0 && (
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-6 shadow-xl backdrop-blur-sm">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span>📈</span> Utvecklingstrend över tid
                    </h2>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.2)" />
                                <XAxis 
                                    dataKey="formattedDate" 
                                    stroke="#64748b" 
                                    fontSize={10} 
                                    tickLine={false} 
                                />
                                <YAxis 
                                    domain={[0, 100]} 
                                    stroke="#64748b" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: '#0f172a', 
                                        border: '1px solid rgb(51, 65, 85)', 
                                        borderRadius: '8px',
                                        color: '#e2e8f0',
                                        fontSize: '11px',
                                        fontFamily: 'sans-serif'
                                    }} 
                                />
                                <Legend 
                                    verticalAlign="top" 
                                    height={36} 
                                    iconType="circle" 
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="line" 
                                    name="Line Coverage" 
                                    stroke="#10b981" 
                                    strokeWidth={3} 
                                    activeDot={{ r: 5 }} 
                                    dot={{ r: 2 }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="branch" 
                                    name="Branch Coverage" 
                                    stroke="#06b6d4" 
                                    strokeWidth={2} 
                                    dot={{ r: 2 }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="function" 
                                    name="Function Coverage" 
                                    stroke="#8b5cf6" 
                                    strokeWidth={2} 
                                    dot={{ r: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Split Grid for Breakdown vs History Log */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* File breakdown (if data exists) */}
                {data ? (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 shadow-xl flex flex-col max-h-[420px]">
                        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                            <span>📁</span> Per-file täckning
                        </h2>
                        <div className="overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-900/40 text-slate-400 uppercase tracking-wider font-mono text-[9px] sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3">Fil</th>
                                        <th className="p-3 text-right">Line %</th>
                                        <th className="p-3 text-right">Branch %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {data.files.map((row) => (
                                        <tr key={row.file} className="hover:bg-slate-700/20 transition-colors">
                                            <td className="p-2.5 font-mono text-slate-300 truncate max-w-[220px]" title={row.file}>
                                                {row.file.replace(/^src\//, '')}
                                            </td>
                                            <td className={`p-2.5 text-right font-bold ${getCoverageColor(row.line)}`}>
                                                {parseFloat(row.line).toFixed(1)}%
                                            </td>
                                            <td className={`p-2.5 text-right font-bold ${getCoverageColor(row.branch)}`}>
                                                {parseFloat(row.branch).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-800/25 border border-slate-700/40 rounded-xl p-6 shadow-xl flex flex-col items-center justify-center text-center text-slate-400 min-h-[300px]">
                        <span className="text-3xl mb-2">📊</span>
                        <h3 className="font-bold text-slate-300 mb-1">Detaljerad analys ej laddad</h3>
                        <p className="text-xs text-slate-400 max-w-[280px]">
                            Klicka på "Run Analysis" ovan för att starta en on-demand testkörning och se täckning per fil.
                        </p>
                    </div>
                )}

                {/* History List */}
                {history.length > 0 ? (
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 shadow-xl flex flex-col max-h-[420px]">
                        <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                            <span>⏳</span> Historiska körningar
                        </h2>
                        <div className="overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-900/40 text-slate-400 uppercase tracking-wider font-mono text-[9px] sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3">Datum & Tid</th>
                                        <th className="p-3 text-right">Line %</th>
                                        <th className="p-3 text-right">Branch %</th>
                                        <th className="p-3 text-right">Func %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {history.slice().reverse().map((run, idx) => (
                                        <tr key={idx} className="hover:bg-slate-700/20 transition-colors">
                                            <td className="p-2.5 text-slate-400 font-mono text-[10px]">
                                                {formatLocalTime(run.date)}
                                            </td>
                                            <td className={`p-2.5 text-right font-semibold ${getCoverageColor(run.line)}`}>
                                                {run.line.toFixed(1)}%
                                            </td>
                                            <td className={`p-2.5 text-right font-semibold ${getCoverageColor(run.branch)}`}>
                                                {run.branch.toFixed(1)}%
                                            </td>
                                            <td className={`p-2.5 text-right font-semibold ${getCoverageColor(run.function)}`}>
                                                {run.function.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-800/25 border border-slate-700/40 rounded-xl p-6 shadow-xl flex flex-col items-center justify-center text-center text-slate-400 min-h-[300px]">
                        <span className="text-3xl mb-2">⏳</span>
                        <h3 className="font-bold text-slate-300 mb-1">Ingen historik tillgänglig</h3>
                        <p className="text-xs text-slate-400 max-w-[280px]">
                            Kör tester via "Run Analysis" eller kör <code>deno task test</code> i terminalen för att bygga upp historiken.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
