import React, { useEffect, useState } from 'react';

// Types (mirrors backend)
interface ClientError {
    message: string;
    source?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    timestamp: string;
    userAgent: string;
    ip: string;
}

interface Session {
    id: string;
    ip: string;
    userAgent: string;
    firstSeen: string;
    lastSeen: string;
    path: string;
    method: string;
    errorCount: number;
}

export function SessionsModule() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [errors, setErrors] = useState<ClientError[]>([]);
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setError(null);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const res = await fetch('/api/admin/sessions', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

            const data = await res.json();
            setSessions(data.sessions);
            setErrors(data.errors);
        } catch (e) {
            console.error("Failed to fetch sessions", e);
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const timeAgo = (isoDate: string) => {
        const diff = Date.now() - new Date(isoDate).getTime();
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    if (loading && sessions.length === 0) return <div className="p-8 text-center text-gray-500">Laddar sessioner...</div>;

    if (error && sessions.length === 0) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-400 mb-2">Ett fel inträffade vid laddning av sessioner</div>
                <div className="text-xs font-mono bg-slate-900 inline-block px-2 py-1 rounded text-red-300">{error}</div>
                <button onClick={fetchData} className="block mx-auto mt-4 text-blue-400 hover:text-blue-300 text-sm">Försök igen</button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Active Sessions */}
            <section className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <span className="p-2 bg-blue-500/10 rounded-lg text-blue-400">📡</span>
                        Aktiva Sessioner
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-gray-400">{sessions.length}</span>
                    </h2>
                    <button onClick={fetchData} className="text-xs text-blue-400 hover:text-blue-300">Uppdatera nu</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-gray-500 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-[10px] uppercase">Senast Aktiv</th>
                                <th className="px-4 py-3 font-semibold text-[10px] uppercase">IP Address</th>
                                <th className="px-4 py-3 font-semibold text-[10px] uppercase">Enhet / Webbläsare</th>
                                <th className="px-4 py-3 font-semibold text-[10px] uppercase">Sista Väg</th>
                                <th className="px-4 py-3 font-semibold text-[10px] uppercase">Fel</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {sessions.map(s => {
                                const isFresh = (Date.now() - new Date(s.lastSeen).getTime()) < 60000; // < 1 min
                                return (
                                    <tr key={s.id} className={`hover:bg-white/[0.02] transition-colors ${isFresh ? 'bg-emerald-500/5' : ''}`}>
                                        <td className="px-4 py-3 text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${isFresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`} />
                                                {timeAgo(s.lastSeen)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-400 text-xs">{s.ip}</td>
                                        <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate" title={s.userAgent}>
                                            {s.userAgent.includes("Mobile") ? "📱 Mobile" : "💻 Desktop"}
                                            <span className="opacity-50 ml-1">
                                                {s.userAgent.includes("Chrome") ? "Chrome" : s.userAgent.includes("Safari") ? "Safari" : "Other"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono text-blue-400">{s.method} {s.path}</td>
                                        <td className="px-4 py-3">
                                            {s.errorCount > 0 ? (
                                                <span className="text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-full text-xs">{s.errorCount} fel</span>
                                            ) : (
                                                <span className="text-emerald-500/50 text-xs">OK</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Client Errors */}
            <section className="bg-red-950/20 rounded-3xl border border-red-900/30 p-6 md:p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <span className="p-2 bg-red-500/10 rounded-lg text-red-400">🚨</span>
                        Rapporterade Klientfel
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded-full text-gray-400">{errors.length}</span>
                    </h2>
                </div>

                <div className="space-y-4">
                    {errors.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">Inga fel rapporterade än. (Hoppas det förblir så!)</div>
                    ) : (
                        errors.map((err, i) => (
                            <div key={i} className="bg-slate-900 border border-red-900/30 p-4 rounded-xl space-y-2">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-red-400 font-bold text-sm font-mono break-all">{err.message}</h3>
                                    <span className="text-[10px] text-gray-500 whitespace-nowrap">{timeAgo(err.timestamp)}</span>
                                </div>
                                <div className="text-xs text-gray-400 flex gap-4">
                                    <span>{err.source}:{err.lineno}:{err.colno}</span>
                                    <span>IP: {err.ip}</span>
                                </div>
                                {err.stack && (
                                    <pre className="mt-2 p-2 bg-black/50 rounded-lg text-[10px] text-gray-500 overflow-x-auto font-mono">
                                        {err.stack}
                                    </pre>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
